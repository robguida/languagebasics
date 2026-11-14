#!/usr/bin/env node
/* ONE-OFF converter (LB-41): old hand-written lesson .js files -> data/<code>.json.
 * It is kept in the repo for LB-41 as a record of how the JSON was made, and is
 * deleted in LB-42.
 *
 * Text carries over exactly BY CONSTRUCTION: every old file is run in node:vm
 * with the same window shim as test/helpers/load-lesson.js, and the converter
 * copies the VALUES the browser would see. It never retypes or regex-parses
 * card text. Labels, rollup flags, the default lesson and the language order
 * come from the old src/content/languages.js. The only things read as source
 * text are the comments (the file header and any section comments inside the
 * card list), which go into the lesson's "notes" and are never written to src/.
 *
 * Usage:
 *   node scripts/convert-js-to-json.js [--from <root>] [--parked-manifest <file>]
 *       Reads <root>/src/content and <root>/parked/content (default: this repo)
 *       and writes data/<code>.json. Parked lessons are not in languages.js, so
 *       their label and rollup come from --parked-manifest: a copy of
 *       src/content/languages.js from before they were parked (LB-34).
 *       If any language fails, nothing is written and the exit code is 1.
 *
 *   node scripts/convert-js-to-json.js --verify <saved root>
 *       The data-identical proof. <saved root> holds a copy of src/ and parked/
 *       from before LB-41. For every lesson file and for languages.js it loads
 *       the old and the new copy and checks that LB_LESSON, LB_LESSONS and
 *       LB_LANGUAGES are deep-equal (same values, same types, same keys, same key
 *       order), and that both sides have the same set of files. Prints only
 *       repo-relative paths. Exit 1 on any difference.
 *
 * Node built-ins only.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

/* ------------------------------------------------------------ loading files */

function runInShim(file, preset) {
  const code = fs.readFileSync(file, "utf8");
  const windowShim = Object.assign({ LB_LESSONS: [] }, preset || {});
  const sandbox = { window: windowShim, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: path.basename(file) });
  return windowShim;
}

/** Load one lesson file; returns plain main-realm copies of what it set. */
function loadLessonFile(file) {
  const w = runInShim(file);
  return structuredClone({ LB_LESSON: w.LB_LESSON, LB_LESSONS: w.LB_LESSONS });
}

function loadManifestFile(file) {
  const w = runInShim(file, { LB_LESSONS: undefined });
  return structuredClone(w.LB_LANGUAGES || []);
}

/* --------------------------------------------------------------- comments */

/** Lines of a block comment body, without the comment markers. */
function commentLines(block) {
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  const out = lines.map((line, i) => {
    let s = line;
    if (i === 0) s = s.replace(/^\s*\/\*+ ?/, "");
    else s = s.replace(/^\s*\* ?/, "");
    if (i === lines.length - 1) s = s.replace(/\s*\*+\/\s*$/, "");
    return s.replace(/\s+$/, "");
  });
  while (out.length && out[out.length - 1] === "") out.pop();
  while (out.length && out[0] === "") out.shift();
  return out;
}

/**
 * Comments in an old lesson file: the header block, plus any comment inside
 * the card list, tied to the card that follows it. Each card sits on its own
 * line in every old file; that is checked against the loaded card count.
 */
function readComments(text, cardCount, place) {
  const t = text.replace(/\r\n/g, "\n");
  let header = [];
  if (t.startsWith("/*")) {
    const end = t.indexOf("*/");
    if (end < 0) throw new Error(`${place}: header comment is not closed`);
    header = commentLines(t.slice(0, end + 2));
  }
  const start = t.indexOf("cards: [");
  if (start < 0) throw new Error(`${place}: no "cards: [" found`);
  const body = t.slice(start).split("\n").slice(1);
  const sections = []; // { beforeCard: index, text }
  let cards = 0;
  for (const line of body) {
    const s = line.trim();
    if (s.startsWith("]")) break;
    if (s.startsWith("{")) { cards++; continue; }
    if (s === "") continue;
    const m = /^\/\*\s*(.*?)\s*\*\/$/.exec(s);
    if (m) { sections.push({ beforeCard: cards, text: m[1] }); continue; }
    throw new Error(`${place}: unexpected line in the card list: ${s.slice(0, 40)}`);
  }
  if (cards !== cardCount) throw new Error(`${place}: found ${cards} card lines but the file holds ${cardCount} cards`);
  return { header, sections };
}

/* --------------------------------------------------------------- converting */

const LESSON_KEYS = ["id", "title", "revealMs", "rollup", "recallPrompt", "cards"];
const CARD_KEYS = ["prompt", "answer", "hint", "audio"];

