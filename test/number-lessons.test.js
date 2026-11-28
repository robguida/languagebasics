/* LB-45: number-lesson checks that read the lesson data (data/*.json).
 *
 * A - prompts are unique inside every lesson, app-wide (progress is saved by
 *     lesson id + prompt text, so a duplicate would merge two cards).
 * D - every number-lesson prompt reads as a whole number, and each language's
 *     big-number roots lesson (lesson-5) covers 100, 1,000, 10,000 and 1,000,000.
 * fitPrompt - a big prompt is shrunk to one line on its card; a short prompt
 *     keeps its size; it never goes below the floor.
 *
 * Every data check runs on the repo and on the repo plus the made-up language
 * (test/fixtures/data-extra/). Each check reports ALL bad items, not the first.
 * Node built-ins only.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { repoWorld, fixtureWorld } = require("./helpers/load-data.js");
const { makeEngineEnv } = require("./helpers/engine-dom.js");

const ROOTS_SLUG = "lesson-5";
const OWNER_ROOTS = [100, 1000, 10000, 1000000];
const WORD_UNITS = { trillion: 1e12, quadrillion: 1e15 };

/** Value of a number-lesson prompt, or null when it does not read as a whole number. */
function promptValue(p) {
  if (typeof p === "number") return Number.isSafeInteger(p) && p >= 0 ? p : null;
  if (typeof p !== "string") return null;
  if (/^\d{1,3}(,\d{3})*$/.test(p) || /^\d{1,3}$/.test(p)) return Number(p.replace(/,/g, ""));
  const m = /^([1-9])\s+(trillion|quadrillion)$/.exec(p);
  if (m) return Number(m[1]) * WORD_UNITS[m[2]];
  return null;
}

for (const world of [repoWorld(), fixtureWorld()]) {
  const T = world.tag;

  test(`${T}A: prompts are unique inside every lesson (all languages, live and parked)`, () => {
    const bad = [];
    for (const row of world.data.lessons) {
      let lesson;
      try { lesson = world.loadLesson(row).lesson; } catch (e) { bad.push(`${row.id}: did not load (${e.message})`); continue; }
      const seen = new Map();
      lesson.cards.forEach((c, i) => {
        const key = String(c.prompt);
        if (seen.has(key)) bad.push(`${row.id}: prompt "${key}" repeats (cards ${seen.get(key) + 1} and ${i + 1})`);
        else seen.set(key, i);
      });
    }
    assert.deepEqual(bad, []);
  });

  test(`${T}D: every number-lesson prompt reads as a whole number`, () => {
    const bad = [];
    for (const row of world.data.lessons.filter((l) => l.group === "Numbers")) {
      let lesson;
      try { lesson = world.loadLesson(row).lesson; } catch (e) { bad.push(`${row.id}: did not load (${e.message})`); continue; }
      (lesson.cards || []).forEach((c, i) => {
        if (promptValue(c.prompt) === null) bad.push(`${row.id} card ${i + 1}: prompt ${JSON.stringify(c.prompt)} is not a whole number`);
      });
    }
    assert.deepEqual(bad, []);
  });

  test(`${T}D: each language's roots lesson covers 100, 1,000, 10,000 and 1,000,000`, () => {
    const bad = [];
    // Exempt: a language that is not "natural" (ip status read from the data) AND has
    // no roots lesson. The made-up fixture languages are like that (qab is numbers-only
    // with no roots lesson). A non-natural language that does have lesson-5 is still checked.
    const real = world.data.languages.filter((l) =>
      !(l.ipStatus !== "natural" && !world.data.byId.has(`${l.code}/${ROOTS_SLUG}`)));
    assert.ok(real.length >= 4, "the four real languages are present");
    for (const lang of real) {
      const row = world.data.byId.get(`${lang.code}/${ROOTS_SLUG}`);
      if (!row) { bad.push(`${lang.code}: no ${ROOTS_SLUG}`); continue; }
      if (row.parked) bad.push(`${row.id}: roots lesson is parked, so learners cannot reach it`);
      let lesson;
      try { lesson = world.loadLesson(row).lesson; } catch (e) { bad.push(`${row.id}: did not load (${e.message})`); continue; }
      const have = new Set(lesson.cards.map((c) => promptValue(c.prompt)));
      for (const v of OWNER_ROOTS) if (!have.has(v)) bad.push(`${row.id}: missing ${v.toLocaleString("en-US")}`);
    }
    assert.deepEqual(bad, []);
  });
}

/* ------------------------------ fitPrompt --------------------------------- */
/* fitPrompt is private; it runs when a card is shown. The stub box is 300 px
 * wide. Text is 20 px per character at 40 px font, so width scales with the
 * font size and the nowrap switch. */

function pxOf(v) { return /px$/.test(String(v || "")) ? parseFloat(v) : 40; }

function fitEnv(boxWidth, charsToPx) {
  const e = makeEngineEnv({});
  const n = e.elements.number;
  n.style = {};
  Object.defineProperty(n, "clientWidth", { get: () => boxWidth });
  Object.defineProperty(n, "scrollWidth", {
    get: () => {
      const px = pxOf(n.style.fontSize);
      const len = String(n.textContent).length;
      return n.style.whiteSpace === "nowrap" ? Math.round(len * charsToPx * px / 40) : Math.min(boxWidth, len * charsToPx);
    },
  });
  e.window.getComputedStyle = () => ({ fontSize: pxOf(n.style.fontSize) + "px" });
  return e;
}

function show(e, prompt) {
  e.engine.start({ id: "sq/fit", title: "Fit", revealMs: 5000, cards: [{ prompt, answer: "w", hint: "h" }] });
  return e.elements.number.style;
}

test("fitPrompt: a short prompt gets no pixel shrink (keeps its ladder size)", () => {
  const e = fitEnv(300, 20);
  const s = show(e, "99");
  assert.ok(!/px$/.test(String(s.fontSize || "")), "no pixel shrink for a prompt that fits: " + s.fontSize);
});

test("fitPrompt: a too-wide prompt gets nowrap and a smaller size that fits the box", () => {
  const e2 = fitEnv(300, 40); // 13 chars x 40 = 520 px at 40 px > 300
  const s2 = show(e2, "1,000,000,000");
  assert.equal(s2.whiteSpace, "nowrap");
  const px = parseFloat(s2.fontSize);
  assert.ok(px < 40 && px >= 14, "size shrank but stays above the floor: " + s2.fontSize);
  assert.ok(Math.round(13 * 40 * px / 40) <= 300, "the shrunk text fits the box");
});

test("fitPrompt: never goes below the 14 px floor, however wide the text", () => {
  const e = fitEnv(300, 4000);
  const s = show(e, "1,000,000,000");
  assert.equal(s.whiteSpace, "nowrap");
  assert.equal(parseFloat(s.fontSize), 14);
});

test("fitPrompt: a DOM with no layout (width 0) keeps the ladder size and does not throw", () => {
  const e = fitEnv(0, 40);
  const s = show(e, "1,000,000,000");
  assert.ok(s.whiteSpace !== "nowrap");
});
