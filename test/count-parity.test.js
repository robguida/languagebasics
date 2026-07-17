/* Card-count parity guard — LB-23 update: manifest is now the single source.
 *
 * Run:  node --test
 *
 * BEFORE LB-23 the per-lesson card count lived in TWO hand-maintained spots that
 * could silently drift — test/schema.test.js EXPECTED and src/index.html
 * LESSON_COUNTS — and this test cross-checked them against each data file's real
 * cards.length. LB-23 collapsed the RUNTIME source into the manifest
 * (src/content/languages.js, read via src/manifest.js), so index.html no longer
 * carries a hand-maintained LESSON_COUNTS / ALLOWED literal to parse.
 *
 * The parity guarded here is now three-way against the MANIFEST:
 *
 *     manifest.count  ===  actual data-file cards.length  ===  schema EXPECTED
 *
 * plus set-parity between the manifest's whitelist (buildAllowedMap), its counts
 * map, and the data files on disk — so a new lesson can't be half-wired. If the
 * manifest count drifts from the real card count, lessonMasteredByCount() would
 * silently break (a lesson never reaches "mastered", or reaches it early); this
 * closes that gap. Built-ins only: node:test, node:assert, node:fs, node:path
 * (+ the shared vm lesson/manifest loader).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadLesson, loadManifest, contentDir } = require("./helpers/load-lesson.js");

// id "sq/lesson-1" -> data file "lesson-1.js"
function fileForId(id) {
  return id.split("/")[1] + ".js";
}

// id "es/lesson-1" -> language namespace "es" (LB-25: multi-language). Each id's
// data file lives under src/content/<lang>, so parity checks resolve per-language.
function langForId(id) {
  return id.split("/")[0];
}

/* Schema EXPECTED, read from the sibling test so we cross-check the maps without
 * duplicating a third hand-maintained count list here. EXPECTED is keyed by
 * language namespace now; every entry still carries its own `id`, so a single
 * regex over the whole file yields { id: count } across all languages. */
function schemaExpected() {
  const src = fs.readFileSync(path.resolve(__dirname, "schema.test.js"), "utf8");
  const out = {};
  const re = /"[^"]+\.js"\s*:\s*\{\s*count:\s*(\d+),\s*id:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[2]] = Number(m[1]);
  return out;
}

const { languages, LBManifest } = loadManifest();
const COUNTS = LBManifest.buildLessonCounts(languages);   // { id: count }
const ALLOWED = LBManifest.buildAllowedMap(languages);    // { id: true }
const EXPECTED = schemaExpected();                        // { id: count }
const IDS = Object.keys(COUNTS).sort();

test("parity: manifest declares a count for exactly the 32 known lessons", () => {
  assert.equal(IDS.length, 32, "expected 32 lessons with counts in the manifest (20 sq + 6 es + 6 ja)");
});

for (const id of IDS) {
  test(`parity: ${id} — manifest count === actual cards.length === schema EXPECTED`, () => {
    const { lesson } = loadLesson(fileForId(id), langForId(id));
    assert.ok(lesson, `${id}: data file must define window.LB_LESSON`);
    assert.equal(lesson.id, id, `${id}: data file id must match the manifest id`);

    const actual = lesson.cards.length;
    assert.equal(
      COUNTS[id], actual,
      `${id}: manifest count=${COUNTS[id]} but data file has ${actual} cards — ` +
      `mastery rollup (lessonMasteredByCount) would break silently`
    );
    assert.equal(
      EXPECTED[id], actual,
      `${id}: schema EXPECTED=${EXPECTED[id]} but data file has ${actual} cards`
    );
  });
}

test("parity: manifest whitelist (ALLOWED) and counts list the SAME lesson set", () => {
  const counts = new Set(IDS);
  assert.deepEqual(
    Object.keys(ALLOWED).sort(), [...counts].sort(),
    "manifest whitelist (buildAllowedMap) must match the manifest counts set"
  );
});

test("parity: every manifest lesson id has a real data file on disk", () => {
  for (const id of IDS) {
    const f = path.join(contentDir(langForId(id)), fileForId(id));
    assert.ok(fs.existsSync(f), `${id}: expected data file ${fileForId(id)} to exist`);
  }
});