function pad3(n) {
  return String(n).padStart(3, "0");
}

/**
 * Build one lesson's JSON from its old file. Errors are pushed, not thrown.
 * @returns {object|null}
 */
function convertLesson(file, rel, entry, errors) {
  let loaded;
  try {
    loaded = loadLessonFile(file);
  } catch (e) {
    errors.push(`${rel}: cannot load (${e.message})`);
    return null;
  }
  const L = loaded.LB_LESSON;
  const push = loaded.LB_LESSONS;
  const slug = entry.id.split("/")[1];
  const before = errors.length;

  if (!L || !Array.isArray(L.cards)) { errors.push(`${rel}: no window.LB_LESSON with cards`); return null; }
  for (const k of Object.keys(L)) if (!LESSON_KEYS.includes(k)) errors.push(`${rel}: LB_LESSON has an unexpected key "${k}"`);
  if (L.id !== entry.id) errors.push(`${rel}: LB_LESSON.id "${L.id}" does not match "${entry.id}"`);
  if (!Array.isArray(push) || push.length !== 1) errors.push(`${rel}: must push exactly one LB_LESSONS entry`);
  else {
    const p = push[0];
    const pk = Object.keys(p).join(",");
    if (pk !== "id,title" && pk !== "id,title,rollup") errors.push(`${rel}: LB_LESSONS entry has keys ${pk}`);
    if (p.id !== L.id) errors.push(`${rel}: LB_LESSONS id differs from LB_LESSON id`);
    if (p.title !== L.title) errors.push(`${rel}: LB_LESSONS title differs from LB_LESSON title`);
    if (("rollup" in p) !== ("rollup" in L) || (("rollup" in p) && p.rollup !== false)) {
      errors.push(`${rel}: rollup must be absent on both, or false on both`);
    }
  }
  if ("rollup" in L && L.rollup !== false) errors.push(`${rel}: LB_LESSON.rollup is set but not false`);
  if ((L.rollup === false) !== (entry.rollup === false)) errors.push(`${rel}: rollup differs from the manifest`);
  if (typeof entry.count === "number" && entry.count !== L.cards.length) {
    errors.push(`${rel}: manifest count ${entry.count} but the file has ${L.cards.length} cards`);
  }

  const cards = [];
  L.cards.forEach((c, i) => {
    const keys = Object.keys(c).join(",");
    if (keys !== CARD_KEYS.join(",")) { errors.push(`${rel} cards[${i}]: keys are ${keys}`); return; }
    const card = { id: `${slug}.${pad3(i + 1)}`, prompt: c.prompt, answer: c.answer, hint: c.hint };
    if (c.audio !== "") card.audio = c.audio;
    cards.push(card);
  });

  let comments = { header: [], sections: [] };
  try {
    comments = readComments(fs.readFileSync(file, "utf8"), L.cards.length, rel);
  } catch (e) {
    errors.push(e.message);
  }
  if (errors.length > before) return null;

  const notes = comments.header.slice();
  if (comments.sections.length) {
    notes.push("");
    notes.push("Section comments from the old file (each comes before the card with this id):");
    for (const s of comments.sections) {
      const target = s.beforeCard < cards.length ? cards[s.beforeCard].id : "(after the last card)";
      notes.push(`${target}: ${s.text}`);
    }
  }

  const out = { slug };
  if (entry.parked) out.parked = true;
  out.label = entry.label;
  out.title = L.title;
  if ("revealMs" in L) out.revealMs = L.revealMs;
  out.rollup = entry.rollup;
  if ("recallPrompt" in L) out.recallPrompt = L.recallPrompt;
  if (notes.length) out.notes = notes;
  out.cards = cards;
  return out;
}

/**
 * Swap a combined deck's copied cards for references to their source cards,
 * matched by prompt among the other card decks of the same group. A prompt
 * with no match, more than one match, or a card that differs from its source
 * is an error.
 */
function toCardRefs(lesson, group, rel, errors) {
  const sources = group.lessons.filter((l) => l !== lesson && Array.isArray(l.cards));
  const refs = [];
  const before = errors.length;
  lesson.cards.forEach((c, i) => {
    const hits = [];
    for (const s of sources) for (const sc of s.cards) if (sc.prompt === c.prompt) hits.push(sc);
    if (hits.length !== 1) {
      errors.push(`${rel} cards[${i}]: prompt ${JSON.stringify(c.prompt)} matches ${hits.length} source cards (need exactly 1)`);
      return;
    }
    const src = hits[0];
    for (const k of ["answer", "hint", "audio"]) {
      if (src[k] !== c[k]) errors.push(`${rel} cards[${i}]: ${k} differs from its source ${src.id}`);
    }
    refs.push(src.id);
  });
  if (errors.length > before) return false;
  delete lesson.cards;
  lesson.cardRefs = refs;
  return true;
}

