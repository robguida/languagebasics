/* LB-43: tests for the lesson-data format add-on in scripts/build-data.js.
 *
 * What the add-on is: format version 2 has a required "ip" block (status,
 * freeOnly, notice, ruling), a notice that is written as comment lines in the
 * generated files, and an optional data-only card "note". These tests cover the
 * fields' mechanics only (what is accepted, refused and written), for any
 * language. They make no statement about any language's licence.
 *
 *  1. The ip block: status, natural-only, required fields, unknown keys, ruling
 *     id and real date, every error reported in one run.
 *  2. The text guard (notice lines, notice short, card note): every refused
 *     class, what still passes, lengths counted in code points.
 *  3. Output: notice lines after the banner in lesson files (live and parked),
 *     above the language block in languages.js, nothing for an empty notice,
 *     nothing for status / freeOnly / ruling / card note. notice.short is written
 *     only as a "notice" key in languages.js, and only when non-empty (LB-44).
 *  4. The writer re-checks line breaks; rebuild-over and stale delete still work
 *     with notice lines in a file.
 *  5. The real languages are unchanged: natural, no notice lines anywhere.
 *  6. The made-up fixture languages: qaa (owned, notice, hostile text) and qab
 *     (numbers-only, free, empty notice).
 * Built-ins only.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");

const build = require("../scripts/build-data.js");

const { DATA_DIR, BANNER } = build;
const FIXTURE_DIR = path.join(__dirname, "fixtures", "data-extra");

const ch = (...cps) => String.fromCharCode(...cps);
const LS = ch(0x2028);
const PS = ch(0x2029);

/* ---------------------------------------------------------------- helpers */

const RULING = () => ({ id: "IP-0001", date: "2026-11-14" });
const FREE = () => ({ status: "free", freeOnly: false, notice: { full: [], short: "" }, ruling: RULING() });
const OWNED = () => ({ status: "owned", freeOnly: true, notice: { full: ["Line one.", "Line two."], short: "Short." }, ruling: RULING() });
const LICENSED = () => ({ status: "licensed", freeOnly: true, notice: { full: ["Line one."], short: "Short." }, ruling: RULING() });

/** A small valid language file with the given ip block. */
function doc(code, order, ip) {
  return {
    format: "languagebasics-lessons",
    formatVersion: 2,
    ip,
    language: { code, name: "Test " + code, order, defaultLesson: "lesson-1" },
    notes: [],
    retiredCardIds: [],
    groups: [
      {
        label: "Numbers",
        lessons: [
          {
            slug: "lesson-1", label: "Lesson 1", title: "One", revealMs: 5000, rollup: true,
            cards: [
              { id: "lesson-1.001", prompt: 0, answer: "zero", hint: "Zee" },
              { id: "lesson-1.002", prompt: 1, answer: "one", hint: "Wun" },
            ],
          },
          {
            slug: "lesson-2", parked: true, label: "Lesson 2", title: "Two", revealMs: 10000, rollup: true,
            cards: [{ id: "lesson-2.001", prompt: 2, answer: "two", hint: "Too" }],
          },
        ],
      },
    ],
  };
}

const src = (name, d) => ({ name, text: JSON.stringify(d, null, 2) });
const gen = (d, name) => build.generateFromSources([src(name || "xx.json", d)]);
const errorsOf = (d) => gen(d).errors;

/** The one error that must name exactly this place, or a failure that shows them all. */
function assertErrorAt(d, place) {
  const r = gen(d);
  assert.equal(r.failed, 1, "the file must fail");
  assert.deepEqual(r.files, {}, "a failed file produces no output");
  assert.ok(r.errors.some((e) => e.startsWith(`data/xx.json ${place}: `)),
    `an error must name exactly "data/xx.json ${place}: "; got:\n${r.errors.join("\n")}`);
}

function assertValid(d) {
  const r = gen(d);
  assert.deepEqual(r.errors, []);
  assert.equal(r.succeeded, 1);
}

function runLesson(text) {
  const w = { LB_LESSONS: [] };
  const sandbox = { window: w };
  vm.createContext(sandbox);
  vm.runInContext(text, sandbox);
  return structuredClone({ lesson: w.LB_LESSON, index: w.LB_LESSONS });
}

function runManifest(text) {
  const w = {};
  const sandbox = { window: w };
  vm.createContext(sandbox);
  vm.runInContext(text, sandbox);
  return structuredClone(w.LB_LANGUAGES);
}

/* -------------------------------------------------------- 1. the ip block */

