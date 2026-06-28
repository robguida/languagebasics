/* LB-20 phrases-section coverage: multi-part (" | ") answer rendering + hint
 * separator safety for the 5 new phrases decks (phrases-1.js .. phrases-5.js).
 *
 * Run:  node --test
 *
 * Why this test exists:
 *   The phrases decks introduce the FIRST broad use of the " | " multi-part
 *   answer stack outside lessons 2/6, and the engine's renderAnswer(" | " ->
 *   "<br>") path had ZERO prior test coverage. They also pack pronunciation for
 *   multiple Albanian parts onto ONE hint line — and the engine treats " | "
 *   (answer separator) and " / " (alphabet hint-rotation delimiter) as control
 *   characters. A hint that accidentally contains either would mis-render or
 *   trigger example-rotation on a phrase card. This file closes both gaps:
 *
 *     1. DATA: every pair card's answer splits into the expected number of
 *        NON-EMPTY Albanian parts (no empty stack lines, no stray separators).
 *     2. ENGINE: the REAL renderAnswer path (via LBEngine.start -> nextCard ->
 *        wordEl.innerHTML) turns a " | " answer into the right <br>-joined HTML,
 *        and leaves a single-part answer with NO <br>.
 *     3. HINT GUARD: no hint on any of the 33 new cards contains " | " or " / "
 *        (either would break raw-hint render / trigger alphabet rotation). The
 *        " / " in a card PROMPT is intentional and out of scope (only hints
 *        feed the rotation delimiter).
 *
 * Built-ins only: node:test, node:assert, node:fs, node:vm, node:path (+ the
 * shared vm lesson loader). No npm installs.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadLesson } = require("./helpers/load-lesson.js");

const PHRASES_FILES = [
  "phrases-1.js",
  "phrases-2.js",
  "phrases-3.js",
  "phrases-4.js",
  "phrases-5.js",
];

const ANSWER_SEP = " | "; // engine renderAnswer line separator
const HINT_DELIM = " / "; // engine alphabet hint-rotation delimiter

/* Every pair/stack card across the 5 decks, keyed by id+prompt, with the exact
 * number of Albanian parts expected. LB-21 Item A simplified the 3 greeting
 * pairs (How are you? / Welcome / Nice to meet you) to single-part cards, so the
 * only remaining stacks are Yes/No and the 4-way Left/Right/Here/Stop = 2 cards
 * with 2+ parts (1 with 2, 1 with 4). */
const PAIR_CARDS = [
  { file: "phrases-3.js", prompt: "Yes / No",                    parts: 2 },
  { file: "phrases-4.js", prompt: "Left / Right / Here / Stop",  parts: 4 },
];

function findCard(lesson, prompt) {
  return lesson.cards.find((c) => String(c.prompt) === String(prompt));
}

// ---------------------------------------------------------------------------
// 1. DATA — pair-card answers split into the expected non-empty parts
// ---------------------------------------------------------------------------
test("phrases: each pair card answer splits into the expected non-empty parts", () => {
  for (const row of PAIR_CARDS) {
    const { lesson } = loadLesson(row.file);
    const card = findCard(lesson, row.prompt);
    assert.ok(card, `${row.file}: pair card prompt ${JSON.stringify(row.prompt)} must exist`);

    const parts = String(card.answer).split(ANSWER_SEP);
    assert.equal(
      parts.length, row.parts,
      `${row.file} ${JSON.stringify(row.prompt)}: expected ${row.parts} " | " parts, ` +
        `got ${parts.length} -> ${JSON.stringify(card.answer)}`
    );
    parts.forEach((p, i) => {
      assert.ok(
        p.trim().length > 0,
        `${row.file} ${JSON.stringify(row.prompt)}: part #${i} is empty (stray " | ")`
      );
      // A clean split must leave no residual separator pipe in any single part.
      assert.ok(
        p.indexOf("|") === -1,
        `${row.file} ${JSON.stringify(row.prompt)}: part #${i} still holds a "|"`
      );
    });
  }
});

test("phrases: exactly 2 pair cards across the section, the rest are single-part", () => {
  let pairCount = 0;
  let total = 0;
  for (const file of PHRASES_FILES) {
    const { lesson } = loadLesson(file);
    for (const card of lesson.cards) {
      total++;
      if (String(card.answer).includes(ANSWER_SEP)) pairCount++;
    }
  }
  assert.equal(total, 33, "expected 33 cards across the 5 phrases decks");
  assert.equal(pairCount, 2, "expected exactly 2 multi-part (pair) answer cards (LB-21 Item A simplified the 3 greeting pairs)");
});

