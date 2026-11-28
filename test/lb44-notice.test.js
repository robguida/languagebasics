/* LB-44: the short notice, the Klingon font rule and the guard fixes.
 *
 * Covers: notice.short is written to languages.js (and only there) when
 * non-empty, through the safe writer; natural languages are byte-identical (no
 * notice key); the page shows it with textContent only; the :lang(tlh) rule is
 * a system monospace stack with no text-transform; the privacy page and README
 * carry the full notice; blank-only text is refused (M1); the numbers-only
 * exemption comes from the data (M2); filler characters and notices with no
 * letter or number are refused. The guard tests use made-up fixture languages;
 * the manifest, page and font checks read the real data (Klingon among it), and
 * test/klingon.test.js holds the Klingon-only checks.
 * Built-ins only.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const build = require("../scripts/build-data.js");
const { loadData, FIXTURE_DATA_DIR } = require("./helpers/load-data.js");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ch = (...cps) => String.fromCharCode(...cps);

function doc(code, order, ip) {
  return {
    format: "languagebasics-lessons", formatVersion: 2, ip,
    language: { code, name: "Test " + code, order, defaultLesson: "lesson-1" },
    notes: [], retiredCardIds: [],
    groups: [{ label: "Numbers", lessons: [{ slug: "lesson-1", label: "Lesson 1", title: "One", revealMs: 5000, rollup: true,
      cards: [{ id: "lesson-1.001", prompt: 0, answer: "zero", hint: "Zee" }] }] }],
  };
}
const OWNED = (short) => ({ status: "owned", freeOnly: true, notice: { full: ["Full line."], short }, ruling: { id: "IP-0001", date: "2026-11-14" } });
const FREE_EMPTY = () => ({ status: "free", freeOnly: false, notice: { full: [], short: "" }, ruling: { id: "IP-0001", date: "2026-11-14" } });
const src = (name, d) => ({ name, text: JSON.stringify(d, null, 2) });
const gen = (sources) => build.generateFromSources(sources);
const errs = (d) => gen([src("xx.json", d)]).errors;
const runManifest = (text) => { const w = {}; const sb = { window: w }; vm.createContext(sb); vm.runInContext(text, sb); return structuredClone(w.LB_LANGUAGES); };

/* ------------------------------------------------------ notice.short written */

test("notice.short: written as a notice key, only when non-empty", () => {
  const r = gen([src("aa.json", doc("aa", 1, { status: "natural" })), src("bb.json", doc("bb", 2, OWNED("Short line."))), src("cc.json", doc("cc", 3, FREE_EMPTY()))]);
  assert.deepEqual(r.errors, []);
  const langs = runManifest(r.files["src/content/languages.js"]);
  assert.equal("notice" in langs[0], false, "natural: no notice key");
  assert.equal(langs[1].notice, "Short line.");
  assert.equal("notice" in langs[2], false, "free with an empty short notice: no notice key");
});

test("notice.short: goes through the safe writer (escapes < and U+2028/2029, same value back)", () => {
  const d = doc("bb", 1, OWNED("Fan-made & \"quoted\" it's fine \\ ok"));
  const r = gen([src("bb.json", d)]);
  assert.deepEqual(r.errors, []);
  const text = r.files["src/content/languages.js"];
  assert.ok(text.includes('    notice: "Fan-made & \\"quoted\\" it\'s fine \\\\ ok",'), text);
  assert.equal(runManifest(text)[0].notice, "Fan-made & \"quoted\" it's fine \\ ok");
  // The writer itself escapes "<" and the line separators if they ever reach it.
  const model = { code: "xx", name: "X", defaultLesson: "lesson-1", ip: { notice: { full: [], short: "a<b" + ch(0x2028) } },
    groups: [{ label: "N", lessons: [{ slug: "lesson-1", label: "L", cards: [{}], rollup: true }] }] };
  const out = build.renderManifest([model]);
  assert.ok(!out.includes("<") && !out.includes(ch(0x2028)), "no raw < or U+2028 in the manifest");
  assert.equal(runManifest(out)[0].notice, "a<b" + ch(0x2028));
});

test("notice.short: never written into any lesson file", () => {
  const r = gen([src("bb.json", doc("bb", 1, OWNED("SHORT-MARK-ZQ")))]);
  for (const [rel, text] of Object.entries(r.files)) {
    assert.equal(text.includes("SHORT-MARK-ZQ"), rel.endsWith("languages.js"), rel);
  }
});

test("natural languages: no notice key in languages.js (Klingon only), and the real files match the build (byte-identical)", () => {
  const files = build.generate(build.DATA_DIR).files;
  const m = files["src/content/languages.js"];
  // Keyed by the data: a manifest entry has a notice exactly when its language's notice.short is non-empty.
  const docs = new Map(loadData().docs.map((d) => [d.language.code, d]));
  const entries = runManifest(m);
  assert.equal(entries.length, docs.size);
  for (const l of entries) {
    const short = docs.get(l.code).ip.notice ? docs.get(l.code).ip.notice.short : "";
    assert.equal("notice" in l, typeof short === "string" && short !== "", `notice key for ${l.code}`);
    if ("notice" in l) assert.equal(l.notice, short, l.code);
  }
  assert.deepEqual(build.check(files), { differs: [], missing: [], stale: [] });
});