function convertAll(from, parkedManifestFile) {
  const errors = [];
  const contentRoot = path.join(from, "src", "content");
  const parkedRoot = path.join(from, "parked", "content");
  const manifest = loadManifestFile(path.join(contentRoot, "languages.js"));
  const oldManifest = parkedManifestFile ? loadManifestFile(parkedManifestFile) : [];
  const docs = [];

  manifest.forEach((ml, li) => {
    const langErrors = [];
    const code = ml.code;
    const groups = ml.groups.map((g) => ({ label: g.label, notes: [], lessons: [] }));
    const used = new Set();

    ml.groups.forEach((g, gi) => {
      for (const entry of g.lessons) {
        const slug = entry.id.split("/")[1];
        const rel = `src/content/${code}/${slug}.js`;
        used.add(`${slug}.js`);
        const lesson = convertLesson(path.join(contentRoot, code, `${slug}.js`), rel, entry, langErrors);
        if (lesson) groups[gi].lessons.push(lesson);
      }
    });

    // Every live file must be in the manifest, or it would be lost.
    const liveDir = path.join(contentRoot, code);
    for (const f of fs.readdirSync(liveDir).filter((n) => n.endsWith(".js"))) {
      if (!used.has(f)) langErrors.push(`src/content/${code}/${f}: not listed in languages.js`);
    }

    // Parked lessons: label + rollup + place from the pre-LB-34 manifest.
    const parkedDir = path.join(parkedRoot, code);
    const parkedFiles = fs.existsSync(parkedDir) ? fs.readdirSync(parkedDir).filter((n) => n.endsWith(".js")).sort() : [];
    const oldLang = oldManifest.find((l) => l.code === code);
    for (const f of parkedFiles) {
      const slug = f.replace(/\.js$/, "");
      const id = `${code}/${slug}`;
      const rel = `parked/content/${code}/${f}`;
      let oldGroup = null;
      let oldIndex = -1;
      if (oldLang) {
        for (const g of oldLang.groups) {
          const i = g.lessons.findIndex((l) => l.id === id);
          if (i >= 0) { oldGroup = g; oldIndex = i; break; }
        }
      }
      if (!oldGroup) { langErrors.push(`${rel}: not found in --parked-manifest, so its label is unknown`); continue; }
      const old = oldGroup.lessons[oldIndex];
      const entry = { id, label: old.label, rollup: old.rollup, count: old.count, parked: true };
      const lesson = convertLesson(path.join(parkedDir, f), rel, entry, langErrors);
      if (!lesson) continue;
      const group = groups.find((g) => g.label === oldGroup.label);
      if (!group) { langErrors.push(`${rel}: group "${oldGroup.label}" is not in languages.js`); continue; }
      // Put it back after the lesson that came before it in the old manifest.
      let at = group.lessons.length;
      for (let k = oldIndex - 1; k >= 0; k--) {
        const prevSlug = oldGroup.lessons[k].id.split("/")[1];
        const pos = group.lessons.findIndex((l) => l.slug === prevSlug);
        if (pos >= 0) { at = pos + 1; break; }
      }
      group.lessons.splice(at, 0, lesson);
    }

    // Combined alphabet decks become references.
    for (const g of groups) {
      for (const l of g.lessons) {
        if (l.slug === "alphabet-all") toCardRefs(l, g, `src/content/${code}/${l.slug}.js`, langErrors);
      }
    }

    const defaultSlug = String(ml.defaultLesson).split("/");
    if (defaultSlug[0] !== code) langErrors.push(`languages.js ${code}: defaultLesson "${ml.defaultLesson}" is not in this language`);

    if (langErrors.length) { errors.push(...langErrors); return; }
    docs.push({
      code,
      doc: {
        format: "languagebasics-lessons",
        formatVersion: 1,
        language: { code, name: ml.name, order: li + 1, defaultLesson: defaultSlug[1] },
        notes: [],
        retiredCardIds: [],
        groups,
      },
    });
  });
  return { docs, errors, languages: manifest.length };
}

/* ------------------------------------------------------------ JSON writing */

/** 2-space JSON, but each card on one line so a deck reads like a table. */
function formatJson(value, indent, key) {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => inner + (key === "cards" ? oneLine(v) : formatJson(v, indent + 1, null)));
    return "[\n" + items.join(",\n") + "\n" + pad + "]";
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const items = keys.map((k) => `${inner}${JSON.stringify(k)}: ${formatJson(value[k], indent + 1, k)}`);
    return "{\n" + items.join(",\n") + "\n" + pad + "}";
  }
  return JSON.stringify(value);
}