const IP_RULES = [
  ["ip is required", () => null, (d) => { delete d.ip; }, "ip"],
  ["ip must be an object (string)", () => null, (d) => { d.ip = "natural"; }, "ip"],
  ["ip must be an object (array)", () => null, (d) => { d.ip = []; }, "ip"],
  ["ip must be an object (null)", () => null, (d) => { d.ip = null; }, "ip"],
  ["status is required", OWNED, (d) => { delete d.ip.status; }, "ip.status"],
  ["status must be in the list", OWNED, (d) => { d.ip.status = "public"; }, "ip.status"],
  ["status is case-sensitive", OWNED, (d) => { d.ip.status = "Owned"; }, "ip.status"],
  ["unknown key in ip", OWNED, (d) => { d.ip.licence = "x"; }, "ip.licence"],
  ["natural allows no freeOnly", () => ({ status: "natural", freeOnly: false }), () => {}, "ip.freeOnly"],
  ["natural allows no notice", () => ({ status: "natural", notice: { full: [], short: "" } }), () => {}, "ip.notice"],
  ["natural allows no ruling", () => ({ status: "natural", ruling: RULING() }), () => {}, "ip.ruling"],
  ["freeOnly is required (owned)", OWNED, (d) => { delete d.ip.freeOnly; }, "ip.freeOnly"],
  ["freeOnly must be a boolean", OWNED, (d) => { d.ip.freeOnly = "true"; }, "ip.freeOnly"],
  ["freeOnly must be true when owned", OWNED, (d) => { d.ip.freeOnly = false; }, "ip.freeOnly"],
  ["freeOnly must be true when licensed", LICENSED, (d) => { d.ip.freeOnly = false; }, "ip.freeOnly"],
  ["freeOnly is required (free)", FREE, (d) => { delete d.ip.freeOnly; }, "ip.freeOnly"],
  ["notice is required (free)", FREE, (d) => { delete d.ip.notice; }, "ip.notice"],
  ["notice must be an object", OWNED, (d) => { d.ip.notice = ["x"]; }, "ip.notice"],
  ["notice.full is required", OWNED, (d) => { delete d.ip.notice.full; }, "ip.notice.full"],
  ["notice.full must be an array", OWNED, (d) => { d.ip.notice.full = "one line"; }, "ip.notice.full"],
  ["notice.short is required", OWNED, (d) => { delete d.ip.notice.short; }, "ip.notice.short"],
  ["notice.short must be a string", OWNED, (d) => { d.ip.notice.short = 5; }, "ip.notice.short"],
  ["unknown key in notice", OWNED, (d) => { d.ip.notice.long = "x"; }, "ip.notice.long"],
  ["owned needs at least one full line", OWNED, (d) => { d.ip.notice.full = []; }, "ip.notice.full"],
  ["licensed needs at least one full line", LICENSED, (d) => { d.ip.notice.full = []; }, "ip.notice.full"],
  ["owned needs a short notice", OWNED, (d) => { d.ip.notice.short = ""; }, "ip.notice.short"],
  ["licensed needs a short notice", LICENSED, (d) => { d.ip.notice.short = ""; }, "ip.notice.short"],
  ["ruling is required (free)", FREE, (d) => { delete d.ip.ruling; }, "ip.ruling"],
  ["ruling must be an object", OWNED, (d) => { d.ip.ruling = "IP-0001"; }, "ip.ruling"],
  ["unknown key in ruling", OWNED, (d) => { d.ip.ruling.by = "x"; }, "ip.ruling.by"],
  ["ruling.id is required", OWNED, (d) => { delete d.ip.ruling.id; }, "ip.ruling.id"],
  ["ruling.date is required", OWNED, (d) => { delete d.ip.ruling.date; }, "ip.ruling.date"],
  ["ruling.id: three digits", OWNED, (d) => { d.ip.ruling.id = "IP-001"; }, "ip.ruling.id"],
  ["ruling.id: five digits", OWNED, (d) => { d.ip.ruling.id = "IP-00001"; }, "ip.ruling.id"],
  ["ruling.id: lower case", OWNED, (d) => { d.ip.ruling.id = "ip-0001"; }, "ip.ruling.id"],
  ["ruling.id: trailing text", OWNED, (d) => { d.ip.ruling.id = "IP-0001/x"; }, "ip.ruling.id"],
  ["ruling.id: a path", OWNED, (d) => { d.ip.ruling.id = "../a"; }, "ip.ruling.id"],
  ["ruling.id: a drive path", OWNED, (d) => { d.ip.ruling.id = "C:x"; }, "ip.ruling.id"],
  ["ruling.id: a name", OWNED, (d) => { d.ip.ruling.id = "Zork Quimby"; }, "ip.ruling.id"],
  ["ruling.id: empty", OWNED, (d) => { d.ip.ruling.id = ""; }, "ip.ruling.id"],
  ["ruling.id: a number", OWNED, (d) => { d.ip.ruling.id = 1; }, "ip.ruling.id"],
  ["ruling.date: wrong format", OWNED, (d) => { d.ip.ruling.date = "14-11-2026"; }, "ip.ruling.date"],
  ["ruling.date: Feb 30", OWNED, (d) => { d.ip.ruling.date = "2026-02-30"; }, "ip.ruling.date"],
  ["ruling.date: month 13", OWNED, (d) => { d.ip.ruling.date = "2026-13-01"; }, "ip.ruling.date"],
  ["ruling.date: Feb 29 in a common year", OWNED, (d) => { d.ip.ruling.date = "2026-02-29"; }, "ip.ruling.date"],
  ["ruling.date: not a string", OWNED, (d) => { d.ip.ruling.date = 20261114; }, "ip.ruling.date"],
];

