/* Card-count parity guard.
 *
 * Run:  node --test
 *
 * The runtime source of each lesson's card count is the manifest
 * (src/content/languages.js, read via src/manifest.js). If a manifest count
 * drifts from the real number of cards, the "N of M known" readout and
 * lessonMasteredByCount() break silently. This test closes that gap.
 *
 * LB-42: the third side of the check is now the data itself (data/*.json, read
 * by the build script's own parser, test/helpers/load-data.js) instead of a
 * typed-in copy of every count, and there is no fixed lesson total. It checks:
 *
 *     manifest.count  ===  generated file cards.length  ===  cards in the data
 *
 * plus set-parity between the data's live lessons, the manifest's counts map,
 * its whitelist (buildAllowedMap) and the lesson files, so a lesson can't be
 * half-wired. Every check runs on the repo and on the repo plus the made-up
 * language fixture (test/fixtures/data-extra/), built in memory.
 *
 * Built-ins only: node:test, node:assert (+ the shared loaders).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { repoWorld, fixtureWorld, generatedPath } = require("./helpers/load-data.js");

for (const world of [repoWorld(), fixtureWorld()]) {
  const { languages, LBManifest } = world.loadManifest();
  const COUNTS = LBManifest.buildLessonCounts(languages);   // { id: count }
  const ALLOWED = LBManifest.buildAllowedMap(languages);    // { id: true }
  const IDS = Object.keys(COUNTS).sort();
  const LIVE = world.data.live;

  test(`${world.tag}parity: the manifest declares a count for exactly the data's live lessons`, () => {
    assert.ok(LIVE.length > 0, "the data must hold at least one live lesson");
    assert.deepEqual(IDS, LIVE.map((l) => l.id).sort(),
      "manifest lessons with counts must be exactly the live lessons in data/*.json (no parked, none missing)");
  });

  for (const row of LIVE) {
    test(`${world.tag}parity: ${row.id} — manifest count === actual cards.length === data`, () => {
      const { lesson } = world.loadLesson(row);
      assert.ok(lesson, `${row.id}: data file must define window.LB_LESSON`);
      assert.equal(lesson.id, row.id, `${row.id}: data file id must match the manifest id`);

      const actual = lesson.cards.length;
      assert.equal(
        COUNTS[row.id], actual,
        `${row.id}: manifest count=${COUNTS[row.id]} but data file has ${actual} cards — ` +
        `mastery rollup (lessonMasteredByCount) would break silently`
      );
      assert.equal(
        row.count, actual,
        `${row.id}: data/${row.code}.json has ${row.count} cards but the generated file has ${actual}`
      );
    });
  }

  test(`${world.tag}parity: manifest whitelist (ALLOWED) and counts list the SAME lesson set`, () => {
    assert.deepEqual(
      Object.keys(ALLOWED).sort(), IDS,
      "manifest whitelist (buildAllowedMap) must match the manifest counts set"
    );
  });

  test(`${world.tag}parity: every manifest lesson id has a real data file`, () => {
    for (const id of IDS) {
      const row = world.data.byId.get(id);
      assert.ok(row, `${id}: the manifest lists a lesson the data does not have`);
      assert.ok(world.exists(generatedPath(row)), `${id}: expected data file ${generatedPath(row)} to exist`);
    }
  });
}