function oneLine(obj) {
  return "{ " + Object.keys(obj).map((k) => `${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`).join(", ") + " }";
}

/* ------------------------------------------------------------------ verify */

function sameKeyOrder(a, b, where, diffs) {
  if (Array.isArray(a) && Array.isArray(b)) {
    a.forEach((v, i) => sameKeyOrder(v, b[i], `${where}[${i}]`, diffs));
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).join(",");
    const kb = Object.keys(b).join(",");
    if (ka !== kb) diffs.push(`${where}: key order ${ka} vs ${kb}`);
    for (const k of Object.keys(a)) if (k in b) sameKeyOrder(a[k], b[k], `${where}.${k}`, diffs);
  }
}

function listDataFiles(root) {
  const out = [];
  for (const base of ["src/content", "parked/content"]) {
    const dir = path.join(root, base);
    if (!fs.existsSync(dir)) continue;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isFile() && ent.name.endsWith(".js")) out.push(`${base}/${ent.name}`);
      if (ent.isDirectory()) {
        for (const f of fs.readdirSync(path.join(dir, ent.name))) if (f.endsWith(".js")) out.push(`${base}/${ent.name}/${f}`);
      }
    }
  }
  return out.sort();
}

function verify(savedRoot, newRoot) {
  const oldFiles = listDataFiles(savedRoot);
  const newFiles = listDataFiles(newRoot);
  const lines = [];
  let bad = 0;

  const onlyOld = oldFiles.filter((f) => !newFiles.includes(f));
  const onlyNew = newFiles.filter((f) => !oldFiles.includes(f));
  for (const f of onlyOld) { lines.push(`MISSING IN NEW  ${f}`); bad++; }
  for (const f of onlyNew) { lines.push(`ONLY IN NEW     ${f}`); bad++; }

  let compared = 0;
  let live = 0;
  let parked = 0;
  for (const rel of oldFiles.filter((f) => newFiles.includes(f))) {
    const isManifest = rel === "src/content/languages.js";
    const a = isManifest ? loadManifestFile(path.join(savedRoot, rel)) : loadLessonFile(path.join(savedRoot, rel));
    const b = isManifest ? loadManifestFile(path.join(newRoot, rel)) : loadLessonFile(path.join(newRoot, rel));
    const diffs = [];
    try {
      assert.deepStrictEqual(b, a);
    } catch (e) {
      diffs.push("values differ");
    }
    sameKeyOrder(a, b, isManifest ? "LB_LANGUAGES" : "", diffs);
    compared++;
    if (!isManifest) { if (rel.startsWith("parked/")) parked++; else live++; }
    const what = isManifest ? "LB_LANGUAGES" : "LB_LESSON + LB_LESSONS";
    if (diffs.length) { bad++; lines.push(`DIFFERENT       ${rel} (${what}): ${diffs.join("; ")}`); }
    else lines.push(`equal           ${rel} (${what})`);
  }
  const summary = [
    `Files compared: ${compared} (${live} live lesson files, ${parked} parked lesson files, ${compared - live - parked} manifest).`,
    `File sets match: ${onlyOld.length === 0 && onlyNew.length === 0 ? "yes" : "NO"} (old ${oldFiles.length}, new ${newFiles.length}).`,
    bad === 0 ? "RESULT: all equal (deepStrictEqual + key order)." : `RESULT: ${bad} problem(s).`,
  ];
  return { ok: bad === 0, text: summary.concat([""], lines).join("\n") + "\n" };
}

/* --------------------------------------------------------------------- CLI */

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function main(argv) {
  const args = argv || [];
  const savedRoot = argValue(args, "--verify");
  if (savedRoot) {
    const r = verify(path.resolve(savedRoot), ROOT);
    process.stdout.write(r.text);
    return r.ok ? 0 : 1;
  }
  const from = path.resolve(argValue(args, "--from") || ROOT);
  const parked = argValue(args, "--parked-manifest");
  const { docs, errors, languages } = convertAll(from, parked && path.resolve(parked));
  process.stdout.write(`Languages: ${docs.length} succeeded, ${languages - docs.length} failed.\n`);
  if (errors.length) {
    for (const e of errors) process.stderr.write("  ERROR " + e + "\n");
    process.stderr.write("Nothing was written.\n");
    return 1;
  }
  const dataDir = path.join(ROOT, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  for (const { code, doc } of docs) {
    fs.writeFileSync(path.join(dataDir, `${code}.json`), formatJson(doc, 0, null) + "\n", "utf8");
    process.stdout.write(`  wrote data/${code}.json\n`);
  }
  return 0;
}

module.exports = { convertAll, verify, formatJson, commentLines };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
