/* LB-23 manifest-integrity guard — the language/lesson manifest is the single
 * source of truth for the picker, the ?lesson= whitelist, per-lesson counts, and
 * the rollup flags. This closes the previously-UNTESTED gap between the picker
 * options, the whitelist, and the real data files (before LB-23 those lived in
 * three hand-maintained index.html spots with no cross-check).
 *
 * Run:  node --test
 *
 * Coverage:
 *   1. registration — window.LB_LANGUAGES self-registers sq with 3 groups.
 *   2. data-file backing — every manifest id has a data file whose cards.length
 *      equals the manifest count AND the schema EXPECTED count.
 *   3. picker-model resolution — every buildPickerModel() option value resolves
 *      to a manifest lesson, and the option set === the manifest lesson set
 *      (no orphan option, no missing lesson). This is the "every optgroup value
 *      resolves to a manifest entry" guarantee, now that the picker is manifest
 *      -driven.
 *   4. rollup is EXPLICIT — every lesson carries a boolean rollup, the
 *      rollup-excluded set is exactly the expected 11 decks, and each manifest
 *      rollup flag MATCHES the flag that deck's data file pushes onto
 *      window.LB_LESSONS (so the picker source and the mastery source can never
 *      drift).
 *   5. id stability — the manifest lesson ids are BYTE-IDENTICAL to the shipped
 *      set (localStorage mastery/Leitner/streak is keyed on them).
 *   6. language <select> threshold — shouldShowLanguageDropdown is false at one
 *      language and true at two.
 *   7. loop resilience — buildPickerModel skips a bad lesson entry and keeps the
 *      valid ones (never aborts the whole build on one bad row).
 *
 * Built-ins only: node:test, node:assert, node:fs, node:path (+ the shared vm
 * lesson/manifest loader). No jsdom, no npm installs.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadLesson, loadManifest, CONTENT_DIR } = require("./helpers/load-lesson.js");

const { languages, LBManifest } = loadManifest();

// Values built INSIDE the vm sandbox (manifest.js output) carry the sandbox's
// Object/Array prototypes, which node:assert/strict deepEqual rejects as a
// prototype mismatch even when the shape is identical. Round-trip through JSON to
// re-home a value in this realm before a deep comparison.
function plain(x) {
  return JSON.parse(JSON.stringify(x));
}

// id "sq/lesson-1" -> data file "lesson-1.js"
function fileForId(id) {
  return id.split("/")[1] + ".js";
}

/* Schema EXPECTED { id: count }, read from the sibling test (keyed by language,
 * every entry carries its own id). */
function schemaExpected() {
  const src = fs.readFileSync(path.resolve(__dirname, "schema.test.js"), "utf8");
  const out = {};
  const re = /"[^"]+\.js"\s*:\s*\{\s*count:\s*(\d+),\s*id:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[2]] = Number(m[1]);
  return out;
}

// The shipped 20 lesson ids in picker order — LOCKED. A change here is a change
// to a ?lesson= value, which would strand saved localStorage state; this array
// makes any such change fail loudly.
const LOCKED_IDS = [
  "sq/lesson-1", "sq/lesson-2", "sq/lesson-3",
  "sq/lesson-4", "sq/lesson-5", "sq/lesson-6",
  "sq/alphabet-vowels", "sq/alphabet-consonants",
  "sq/alphabet-digraphs", "sq/alphabet-all",
  "sq/words-1", "sq/phrases-1", "sq/words-2", "sq/phrases-2",
  "sq/words-3", "sq/phrases-3", "sq/words-4", "sq/phrases-4",
  "sq/words-5", "sq/phrases-5",
];

// The decks that must be rollup-EXCLUDED (rollup:false): the combined alphabet
// deck + every words deck + every phrases deck.
const LOCKED_ROLLUP_FALSE = new Set([
  "sq/alphabet-all",
  "sq/words-1", "sq/words-2", "sq/words-3", "sq/words-4", "sq/words-5",
  "sq/phrases-1", "sq/phrases-2", "sq/phrases-3", "sq/phrases-4", "sq/phrases-5",
]);

const LESSONS = LBManifest.listLessons(languages);

// ---------------------------------------------------------------------------
// 1. Registration
// ---------------------------------------------------------------------------
test("manifest: window.LB_LANGUAGES registers sq (Albanian) with 3 groups", () => {
  assert.equal(languages.length, 1, "exactly one language registered (sq) for now");
  const sq = languages[0];
  assert.equal(sq.code, "sq", "language code must be sq");
  assert.equal(sq.name, "Albanian", "language name must be Albanian");
  assert.ok(Array.isArray(sq.groups) && sq.groups.length === 3,
    "sq must have 3 picker groups (Numbers / Alphabet / Words & Phrases)");
});

// ---------------------------------------------------------------------------
// 2. Data-file backing: manifest count === cards.length === schema EXPECTED
// ---------------------------------------------------------------------------
test("manifest: every lesson id has a data file; count === cards.length === EXPECTED", () => {
  const EXPECTED = schemaExpected();
  assert.equal(LESSONS.length, 20, "manifest must list 20 lessons");
  for (const row of LESSONS) {
    const file = fileForId(row.id);
    const full = path.join(CONTENT_DIR, file);
    assert.ok(fs.existsSync(full), `${row.id}: data file ${file} must exist`);

    const { lesson } = loadLesson(file);
    assert.ok(lesson, `${row.id}: data file must define window.LB_LESSON`);
    assert.equal(lesson.id, row.id, `${row.id}: data file id must match the manifest id`);

    const actual = lesson.cards.length;
    assert.equal(row.count, actual,
      `${row.id}: manifest count=${row.count} but data file has ${actual} cards`);
    assert.equal(EXPECTED[row.id], actual,
      `${row.id}: schema EXPECTED=${EXPECTED[row.id]} but data file has ${actual} cards`);
  }
});