for (const [name, make, mutate, place] of IP_RULES) {
  test(`ip: ${name}`, () => {
    const d = doc("xx", 1, make() || { status: "natural" });
    mutate(d);
    assertErrorAt(d, place);
  });
}

test("ip: each status passes with its required fields", () => {
  assertValid(doc("xx", 1, { status: "natural" }));
  assertValid(doc("xx", 1, FREE()));
  assertValid(doc("xx", 1, OWNED()));
  assertValid(doc("xx", 1, LICENSED()));
});

test("ip: free may have freeOnly false, or true", () => {
  const d = doc("xx", 1, FREE());
  assertValid(d);
  d.ip.freeOnly = true;
  assertValid(d);
});

test("ip: free allows an empty notice (full [] and short \"\"), and a non-empty one", () => {
  assertValid(doc("xx", 1, FREE()));
  const d = doc("xx", 1, FREE());
  d.ip.notice.full = ["A credit line."];
  assertValid(d);
});

test("ip: a leap day is a real date", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.ruling.date = "2028-02-29";
  assertValid(d);
});

test("ip: ruling.id IP-0001 and IP-9999 pass", () => {
  for (const id of ["IP-0001", "IP-9999", "IP-0000"]) {
    const d = doc("xx", 1, OWNED());
    d.ip.ruling.id = id;
    assertValid(d);
  }
});

test("ip: natural with every extra key reports each key", () => {
  const d = doc("xx", 1, { status: "natural", freeOnly: true, notice: { full: ["x"], short: "y" }, ruling: RULING() });
  const e = errorsOf(d);
  for (const k of ["freeOnly", "notice", "ruling"]) {
    assert.ok(e.some((m) => m.startsWith(`data/xx.json ip.${k}: `) && /natural/.test(m)), `ip.${k}: ${e.join("\n")}`);
  }
});

test("format version: 1 fails and says how to migrate, 3 fails, 2 passes", () => {
  const one = doc("xx", 1, { status: "natural" });
  one.formatVersion = 1;
  assertErrorAt(one, "formatVersion");
  assert.match(errorsOf(one).find((e) => e.includes("formatVersion")), /ip.*natural|natural/, "the error tells how to migrate");
  const three = doc("xx", 1, { status: "natural" });
  three.formatVersion = 3;
  assertErrorAt(three, "formatVersion");
  assertValid(doc("xx", 1, { status: "natural" }));
});

test("ip: one file with many ip errors reports all of them (the check goes on)", () => {
  const d = doc("xx", 1, {
    status: "owned", freeOnly: false,
    notice: { full: [], short: "", extra: 1 },
    ruling: { id: "bad", date: "2026-02-30" },
  });
  const e = errorsOf(d);
  for (const place of ["ip.freeOnly", "ip.notice.extra", "ip.notice.full", "ip.notice.short", "ip.ruling.id", "ip.ruling.date"]) {
    assert.ok(e.some((m) => m.startsWith(`data/xx.json ${place}: `)), `${place} missing from:\n${e.join("\n")}`);
  }
});

test("ip: a bad ip block in one file does not stop the next file", () => {
  const bad = doc("aa", 1, { status: "owned" });
  const good = doc("bb", 2, OWNED());
  const r = build.generateFromSources([src("aa.json", bad), src("bb.json", good)]);
  assert.equal(r.failed, 1);
  assert.equal(r.succeeded, 1);
  assert.ok(r.files["src/content/bb/lesson-1.js"], "the good file is still generated");
});

/* ------------------------------------------------------- 2. the text guard */

// Where guarded text lives: [label, a function that puts the text there, the error place].
const TARGETS = [
  ["notice.full line", (d, t) => { d.ip.notice.full[0] = t; }, "ip.notice.full[0]"],
  ["notice.short", (d, t) => { d.ip.notice.short = t; }, "ip.notice.short"],
  ["card note", (d, t) => { d.groups[0].lessons[0].cards[0].note = t; }, "groups[0].lessons[0].cards[0].note"],
];