// ---------------------------------------------------------------------------
// 1b. ROLLUP-SKIP — every phrases deck must carry rollup:false on BOTH the
// LB_LESSON object and the registry push entry, exactly like alphabet-all.
// Schema/count tests never look at `rollup`, so without this a deck silently
// missing the flag would wrongly inflate the "X of N mastered" denominator and
// never be caught. (Mirrors the alphabet-combined.test.js rollup guard.)
// ---------------------------------------------------------------------------
test("phrases: every deck carries rollup:false on LB_LESSON AND its registry entry", () => {
  for (const file of PHRASES_FILES) {
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
// 2. ENGINE — the REAL renderAnswer path produces the right <br> HTML
// ---------------------------------------------------------------------------
const ENGINE_PATH = path.resolve(__dirname, "..", "src", "engine.js");
const ENGINE_SRC = fs.readFileSync(ENGINE_PATH, "utf8");

/* Minimal DOM + window shim (same approach as loop-resilience.test.js). The
 * engine's nextCard() sets wordEl.innerHTML = renderAnswer(answer) the moment a
 * card is shown (even while hidden), so a single-card deck lets us read the REAL
 * rendered HTML after start() with no timer/click needed. */
function makeDomShim() {
  const elements = {};
  const ids = ["number", "word", "pronunciation", "label", "recall", "bar", "toggleBtn", "title"];
  for (const id of ids) {
    elements[id] = { id, style: {}, hidden: false, textContent: "", innerHTML: "", offsetWidth: 0, addEventListener() {} };
  }
  const documentShim = {
    getElementById: (id) => elements[id] || null,
    addEventListener() {},
    set title(v) { this._title = v; },
    get title() { return this._title; },
  };
  const sandbox = {
    window: { LB_LESSONS: [] },
    document: documentShim,
    console: { warn() {}, log() {} },
    setTimeout: () => 0,
    clearTimeout: () => {},
    Math, String, Array,
  };
  return { sandbox, elements };
}

function renderAnswerViaEngine(answer) {
  const { sandbox, elements } = makeDomShim();
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SRC, sandbox, { filename: ENGINE_PATH });
  const engine = sandbox.window.LBEngine;
  engine.start({
    id: "sq/test-pair",
    title: "Pair render",
    revealMs: 5000,
    cards: [{ prompt: "X", answer, hint: "hh", audio: "" }],
  });
  return String(elements.word.innerHTML);
}

test("engine renderAnswer: a single 2-part answer becomes <br>-joined HTML", () => {
  const html = renderAnswerViaEngine("Si je? | Mirë, faleminderit");
  assert.equal(html, "Si je?<br>Mirë, faleminderit");
});

test("engine renderAnswer: a 4-part answer becomes 3 <br> joins, 4 segments", () => {
  const html = renderAnswerViaEngine("Majtas | Djathtas | Këtu | Ndalo");
  assert.equal(html, "Majtas<br>Djathtas<br>Këtu<br>Ndalo");
  assert.equal(html.split("<br>").length, 4, "4 parts -> 4 rendered segments");
});

test("engine renderAnswer: a single-part answer has NO <br>", () => {
  const html = renderAnswerViaEngine("Faleminderit");
  assert.equal(html, "Faleminderit");
  assert.ok(html.indexOf("<br>") === -1, "single-part answer must not render a <br>");
});

// Drive every real pair card through the engine, not just the hand-picked two.
test("engine renderAnswer: every phrases pair card renders parts joined by <br>", () => {
  for (const row of PAIR_CARDS) {
    const { lesson } = loadLesson(row.file);
    const card = findCard(lesson, row.prompt);
    const expected = String(card.answer).split(ANSWER_SEP).join("<br>");
    const html = renderAnswerViaEngine(card.answer);
    assert.equal(
      html, expected,
      `${row.file} ${JSON.stringify(row.prompt)}: engine render mismatch`
    );
    assert.equal(
      html.split("<br>").length, row.parts,
      `${row.file} ${JSON.stringify(row.prompt)}: expected ${row.parts} rendered segments`
    );
  }
});

// ---------------------------------------------------------------------------
// 3. HINT GUARD — no new hint carries an engine control separator
// ---------------------------------------------------------------------------
test('phrases: no hint contains " | " or " / " (would break render / trigger rotation)', () => {
  const offenders = [];
  let scanned = 0;
  for (const file of PHRASES_FILES) {
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
  assert.equal(scanned, 33, "expected to scan all 33 new phrases hints");
  assert.deepEqual(offenders, [], `Forbidden hint separator(s) found:\n${offenders.join("\n")}`);
});