// ---------------------------------------------------------------------------
// 3. Picker-model resolution: every option value resolves to a manifest lesson
// ---------------------------------------------------------------------------
test("manifest: every buildPickerModel option resolves to a manifest lesson (no orphans/gaps)", () => {
  const manifestIds = new Set(LESSONS.map((r) => r.id));
  const model = LBManifest.buildPickerModel(languages, "sq");
  assert.equal(model.languageCode, "sq", "picker model must be for sq");

  const optionValues = [];
  for (const group of model.groups) {
    for (const opt of group.options) {
      assert.ok(manifestIds.has(opt.value),
        `picker option "${opt.value}" does not resolve to a manifest lesson`);
      optionValues.push(opt.value);
    }
  }
  // No duplicate options, and the option set covers exactly the manifest set.
  assert.equal(new Set(optionValues).size, optionValues.length,
    "picker options must be unique (no duplicate values)");
  assert.deepEqual(optionValues.slice().sort(), [...manifestIds].sort(),
    "picker option set must equal the manifest lesson set (no orphan, no missing)");
});

// ---------------------------------------------------------------------------
// 4. Rollup is explicit + matches the data-file registry push
// ---------------------------------------------------------------------------
test("manifest: rollup is an explicit boolean on every lesson; excluded set is the locked 11", () => {
  const excluded = new Set();
  for (const row of LESSONS) {
    // listLessons normalizes rollup to a boolean; assert the SOURCE is explicit.
    const sourceLesson = findSourceLesson(row.id);
    assert.equal(typeof sourceLesson.rollup, "boolean",
      `${row.id}: manifest rollup must be an explicit boolean, got ${typeof sourceLesson.rollup}`);
    if (row.rollup === false) excluded.add(row.id);
  }
  assert.deepEqual([...excluded].sort(), [...LOCKED_ROLLUP_FALSE].sort(),
    "the rollup-excluded set must be exactly {alphabet-all, words-*, phrases-*}");
});

test("manifest: each rollup flag matches the deck's data-file LB_LESSONS push", () => {
  for (const row of LESSONS) {
    const { lessonsIndex } = loadLesson(fileForId(row.id));
    assert.equal(lessonsIndex.length, 1, `${row.id}: data file must push one registry entry`);
    // Default-counted convention: only an explicit rollup:false excludes a deck.
    const dataCounted = lessonsIndex[0].rollup !== false;
    const manifestCounted = row.rollup !== false;
    assert.equal(manifestCounted, dataCounted,
      `${row.id}: manifest rollup (counted=${manifestCounted}) disagrees with the ` +
      `data-file registry push (counted=${dataCounted})`);
  }
});

// Pull the RAW lesson object out of the manifest tree (to inspect the literal
// rollup type, before listLessons normalizes it).
function findSourceLesson(id) {
  for (const lang of languages) {
    for (const group of lang.groups) {
      for (const lesson of group.lessons) {
        if (lesson && lesson.id === id) return lesson;
      }
    }
  }
  throw new Error(`manifest source lesson not found for ${id}`);
}

// ---------------------------------------------------------------------------
// 5. Id stability — byte-identical to the shipped set
// ---------------------------------------------------------------------------
test("manifest: lesson ids are byte-identical to the shipped set (localStorage keys)", () => {
  assert.deepEqual(plain(LESSONS.map((r) => r.id)), LOCKED_IDS,
    "manifest ids/order must match the shipped ?lesson= values exactly");
});

// ---------------------------------------------------------------------------
// 6. Language <select> visibility threshold
// ---------------------------------------------------------------------------
test("manifest: shouldShowLanguageDropdown is false at 1 language, true at 2", () => {
  assert.equal(LBManifest.shouldShowLanguageDropdown(languages), false,
    "one registered language -> dropdown hidden");

  const twoLangs = languages.concat([{
    code: "es", name: "Spanish", defaultLesson: "es/lesson-1",
    groups: [{ label: "Numbers", lessons: [{ id: "es/lesson-1", label: "L1", count: 1, rollup: true }] }],
  }]);
  assert.equal(LBManifest.shouldShowLanguageDropdown(twoLangs), true,
    "two registered languages -> dropdown shown");

  const opts = LBManifest.buildLanguageOptions(languages);
  assert.deepEqual(plain(opts), [{ value: "sq", label: "Albanian" }],
    "single-language option list must be [{sq, Albanian}]");
});

// ---------------------------------------------------------------------------
// 7. Loop resilience — one bad lesson entry is skipped, valid ones survive
// ---------------------------------------------------------------------------
test("manifest: buildPickerModel skips a bad lesson entry and keeps the valid ones", () => {
  const dirty = [{
    code: "sq", name: "Albanian", defaultLesson: "sq/lesson-1",
    groups: [{
      label: "Numbers",
      lessons: [
        { id: "sq/lesson-1", label: "L1", count: 11, rollup: true }, // valid
        null,                                                          // bad
        { label: "no id", count: 3, rollup: true },                   // bad (no id)
        { id: "sq/lesson-2", label: "L2", count: 9, rollup: true },   // valid
      ],
    }],
  }];
  let model;
  assert.doesNotThrow(() => { model = LBManifest.buildPickerModel(dirty, "sq"); },
    "buildPickerModel must not throw on a dirty manifest");
  const values = plain(model.groups[0].options.map((o) => o.value));
  assert.deepEqual(values, ["sq/lesson-1", "sq/lesson-2"],
    "the two valid lessons must survive; the null and id-less rows are skipped");
});