const REFUSED = [
  ["*/ (would close the comment)", "ends */ here"],
  ["less-than <", "a < b"],
  ["</script>", "x </script> y"],
  ["CR", "a" + ch(13) + "b"],
  ["LF", "a" + ch(10) + "b"],
  ["U+2028", "a" + LS + "b"],
  ["U+2029", "a" + PS + "b"],
  ["TAB", "a" + ch(9) + "b"],
  ["NUL", "a" + ch(0) + "b"],
  ["U+001F", "a" + ch(0x1f) + "b"],
  ["DEL U+007F", "a" + ch(0x7f) + "b"],
  ["U+0085", "a" + ch(0x85) + "b"],
  ["U+009F", "a" + ch(0x9f) + "b"],
  ["BOM U+FEFF", "a" + ch(0xfeff) + "b"],
  ["bidi LRM U+200E", "a" + ch(0x200e) + "b"],
  ["bidi RLM U+200F", "a" + ch(0x200f) + "b"],
  ["bidi U+202A", "a" + ch(0x202a) + "b"],
  ["bidi U+202B", "a" + ch(0x202b) + "b"],
  ["bidi U+202C", "a" + ch(0x202c) + "b"],
  ["bidi U+202D", "a" + ch(0x202d) + "b"],
  ["bidi U+202E", "a" + ch(0x202e) + "b"],
  ["bidi U+2066", "a" + ch(0x2066) + "b"],
  ["bidi U+2067", "a" + ch(0x2067) + "b"],
  ["bidi U+2068", "a" + ch(0x2068) + "b"],
  ["bidi U+2069", "a" + ch(0x2069) + "b"],
  ["Arabic letter mark U+061C", "a" + ch(0x061c) + "b"],
  ["ZWJ U+200D", "a" + ch(0x200d) + "b"],
  ["ZWNJ U+200C", "a" + ch(0x200c) + "b"],
  ["zero-width space U+200B", "a" + ch(0x200b) + "b"],
  ["lone high surrogate", "a" + ch(0xd800) + "b"],
  ["lone low surrogate", "a" + ch(0xdc00) + "b"],
  ["unassigned U+0378", "a" + ch(0x378) + "b"],
  ["NFD (e + combining accent)", "cafe" + ch(0x301)],
  ["a number, not text", 42],
  ["an array, not text", ["x"]],
];

for (const [tname, put, place] of TARGETS) {
  for (const [name, text] of REFUSED) {
    test(`text guard (${tname}): refuses ${name}`, () => {
      const d = doc("xx", 1, OWNED());
      put(d, text);
      assertErrorAt(d, place);
    });
  }

  test(`text guard (${tname}): accepts apostrophe, accents, dash, Bengali, Japanese, emoji, a space`, () => {
    const ok = "It's café – বাংলা 日本語 😀 fine.";
    const d = doc("xx", 1, OWNED());
    put(d, ok);
    assertValid(d);
  });
}

test("text guard: Private Use is refused in the notice, allowed in a card note", () => {
  const pua = "a" + ch(0xe000) + "b";
  for (const [tname, put, place] of TARGETS.slice(0, 2)) {
    const d = doc("xx", 1, OWNED());
    put(d, pua);
    assertErrorAt(d, place);
    assert.ok(tname);
  }
  const d = doc("xx", 1, OWNED());
  d.groups[0].lessons[0].cards[0].note = pua;
  assertValid(d);
});

test("text guard: a refused character is named in the error", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.full[0] = "a" + ch(0x202e) + "b";
  assert.ok(errorsOf(d).some((e) => e.includes("U+202E")), errorsOf(d).join("\n"));
});

test("text guard: ZWJ and ZWNJ are refused in the notice and note only, not in a title, answer or hint", () => {
  const d = doc("xx", 1, { status: "natural" });
  const l = d.groups[0].lessons[0];
  l.title = "T" + ch(0x200d) + "x";
  l.cards[0].answer = "a" + ch(0x200c) + "b";
  l.cards[0].hint = "h" + ch(0x200d) + "i";
  assertValid(d);
});

/* ------------------------------------------------------------- 2b. lengths */

test("lengths: notice.full 8 lines pass, 9 fail", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.full = Array.from({ length: 8 }, (_, i) => "Line " + i);
  assertValid(d);
  d.ip.notice.full.push("Line 8");
  assertErrorAt(d, "ip.notice.full");
});

test("lengths: a notice line of 160 characters passes, 161 fails", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.full = ["a".repeat(160)];
  assertValid(d);
  d.ip.notice.full = ["a".repeat(161)];
  assertErrorAt(d, "ip.notice.full[0]");
});

test("lengths: counted in code points, so 160 emoji pass and 161 fail", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.full = ["😀".repeat(160)];
  assertValid(d);
  d.ip.notice.full = ["😀".repeat(161)];
  assertErrorAt(d, "ip.notice.full[0]");
  d.ip.notice.full = ["Line"];
  d.ip.notice.short = "😀".repeat(200);
  assertValid(d);
  d.ip.notice.short = "😀".repeat(201);
  assertErrorAt(d, "ip.notice.short");
});

test("lengths: notice.short 200 passes, 201 fails", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.short = "s".repeat(200);
  assertValid(d);
  d.ip.notice.short = "s".repeat(201);
  assertErrorAt(d, "ip.notice.short");
});

