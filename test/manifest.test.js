/* LB-23 manifest-integrity guard — the language/lesson manifest is the single
 * source of truth for the picker, the ?lesson= whitelist, per-lesson counts, and
 * the rollup flags. This closes the gap between the picker options, the
 * whitelist, and the real data files.
 *
 * Run:  node --test
 *
 * LB-42: what the manifest must hold now comes from data/*.json, read by the
 * build script's own parser (test/helpers/load-data.js): no fixed language
 * count, lesson totals, option list or rollup list. The one thing still locked
 * by hand is the list of lesson ids that have shipped
 * (test/fixtures/shipped-lesson-ids.json), because saved progress and links use
 * them: adding a lesson is fine, removing or renaming a shipped one fails.
 *
 * Coverage:
 *   1. registration — window.LB_LANGUAGES holds every data language, in
 *      language.order, with its name and its groups (groups with no live
 *      lesson left out) and live lessons per group.
 *   2. data-file backing — every manifest id has a data file whose cards.length
 *      equals the manifest count AND the data's count.
 *   3. picker-model resolution — every buildPickerModel() option value resolves
 *      to a manifest lesson, and the option set === the manifest lesson set.
 *   4. rollup is EXPLICIT — every lesson carries a boolean rollup equal to the
 *      data's, and it MATCHES the flag the deck's data file pushes onto
 *      window.LB_LESSONS.
 *   5. id stability — every shipped lesson id is still in the manifest, in the
 *      same order relative to each other (new ids may be added anywhere).
 *   6. language <select> threshold + the language option list.
 *   7. loop resilience — buildPickerModel skips a bad lesson entry and keeps the
 *      valid ones (never aborts the whole build on one bad row).
 *
 * Checks 1-6 run on the repo and on the repo plus the made-up language fixture
 * (test/fixtures/data-extra/), built in memory.
 *
 * Built-ins only: node:test, node:assert (+ the shared loaders). No jsdom, no
 * npm installs.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { repoWorld, fixtureWorld, shippedLessonIds, generatedPath } = require("./helpers/load-data.js");
const { loadManifest } = require("./helpers/load-lesson.js");

// Values built INSIDE the vm sandbox (manifest.js output) carry the sandbox's
// Object/Array prototypes, which node:assert/strict deepEqual rejects as a
// prototype mismatch even when the shape is identical. Round-trip through JSON to
// re-home a value in this realm before a deep comparison.
function plain(x) {
  return JSON.parse(JSON.stringify(x));
}

/**
 * The shipped-id guard. Returns a list of problems (empty = fine):
 *   - a shipped id that is not in the manifest (removed or renamed), or
 *   - shipped ids that are no longer in the same order relative to each other.
 * Ids that are not in the shipped list (new lessons) are ignored.
 */
function shippedIdProblems(shipped, current) {
  const problems = [];
  const have = new Set(current);
  for (const id of shipped) {
    if (!have.has(id)) problems.push(`shipped lesson id "${id}" is missing from the manifest (removed or renamed)`);
  }
  const want = new Set(shipped);
  const kept = current.filter((id) => want.has(id));
  const expectedOrder = shipped.filter((id) => have.has(id));
  if (JSON.stringify(kept) !== JSON.stringify(expectedOrder)) {
    problems.push("shipped lesson ids changed order relative to each other");
  }
  return problems;
}

const SHIPPED = shippedLessonIds();

// ---------------------------------------------------------------------------
// 5a. The guard itself has teeth (synthetic lists, no data needed)
// ---------------------------------------------------------------------------
test("manifest: the shipped-id guard rejects a removal, a rename and a reorder; allows additions", () => {
  const shipped = ["sq/lesson-1", "sq/lesson-2", "es/lesson-1"];
  assert.deepEqual(shippedIdProblems(shipped, shipped), [], "same list passes");
  assert.deepEqual(shippedIdProblems(shipped, ["sq/lesson-1", "sq/new", "sq/lesson-2", "es/lesson-1", "qaa/lesson-1"]), [],
    "adding ids anywhere passes");
  assert.equal(shippedIdProblems(shipped, ["sq/lesson-1", "es/lesson-1"]).length, 1, "a removal fails");
  assert.equal(shippedIdProblems(shipped, ["sq/lesson-1", "sq/lesson-2b", "es/lesson-1"]).length, 1, "a rename fails");
  assert.equal(shippedIdProblems(shipped, ["sq/lesson-2", "sq/lesson-1", "es/lesson-1"]).length, 1, "a reorder fails");
});

