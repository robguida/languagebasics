/* LB-44: Klingon (tlh) numbers lessons 1-6.
 *
 * Reads the Klingon data through the build's own parser (test/helpers/load-data.js)
 * and checks the committed generated files. The Klingon forms themselves belong to
 * the linguist; these tests only guard the shape: the lesson list, the letters,
 * the apostrophe, the line splits and the notice. Per-item checks collect every
 * failure and report them together (one bad card never hides the rest).
 * Built-ins only.
 */
"use strict";

const baseTest = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadData, repoWorld, generatedPath } = require("./helpers/load-data.js");

const ROOT = path.resolve(__dirname, "..");
const data = loadData();
const world = repoWorld();
const tlhRows = data.lessons.filter((l) => l.code === "tlh");
const tlhDoc = data.docs.find((d) => d.language && d.language.code === "tlh");
// Klingon is switched off by removing data/tlh.json: then every test here is skipped, with this reason.
const SKIP = !tlhDoc && "Klingon is switched off (no data/tlh.json)";
const test = (name, fn) => baseTest(name, { skip: SKIP }, fn);
const tlhCards = [];
for (const g of (tlhDoc ? tlhDoc.groups : [])) for (const l of g.lessons) for (const c of (l.cards || [])) tlhCards.push({ lesson: l.slug, c });

const ids = (c) => `${c.lesson}/${c.c.id}`;
const lessonText = (row) => fs.readFileSync(path.join(ROOT, generatedPath(row)), "utf8");

/** Run a check on every item; one throwing or failing item never stops the rest. */
function collect(items, check) {
  const bad = [];
  for (const it of items) {
    try { const m = check(it); if (m) bad.push(m); } catch (e) { bad.push(`${ids(it)}: ${e.message}`); }
  }
  return bad;
}

