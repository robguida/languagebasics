/* LB-41: tests for scripts/build-data.js (lesson data in data/*.json).
 *
 * Run:  node --test
 *
 * 1. The committed src/content, parked/content and languages.js files match
 *    data/*.json exactly (the same check as `npm run check:data`).
 * 2. The validator catches each rule of the JSON format, and names the file and
 *    the place in it.
 * 3. Loops continue on error: 2 bad files + 1 good file give failed 2,
 *    succeeded 1, and nothing is written.
 * 4. Card ids are unique, valid, not retired, and never written to src/.
 * 5. cardRefs resolve to the real cards.
 * 6. write()/check(): unchanged files are left alone, CRLF and BOM compare
 *    equal, a failed temp write changes nothing, and only banner-carrying stale
 *    files are deleted. These use an in-memory fake file system (no temp
 *    folders on disk).
 * Built-ins only.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const build = require("../scripts/build-data.js");

const { ROOT, DATA_DIR, BANNER, CARD_ID_RE } = build;

/* ---------------------------------------------------------------- fixtures */

/** A small valid language file. Each call returns a fresh copy. */
function fixture(code, order) {
  return {
    format: "languagebasics-lessons",
    formatVersion: 1,
    language: { code, name: "Test " + code, order, defaultLesson: "lesson-1" },
    notes: ["a note"],
    retiredCardIds: ["lesson-1.009"],
    groups: [
      {
        label: "Numbers",
        notes: [],
        lessons: [
          {
            slug: "lesson-1", label: "Lesson 1", title: "One", revealMs: 5000, rollup: true, notes: ["n"],
            cards: [
              { id: "lesson-1.001", prompt: 0, answer: "zero", hint: "Zee" },
              { id: "lesson-1.002", prompt: "1", answer: "one", hint: "Wun", audio: "" },
            ],
          },
          {
            slug: "lesson-2", parked: true, label: "Lesson 2", title: "Two", revealMs: 10000, rollup: true,
            cards: [{ id: "lesson-2.001", prompt: 2, answer: "two", hint: "Too" }],
          },
        ],
      },
      {
        label: "Parked only",
        lessons: [
          {
            slug: "lesson-3", parked: true, label: "Lesson 3", title: "Three", rollup: true,
            cards: [{ id: "lesson-3.001", prompt: 3, answer: "three", hint: "Three" }],
          },
        ],
      },
      {
        label: "Words",
        lessons: [
          {
            slug: "words-1", label: "W1", title: "Words \"1\"", revealMs: 5000, rollup: false, recallPrompt: "Say it.",
            cards: [{ id: "words-1.001", prompt: "Hi", answer: "a | b", hint: "Hy" }],
          },
          { slug: "all", label: "All", title: "All", revealMs: 5000, rollup: false, cardRefs: ["lesson-1.002", "words-1.001"] },
        ],
      },
    ],
  };
}

function src(name, doc) {
  return { name, text: typeof doc === "string" ? doc : JSON.stringify(doc, null, 2) };
}

function genOne(doc, name) {
  return build.generateFromSources([src(name || "xx.json", doc)]);
}

/** Load a generated lesson file's text the way the browser would. */
function runLesson(text) {
  const w = { LB_LESSONS: [] };
  const sandbox = { window: w };
  vm.createContext(sandbox);
  vm.runInContext(text, sandbox);
  return structuredClone({ lesson: w.LB_LESSON, index: w.LB_LESSONS });
}

/* ------------------------------------------------------------ 1. the repo */

test("check:data: the committed generated files match data/*.json", () => {
  const r = build.generate(DATA_DIR);
  assert.deepEqual(r.errors, []);
  assert.equal(r.failed, 0);
  assert.equal(r.succeeded, fs.readdirSync(DATA_DIR).filter((n) => n.endsWith(".json")).length);
  const c = build.check(r.files, ROOT);
  assert.deepEqual(c, { differs: [], missing: [], stale: [] },
    "generated files are out of date: run npm run build:data");
});