test("lengths: card note 280 passes, 281 fails, empty fails", () => {
  const d = doc("xx", 1, { status: "natural" });
  const card = d.groups[0].lessons[0].cards[0];
  card.note = "n".repeat(280);
  assertValid(d);
  card.note = "n".repeat(281);
  assertErrorAt(d, "groups[0].lessons[0].cards[0].note");
  card.note = "";
  assertErrorAt(d, "groups[0].lessons[0].cards[0].note");
});

test("lengths: an empty full line fails, and so does a blank (spaces only) line", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.full = ["ok", ""];
  assertErrorAt(d, "ip.notice.full[1]");
  d.ip.notice.full = ["ok", "   "];
  assertErrorAt(d, "ip.notice.full[1]");
});

test("text guard: every bad notice line is reported, not just the first", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.full = ["a < b", "fine", "ends */", ""];
  const e = errorsOf(d);
  for (const i of [0, 2, 3]) assert.ok(e.some((m) => m.startsWith(`data/xx.json ip.notice.full[${i}]: `)), e.join("\n"));
  assert.ok(!e.some((m) => m.startsWith("data/xx.json ip.notice.full[1]: ")), "the good line is not reported");
});

/* --------------------------------------------------- 2c. the card note field */

test("card note: kept on the model, never shown or written; a typo key still fails", () => {
  const d = doc("xx", 1, { status: "natural" });
  d.groups[0].lessons[0].cards[0].note = "NOTE-MARK-ZQ";
  const p = build.parseSources([src("xx.json", d)]);
  assert.deepEqual(p.errors, []);
  assert.equal(p.models[0].groups[0].lessons[0].cards[0].note, "NOTE-MARK-ZQ");
  assert.equal("note" in p.models[0].groups[0].lessons[0].cards[1], false, "a card without a note has no note key");
  const r = gen(d);
  for (const [rel, text] of Object.entries(r.files)) {
    assert.ok(!text.includes("NOTE-MARK-ZQ"), `${rel} must not hold the card note`);
  }
  const typo = doc("xx", 1, { status: "natural" });
  typo.groups[0].lessons[0].cards[0].nots = "x";
  assertErrorAt(typo, "groups[0].lessons[0].cards[0].nots");
});

test("card note: output is identical with and without a note", () => {
  const plain = doc("xx", 1, { status: "natural" });
  const noted = doc("xx", 1, { status: "natural" });
  noted.groups[0].lessons[0].cards.forEach((c, i) => { c.note = "Note " + i; });
  assert.deepEqual(gen(noted).files, gen(plain).files);
});

test("card note: a note on a cardRefs source card is also data only", () => {
  const d = doc("xx", 1, { status: "natural" });
  d.groups[0].lessons[0].cards[0].note = "NOTE-MARK-ZQ";
  d.groups[0].lessons.push({ slug: "all", label: "All", title: "All", rollup: false, cardRefs: ["lesson-1.001", "lesson-1.002"] });
  const r = gen(d);
  assert.deepEqual(r.errors, []);
  for (const text of Object.values(r.files)) assert.ok(!text.includes("NOTE-MARK-ZQ"));
});

/* --------------------------------------------------------------- 3. output */

test("output: notice lines come right after the banner in a live and a parked lesson file", () => {
  const r = gen(doc("xx", 1, OWNED()));
  assert.deepEqual(r.errors, []);
  for (const rel of ["src/content/xx/lesson-1.js", "parked/content/xx/lesson-2.js"]) {
    assert.ok(r.files[rel], `${rel} generated`);
    assert.ok(r.files[rel].startsWith(BANNER + "// Line one.\n// Line two.\nwindow.LB_LESSON = {\n"), `${rel}:\n${r.files[rel]}`);
    const { lesson } = runLesson(r.files[rel]);
    assert.ok(lesson.id.startsWith("xx/"), "the file still runs and sets the lesson");
  }
});

test("output: the exact text of a lesson file with a notice", () => {
  const r = gen(doc("xx", 1, LICENSED()));
  assert.equal(r.files["src/content/xx/lesson-1.js"], BANNER + [
    "// Line one.",
    "window.LB_LESSON = {",
    '  id: "xx/lesson-1",',
    '  title: "One",',
    "  revealMs: 5000,",
    "  cards: [",
    '    { prompt: 0, answer: "zero", hint: "Zee", audio: "" },',
    '    { prompt: 1, answer: "one", hint: "Wun", audio: "" }',
    "  ]",
    "};",
    '(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "xx/lesson-1", title: "One" });',
    "",
  ].join("\n"));
});

test("output: notice lines sit above that language's block in languages.js, and the manifest still runs", () => {
  const r = gen(doc("xx", 1, OWNED()));
  const text = r.files["src/content/languages.js"];
  assert.ok(text.startsWith(BANNER + [
    "(function () {",
    '  "use strict";',
    "",
    "  window.LB_LANGUAGES = window.LB_LANGUAGES || [];",
    "",
    "  // Line one.",
    "  // Line two.",
    "  window.LB_LANGUAGES.push({",
    '    code: "xx",',
  ].join("\n")), text);
  // LB-44: a language with a short notice carries one extra key, notice. The rest is as before.
  const langs = runManifest(text);
  assert.deepEqual(Object.keys(langs[0]), ["code", "name", "notice", "defaultLesson", "groups"]);
  assert.equal(langs[0].notice, "Short.");
  assert.deepEqual(langs[0].groups, [{ label: "Numbers", lessons: [{ id: "xx/lesson-1", label: "Lesson 1", count: 2, rollup: true }] }]);
});