test("the made-up fixture: qaa's short notice is in the manifest, qab has none", () => {
  const r = build.generate(FIXTURE_DATA_DIR);
  const langs = runManifest(r.files["src/content/languages.js"]);
  const qaa = JSON.parse(fs.readFileSync(path.join(FIXTURE_DATA_DIR, "qaa.json"), "utf8"));
  assert.equal(langs.find((l) => l.code === "qaa").notice, qaa.ip.notice.short);
  assert.equal("notice" in langs.find((l) => l.code === "qab"), false);
});

/* ------------------------------------------------------------ the page: shows */

test("index.html: the notice is set with textContent only, and the element starts hidden", () => {
  const html = read("src/index.html");
  assert.match(html, /<p id="ipNotice" class="ip-notice" hidden><\/p>/);
  const fn = html.slice(html.indexOf("function renderIpNotice"), html.indexOf("function renderIpNotice") + 900);
  assert.ok(/getElementById\("ipNotice"\)/.test(fn));
  assert.ok(/el\.textContent = text/.test(fn), "uses textContent");
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write\(\s*text/.test(fn), "no HTML sink for the notice");
  assert.ok(/activeCode === "tlh"/.test(fn) && /getElementById\("word"\)/.test(fn) && /setAttribute\("lang", "tlh"\)/.test(fn), "the answer element #word gets lang=tlh");
  assert.ok(!/querySelector\("\.card"\)/.test(fn), "the whole card is not tagged");
  assert.ok(!/documentElement[^;]*lang|<html[^>]*tlh/.test(html), "<html> lang is untouched");
});

/* ------------------------------------------------------------ the css rules */

test("styles.css: :lang(tlh) is a system monospace stack, no font file, no text-transform anywhere", () => {
  const css = read("src/styles.css");
  const m = /:lang\(tlh\)\s*\{([^}]*)\}/.exec(css);
  assert.ok(m, ":lang(tlh) rule present");
  assert.match(m[1], /font-family:\s*ui-monospace,\s*"Cascadia Mono",\s*Consolas,\s*"Courier New",\s*monospace;/);
  assert.ok(!/text-transform/.test(css), "no text-transform in styles.css");
  assert.ok(!/@font-face|@import|url\(|https?:\/\//i.test(css), "no font file, import or external address");
});

test("styles.css: the notice line wraps at spaces (no break-all, no nowrap)", () => {
  const css = read("src/styles.css");
  const m = /\.ip-notice\s*\{([^}]*)\}/.exec(css);
  assert.ok(m, ".ip-notice rule present");
  assert.ok(!/word-break:\s*break-all|white-space:\s*nowrap/.test(m[1]));
  assert.match(m[1], /max-width:\s*100%/);
});

/* ------------------------------------------------- the full notice, static */

const FULL_NOTICE = "Klingon is a trademark of CBS Studios Inc. Star Trek and related marks are owned by CBS Studios Inc. LanguageBasics is a free, fan-made learning tool. It is not endorsed by, sponsored by, or affiliated with CBS Studios, Paramount, or the Star Trek franchise. The Klingon language was created by Marc Okrand. The card selection, English meanings and pronunciation guides here are our own work.";

test("privacy.html and README.md carry the full notice, exactly; privacy page stays script-free and counter-free", () => {
  const page = read("src/privacy.html");
  assert.ok(page.includes(FULL_NOTICE), "privacy page");
  assert.ok(read("README.md").includes(FULL_NOTICE), "README");
  assert.ok(!/<script/i.test(page));
  assert.ok(!/We count page visits/.test(page));
});

/* ------------------------------------------------------------------ M1 blank */

test("M1: a blank-only notice.short, notice line or card note is refused", () => {
  for (const blank of [" ", "   ", ch(32, 32, 32)]) {
    const a = doc("xx", 1, OWNED(blank));
    assert.ok(errs(a).some((e) => e.startsWith("data/xx.json ip.notice.short: ") && /blank/.test(e)), errs(a).join("\n"));
    const b = doc("xx", 1, OWNED("ok"));
    b.ip.notice.full = [blank];
    assert.ok(errs(b).some((e) => e.startsWith("data/xx.json ip.notice.full[0]: ")), errs(b).join("\n"));
    const c = doc("xx", 1, { status: "natural" });
    c.groups[0].lessons[0].cards[0].note = blank;
    assert.ok(errs(c).some((e) => e.startsWith("data/xx.json groups[0].lessons[0].cards[0].note: ") && /blank/.test(e)), errs(c).join("\n"));
  }
  const ok = doc("xx", 1, OWNED(" a "));
  assert.deepEqual(errs(ok), [], "text with a letter in it still passes");
});

/* ----------------------------------------------------------- M2 data-keyed */