test("generated files: banner, LF only, no BOM, newline at the end, deterministic", () => {
  const a = build.generate(DATA_DIR).files;
  const b = build.generate(DATA_DIR).files;
  assert.deepEqual(a, b, "two runs must give the same bytes");
  for (const [rel, text] of Object.entries(a)) {
    assert.ok(text.startsWith(BANNER), `${rel} must start with the GENERATED banner`);
    assert.ok(!text.includes("\r"), `${rel} must use LF endings`);
    assert.ok(!text.startsWith("﻿"), `${rel} must have no BOM`);
    assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"), `${rel} must end with one newline`);
  }
});

test("the banner holds no data text", () => {
  const lines = BANNER.trimEnd().split("\n");
  assert.equal(lines.length, 2);
  assert.match(BANNER, /GENERATED/);
});

/* ----------------------------------------------------- the output template */

test("template: lesson file layout and key order", () => {
  const r = genOne(fixture("xx", 1));
  assert.deepEqual(r.errors, []);
  assert.equal(r.files["src/content/xx/words-1.js"], BANNER + [
    "window.LB_LESSON = {",
    '  id: "xx/words-1",',
    '  title: "Words \\"1\\"",',
    "  revealMs: 5000,",
    "  rollup: false,",
    '  recallPrompt: "Say it.",',
    "  cards: [",
    '    { prompt: "Hi", answer: "a | b", hint: "Hy", audio: "" }',
    "  ]",
    "};",
    '(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "xx/words-1", title: "Words \\"1\\"", rollup: false });',
    "",
  ].join("\n"));

  // rollup:true leaves rollup off both objects; a number prompt stays a number.
  const one = runLesson(r.files["src/content/xx/lesson-1.js"]);
  assert.deepEqual(Object.keys(one.lesson), ["id", "title", "revealMs", "cards"]);
  assert.deepEqual(one.index, [{ id: "xx/lesson-1", title: "One" }]);
  assert.deepEqual(one.lesson.cards, [
    { prompt: 0, answer: "zero", hint: "Zee", audio: "" },
    { prompt: "1", answer: "one", hint: "Wun", audio: "" },
  ]);

  // revealMs left out of the JSON is left out of the file.
  const three = runLesson(r.files["parked/content/xx/lesson-3.js"]);
  assert.equal("revealMs" in three.lesson, false);
});

test("template: parked lessons go to parked/ and stay out of languages.js", () => {
  const r = genOne(fixture("xx", 1));
  assert.ok(r.files["parked/content/xx/lesson-2.js"]);
  assert.ok(r.files["parked/content/xx/lesson-3.js"]);
  assert.equal(r.files["src/content/xx/lesson-2.js"], undefined);
  const w = {};
  const sandbox = { window: w };
  vm.createContext(sandbox);
  vm.runInContext(r.files["src/content/languages.js"], sandbox);
  const langs = structuredClone(w.LB_LANGUAGES);
  assert.deepEqual(langs, [{
    code: "xx",
    name: "Test xx",
    defaultLesson: "xx/lesson-1",
    groups: [
      { label: "Numbers", lessons: [{ id: "xx/lesson-1", label: "Lesson 1", count: 2, rollup: true }] },
      // "Parked only" has no live lesson, so the group is left out.
      { label: "Words", lessons: [
        { id: "xx/words-1", label: "W1", count: 1, rollup: false },
        { id: "xx/all", label: "All", count: 2, rollup: false },
      ] },
    ],
  }]);
});

test("languages follow their order field, not the file name", () => {
  const r = build.generateFromSources([src("aa.json", fixture("aa", 2)), src("zz.json", fixture("zz", 1))]);
  assert.deepEqual(r.errors, []);
  const w = {};
  const sandbox = { window: w };
  vm.createContext(sandbox);
  vm.runInContext(r.files["src/content/languages.js"], sandbox);
  assert.deepEqual(structuredClone(w.LB_LANGUAGES).map((l) => l.code), ["zz", "aa"]);
});

/* -------------------------------------------------------- 2. the validator */