// Klingon letters, case-exact: a b ch D e gh H I j l m n ng o p q Q r S t tlh u v w y and the apostrophe
const WORD = /^(?:ch|gh|ng|tlh|[abDeHIjlmnopqQrStuvwy]|')+$/;
const WA_UY = "wa''uy'";

test("Klingon has exactly lessons 1 to 6 live, in order, one Numbers group, none parked", () => {
  assert.deepEqual(tlhRows.map((r) => r.slug), ["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5", "lesson-6"]);
  assert.deepEqual(tlhRows.map((r) => r.count), [11, 9, 8, 80, 45, 20]);
  assert.ok(tlhRows.every((r) => !r.parked && r.group === "Numbers"));
  const lang = data.languages.find((l) => l.code === "tlh");
  assert.equal(lang.groups.length, 1);
  assert.equal(lang.defaultLesson, "tlh/lesson-1");
  assert.equal(tlhDoc.ip.status, "owned");
  for (const r of tlhRows) assert.ok(fs.existsSync(path.join(ROOT, generatedPath(r))), `${r.id} generated file exists`);
  const dir = fs.readdirSync(path.join(ROOT, "src", "content", "tlh")).sort();
  assert.deepEqual(dir, tlhRows.map((r) => r.file).sort(), "no extra file in src/content/tlh");
  const { languages } = world.loadManifest();
  const live = languages.find((l) => l.code === "tlh").groups.flatMap((g) => g.lessons.map((l) => l.id));
  assert.deepEqual([...live], tlhRows.map((r) => r.id), "the manifest lists the same six");
});

test("every answer uses only Klingon letters, case kept, spaces and the ' | ' split", () => {
  const bad = collect(tlhCards, (it) => {
    const a = it.c.answer;
    if (typeof a !== "string" || !a.length) return `${ids(it)}: empty answer`;
    for (const line of a.split(" | ")) {
      for (const w of line.split(" ")) if (!WORD.test(w)) return `${ids(it)}: "${w}" has a character that is not a Klingon letter`;
    }
    return null;
  });
  assert.deepEqual(bad, []);
});

const rangeClass = (ranges) => new RegExp("[" + ranges.map(([a, b]) => String.fromCharCode(a) + (b ? "-" + String.fromCharCode(b) : "")).join("") + "]");

test("the apostrophe is the straight U+0027 only: no curly or look-alike marks in answers and hints", () => {
  // U+2018-201B, 02BC, 02BB, 02B9, 02C8, 0060, 00B4, 2032, 2035, FF07, 055A, A78C
  const FORBID = rangeClass([[0x2018, 0x201B], [0x2BC], [0x2BB], [0x2B9], [0x2C8], [0x60], [0xB4], [0x2032], [0x2035], [0xFF07], [0x55A], [0xA78C]]);
  const bad = collect(tlhCards, (it) => {
    if (FORBID.test(it.c.answer)) return `${ids(it)}: look-alike apostrophe in answer`;
    if (FORBID.test(it.c.hint)) return `${ids(it)}: look-alike apostrophe in hint`;
    return null;
  });
  assert.deepEqual(bad, []);
  assert.ok(tlhCards.some((x) => x.c.answer.includes("'")), "the data does use the apostrophe");
});

test("NFC and no hidden characters in any answer, hint or prompt", () => {
  const HIDDEN = rangeClass([[0, 0x1F], [0x7F, 0x9F], [0xA0], [0xAD], [0x200B, 0x200F], [0x2028, 0x202F], [0x2060, 0x206F], [0xFEFF], [0xFFF9, 0xFFFC]]);
  const bad = collect(tlhCards, (it) => {
    for (const k of ["answer", "hint", "prompt"]) {
      const v = String(it.c[k]);
      if (v !== v.normalize("NFC")) return `${ids(it)}: ${k} is not NFC`;
      if (HIDDEN.test(v)) return `${ids(it)}: ${k} has a hidden or control character`;
      if (v !== v.trim() || /\s{2,}/.test(v)) return `${ids(it)}: ${k} has stray spaces`;
    }
    return null;
  });
  assert.deepEqual(bad, []);
});

test("' | ' splits: at most 4 lines, none empty, each split sits at a space between whole words", () => {
  const bad = collect(tlhCards, (it) => {
    const a = it.c.answer;
    const lines = a.split(" | ");
    if (lines.length > 4) return `${ids(it)}: ${lines.length} lines`;
    if (lines.some((l) => !l.trim())) return `${ids(it)}: empty line`;
    if (/\S\|/.test(a) || /\|\S/.test(a)) return `${ids(it)}: a bar touches a word`;
    if (lines.join(" ").split(" ").some((w) => !WORD.test(w))) return `${ids(it)}: a split cuts a word`;
    // A split must fall after a whole magnitude word, so "w | a'" and "cha'b | Ip" are caught.
    for (let i = 0; i < lines.length - 1; i++) {
      if (!/(?:'uy'|bIp|netlh|SaD|vatlh|maH)$/.test(lines[i])) return `${ids(it)}: line ${i + 1} ("${lines[i]}") does not end with a magnitude word`;
    }
    return null;
  });
  assert.deepEqual(bad, []);
  assert.ok(tlhCards.some((x) => x.c.answer.includes(" | ")), "some answers do split");
});

test("spot checks: 7, 4, 10 and the hint for 8", () => {
  const find = (lesson, p) => tlhCards.find((x) => x.lesson === lesson && String(x.c.prompt) === String(p)).c;
  assert.equal(find("lesson-1", 7).answer, "Soch");
  assert.equal(find("lesson-1", 4).answer, "loS");
  assert.equal(find("lesson-1", 10).answer, "wa'maH");
  assert.equal(find("lesson-1", 8).hint, "Chorgh");
});

test("the million cards name wa''uy' with the double apostrophe: 1,000,000, 1,000,001 and 1,234,567", () => {
  for (const p of ["1,000,000", "1,000,001", "1,234,567"]) {
    const hit = tlhCards.find((x) => String(x.c.prompt) === p);
    assert.ok(hit, p + " has a card");
    assert.ok(hit.c.answer.includes(WA_UY), p + " answer holds wa''uy': " + hit.c.answer);
  }
});

test("wa''uy' keeps its double apostrophe from the data to the generated file, byte for byte", () => {
  const withIt = tlhCards.filter((x) => x.c.answer.includes(WA_UY));
  assert.ok(withIt.length >= 2, "1,000,000 and 1,000,001 at least");
  const bad = collect(withIt, (it) => {
    const row = tlhRows.find((r) => r.slug === it.lesson);
    if (!lessonText(row).includes(JSON.stringify(it.c.answer))) return `${ids(it)}: answer not byte-identical in the generated file`;
    const card = world.loadLesson(row).lesson.cards.find((k) => String(k.prompt) === String(it.c.prompt));
    if (!card || card.answer !== it.c.answer) return `${ids(it)}: loaded answer differs`;
    return null;
  });
  assert.deepEqual(bad, []);
});

test("every loaded answer, hint and prompt equals the data", () => {
  const bad = [];
  for (const row of tlhRows) {
    let lesson;
    try { lesson = world.loadLesson(row).lesson; } catch (e) { bad.push(`${row.id}: could not load (${e.message})`); continue; }
    const src = tlhCards.filter((x) => x.lesson === row.slug);
    if (lesson.cards.length !== src.length) { bad.push(`${row.id}: ${lesson.cards.length} cards, data has ${src.length}`); continue; }
    src.forEach((it, i) => {
      const k = lesson.cards[i];
      if (k.answer !== it.c.answer || k.hint !== it.c.hint || String(k.prompt) !== String(it.c.prompt)) bad.push(`${ids(it)}: differs`);
    });
  }
  assert.deepEqual(bad, []);
});

test("notice: short one in the manifest for tlh only; full one as comment lines at the top of every tlh lesson file", () => {
  const { languages } = world.loadManifest();
  for (const l of languages) assert.equal(typeof l.notice === "string" && l.notice.length > 0, l.code === "tlh", `notice on ${l.code}`);
  assert.equal(languages.find((l) => l.code === "tlh").notice, tlhDoc.ip.notice.short);
  const full = tlhDoc.ip.notice.full;
  assert.ok(full.length >= 1);
  const bad = collect(tlhRows.map((r) => ({ lesson: r.slug, c: { id: r.id } })), (it) => {
    const row = tlhRows.find((r) => r.slug === it.lesson);
    const lines = lessonText(row).split("\n");
    if (!full.every((f, i) => lines[2 + i] === "// " + f)) return `${row.id}: the full notice is not the comment block under the banner`;
    if (!/^window\.LB_LESSON = \{/.test(lines[2 + full.length])) return `${row.id}: the lesson does not start right after the notice`;
    return null;
  });
  assert.deepEqual(bad, []);
  for (const r of data.lessons.filter((l) => l.code !== "tlh")) {
    assert.ok(!lessonText(r).split("\n").some((l) => /^\s*\/\//.test(l)), `${r.id} has no comment line`);
  }
});

test("lesson and card notes in the data (such as the ones on 10,000 and 100,000) are never written to a generated file", () => {
  const all = tlhRows.map(lessonText).join("\n");
  const leaked = [];
  for (const l of tlhDoc.groups.flatMap((g) => g.lessons)) {
    for (const n of (l.notes || [])) if (n.length > 12 && all.includes(n)) leaked.push(n);
    for (const c of (l.cards || [])) if (c.note && all.includes(c.note)) leaked.push(c.note);
  }
  assert.deepEqual(leaked, []);
});