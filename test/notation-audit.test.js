/* Notation audit for the number decks (content/sq/lesson-1.js .. lesson-6.js).
 *
 * Run:  node --test
 *
 * Why this test exists (LB-19):
 *   The schema/count tests stay green whether the gj phonetic notation is right
 *   or wrong — card counts stay 170 and every hint stays non-empty no matter
 *   what the syllables say. Only a CONTENT-level scan can catch a half-applied
 *   retrofit where one card was missed. This file is that scan.
 *
 * Two halves, both DATA-DRIVEN (edit the arrays/tables, never the logic) so the
 * same harness is reusable for the future, currently-PARKED "dh / -dhjetë"
 * retrofit:
 *
 *   1. NEGATIVE guard — assert NO forbidden legacy spelling survives on ANY
 *      card (hint or answer) in lessons 1-6. This is the test that catches a
 *      MISSED card.
 *   2. POSITIVE check — the 29 corrected six-family ("gjashtë") cards each
 *      carry the new "Gyosht" notation in their hint.
 *
 * Built-ins only: node:test, node:assert. No npm installs.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadLesson } = require("./helpers/load-lesson.js");

// Number decks in scope. The alphabet decks (alphabet-*.js) were already
// corrected to "Gyosht" under LB-18 and are intentionally out of scope here.
const LESSON_FILES = [
  "lesson-1.js",
  "lesson-2.js",
  "lesson-3.js",
  "lesson-4.js",
  "lesson-5.js",
  "lesson-6.js",
];

// Per-card text fields that carry human-readable notation we audit.
const TEXT_FIELDS = ["hint", "answer"];

// ---------------------------------------------------------------------------
// 1. NEGATIVE GUARD
// ---------------------------------------------------------------------------
// Legacy gj phonetic spellings the LB-19 retrofit replaces with "Gyosht".
// EDIT THIS ARRAY (not the logic) to reuse the audit for a future retrofit.
//
// NOTE — do NOT add "they yet" here. The "dh / -dhjetë" -> "they yet" rendering
// is intentionally PARKED by Rob and is unchanged by LB-19; flagging it would be
// wrong. This guard is for the gj/"Jyosht" family only.
const FORBIDDEN = ["Jyosht", "Jyosh"];

test("notation audit (lessons 1-6): no forbidden legacy gj spelling survives", () => {
  const offenders = [];

  for (const file of LESSON_FILES) {
    const { lesson } = loadLesson(file);
    lesson.cards.forEach((card, i) => {
      for (const field of TEXT_FIELDS) {
        const val = card[field];
        if (typeof val !== "string") continue;
        for (const bad of FORBIDDEN) {
          if (val.includes(bad)) {
            offenders.push(
              `${file} card #${i} (prompt ${JSON.stringify(card.prompt)}) ` +
                `.${field} still contains "${bad}" -> ${JSON.stringify(val)}`
            );
            break; // one offender line per offending field is enough to locate it
          }
        }
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `Forbidden legacy gj notation still present (a card was missed in the retrofit):\n` +
      offenders.join("\n")
  );
});

// ---------------------------------------------------------------------------
// 2. POSITIVE CHECK
// ---------------------------------------------------------------------------
// The 29 six-family ("gjashtë" / number 6) cards the retrofit corrects. Each
// must carry the new substring in its hint. DATA-DRIVEN: add/remove rows here,
// never touch the loop. prompt is matched type-agnostically (String()) because
// lessons 1-4 use numeric prompts and lessons 5-6 use string prompts.
const EXPECT_SUBSTR = "Gyosht";

const CORRECTED = [
  // L1 — Numbers 0-10
  { file: "lesson-1.js", prompt: 6 },
  // L2 — Numbers 11-19
  { file: "lesson-2.js", prompt: 16 },
  // L3 — Tens 20-90
  { file: "lesson-3.js", prompt: 60 },
  // L4 — 20-99 compounds: the units-6 cards + the entire 60s row
  { file: "lesson-4.js", prompt: 26 },
  { file: "lesson-4.js", prompt: 36 },
  { file: "lesson-4.js", prompt: 46 },
  { file: "lesson-4.js", prompt: 56 },
  { file: "lesson-4.js", prompt: 60 },
  { file: "lesson-4.js", prompt: 61 },
  { file: "lesson-4.js", prompt: 62 },
  { file: "lesson-4.js", prompt: 63 },
  { file: "lesson-4.js", prompt: 64 },
  { file: "lesson-4.js", prompt: 65 },
  { file: "lesson-4.js", prompt: 66 },
  { file: "lesson-4.js", prompt: 67 },
  { file: "lesson-4.js", prompt: 68 },
  { file: "lesson-4.js", prompt: 69 },
  { file: "lesson-4.js", prompt: 76 },
  { file: "lesson-4.js", prompt: 86 },
  { file: "lesson-4.js", prompt: 96 },
  // L5 — Big Number Roots (six-family)
  { file: "lesson-5.js", prompt: "600" },
  { file: "lesson-5.js", prompt: "6,000" },
  { file: "lesson-5.js", prompt: "6,000,000" },
  { file: "lesson-5.js", prompt: "6,000,000,000" },
  { file: "lesson-5.js", prompt: "6 trillion" },
  { file: "lesson-5.js", prompt: "6 quadrillion" },
  // L6 — Number Builder (built compounds containing a six)
  { file: "lesson-6.js", prompt: "12,568" },
  { file: "lesson-6.js", prompt: "234,567" },
  { file: "lesson-6.js", prompt: "1,234,567" },
];

// Cache each lesson once so we do not re-load files per row.
function lessonCache() {
  const cache = {};
  return (file) => (cache[file] ||= loadLesson(file).lesson);
}

function findCard(lesson, prompt) {
  return lesson.cards.find((c) => String(c.prompt) === String(prompt));
}

test(`notation audit: all ${CORRECTED.length} six-family cards carry "${EXPECT_SUBSTR}"`, () => {
  assert.equal(CORRECTED.length, 29, "the corrected-card table must list exactly 29 rows");

  const getLesson = lessonCache();
  const misses = [];

  for (const row of CORRECTED) {
    const lesson = getLesson(row.file);
    const card = findCard(lesson, row.prompt);
    if (!card) {
      misses.push(`${row.file}: no card with prompt ${JSON.stringify(row.prompt)}`);
      continue;
    }
    if (typeof card.hint !== "string" || !card.hint.includes(EXPECT_SUBSTR)) {
      misses.push(
        `${row.file} prompt ${JSON.stringify(row.prompt)}: ` +
          `hint missing "${EXPECT_SUBSTR}" -> ${JSON.stringify(card.hint)}`
      );
    }
  }

  assert.deepEqual(misses, [], `Retrofit incomplete:\n${misses.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 3. REGRESSION ANCHOR — Leitner / mastery identity is keyed on the number
// prompt, NOT the hint. The hint-only retrofit must not move any prompt, or
// learners would lose their per-card progress. Assert every corrected card's
// prompt is exactly what the table expects (i.e. untouched by the retrofit).
// ---------------------------------------------------------------------------
test("notation audit: retrofit touched hints only — card prompts (Leitner/mastery keys) unchanged", () => {
  const getLesson = lessonCache();

  for (const row of CORRECTED) {
    const lesson = getLesson(row.file);
    const card = findCard(lesson, row.prompt);
    assert.ok(card, `${row.file}: prompt ${JSON.stringify(row.prompt)} must still exist`);
    assert.equal(
      String(card.prompt),
      String(row.prompt),
      `${row.file}: prompt identity must be unchanged by the hint retrofit`
    );
  }
});