const lessonAt = (d, g, l) => d.groups[g].lessons[l];
const cardAt = (d, c) => d.groups[0].lessons[0].cards[c];

const RULES = [
  ["format must be the format name", (d) => { d.format = "other"; }, "format"],
  ["formatVersion must be 1", (d) => { d.formatVersion = 2; }, "formatVersion"],
  ["unknown top-level key", (d) => { d.grups = []; }, "grups"],
  ["code must be plain a-z0-9", (d) => { d.language.code = "X-1"; }, "language.code"],
  ["code must equal the file name", (d) => { d.language.code = "yy"; }, "language.code"],
  ["unknown language key", (d) => { d.language.dialect = "tosk"; }, "language.dialect"],
  ["name must be a string", (d) => { d.language.name = ""; }, "language.name"],
  ["order must be a positive integer (0)", (d) => { d.language.order = 0; }, "language.order"],
  ["order must be a positive integer (1.5)", (d) => { d.language.order = 1.5; }, "language.order"],
  ["defaultLesson must exist", (d) => { d.language.defaultLesson = "lesson-9"; }, "language.defaultLesson"],
  ["defaultLesson must be live", (d) => { d.language.defaultLesson = "lesson-2"; }, "language.defaultLesson"],
  ["notes must be strings", (d) => { d.notes = [1]; }, "notes[0]"],
  ["retiredCardIds must be ids", (d) => { d.retiredCardIds = ["zero"]; }, "retiredCardIds[0]"],
  ["groups must not be empty", (d) => { d.groups = []; }, "groups"],
  ["group label must be a string", (d) => { d.groups[0].label = 3; }, "groups[0].label"],
  ["group lessons must not be empty", (d) => { d.groups[1].lessons = []; }, "groups[1].lessons"],
  ["unknown group key", (d) => { d.groups[0].lable = "x"; }, "groups[0].lable"],
  ["slug must be plain a-z0-9", (d) => { lessonAt(d, 0, 0).slug = "Lesson_1"; d.language.defaultLesson = "Lesson_1"; }, "groups[0].lessons[0].slug"],
  ["slug must not hold a path", (d) => { lessonAt(d, 2, 0).slug = "../x"; }, "groups[2].lessons[0].slug"],
  ["slug must be unique", (d) => { lessonAt(d, 2, 0).slug = "lesson-1"; }, "groups[2].lessons[0].slug"],
  ["rollup must be a boolean", (d) => { lessonAt(d, 0, 0).rollup = "yes"; }, "groups[0].lessons[0].rollup"],
  ["rollup is required", (d) => { delete lessonAt(d, 0, 0).rollup; }, "groups[0].lessons[0].rollup"],
  ["revealMs must be a positive integer", (d) => { lessonAt(d, 0, 0).revealMs = -1; }, "groups[0].lessons[0].revealMs"],
  ["recallPrompt must be a string", (d) => { lessonAt(d, 2, 0).recallPrompt = 5; }, "groups[2].lessons[0].recallPrompt"],
  ["parked must be a boolean", (d) => { lessonAt(d, 0, 1).parked = "no"; }, "groups[0].lessons[1].parked"],
  ["title must be a string", (d) => { lessonAt(d, 0, 0).title = ""; }, "groups[0].lessons[0].title"],
  ["label must be a string", (d) => { delete lessonAt(d, 0, 0).label; }, "groups[0].lessons[0].label"],
  ["unknown lesson key (typo)", (d) => { lessonAt(d, 0, 0).titel = "x"; }, "groups[0].lessons[0].titel"],
  ["not both cards and cardRefs", (d) => { lessonAt(d, 2, 1).cards = []; }, "groups[2].lessons[1]"],
  ["one of cards or cardRefs", (d) => { delete lessonAt(d, 0, 0).cards; }, "groups[0].lessons[0]"],
  ["cards must not be empty", (d) => { lessonAt(d, 0, 0).cards = []; }, "groups[0].lessons[0].cards"],
  ["unknown card key (typo)", (d) => { cardAt(d, 0).hnt = "x"; }, "groups[0].lessons[0].cards[0].hnt"],
  ["card id is required", (d) => { delete cardAt(d, 0).id; }, "groups[0].lessons[0].cards[0].id"],
  ["card id is never the card text", (d) => { cardAt(d, 0).id = "zero"; }, "groups[0].lessons[0].cards[0].id"],
  ["card id must be unique", (d) => { cardAt(d, 1).id = "lesson-1.001"; }, "groups[0].lessons[0].cards[1].id"],
  ["card id unique across lessons", (d) => { lessonAt(d, 0, 1).cards[0].id = "lesson-1.001"; }, "groups[0].lessons[1].cards[0].id"],
  ["retired card id is never reused", (d) => { cardAt(d, 1).id = "lesson-1.009"; }, "groups[0].lessons[0].cards[1].id"],
  ["prompt must be a string or number", (d) => { cardAt(d, 0).prompt = { n: 0 }; }, "groups[0].lessons[0].cards[0].prompt"],
  ["prompt is required", (d) => { delete cardAt(d, 0).prompt; }, "groups[0].lessons[0].cards[0].prompt"],
  ["answer must be non-empty", (d) => { cardAt(d, 0).answer = ""; }, "groups[0].lessons[0].cards[0].answer"],
  ["hint must be a string", (d) => { delete cardAt(d, 0).hint; }, "groups[0].lessons[0].cards[0].hint"],
  ["audio must be a string", (d) => { cardAt(d, 0).audio = 1; }, "groups[0].lessons[0].cards[0].audio"],
  ["cardRefs must resolve", (d) => { lessonAt(d, 2, 1).cardRefs[0] = "lesson-1.099"; }, "groups[2].lessons[1].cardRefs[0]"],
  ["cardRefs must not repeat", (d) => { lessonAt(d, 2, 1).cardRefs[1] = "lesson-1.002"; }, "groups[2].lessons[1].cardRefs[1]"],
  ["cardRefs must be ids", (d) => { lessonAt(d, 2, 1).cardRefs[0] = 7; }, "groups[2].lessons[1].cardRefs[0]"],
  ["lesson notes must be strings", (d) => { lessonAt(d, 0, 0).notes = "n"; }, "groups[0].lessons[0].notes"],
];

