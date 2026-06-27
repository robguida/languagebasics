/* Anti-drift guard for the generated combined alphabet deck (LB-18).
 *
 * Run:  node --test
 *
 * alphabet-all.js is the canonical-order union of the three group decks
 * (vowels + consonants + digraphs). It is GENERATED, so this test guarantees it
 * never drifts from the sources by hand: every combined card must be byte-equal
 * to its group source, the order must match the canonical 36-letter sequence,
 * and the combined registry entry must carry rollup:false (so it is excluded
 * from the "X of N mastered" rollup). Built-ins only.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadLesson } = require("./helpers/load-lesson.js");

// Canonical Albanian alphabet order (36 letters).
const CANON = ["a","b","c","ç","d","dh","e","ë","f","g","gj","h","i","j","k","l",
  "ll","m","n","nj","o","p","q","r","rr","s","sh","t","th","u","v","x","xh","y","z","zh"];

function cardKey(c) {
  return JSON.stringify([String(c.prompt), String(c.answer), String(c.hint), String(c.audio || "")]);
}

test("alphabet-all is the canonical-order union of the 3 group decks", () => {
  const groups = ["alphabet-vowels.js", "alphabet-consonants.js", "alphabet-digraphs.js"]
    .map((f) => loadLesson(f).lesson);

  // Build the source map prompt -> card from the 3 groups.
  const byPrompt = {};
  for (const g of groups) {
    for (const c of g.cards) byPrompt[String(c.prompt)] = c;
  }
  assert.equal(Object.keys(byPrompt).length, 36, "groups must supply 36 distinct letters");

  const { lesson: combined, lessonsIndex } = loadLesson("alphabet-all.js");
  assert.equal(combined.cards.length, 36, "combined deck must hold 36 cards");

  // Order + byte-equality, card by card, against the canonical sequence.
  CANON.forEach((letter, i) => {
    const got = combined.cards[i];
    const src = byPrompt[letter];
    assert.ok(src, `group decks must contain "${letter}"`);
    assert.equal(String(got.prompt), letter, `card #${i} must be "${letter}" in canonical order`);
    assert.equal(cardKey(got), cardKey(src),
      `combined card "${letter}" must be byte-identical to its group source`);
  });

  // Rollup-skip flag must be present so the combined deck is excluded from the
  // overall mastery denominator (and the celebration numerator).
  assert.equal(combined.rollup, false, "combined LB_LESSON must carry rollup:false");
  assert.equal(lessonsIndex.length, 1, "combined must push exactly one registry entry");
  assert.equal(lessonsIndex[0].rollup, false, "combined registry entry must carry rollup:false");
});
