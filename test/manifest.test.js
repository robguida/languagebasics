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
const { loadLesson, loadManifest, contentDir } = require("./helpers/load-lesson.js");

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

// id "es/lesson-1" -> language namespace "es" (LB-25: multi-language). Data files
// live under src/content/<lang>, so id-driven loads resolve per-language.
function langForId(id) {
  return id.split("/")[0];
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

// The shipped lesson ids in manifest order — LOCKED. A change here is a change to
// a ?lesson= value, which would strand saved localStorage state; this array makes
// any such change fail loudly. LB-25 appended the 6 es number-deck ids after the
// 20 sq ids; LB-24 appended the 6 ja number-deck ids after es (listLessons walks
// languages in registration order: sq, then es, then ja).
const LOCKED_IDS = [
  "sq/lesson-1", "sq/lesson-2", "sq/lesson-3",
  "sq/lesson-4", "sq/lesson-5", "sq/lesson-6",
  "sq/alphabet-vowels", "sq/alphabet-consonants",
  "sq/alphabet-digraphs", "sq/alphabet-all",
  "sq/words-1", "sq/phrases-1", "sq/words-2", "sq/phrases-2",
  "sq/words-3", "sq/phrases-3", "sq/words-4", "sq/phrases-4",
  "sq/words-5", "sq/phrases-5",
  "es/lesson-1", "es/lesson-2", "es/lesson-3",
  "es/lesson-4", "es/lesson-5", "es/lesson-6",
  "ja/lesson-1", "ja/lesson-2", "ja/lesson-3",
  "ja/lesson-4", "ja/lesson-5", "ja/lesson-6",
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
test("manifest: window.LB_LANGUAGES registers sq (Albanian) + es (Spanish) + ja (Japanese)", () => {
  assert.equal(languages.length, 3, "three languages registered (sq, es, ja) after LB-24");
  const sq = languages[0];
  assert.equal(sq.code, "sq", "first language code must be sq");
  assert.equal(sq.name, "Albanian", "first language name must be Albanian");
  assert.ok(Array.isArray(sq.groups) && sq.groups.length === 3,
    "sq must have 3 picker groups (Numbers / Alphabet / Words & Phrases)");

  const es = languages[1];
  assert.equal(es.code, "es", "second language code must be es");
  assert.equal(es.name, "Spanish", "second language name must be Spanish");
  assert.ok(Array.isArray(es.groups) && es.groups.length === 1,
    "es must have 1 picker group (Numbers)");
  assert.equal(es.groups[0].label, "Numbers", "es group label must be Numbers");
  assert.equal(es.groups[0].lessons.length, 6, "es Numbers group must list 6 lessons");

  const ja = languages[2];
  assert.equal(ja.code, "ja", "third language code must be ja");
  assert.equal(ja.name, "Japanese", "third language name must be Japanese");
  assert.ok(Array.isArray(ja.groups) && ja.groups.length === 1,
    "ja must have 1 picker group (Numbers)");
  assert.equal(ja.groups[0].label, "Numbers", "ja group label must be Numbers");
  assert.equal(ja.groups[0].lessons.length, 6, "ja Numbers group must list 6 lessons");
});

// ---------------------------------------------------------------------------
// 2. Data-file backing: manifest count === cards.length === schema EXPECTED
// ---------------------------------------------------------------------------
test("manifest: every lesson id has a data file; count === cards.length === EXPECTED", () => {
  const EXPECTED = schemaExpected();
  assert.equal(LESSONS.length, 32, "manifest must list 32 lessons (20 sq + 6 es + 6 ja)");
  for (const row of LESSONS) {
    const file = fileForId(row.id);
    const lang = langForId(row.id);
    const full = path.join(contentDir(lang), file);
    assert.ok(fs.existsSync(full), `${row.id}: data file ${lang}/${file} must exist`);

    const { lesson } = loadLesson(file, lang);
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
  // LB-25: buildPickerModel is PER language. Each language's picker must cover
  // exactly that language's manifest lessons — no orphan option, no missing lesson.
  for (const code of ["sq", "es", "ja"]) {
    const langIds = new Set(LESSONS.filter((r) => r.languageCode === code).map((r) => r.id));
    const model = LBManifest.buildPickerModel(languages, code);
    assert.equal(model.languageCode, code, `picker model must be for ${code}`);

    const optionValues = [];
    for (const group of model.groups) {
      for (const opt of group.options) {
        assert.ok(langIds.has(opt.value),
          `${code}: picker option "${opt.value}" does not resolve to a manifest lesson`);
        optionValues.push(opt.value);
      }
    }
    assert.equal(new Set(optionValues).size, optionValues.length,
      `${code}: picker options must be unique (no duplicate values)`);
    assert.deepEqual(optionValues.slice().sort(), [...langIds].sort(),
      `${code}: picker option set must equal that language's manifest lesson set`);
  }
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
    const { lessonsIndex } = loadLesson(fileForId(row.id), langForId(row.id));
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
  // LB-25: with sq + es registered, the live manifest now has 2 languages, so the
  // dropdown SHOWS. The 1-language (hidden) case is checked with a synthetic
  // single-language array so the threshold logic stays covered on both sides.
  const oneLang = [languages[0]];
  assert.equal(LBManifest.shouldShowLanguageDropdown(oneLang), false,
    "one registered language -> dropdown hidden");
  assert.equal(LBManifest.shouldShowLanguageDropdown(languages), true,
    "two registered languages (sq + es) -> dropdown shown");

  const opts = LBManifest.buildLanguageOptions(languages);
  assert.deepEqual(plain(opts), [
    { value: "sq", label: "Albanian" },
    { value: "es", label: "Spanish" },
    { value: "ja", label: "Japanese" },
  ], "language option list must be [{sq, Albanian}, {es, Spanish}, {ja, Japanese}]");
});

// ---------------------------------------------------------------------------
// 6b. Language-switch path (LB-24-ready) — buildPickerModel + getDefaultLesson
//     resolve PER activeCode. The language <select> change handler in index.html
//     relies on getDefaultLesson(manifest, code) returning the SELECTED
//     language's default lesson, and on buildPickerModel(manifest, code)
//     rendering that language's lessons.
// ---------------------------------------------------------------------------
test("manifest: buildPickerModel/getDefaultLesson resolve per activeCode (language switch)", () => {
  // LB-25: es is now a REAL registered language, so the switch path resolves
  // against the live manifest (no synthetic stub needed).

  // Active language selects which language's picker/default is produced.
  assert.equal(LBManifest.getDefaultLesson(languages, "sq"), "sq/lesson-1",
    "sq default lesson unchanged now that a 2nd language exists");
  assert.equal(LBManifest.getDefaultLesson(languages, "es"), "es/lesson-1",
    "selecting es must resolve to the es default lesson");

  const esModel = LBManifest.buildPickerModel(languages, "es");
  assert.equal(esModel.languageCode, "es", "picker model must be for the selected language");
  const esValues = plain(esModel.groups.flatMap((g) => g.options.map((o) => o.value)));
  assert.deepEqual(esValues, [
    "es/lesson-1", "es/lesson-2", "es/lesson-3",
    "es/lesson-4", "es/lesson-5", "es/lesson-6",
  ], "es picker must render only es lessons, in order");
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