for (const [name, mutate, place] of RULES) {
  test(`validator: ${name}`, () => {
    const doc = fixture("xx", 1);
    mutate(doc);
    const r = genOne(doc);
    assert.equal(r.failed, 1, "the file must fail");
    assert.equal(r.succeeded, 0);
    assert.deepEqual(r.files, {}, "a failed file produces no output");
    const hit = r.errors.find((e) => e.startsWith(`data/xx.json ${place}`));
    assert.ok(hit, `an error must name "data/xx.json ${place}"; got:\n${r.errors.join("\n")}`);
  });
}

test("validator: the good fixture passes", () => {
  const r = genOne(fixture("xx", 1));
  assert.deepEqual(r.errors, []);
  assert.equal(r.succeeded, 1);
  assert.equal(r.failed, 0);
});

test("validator: invalid JSON fails with the file name", () => {
  const r = build.generateFromSources([{ name: "xx.json", text: "{ not json" }]);
  assert.equal(r.failed, 1);
  assert.match(r.errors[0], /^data\/xx\.json: not valid JSON/);
});

test("validator: a file name that is not a language code fails", () => {
  const r = build.generateFromSources([src("Bad Name.json", fixture("xx", 1))]);
  assert.equal(r.failed, 1);
  assert.match(r.errors[0], /^data\/Bad Name\.json: the file name/);
});

test("validator: an unreadable file fails without stopping the rest", () => {
  const r = build.generateFromSources([{ name: "aa.json", readError: "EACCES" }, src("bb.json", fixture("bb", 1))]);
  assert.equal(r.failed, 1);
  assert.equal(r.succeeded, 1);
  assert.match(r.errors[0], /^data\/aa\.json: cannot read file/);
});