test("manifest: the shipped-id list is a real list of lesson ids", () => {
  assert.ok(Array.isArray(SHIPPED) && SHIPPED.length > 0, "shipped-lesson-ids.json must list ids");
  assert.equal(new Set(SHIPPED).size, SHIPPED.length, "no id listed twice");
  for (const id of SHIPPED) assert.match(id, /^[a-z][a-z0-9]{1,7}\/[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${id}`);
});

for (const world of [repoWorld(), fixtureWorld()]) {
  const T = world.tag;
  const DATA = world.data;
  const { languages, LBManifest } = world.loadManifest();
  const LESSONS = LBManifest.listLessons(languages);
  const CODES = DATA.languages.map((l) => l.code);

  // -------------------------------------------------------------------------
  // 1. Registration
  // -------------------------------------------------------------------------
  test(`${T}manifest: window.LB_LANGUAGES registers every data language, in order, with its groups`, () => {
    assert.ok(DATA.languages.length > 0, "the data must hold at least one language");
    assert.equal(languages.length, DATA.languages.length,
      `the manifest must register ${DATA.languages.length} languages (one per data file)`);
    DATA.languages.forEach((want, i) => {
      const got = languages[i];
      assert.equal(got.code, want.code, `language #${i} must be ${want.code} (language.order)`);
      assert.equal(got.name, want.name, `${want.code}: name must be the data's`);
      assert.equal(got.defaultLesson, want.defaultLesson, `${want.code}: defaultLesson must be the data's`);
      const liveGroups = want.groups
        .map((g) => ({ label: g.label, ids: g.lessons.filter((l) => !l.parked).map((l) => l.id) }))
        .filter((g) => g.ids.length > 0);
      assert.ok(Array.isArray(got.groups), `${want.code}: groups must be an array`);
      assert.deepEqual(
        plain(got.groups.map((g) => ({ label: g.label, ids: g.lessons.map((l) => l.id) }))),
        liveGroups,
        `${want.code}: groups (labels, live lessons, order) must match the data; groups with no live lesson are left out`);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Data-file backing: manifest count === cards.length === data
  // -------------------------------------------------------------------------
  test(`${T}manifest: every lesson id has a data file; count === cards.length === data`, () => {
    assert.equal(LESSONS.length, DATA.live.length,
      `manifest must list ${DATA.live.length} lessons (every live lesson in the data)`);
    for (const row of LESSONS) {
      const want = DATA.byId.get(row.id);
      assert.ok(want, `${row.id}: the manifest lists a lesson the data does not have`);
      assert.equal(want.parked, false, `${row.id}: a parked lesson must not be in the manifest`);
      assert.ok(world.exists(generatedPath(want)), `${row.id}: data file ${generatedPath(want)} must exist`);

      const { lesson } = world.loadLesson(want);
      assert.ok(lesson, `${row.id}: data file must define window.LB_LESSON`);
      assert.equal(lesson.id, row.id, `${row.id}: data file id must match the manifest id`);

      const actual = lesson.cards.length;
      assert.equal(row.count, actual,
        `${row.id}: manifest count=${row.count} but data file has ${actual} cards`);
      assert.equal(want.count, actual,
        `${row.id}: the data has ${want.count} cards but the data file has ${actual}`);
    }
  });

  // -------------------------------------------------------------------------
  // 3. Picker-model resolution: every option value resolves to a manifest lesson
  // -------------------------------------------------------------------------
  test(`${T}manifest: every buildPickerModel option resolves to a manifest lesson (no orphans/gaps)`, () => {
    // buildPickerModel is PER language. Each language's picker must cover
    // exactly that language's manifest lessons — no orphan option, no missing lesson.
    for (const code of CODES) {
      const langIds = new Set(LESSONS.filter((r) => r.languageCode === code).map((r) => r.id));
      assert.ok(langIds.size > 0, `${code}: must have lessons in the manifest`);
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

  // -------------------------------------------------------------------------
  // 4. Rollup is explicit, equals the data, and matches the data-file push
  // -------------------------------------------------------------------------
  test(`${T}manifest: rollup is an explicit boolean on every lesson and equals the data's`, () => {
    for (const row of LESSONS) {
      // listLessons normalizes rollup to a boolean; assert the SOURCE is explicit.
      const sourceLesson = findSourceLesson(languages, row.id);
      assert.equal(typeof sourceLesson.rollup, "boolean",
        `${row.id}: manifest rollup must be an explicit boolean, got ${typeof sourceLesson.rollup}`);
      assert.equal(sourceLesson.rollup, DATA.byId.get(row.id).rollup,
        `${row.id}: manifest rollup must equal the data's rollup`);
    }
  });

  test(`${T}manifest: each rollup flag matches the deck's data-file LB_LESSONS push`, () => {
    for (const row of LESSONS) {
      const { lessonsIndex } = world.loadLesson(DATA.byId.get(row.id));
      assert.equal(lessonsIndex.length, 1, `${row.id}: data file must push one registry entry`);
      // Default-counted convention: only an explicit rollup:false excludes a deck.
      const dataCounted = lessonsIndex[0].rollup !== false;
      const manifestCounted = row.rollup !== false;
      assert.equal(manifestCounted, dataCounted,
        `${row.id}: manifest rollup (counted=${manifestCounted}) disagrees with the ` +
        `data-file registry push (counted=${dataCounted})`);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Id stability — every shipped id stays (adding is allowed)
  // -------------------------------------------------------------------------
  test(`${T}manifest: every shipped lesson id is still in the manifest, in the same order (localStorage keys)`, () => {
    const problems = shippedIdProblems(SHIPPED, plain(LESSONS.map((r) => r.id)));
    assert.deepEqual(problems, [],
      "a shipped ?lesson= value would strand saved progress. If this is on purpose, " +
      "update test/fixtures/shipped-lesson-ids.json with the owner's go.");
  });

  // -------------------------------------------------------------------------
  // 6. Language <select> visibility threshold + option list
  // -------------------------------------------------------------------------
  test(`${T}manifest: shouldShowLanguageDropdown is false at 1 language, true at 2+; options follow the data`, () => {
    assert.equal(LBManifest.shouldShowLanguageDropdown([languages[0]]), false,
      "one registered language -> dropdown hidden");
    assert.equal(LBManifest.shouldShowLanguageDropdown(languages.slice(0, 2)), languages.length >= 2,
      "two registered languages -> dropdown shown");
    assert.equal(LBManifest.shouldShowLanguageDropdown(languages), languages.length >= 2,
      "the live manifest shows the dropdown when it has two or more languages");

    assert.deepEqual(plain(LBManifest.buildLanguageOptions(languages)),
      DATA.languages.map((l) => ({ value: l.code, label: l.name })),
      "language option list must be every data language, in language.order");
  });

  // -------------------------------------------------------------------------
  // 6b. Language-switch path — buildPickerModel + getDefaultLesson resolve PER
  //     activeCode. The language <select> change handler in index.html relies
  //     on getDefaultLesson(manifest, code) returning the SELECTED language's
  //     default lesson, and on buildPickerModel(manifest, code) rendering that
  //     language's lessons.
  // -------------------------------------------------------------------------
  test(`${T}manifest: buildPickerModel/getDefaultLesson resolve per activeCode (language switch)`, () => {
    for (const lang of DATA.languages) {
      assert.equal(LBManifest.getDefaultLesson(languages, lang.code), lang.defaultLesson,
        `selecting ${lang.code} must resolve to its default lesson`);
      const model = LBManifest.buildPickerModel(languages, lang.code);
      assert.equal(model.languageCode, lang.code, "picker model must be for the selected language");
      const values = plain(model.groups.flatMap((g) => g.options.map((o) => o.value)));
      assert.deepEqual(values,
        DATA.live.filter((l) => l.code === lang.code).map((l) => l.id),
        `${lang.code} picker must render only ${lang.code} lessons, in data order`);
    }
  });

  // -------------------------------------------------------------------------
  // 6c. Per-language lesson list (LB-27) — listLessonsForLanguage returns only
  //     the requested language's lessons; an unknown/empty code returns [].
  // -------------------------------------------------------------------------
  test(`${T}manifest: listLessonsForLanguage returns only the requested language's lessons`, () => {
    for (const code of CODES) {
      const rows = LBManifest.listLessonsForLanguage(languages, code);
      const want = DATA.live.filter((l) => l.code === code);
      assert.ok(rows.length > 0, `${code} must return lessons`);
      assert.ok(rows.every((r) => r.languageCode === code),
        `every ${code} row must have languageCode === ${code}`);
      assert.deepEqual(plain(rows.map((r) => r.id)), want.map((l) => l.id),
        `${code} list must be exactly its live lessons, in order`);
      assert.deepEqual(plain(rows.map((r) => r.id)),
        plain(LESSONS.filter((r) => r.languageCode === code).map((r) => r.id)),
        `${code} list must equal the ${code} subset of listLessons, in order`);

      // Rows carry count + rollup so the per-language rollup can judge mastery
      // WITHOUT loading each lesson's card data (one lesson loads per page).
      assert.deepEqual(plain(rows.map((r) => [r.count, r.rollup])), want.map((l) => [l.count, l.rollup]),
        `${code}: each row must carry the data's count and rollup`);
    }
  });
}

test("manifest: listLessonsForLanguage returns [] for unknown/empty code (never throws)", () => {
  const { languages, LBManifest } = loadManifest();
  // "not-a-language" can never be a real code (codes are a-z0-9 only).
  assert.deepEqual(plain(LBManifest.listLessonsForLanguage(languages, "not-a-language")), [],
    "an unknown language code yields an empty list");
  assert.deepEqual(plain(LBManifest.listLessonsForLanguage(languages, "")), [],
    "an empty code yields an empty list");
  assert.deepEqual(plain(LBManifest.listLessonsForLanguage(languages)), [],
    "a missing code yields an empty list");
  assert.doesNotThrow(() => LBManifest.listLessonsForLanguage(null, "sq"),
    "a null manifest must not throw");
});

// Pull the RAW lesson object out of the manifest tree (to inspect the literal
// rollup type, before listLessons normalizes it).
function findSourceLesson(languages, id) {
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
// 7. Loop resilience — one bad lesson entry is skipped, valid ones survive
// ---------------------------------------------------------------------------
test("manifest: buildPickerModel skips a bad lesson entry and keeps the valid ones", () => {
  const { LBManifest } = loadManifest();
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