test("M2: the numbers-only exemption reads the ip status from the data, not a typed list", () => {
  const data = loadData([build.DATA_DIR, FIXTURE_DATA_DIR]);
  const by = new Map(data.languages.map((l) => [l.code, l]));
  for (const code of ["sq", "es", "ja", "bn"]) assert.equal(by.get(code).ipStatus, "natural", code);
  assert.equal(by.get("qaa").ipStatus, "owned");
  assert.equal(by.get("qab").ipStatus, "free");
  assert.ok(!/\["qaa",\s*"qab"\]/.test(read("test/number-lessons.test.js")), "no typed-in fixture list");
});

/* -------------------------------------------------------- filler characters */

const FILLERS = [0x115f, 0x1160, 0x3164, 0xffa0, 0x2800, 0x00a0, 0x202f, 0x205f, 0x3000];
for (let c = 0x2000; c <= 0x200a; c++) FILLERS.push(c);

test("filler characters are refused in notice text (full line and short), each one named", () => {
  for (const cp of FILLERS) {
    const hex = "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
    const a = doc("xx", 1, OWNED("ok"));
    a.ip.notice.full = ["a" + ch(cp) + "b"];
    assert.ok(errs(a).some((e) => e.startsWith("data/xx.json ip.notice.full[0]: ") && (e.includes(hex) || /NFC/.test(e))), hex + ": " + errs(a).join("\n"));
    const b = doc("xx", 1, OWNED("a" + ch(cp) + "b"));
    assert.ok(errs(b).some((e) => e.startsWith("data/xx.json ip.notice.short: ")), hex);
    const e2 = doc("xx", 1, OWNED(ch(cp)));
    assert.ok(errs(e2).length > 0, hex + " alone");
  }
});

test("filler characters: a plain space and ordinary text still pass", () => {
  assert.deepEqual(errs(doc("xx", 1, OWNED("Fan-made; not affiliated. Plain spaces are fine."))), []);
});

/* ------------------------------------- letters or numbers, picker label, results */

test("E: a notice made only of invisible marks (no letter or number) is refused", () => {
  const MARKS = [ch(0xfe0f), ch(0x034f), ch(0x17b4), ch(0x17b5), ch(0x180b), ch(0x180c), ch(0x180d), ch(0x1680)];
  for (const m of MARKS) {
    const hex = m.codePointAt(0).toString(16);
    const a = doc("xx", 1, OWNED("ok"));
    a.ip.notice.full = [m + m];
    assert.ok(errs(a).some((e) => e.startsWith("data/xx.json ip.notice.full[0]: ")), hex + ": " + errs(a).join("\n"));
    const b = doc("xx", 1, OWNED(m));
    assert.ok(errs(b).some((e) => e.startsWith("data/xx.json ip.notice.short: ")), hex + ": " + errs(b).join("\n"));
  }
  const empty = doc("xx", 1, OWNED(""));
  assert.ok(errs(empty).some((e) => e.startsWith("data/xx.json ip.notice.short: ") && /empty or blank/.test(e)), errs(empty).join("\n"));
  assert.deepEqual(errs(doc("xx", 1, OWNED("1990"))), [], "a number counts");
});

test("picker: the Klingon label is exactly \"Klingon (tlhIngan Hol)\" in the data, the manifest and the picker options", () => {
  const { loadManifest } = require("./helpers/load-lesson.js");
  const { LBManifest } = loadManifest();
  const doc_ = loadData().docs.find((d) => d.language.code === "tlh");
  if (!doc_) return; // Klingon switched off: nothing to pin
  assert.equal(doc_.language.name, "Klingon (tlhIngan Hol)");
  const m = vm.runInNewContext("(function(){var window={};" + read("src/content/languages.js") + ";return window.LB_LANGUAGES;})()");
  assert.equal(m.find((l) => l.code === "tlh").name, "Klingon (tlhIngan Hol)");
  const opts = LBManifest.buildLanguageOptions(m);
  assert.equal(opts.find((o) => o.value === "tlh").label, "Klingon (tlhIngan Hol)");
});

test("C: on a Klingon lesson each missed row in the results list gets lang=tlh; on other languages it does not", () => {
  const { makeEngineEnv } = require("./helpers/engine-dom.js");
  const { makeLocalStorage } = require("./helpers/local-storage-shim.js");
  for (const [id, want] of [["tlh/lesson-1", "tlh"], ["sq/lesson-1", undefined]]) {
    const cards = [1, 2, 3].map((i) => ({ prompt: i, answer: "w" + i, hint: "h" + i }));
    const h = makeEngineEnv({ modules: ["store.js", "prefs.js", "game.js", "progress.js", "streak.js"], storage: makeLocalStorage() });
    h.engine.startTest({ id, title: "T", revealMs: 5000, cards });
    for (let i = 0; i < 3; i++) { h.click("toggleBtn"); h.advance(500); h.click("rateNotYetBtn"); }
    const rows = h.elements.resultList.children;
    assert.equal(rows.length, 3, id);
    for (const li of rows) assert.equal(li.children[0].attrs.lang, want, id);
  }
});
