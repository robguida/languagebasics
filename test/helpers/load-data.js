/* Test helper (LB-42): read the lesson data the way the build does, so the
 * tests take their languages, lessons, counts and parked flags from
 * data/*.json instead of typed-in numbers.
 *
 * It uses the build script's own parser (scripts/build-data.js parseSources),
 * so a test can never read the data differently from the build.
 *
 * Two "worlds" run the same checks:
 *   repoWorld()    the real data/*.json and the committed generated files on
 *                  disk (loaded with the same vm loader as load-lesson.js).
 *   fixtureWorld() the real data/*.json PLUS the made-up language in
 *                  test/fixtures/data-extra/, built in memory (nothing is
 *                  written). It proves a 5th language passes every
 *                  data-driven test with no test edits.
 *
 * Node built-ins only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const build = require("../../scripts/build-data.js");
const { loadLesson: loadLessonFile, loadManifest: loadManifestFiles } = require("./load-lesson.js");

const ROOT = build.ROOT;
const DATA_DIR = build.DATA_DIR;
const FIXTURE_DATA_DIR = path.resolve(__dirname, "..", "fixtures", "data-extra");
const SHIPPED_IDS_FILE = path.resolve(__dirname, "..", "fixtures", "shipped-lesson-ids.json");
const CARD_ID_MARKS_FILE = path.resolve(__dirname, "..", "fixtures", "card-id-high-marks.json");
const MANIFEST_JS = path.join(ROOT, "src", "manifest.js");

/** Every data source from the given folders, in folder order. */
function readAll(dirs) {
  const out = [];
  for (const dir of dirs) out.push(...build.readSources(dir));
  return out;
}

/** Throw one error that lists every data problem (the test file then fails loudly). */
function failOnErrors(result, dirs) {
  if (result.errors.length || result.failed > 0 || result.succeeded === 0) {
    throw new Error(`lesson data in ${dirs.join(", ")} did not pass the build's checks:\n  ` +
      (result.errors.length ? result.errors.join("\n  ") : "no language files found"));
  }
}

/**
 * The data as the tests use it.
 * @param {Array<{name: string, text?: string, readError?: string}>} sources
 * @returns {{ languages: object[], lessons: object[], live: object[], parked: object[],
 *   byId: Map<string, object>, docs: object[] }}
 *   languages: [{ code, name, order, defaultLesson ("code/slug"), groups: [{ label, lessons }] }]
 *   lessons:   [{ id, code, slug, file, group, label, title, parked, count, revealMs, rollup, recallPrompt }]
 *              in language order, then data order.
 *   docs:      the raw parsed JSON of each file (for checks on card ids, which the build
 *              never writes out).
 */
function dataFromSources(sources, dirs) {
  const parsed = build.parseSources(sources);
  failOnErrors(parsed, dirs);
  const languages = [];
  const lessons = [];
  for (const m of parsed.models) {
    const lang = { code: m.code, name: m.name, order: m.order, defaultLesson: m.code + "/" + m.defaultLesson, ipStatus: m.ip && m.ip.status, groups: [] };
    for (const g of m.groups) {
      const group = { label: g.label, lessons: [] };
      for (const l of g.lessons) {
        const row = {
          id: m.code + "/" + l.slug,
          code: m.code,
          slug: l.slug,
          file: l.slug + ".js",
          group: g.label,
          label: l.label,
          title: l.title,
          parked: l.parked,
          count: l.cards.length,
          revealMs: l.revealMs,
          rollup: l.rollup,
          recallPrompt: l.recallPrompt,
        };
        group.lessons.push(row);
        lessons.push(row);
      }
      lang.groups.push(group);
    }
    languages.push(lang);
  }
  const docs = sources.map((s) => JSON.parse(build.normalize(s.text)));
  return {
    languages,
    lessons,
    live: lessons.filter((l) => !l.parked),
    parked: lessons.filter((l) => l.parked),
    byId: new Map(lessons.map((l) => [l.id, l])),
    docs,
  };
}

/** The real data/*.json (or other folders). */
function loadData(dirs) {
  const list = dirs || [DATA_DIR];
  return dataFromSources(readAll(list), list);
}

/** Lesson file path, repo-relative, for a data lesson row. */
function generatedPath(row) {
  return `${row.parked ? "parked/content" : "src/content"}/${row.code}/${row.file}`;
}

/** Run one lesson file's text the way load-lesson.js does. */
function runLessonText(text, filename) {
  const windowShim = { LB_LESSONS: [] };
  const sandbox = { window: windowShim, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(text, sandbox, { filename });
  return { lesson: windowShim.LB_LESSON, lessonsIndex: windowShim.LB_LESSONS };
}

/** Run languages.js text + the real src/manifest.js, as index.html does. */
function runManifestText(languagesText) {
  const windowShim = {};
  const sandbox = { window: windowShim, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(languagesText, sandbox, { filename: "content/languages.js" });
  vm.runInContext(fs.readFileSync(MANIFEST_JS, "utf8"), sandbox, { filename: MANIFEST_JS });
  return { languages: windowShim.LB_LANGUAGES || [], LBManifest: windowShim.LBManifest };
}

/** The real repo: data/*.json and the committed files on disk. */
function repoWorld() {
  const data = loadData([DATA_DIR]);
  return {
    name: "repo",
    tag: "",
    data,
    /** @param row a data lesson row */
    loadLesson: (row) => loadLessonFile(row.file, row.code, { parked: row.parked }),
    loadManifest: () => loadManifestFiles(),
    exists: (rel) => fs.existsSync(path.join(ROOT, rel)),
  };
}

/** The real data plus the made-up language, generated in memory. */
function fixtureWorld() {
  const dirs = [DATA_DIR, FIXTURE_DATA_DIR];
  const sources = readAll(dirs);
  const data = dataFromSources(sources, dirs);
  const gen = build.generateFromSources(sources);
  failOnErrors(gen, dirs);
  const files = gen.files;
  const has = (rel) => Object.prototype.hasOwnProperty.call(files, rel);
  return {
    name: "fixture",
    tag: "[+made-up language] ",
    data,
    files,
    loadLesson: (row) => {
      const rel = generatedPath(row);
      if (!has(rel)) throw new Error(`${rel} was not generated`);
      return runLessonText(files[rel], rel);
    },
    loadManifest: () => runManifestText(files["src/content/languages.js"]),
    exists: has,
  };
}

/** The shipped lesson ids (test/fixtures/shipped-lesson-ids.json), in order. */
function shippedLessonIds() {
  return JSON.parse(fs.readFileSync(SHIPPED_IDS_FILE, "utf8")).ids;
}

/** The locked highest card ids (test/fixtures/card-id-high-marks.json): { code: [id, ...] }. */
function cardIdHighMarks() {
  return JSON.parse(fs.readFileSync(CARD_ID_MARKS_FILE, "utf8")).highest;
}

module.exports = {
  loadData,
  repoWorld,
  fixtureWorld,
  shippedLessonIds,
  cardIdHighMarks,
  generatedPath,
  runLessonText,
  DATA_DIR,
  FIXTURE_DATA_DIR,
  SHIPPED_IDS_FILE,
  CARD_ID_MARKS_FILE,
};
