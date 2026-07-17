/* Schema validation for every content/sq/lesson-N.js data file.
 *
 * Run:  node --test
 *
 * Asserts, per lesson:
 *   - window.LB_LESSON is present with required keys (id, title, cards)
 *   - every card has a non-empty prompt (string|number), non-empty answer,
 *     and a non-empty hint (the final dataset filled all hints app-wide,
 *     including lesson 6 which was previously blank)
 *   - optional fields (audio, recallPrompt) are correct type when present
 *   - window.LB_LESSONS received exactly one {id, title} entry for the lesson
 *   - known card counts hold (1=11, 2=9, 3=8, 4=80, 5=56, 6=6)
 *   - lesson 6 revealMs === 10000 (10s)
 *
 * Built-ins only: node:test, node:assert. No npm installs.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadLesson } = require("./helpers/load-lesson.js");

// Expected card counts per lesson, KEYED BY LANGUAGE NAMESPACE (LB-23). Adding a
// language adds a top-level namespace here; the loop below loads each file under
// its language's content/<lang> directory via loadLesson(file, lang).
const EXPECTED = {
  sq: {
    "lesson-1.js": { count: 11, id: "sq/lesson-1", revealMs: 5000 },
    "lesson-2.js": { count: 9, id: "sq/lesson-2", revealMs: 5000 },
    "lesson-3.js": { count: 8, id: "sq/lesson-3", revealMs: 5000 },
    "lesson-4.js": { count: 80, id: "sq/lesson-4", revealMs: 5000 },
    "lesson-5.js": { count: 56, id: "sq/lesson-5", revealMs: 5000 },
    "lesson-6.js": { count: 6, id: "sq/lesson-6", revealMs: 10000 },
    // LB-18 alphabet section: 3 group decks + 1 combined (rollup-excluded).
    "alphabet-vowels.js": { count: 7, id: "sq/alphabet-vowels", revealMs: 5000 },
    "alphabet-consonants.js": { count: 20, id: "sq/alphabet-consonants", revealMs: 5000 },
    "alphabet-digraphs.js": { count: 9, id: "sq/alphabet-digraphs", revealMs: 5000 },
    "alphabet-all.js": { count: 36, id: "sq/alphabet-all", revealMs: 5000 },
    // LB-20 phrases section: 5 decks, all rollup-excluded. 7/8/6/5/6 = 32 cards.
    "phrases-1.js": { count: 7, id: "sq/phrases-1", revealMs: 5000 },
    "phrases-2.js": { count: 8, id: "sq/phrases-2", revealMs: 5000 },
    "phrases-3.js": { count: 6, id: "sq/phrases-3", revealMs: 5000 },
    "phrases-4.js": { count: 5, id: "sq/phrases-4", revealMs: 5000 },
    "phrases-5.js": { count: 6, id: "sq/phrases-5", revealMs: 5000 },
    // LB-21 words section: 5 decks, all rollup-excluded. 9/12/11/13/17 = 62 cards.
    "words-1.js": { count: 9, id: "sq/words-1", revealMs: 5000 },
    "words-2.js": { count: 12, id: "sq/words-2", revealMs: 5000 },
    "words-3.js": { count: 11, id: "sq/words-3", revealMs: 5000 },
    "words-4.js": { count: 13, id: "sq/words-4", revealMs: 5000 },
    "words-5.js": { count: 17, id: "sq/words-5", revealMs: 5000 },
  },
};

for (const [lang, files] of Object.entries(EXPECTED)) {
  for (const [file, expected] of Object.entries(files)) {
    test(`${lang}/${file}: schema + counts`, () => {
      const { lesson, lessonsIndex } = loadLesson(file, lang);

    // --- LB_LESSON present with required keys ---
    assert.ok(lesson, `${file}: window.LB_LESSON must be defined`);
    assert.equal(typeof lesson.id, "string", `${file}: id must be a string`);
    assert.ok(lesson.id.length > 0, `${file}: id must be non-empty`);
    assert.equal(lesson.id, expected.id, `${file}: id mismatch`);
    assert.equal(typeof lesson.title, "string", `${file}: title must be a string`);
    assert.ok(lesson.title.length > 0, `${file}: title must be non-empty`);
    assert.ok(Array.isArray(lesson.cards), `${file}: cards must be an array`);

    // --- revealMs: optional, but when present must be a positive number ---
    if (lesson.revealMs !== undefined) {
      assert.equal(typeof lesson.revealMs, "number", `${file}: revealMs must be a number`);
      assert.ok(lesson.revealMs > 0, `${file}: revealMs must be > 0`);
    }
    assert.equal(lesson.revealMs, expected.revealMs, `${file}: revealMs mismatch`);

    // --- optional lesson.recallPrompt override ---
    if (lesson.recallPrompt !== undefined) {
      assert.equal(typeof lesson.recallPrompt, "string", `${file}: lesson.recallPrompt must be a string`);
    }

    // --- card count ---
    assert.equal(
      lesson.cards.length,
      expected.count,
      `${file}: expected ${expected.count} cards, found ${lesson.cards.length}`
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

      // hint: required, string, non-empty (final dataset filled all hints
      // app-wide, incl. lesson 6 which was previously blank)
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
}
