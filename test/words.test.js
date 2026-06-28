/* LB-21 words-section guards — net-new coverage for the 5 new words decks
 * (words-1.js .. words-5.js, 9/12/11/13/17 = 62 cards, all single-word cards).
 *
 * Run:  node --test
 *
 * Why this file exists (two guards schema/count/parity do NOT cover):
 *
 *   1. ROLLUP-SKIP — every words deck must carry rollup:false on BOTH the
 *      LB_LESSON object AND its LB_LESSONS registry push entry, exactly like the
 *      phrases/alphabet rollup-skip decks. Schema/count tests never read
 *      `rollup`, so a deck silently missing the flag would wrongly inflate the
 *      "X of N mastered" denominator and never be caught. (Mirrors the
 *      phrases.test.js / alphabet-combined.test.js rollup guards.)
 *
 *   2. HINT SEPARATOR GUARD — no hint on any of the 62 word cards may contain
 *      " | " (engine renderAnswer line separator) or " / " (engine alphabet
 *      hint-rotation delimiter). Either would mis-render the hint or trigger
 *      example-rotation on a word card. The existing phrases.test.js separator
 *      guard is hard-scoped to the 33 phrase hints (scanned===33); this is the
 *      words-scoped mirror (scanned===62).
 *
 * Built-ins only: node:test, node:assert (+ the shared vm lesson loader).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadLesson } = require("./helpers/load-lesson.js");

const WORDS_FILES = [
  "words-1.js",
  "words-2.js",
  "words-3.js",
  "words-4.js",
  "words-5.js",
];

const ANSWER_SEP = " | "; // engine renderAnswer line separator
const HINT_DELIM = " / "; // engine alphabet hint-rotation delimiter

// ---------------------------------------------------------------------------
// 1. ROLLUP-SKIP — every words deck carries rollup:false on the LB_LESSON object
// AND the registry push entry (mirrors the phrases rollup guard).
// ---------------------------------------------------------------------------
test("words: every deck carries rollup:false on LB_LESSON AND its registry entry", () => {
  for (const file of WORDS_FILES) {
    const { lesson, lessonsIndex } = loadLesson(file);
    assert.equal(lesson.rollup, false, `${file}: LB_LESSON.rollup must be false (rollup-skip)`);
    assert.equal(lessonsIndex.length, 1, `${file}: must push exactly one registry entry`);
    assert.equal(
      lessonsIndex[0].rollup, false,
      `${file}: registry entry must carry rollup:false or the mastery rollup denominator inflates`
    );
  }
});

// ---------------------------------------------------------------------------
// 2. HINT SEPARATOR GUARD — no word hint carries an engine control separator.
// Words-scoped mirror of the phrases guard; scanned must equal all 62 cards.
// ---------------------------------------------------------------------------
test('words: no hint contains " | " or " / " (would break render / trigger rotation)', () => {
  const offenders = [];
  let scanned = 0;
  for (const file of WORDS_FILES) {
    const { lesson } = loadLesson(file);
    lesson.cards.forEach((card, i) => {
      scanned++;
      const hint = String(card.hint);
      if (hint.includes(ANSWER_SEP)) {
        offenders.push(`${file} card #${i} (${JSON.stringify(card.prompt)}): hint has " | " -> ${JSON.stringify(hint)}`);
      }
      if (hint.includes(HINT_DELIM)) {
        offenders.push(`${file} card #${i} (${JSON.stringify(card.prompt)}): hint has " / " -> ${JSON.stringify(hint)}`);
      }
    });
  }
  assert.equal(scanned, 62, "expected to scan all 62 new words hints");
  assert.deepEqual(offenders, [], `Forbidden hint separator(s) found:\n${offenders.join("\n")}`);
});