test("output: with two languages the notice sits only above the language that has one", () => {
  const r = build.generateFromSources([src("aa.json", doc("aa", 1, { status: "natural" })), src("bb.json", doc("bb", 2, OWNED()))]);
  assert.deepEqual(r.errors, []);
  const text = r.files["src/content/languages.js"];
  const lines = text.split("\n");
  const at = (needle) => lines.findIndex((l) => l.includes(needle));
  const comments = lines.map((l, i) => [l, i]).filter(([l]) => /^\s*\/\//.test(l)).map(([, i]) => i);
  assert.deepEqual(comments.length, 2);
  assert.ok(comments.every((i) => i > at('code: "aa"')), "no comment above or in the first block");
  assert.equal(lines[at('code: "bb"') - 1], "  window.LB_LANGUAGES.push({");
  assert.equal(lines[at('code: "bb"') - 2], "  // Line two.");
  assert.ok(r.files["src/content/aa/lesson-1.js"].startsWith(BANNER + "window.LB_LESSON"), "the natural language's lesson file has no notice");
  assert.ok(r.files["src/content/bb/lesson-1.js"].startsWith(BANNER + "// Line one."), "the owned language's lesson file has one");
});

test("output: an empty notice (free) writes nothing: no comment line in any file", () => {
  const r = gen(doc("xx", 1, FREE()));
  assert.deepEqual(r.errors, []);
  for (const [rel, text] of Object.entries(r.files)) {
    assert.ok(!text.split("\n").some((l) => /^\s*\/\//.test(l)), `${rel} must have no comment line`);
  }
  assert.ok(r.files["src/content/xx/lesson-1.js"].startsWith(BANNER + "window.LB_LESSON = {"));
});

test("output: a free language with a non-empty full notice does get its lines", () => {
  const d = doc("xx", 1, FREE());
  d.ip.notice.full = ["Credit line."];
  const r = gen(d);
  assert.ok(r.files["src/content/xx/lesson-1.js"].startsWith(BANNER + "// Credit line.\nwindow.LB_LESSON"));
});

test("output: status, freeOnly and ruling are never written to any file; notice.short only to languages.js (LB-44)", () => {
  const d = doc("xx", 1, {
    status: "licensed", freeOnly: true,
    notice: { full: ["Full line."], short: "SHORT-MARK-ZQ" },
    ruling: { id: "IP-4242", date: "2026-11-14" },
  });
  const r = gen(d);
  assert.deepEqual(r.errors, []);
  for (const [rel, text] of Object.entries(r.files)) {
    // The short notice may sit in the manifest only; no lesson file holds it.
    if (!rel.endsWith("languages.js")) assert.ok(!text.includes("SHORT-MARK-ZQ"), `${rel} must not hold the short notice`);
    for (const needle of ["IP-4242", "2026-11-14", "freeOnly", "ruling", "licensed", "status"]) {
      assert.ok(!text.includes(needle), `${rel} must not hold "${needle}"`);
    }
  }
});

test("output: the notice text is written exactly (apostrophe, accents, emoji, Bengali), one line per entry", () => {
  const d = doc("xx", 1, OWNED());
  d.ip.notice.full = ["It's café – বাংলা 日本語 😀"];
  const text = gen(d).files["src/content/xx/lesson-1.js"];
  assert.equal(text.split("\n")[2], "// It's café – বাংলা 日本語 😀");
});

test("output: the same data builds the same bytes twice", () => {
  const a = gen(doc("xx", 1, OWNED())).files;
  const b = gen(doc("xx", 1, OWNED())).files;
  assert.deepEqual(a, b);
});

/* ------------------------------------------- 4. the writer's second check */

const modelLesson = { slug: "a", title: "A", rollup: true, cards: [{ prompt: "p", answer: "a", hint: "h", audio: "" }] };

test("writer: renderLesson refuses a notice line with a line break (a second check after validation)", () => {
  for (const bad of ["a" + ch(10) + "b", "a" + ch(13) + "b", "a" + LS + "b", "a" + PS + "b"]) {
    assert.throws(() => build.renderLesson("xx", modelLesson, [bad]), /line break/, JSON.stringify(bad));
  }
  assert.throws(() => build.renderLesson("xx", modelLesson, [5]), /not text|line break/);
});

test("writer: renderLesson with no notice, an empty notice or undefined writes the same bytes", () => {
  const a = build.renderLesson("xx", modelLesson);
  assert.equal(build.renderLesson("xx", modelLesson, []), a);
  assert.equal(build.renderLesson("xx", modelLesson, undefined), a);
  assert.ok(a.startsWith(BANNER + "window.LB_LESSON = {"));
});

test("writer: renderManifest refuses a notice line with a line break", () => {
  const model = (line) => ({
    code: "xx", name: "X", defaultLesson: "lesson-1",
    ip: { status: "owned", notice: { full: [line] } },
    groups: [{ label: "N", lessons: [{ slug: "lesson-1", label: "L", cards: [{}], rollup: true }] }],
  });
  for (const bad of ["a" + ch(10) + "b", "a" + ch(13) + "b", "a" + LS + "b", "a" + PS + "b"]) {
    assert.throws(() => build.renderManifest([model(bad)]), /line break/, JSON.stringify(bad));
  }
  assert.doesNotThrow(() => build.renderManifest([model("fine")]));
});

/* ---------------------- 4b. rebuild-over and stale delete with notice lines */

const FAKE_ROOT = path.resolve(path.sep, "fake-root");

function fakeFs(initial) {
  const files = new Map();
  for (const [rel, text] of Object.entries(initial)) files.set(path.join(FAKE_ROOT, rel), text);
  const isDir = (p) => [...files.keys()].some((k) => k.startsWith(p + path.sep));
  return {
    files,
    get(rel) { return files.get(path.join(FAKE_ROOT, rel)); },
    existsSync: (p) => files.has(p) || isDir(p),
    readFileSync: (p) => {
      if (!files.has(p)) throw Object.assign(new Error("ENOENT " + p), { code: "ENOENT" });
      return files.get(p);
    },
    writeFileSync: (p, data) => { files.set(p, String(data)); },
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

test("rebuild: a file that already holds notice lines (it has the banner) is rebuilt over, and check sees it", () => {
  const old = gen(doc("xx", 1, OWNED())).files;
  const f = fakeFs(old);
  assert.deepEqual(build.check(old, FAKE_ROOT, f), { differs: [], missing: [], stale: [] });

  const d = doc("xx", 1, OWNED());
  d.ip.notice.full = ["Changed line."];
  const fresh = gen(d).files;
  assert.deepEqual(build.check(fresh, FAKE_ROOT, f).differs.sort(), Object.keys(fresh).sort(), "every file differs from the old notice");
  const w = build.write(fresh, FAKE_ROOT, f);
  assert.deepEqual(w.errors, []);
  assert.ok(f.get("src/content/xx/lesson-1.js").startsWith(BANNER + "// Changed line.\n"));
  assert.deepEqual(build.check(fresh, FAKE_ROOT, f), { differs: [], missing: [], stale: [] });
});

test("rebuild: a notice added to a language that had none is written over its old files", () => {
  const old = gen(doc("xx", 1, { status: "natural" })).files;
  const f = fakeFs(old);
  const fresh = gen(doc("xx", 1, OWNED())).files;
  const w = build.write(fresh, FAKE_ROOT, f);
  assert.deepEqual(w.errors, []);
  assert.ok(f.get("src/content/xx/lesson-1.js").startsWith(BANNER + "// Line one.\n"));
});

test("stale delete: a stale lesson file that holds notice lines is deleted (it has the banner)", () => {
  const withBoth = doc("xx", 1, OWNED());
  withBoth.groups[0].lessons.push({ slug: "lesson-3", label: "L3", title: "Three", rollup: true, cards: [{ id: "lesson-3.001", prompt: 3, answer: "t", hint: "t" }] });
  const old = gen(withBoth).files;
  assert.ok(old["src/content/xx/lesson-3.js"].includes("// Line one."));
  const f = fakeFs(old);
  const fresh = gen(doc("xx", 1, OWNED())).files;
  const w = build.write(fresh, FAKE_ROOT, f);
  assert.deepEqual(w.errors, []);
  assert.ok(w.deleted.includes("src/content/xx/lesson-3.js"), JSON.stringify(w));
  assert.equal(f.get("src/content/xx/lesson-3.js"), undefined);
});

test("stale delete: a hand-written file with a comment but no banner is kept and never overwritten", () => {
  const fresh = gen(doc("xx", 1, OWNED())).files;
  const f = fakeFs({ "src/content/xx/mine.js": "// Line one.\nvar mine = 1;\n" });
  const w = build.write(fresh, FAKE_ROOT, f);
  assert.ok(w.keptStale.includes("src/content/xx/mine.js"), JSON.stringify(w));
  assert.equal(f.get("src/content/xx/mine.js"), "// Line one.\nvar mine = 1;\n");
  const g = fakeFs({ "src/content/xx/lesson-1.js": "// Line one.\nwindow.LB_LESSON = {};\n" });
  assert.throws(() => build.write(fresh, FAKE_ROOT, g), /banner|GENERATED|overwrit|refus/i);
  assert.equal(g.get("src/content/xx/lesson-1.js"), "// Line one.\nwindow.LB_LESSON = {};\n");
});

/* ----------------------------------------- 5. the real languages: unchanged */

test("real languages: every data file is format 2 with ip natural and nothing else in ip", () => {
  const sources = build.readSources(DATA_DIR);
  assert.ok(sources.length >= 4);
  for (const s of sources) {
    const j = JSON.parse(s.text);
    assert.equal(j.formatVersion, 2, s.name);
    assert.deepEqual(j.ip, { status: "natural" }, s.name);
  }
});

test("real languages: no comment line in any generated lesson file or in languages.js (byte-for-byte as before)", () => {
  const files = build.generate(DATA_DIR).files;
  let lessonFiles = 0;
  for (const [rel, text] of Object.entries(files)) {
    const lines = text.split("\n");
    assert.ok(!lines.some((l) => /^\s*\/\//.test(l)), `${rel} must have no // comment line`);
    if (rel.endsWith("languages.js")) {
      assert.equal(lines[2], "(function () {", rel);
    } else {
      lessonFiles++;
      assert.equal(lines[2], "window.LB_LESSON = {", `${rel}: the lesson starts right after the banner`);
    }
  }
  assert.ok(lessonFiles >= 4 * 20, "the real lesson files were checked");
});

/* ------------------------------------------- 6. the made-up fixture languages */

const fixtureSources = () => build.readSources(FIXTURE_DIR);
const fixtureDoc = (name) => JSON.parse(fixtureSources().find((s) => s.name === name).text);

test("fixtures: qaa is owned with a notice, qab is numbers-only and free with an empty notice", () => {
  const a = fixtureDoc("qaa.json");
  assert.equal(a.formatVersion, 2);
  assert.equal(a.ip.status, "owned");
  assert.ok(a.ip.notice.full.length >= 1 && a.ip.notice.short.length > 0);
  const b = fixtureDoc("qab.json");
  assert.equal(b.formatVersion, 2);
  assert.equal(b.ip.status, "free");
  assert.deepEqual(b.ip.notice, { full: [], short: "" });
  assert.deepEqual(b.groups.map((g) => g.label), ["Numbers"], "qab has a single group: a language may have only some lesson groups");
});

test("fixtures: every fixture file builds with no error", () => {
  const r = build.generate(FIXTURE_DIR);
  assert.deepEqual(r.errors, []);
  assert.equal(r.succeeded, 2);
});

test("fixtures: qaa's notice lines are written after the banner, and above its block in languages.js", () => {
  const a = fixtureDoc("qaa.json");
  const r = build.generate(FIXTURE_DIR);
  const want = a.ip.notice.full.map((l) => "// " + l).join("\n");
  for (const [rel, text] of Object.entries(r.files)) {
    if (!rel.includes("/qaa/")) continue;
    assert.ok(text.startsWith(BANNER + want + "\nwindow.LB_LESSON = {\n"), rel);
  }
  const m = r.files["src/content/languages.js"];
  const above = a.ip.notice.full.map((l) => "  // " + l).join("\n");
  assert.ok(m.includes("\n" + above + "\n  window.LB_LANGUAGES.push({\n    code: \"qaa\","), m);
});

test("fixtures: qab writes no notice and holds no hostile text; only qaa does", () => {
  const r = build.generate(FIXTURE_DIR);
  for (const [rel, text] of Object.entries(r.files)) {
    if (!rel.includes("/qab/")) continue;
    assert.ok(text.startsWith(BANNER + "window.LB_LESSON = {"), rel);
  }
  const m = r.files["src/content/languages.js"];
  const qabAt = m.indexOf('code: "qab"');
  assert.ok(qabAt > 0);
  const before = m.slice(m.lastIndexOf("window.LB_LANGUAGES.push({", qabAt) - 40, qabAt);
  assert.ok(!/\/\//.test(before), "no comment above qab's block");
  assert.ok(!fixtureSources().find((s) => s.name === "qab.json").text.includes("</script>"), "qab holds no hostile text");
  assert.ok(fixtureSources().find((s) => s.name === "qaa.json").text.includes("</script>"), "the hostile text is in qaa");
});

test("fixtures: qaa's notice is plain text (the hostile text is in its lessons, not its notice)", () => {
  const a = fixtureDoc("qaa.json");
  const r = build.generateFromSources([src("qaa.json", a)]);
  assert.deepEqual(r.errors, []);
  for (const line of [...a.ip.notice.full, a.ip.notice.short]) assert.ok(!/[<]|\*\//.test(line), line);
});

test("fixtures: with the made-up languages added the real files stay byte-identical", () => {
  const real = build.generate(DATA_DIR).files;
  const both = build.generateFromSources(build.readSources(DATA_DIR).concat(fixtureSources())).files;
  for (const [rel, text] of Object.entries(real)) {
    if (rel.endsWith("languages.js")) continue;
    assert.equal(both[rel], text, rel);
  }
});