test("validator: a BOM or CRLF in a data file is accepted", () => {
  const text = "﻿" + JSON.stringify(fixture("xx", 1), null, 2).replace(/\n/g, "\r\n");
  const r = build.generateFromSources([{ name: "xx.json", text }]);
  assert.deepEqual(r.errors, []);
});

test("validator: two files with the same order both fail", () => {
  const r = build.generateFromSources([src("aa.json", fixture("aa", 1)), src("bb.json", fixture("bb", 1)), src("cc.json", fixture("cc", 2))]);
  assert.equal(r.failed, 2);
  assert.equal(r.succeeded, 1);
  assert.ok(r.errors.some((e) => e.startsWith("data/aa.json language.order")));
  assert.ok(r.errors.some((e) => e.startsWith("data/bb.json language.order")));
});

test("validator: an empty data folder is an error", () => {
  const r = build.generateFromSources([]);
  assert.equal(r.succeeded, 0);
  assert.ok(r.errors.length > 0);
});

/* ----------------------------------------------- 3. loops continue on error */

test("per-card loop continues: every bad card in one file is reported", () => {
  const doc = fixture("xx", 1);
  cardAt(doc, 0).hint = 1;
  cardAt(doc, 1).answer = "";
  lessonAt(doc, 2, 0).cards[0].prompt = null;
  const r = genOne(doc);
  assert.ok(r.errors.some((e) => e.startsWith("data/xx.json groups[0].lessons[0].cards[0].hint")));
  assert.ok(r.errors.some((e) => e.startsWith("data/xx.json groups[0].lessons[0].cards[1].answer")));
  assert.ok(r.errors.some((e) => e.startsWith("data/xx.json groups[2].lessons[0].cards[0].prompt")));
});

test("2 bad files + 1 good: failed 2, succeeded 1, write() never called, exit 1", () => {
  const bad1 = fixture("aa", 1);
  bad1.language.code = "zz";
  const bad2 = fixture("bb", 2);
  cardAt(bad2, 0).hint = 7;
  const good = fixture("cc", 3);
  const logs = [];
  let writes = 0;
  let checks = 0;
  const code = build.main([], {
    readSources: () => [src("aa.json", bad1), src("bb.json", bad2), src("cc.json", good)],
    write: () => { writes++; return { written: [], unchanged: [], deleted: [], keptStale: [] }; },
    check: () => { checks++; return { differs: [], missing: [], stale: [] }; },
    log: (s) => logs.push(s),
    error: (s) => logs.push(s),
  });
  assert.equal(code, 1);
  assert.equal(writes, 0, "write() must never be called when a file failed");
  assert.equal(checks, 0);
  assert.ok(logs.some((s) => s.includes("1 succeeded, 2 failed")), logs.join("\n"));
  assert.ok(logs.some((s) => s.includes("data/aa.json language.code")));
  assert.ok(logs.some((s) => s.includes("data/bb.json groups[0].lessons[0].cards[0].hint")));
  assert.ok(logs.some((s) => s.includes("Nothing was written")));

  const r = build.generateFromSources([src("aa.json", bad1), src("bb.json", bad2), src("cc.json", good)]);
  assert.equal(r.failed, 2);
  assert.equal(r.succeeded, 1);
  assert.equal(r.files["src/content/languages.js"], undefined, "no manifest when any file failed");
});

test("main: --check returns 1 on differences and 0 when clean; unknown option returns 2", () => {
  const quiet = { log() {}, error() {}, readSources: () => [src("xx.json", fixture("xx", 1))] };
  assert.equal(build.main(["--check"], Object.assign({ check: () => ({ differs: ["a"], missing: [], stale: [] }) }, quiet)), 1);
  assert.equal(build.main(["--check"], Object.assign({ check: () => ({ differs: [], missing: [], stale: [] }) }, quiet)), 0);
  assert.equal(build.main(["--nope"], quiet), 2);
});

/* ------------------------------------------------- 4 + 5. ids and cardRefs */

