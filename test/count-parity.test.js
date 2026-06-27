/* LB-18 build-breaker guard: three-way card-count parity across the WHOLE app.
 *
 * Run:  node --test
 *
 * The app stores per-lesson card counts in TWO places that must never drift:
 *   1. test/schema.test.js  EXPECTED            (the test source of truth)
 *   2. src/index.html       LESSON_COUNTS       (the RUNTIME source of truth —
 *      attached to each registry entry as `.count` so the mastery rollup can
 *      judge "X of N mastered" for lessons whose card data is NOT loaded, since
 *      the app loads exactly one lesson at a time)
 * ...and the ACTUAL truth is each data file's cards.length.
 *
 * If LESSON_COUNTS drifts from the real card count, lessonMasteredByCount()
 * silently breaks: a lesson never reaches "mastered", or reaches it early — with
 * every existing test still green, because schema.test.js only checks ITS OWN
 * map against cards.length and never reads index.html. This harness closes that
 * gap: for ALL lessons it asserts
 *
 *     index.html LESSON_COUNTS[id]  ===  actual cards.length  ===  schema EXPECTED[id]
 *
 * plus set-parity (whitelist <-> dropdown <-> LESSON_COUNTS <-> data files), so a
 * new lesson can't be half-wired. Built-ins only: node:test, node:assert,
 * node:fs, node:path (+ the shared vm lesson loader).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadLesson, CONTENT_DIR } = require("./helpers/load-lesson.js");

const INDEX_PATH = path.resolve(__dirname, "..", "src", "index.html");
const INDEX_SRC = fs.readFileSync(INDEX_PATH, "utf8");

// id "sq/lesson-1" -> data file "lesson-1.js"
function fileForId(id) {
  return id.split("/")[1] + ".js";
}

/* Pull a `var NAME = { ... };` object body out of index.html by name. */
function objectBody(name) {
  const re = new RegExp("var\\s+" + name + "\\s*=\\s*\\{([\\s\\S]*?)\\}", "m");
  const m = re.exec(INDEX_SRC);
  assert.ok(m, `index.html must define var ${name} = { ... }`);
  return m[1];
}

/* "sq/...": <number>  ->  { id: count } */
function parseCounts() {
  const body = objectBody("LESSON_COUNTS");
  const out = {};
  const re = /"(sq\/[^"]+)"\s*:\s*(\d+)/g;
  let m;
  while ((m = re.exec(body)) !== null) out[m[1]] = Number(m[2]);
  return out;
}

/* "sq/...": true  ->  Set of ids */
function parseWhitelist() {
  const body = objectBody("ALLOWED");
  const out = new Set();
  const re = /"(sq\/[^"]+)"\s*:\s*true/g;
  let m;
  while ((m = re.exec(body)) !== null) out.add(m[1]);
  return out;
}

/* <option value="sq/...">  ->  Set of ids */
function parseDropdown() {
  const out = new Set();
  const re = /<option\s+value="(sq\/[^"]+)"/g;
  let m;
  while ((m = re.exec(INDEX_SRC)) !== null) out.add(m[1]);
  return out;
}

/* Schema EXPECTED, read from the sibling test so we cross-check the two maps
 * without duplicating a third hand-maintained count list here. */
function schemaExpected() {
  const src = fs.readFileSync(path.resolve(__dirname, "schema.test.js"), "utf8");
  const body = (/const\s+EXPECTED\s*=\s*\{([\s\S]*?)\n\};/m.exec(src) || [])[1];
  assert.ok(body, "schema.test.js must define const EXPECTED = { ... }");
  const out = {};
  const re = /"([^"]+\.js)"\s*:\s*\{\s*count:\s*(\d+)/g;
  let m;
  while ((m = re.exec(body)) !== null) out["sq/" + m[1].replace(/\.js$/, "")] = Number(m[2]);
  return out;
}

const COUNTS = parseCounts();
const WHITELIST = parseWhitelist();
const DROPDOWN = parseDropdown();
const EXPECTED = schemaExpected();
const IDS = Object.keys(COUNTS).sort();

test("parity: index.html LESSON_COUNTS covers exactly the 10 known lessons", () => {
  assert.equal(IDS.length, 10, "expected 10 lessons in LESSON_COUNTS");
});

for (const id of IDS) {
  test(`parity: ${id} — LESSON_COUNTS === actual cards.length === schema EXPECTED`, () => {
    const { lesson } = loadLesson(fileForId(id));
    assert.ok(lesson, `${id}: data file must define window.LB_LESSON`);
    assert.equal(lesson.id, id, `${id}: data file id must match the count-map key`);

    const actual = lesson.cards.length;
    assert.equal(
      COUNTS[id], actual,
      `${id}: index.html LESSON_COUNTS=${COUNTS[id]} but data file has ${actual} cards — ` +
      `mastery rollup (lessonMasteredByCount) would break silently`
    );
    assert.equal(
      EXPECTED[id], actual,
      `${id}: schema EXPECTED=${EXPECTED[id]} but data file has ${actual} cards`
    );
  });
}

test("parity: whitelist, dropdown, and LESSON_COUNTS list the SAME lesson set", () => {
  const counts = new Set(IDS);
  assert.deepEqual([...WHITELIST].sort(), [...counts].sort(),
    "ALLOWED whitelist must match LESSON_COUNTS keys (no half-wired lesson)");
  assert.deepEqual([...DROPDOWN].sort(), [...counts].sort(),
    "picker <option> set must match LESSON_COUNTS keys");
});

test("parity: every LESSON_COUNTS id has a real data file on disk", () => {
  for (const id of IDS) {
    const f = path.join(CONTENT_DIR, fileForId(id));
    assert.ok(fs.existsSync(f), `${id}: expected data file ${fileForId(id)} to exist`);
  }
});
