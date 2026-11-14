/* Schema validation for every generated lesson file (live and parked).
 *
 * Run:  node --test
 *
 * LB-42: the list of lessons and what each must hold (id, card count, revealMs)
 * come from data/*.json, read by the build script's own parser
 * (test/helpers/load-data.js). Adding a language or a lesson needs no edit here.
 *
 * Asserts, per lesson:
 *   - window.LB_LESSON is present with required keys (id, title, cards)
 *   - id, card count and revealMs equal the data's
 *   - every card has a non-empty prompt (string|number), non-empty answer,
 *     and a non-empty hint (the dataset fills every hint app-wide, including
 *     the parked lessons)
 *   - optional fields (audio, recallPrompt) are correct type when present
 *   - window.LB_LESSONS received exactly one {id, title} entry for the lesson
 *   - parked lessons (LB-34, "parked": true) load from parked/content/<lang>/
 *     and get the same full checks, so they are valid when they come back; the
 *     "not shipped / not in the picker" checks live in
 *     test/lb34-testing-flag.test.js.
 * Per data file:
 *   - card ids leave no gaps: for each slug, the ids in use plus the retired ids
 *     are exactly 1..max. A card deleted from the JSON without retiring its id
 *     fails here (the typed-in counts that used to catch it are gone).
 *
 * Every check runs twice: on the repo, and on the repo plus the made-up
 * language fixture (test/fixtures/data-extra/), built in memory.
 *
 * Built-ins only: node:test, node:assert. No npm installs.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { repoWorld, fixtureWorld } = require("./helpers/load-data.js");

for (const world of [repoWorld(), fixtureWorld()]) {
  test(`${world.tag}the data lists lessons`, () => {
    assert.ok(world.data.live.length > 0, "at least one live lesson");
  });

  for (const row of world.data.lessons) {
    const label = `${world.tag}${row.parked ? "parked " : ""}${row.code}/${row.file}`;
    test(`${label}: schema + counts`, () => {
      const { lesson, lessonsIndex } = world.loadLesson(row);
      const file = row.file;

      // --- LB_LESSON present with required keys ---
      assert.ok(lesson, `${file}: window.LB_LESSON must be defined`);
      assert.equal(typeof lesson.id, "string", `${file}: id must be a string`);
      assert.ok(lesson.id.length > 0, `${file}: id must be non-empty`);
      assert.equal(lesson.id, row.id, `${file}: id mismatch`);
      assert.equal(typeof lesson.title, "string", `${file}: title must be a string`);
      assert.ok(lesson.title.length > 0, `${file}: title must be non-empty`);
      assert.equal(lesson.title, row.title, `${file}: title must equal the data's`);
      assert.ok(Array.isArray(lesson.cards), `${file}: cards must be an array`);

      // --- revealMs: optional, but when present must be a positive number ---
      if (lesson.revealMs !== undefined) {
        assert.equal(typeof lesson.revealMs, "number", `${file}: revealMs must be a number`);
        assert.ok(lesson.revealMs > 0, `${file}: revealMs must be > 0`);
      }
      assert.equal(lesson.revealMs, row.revealMs, `${file}: revealMs mismatch`);

      // --- optional lesson.recallPrompt override ---
      if (lesson.recallPrompt !== undefined) {
        assert.equal(typeof lesson.recallPrompt, "string", `${file}: lesson.recallPrompt must be a string`);
      }
      assert.equal(lesson.recallPrompt, row.recallPrompt, `${file}: recallPrompt must equal the data's`);

      // --- card count ---
      assert.ok(row.count > 0, `${file}: the data must hold at least one card`);
      assert.equal(
        lesson.cards.length,
        row.count,
        `${file}: expected ${row.count} cards (from the data), found ${lesson.cards.length}`
      );

      // --- per-card schema ---
      lesson.cards.forEach((card, i) => {
        const where = `${file} card #${i}`;
        assert.ok(card && typeof card === "object", `${where}: must be an object`);

        // prompt: string|number, required, non-empty
        const pt = typeof card.prompt;
        assert.ok(pt === "string" || pt === "number", `${where}: prompt must be string|number`);
        assert.ok(String(card.prompt).length > 0, `${where}: prompt must be non-empty`);

        // answer: string, required, non-empty
        assert.equal(typeof card.answer, "string", `${where}: answer must be a string`);
        assert.ok(card.answer.length > 0, `${where}: answer must be non-empty`);

        // hint: required, string, non-empty (the dataset fills every hint
        // app-wide, parked lessons included)
        assert.equal(typeof card.hint, "string", `${where}: hint must be a string`);
        assert.ok(card.hint.trim().length > 0, `${where}: hint must be non-empty`);
        // audio: optional (reserved), string when present
        if (card.audio !== undefined) {
          assert.equal(typeof card.audio, "string", `${where}: audio must be a string when present`);
        }
        // recallPrompt: optional per-card override, string when present
        if (card.recallPrompt !== undefined) {
          assert.equal(typeof card.recallPrompt, "string", `${where}: recallPrompt must be a string when present`);
        }
      });

      // --- LB_LESSONS index got exactly one matching {id,title} entry ---
      assert.equal(lessonsIndex.length, 1, `${file}: should push exactly one LB_LESSONS entry`);
      assert.equal(lessonsIndex[0].id, lesson.id, `${file}: LB_LESSONS entry id must match lesson.id`);
      assert.equal(lessonsIndex[0].title, lesson.title, `${file}: LB_LESSONS entry title must match lesson.title`);
    });
  }

  test(`${world.tag}card ids: per slug, ids in use + retired ids are exactly 1..max (no silent deletes)`, () => {
    for (const doc of world.data.docs) {
      const code = doc.language.code;
      const used = new Map(); // slug prefix -> Set of numbers
      const add = (id, source) => {
        const dot = id.lastIndexOf(".");
        const prefix = id.slice(0, dot);
        const n = Number(id.slice(dot + 1));
        if (!used.has(prefix)) used.set(prefix, new Map());
        assert.ok(!used.get(prefix).has(n), `${code}: ${id} appears twice (${source})`);
        used.get(prefix).set(n, source);
      };
      for (const g of doc.groups) for (const l of g.lessons) for (const c of l.cards || []) add(c.id, "card");
      for (const id of doc.retiredCardIds || []) add(id, "retired");
      assert.ok(used.size > 0, `${code}: must hold card ids`);
      for (const [prefix, nums] of used) {
        const max = Math.max(...nums.keys());
        const gaps = [];
        for (let n = 1; n <= max; n++) if (!nums.has(n)) gaps.push(`${prefix}.${String(n).padStart(3, "0")}`);
        assert.deepEqual(gaps, [],
          `${code}: card ids ${gaps.join(", ")} are neither used nor in retiredCardIds. ` +
          "A deleted card's id must go into retiredCardIds.");
      }
    }
  });
}