function realDocs() {
  return fs.readdirSync(DATA_DIR).filter((n) => n.endsWith(".json")).sort()
    .map((n) => ({ name: n, doc: JSON.parse(fs.readFileSync(path.join(DATA_DIR, n), "utf8")) }));
}

test("data: card ids are unique, valid and not retired", () => {
  for (const { name, doc } of realDocs()) {
    const retired = new Set(doc.retiredCardIds || []);
    const seen = new Set();
    for (const g of doc.groups) {
      for (const l of g.lessons) {
        for (const c of l.cards || []) {
          assert.match(c.id, CARD_ID_RE, `${name} ${l.slug}: bad id ${c.id}`);
          assert.ok(!seen.has(c.id), `${name}: id ${c.id} is used twice`);
          assert.ok(!retired.has(c.id), `${name}: id ${c.id} is retired`);
          seen.add(c.id);
        }
      }
    }
    assert.ok(seen.size > 0, `${name} must hold cards`);
  }
});

test("data: card ids are never written to src (cards keep prompt, answer, hint, audio)", () => {
  const files = build.generate(DATA_DIR).files;
  for (const [rel, text] of Object.entries(files)) {
    if (rel.endsWith("languages.js")) continue;
    const { lesson } = runLesson(text);
    for (const c of lesson.cards) {
      assert.deepEqual(Object.keys(c), ["prompt", "answer", "hint", "audio"], `${rel}: card keys`);
    }
    assert.ok(!/\.[0-9]{3}"/.test(text), `${rel} must not contain a card id`);
  }
});

test("data: every cardRefs deck resolves to its source cards", () => {
  const files = build.generate(DATA_DIR).files;
  let decks = 0;
  for (const { doc } of realDocs()) {
    const byId = new Map();
    for (const g of doc.groups) for (const l of g.lessons) for (const c of l.cards || []) byId.set(c.id, c);
    for (const g of doc.groups) {
      for (const l of g.lessons) {
        if (!l.cardRefs) continue;
        decks++;
        const base = l.parked ? "parked/content" : "src/content";
        const { lesson } = runLesson(files[`${base}/${doc.language.code}/${l.slug}.js`]);
        assert.equal(lesson.cards.length, l.cardRefs.length);
        l.cardRefs.forEach((ref, i) => {
          const c = byId.get(ref);
          assert.ok(c, `${doc.language.code}/${l.slug}: ref ${ref} must exist`);
          assert.deepEqual(lesson.cards[i], { prompt: c.prompt, answer: c.answer, hint: c.hint, audio: c.audio || "" });
        });
      }
    }
  }
  assert.ok(decks >= 1, "at least one cardRefs deck is expected (the combined alphabets)");
});

/* -------------------------------------------- 6. write() and check() (fake fs) */

const FAKE_ROOT = path.resolve(path.sep, "fake-root");

function fakeFs(initial, opts) {
  const o = opts || {};
  const files = new Map();
  for (const [rel, text] of Object.entries(initial)) files.set(path.join(FAKE_ROOT, rel), text);
  const isDir = (p) => [...files.keys()].some((k) => k.startsWith(p + path.sep));
  const written = [];
  return {
    files,
    written,
    get(rel) { return files.get(path.join(FAKE_ROOT, rel)); },
    existsSync: (p) => files.has(p) || isDir(p),
    readFileSync: (p) => {
      if (!files.has(p)) throw Object.assign(new Error("ENOENT " + p), { code: "ENOENT" });
      return files.get(p);
    },
    writeFileSync: (p, data) => {
      written.push(p);
      if (o.failOnWrite && written.length === o.failOnWrite) throw new Error("disk full");
      files.set(p, String(data));
    },
    renameSync: (a, b) => { files.set(b, files.get(a)); files.delete(a); },
    unlinkSync: (p) => { files.delete(p); },
    mkdirSync: () => {},
    readdirSync: (p) => {
      const names = new Map();
      for (const k of files.keys()) {
        if (!k.startsWith(p + path.sep)) continue;
        const rest = k.slice(p.length + 1).split(path.sep);
        names.set(rest[0], rest.length > 1);
      }
      return [...names].map(([name, dir]) => ({ name, isDirectory: () => dir, isFile: () => !dir }));
    },
  };
}

const GEN_A = BANNER + "a\n";
const GEN_B = BANNER + "b\n";

test("check: CRLF and a BOM compare equal; missing and stale are listed", () => {
  const f = fakeFs({
    "src/content/xx/a.js": "﻿" + GEN_A.replace(/\n/g, "\r\n"),
    "src/content/xx/old.js": BANNER + "old\n",
  });
  const c = build.check({ "src/content/xx/a.js": GEN_A, "src/content/xx/b.js": GEN_B }, FAKE_ROOT, f);
  assert.deepEqual(c, { differs: [], missing: ["src/content/xx/b.js"], stale: ["src/content/xx/old.js"] });
  const d = build.check({ "src/content/xx/a.js": GEN_B }, FAKE_ROOT, f);
  assert.deepEqual(d.differs, ["src/content/xx/a.js"]);
});

test("write: only changed files are written, via temp files then rename", () => {
  const f = fakeFs({
    "src/content/xx/a.js": GEN_A.replace(/\n/g, "\r\n"),
    "src/content/xx/b.js": "old text\n",
  });
  const w = build.write({ "src/content/xx/a.js": GEN_A, "src/content/xx/b.js": GEN_B, "parked/content/xx/c.js": GEN_A }, FAKE_ROOT, f);
  assert.deepEqual(w.written, ["parked/content/xx/c.js", "src/content/xx/b.js"]);
  assert.deepEqual(w.unchanged, ["src/content/xx/a.js"]);
  assert.ok(f.written.every((p) => p.endsWith(".tmp")), "every write goes to a temp file first");
  assert.equal(f.get("src/content/xx/b.js"), GEN_B);
  assert.equal(f.get("parked/content/xx/c.js"), GEN_A);
  assert.equal(f.get("src/content/xx/a.js"), GEN_A.replace(/\n/g, "\r\n"), "an unchanged file is not rewritten");
  assert.ok(![...f.files.keys()].some((k) => k.endsWith(".tmp")), "no temp files are left");
});

test("write: a failed temp write removes the temps and leaves the originals", () => {
  const f = fakeFs({ "src/content/xx/a.js": "old a\n", "src/content/xx/b.js": "old b\n" }, { failOnWrite: 2 });
  assert.throws(() => build.write({ "src/content/xx/a.js": GEN_A, "src/content/xx/b.js": GEN_B }, FAKE_ROOT, f), /nothing was changed/);
  assert.equal(f.get("src/content/xx/a.js"), "old a\n");
  assert.equal(f.get("src/content/xx/b.js"), "old b\n");
  assert.ok(![...f.files.keys()].some((k) => k.endsWith(".tmp")), "temps are removed");
});

test("write: a stale file is deleted only if it carries the GENERATED banner", () => {
  const f = fakeFs({
    "src/content/xx/a.js": GEN_A,
    "src/content/xx/gone.js": BANNER + "gone\n",
    "src/content/yy/gone.js": (BANNER + "gone\n").replace(/\n/g, "\r\n"),
    "src/content/xx/hand.js": "/* hand-written */\n",
  });
  const w = build.write({ "src/content/xx/a.js": GEN_A }, FAKE_ROOT, f);
  assert.deepEqual(w.deleted, ["src/content/xx/gone.js", "src/content/yy/gone.js"]);
  assert.deepEqual(w.keptStale, ["src/content/xx/hand.js"]);
  assert.equal(f.get("src/content/xx/hand.js"), "/* hand-written */\n");
  assert.equal(f.get("src/content/xx/gone.js"), undefined);
});

test("main: a stale hand-written file makes build:data exit 1 after writing", () => {
  const code = build.main([], {
    readSources: () => [src("xx.json", fixture("xx", 1))],
    write: () => ({ written: ["x"], unchanged: [], deleted: [], keptStale: ["src/content/xx/hand.js"] }),
    log() {},
    error() {},
  });
  assert.equal(code, 1);
});
