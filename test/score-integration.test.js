/* LB-36: end-to-end score flow with the REAL modules wired together
 * (store.js + prefs.js + game.js + progress.js + streak.js + engine.js) over
 * one in-memory localStorage — the same stack the page loads.
 *
 * Proves: a 10-card test stores ratings and a personal best under
 * languagebasics.* keys only; a "reload" (a fresh module stack over the SAME
 * storage) keeps progress; no lb.* key is ever read, written or deleted; the
 * streak is not marked on page load; blocked storage still runs and shows
 * the no-storage footer.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { makeEngineEnv } = require("./helpers/engine-dom.js");
const { makeLocalStorage } = require("./helpers/local-storage-shim.js");

const MODULES = ["store.js", "prefs.js", "game.js", "progress.js", "streak.js"];

function lesson(n) {
  const cards = [];
  for (let i = 1; i <= n; i++) cards.push({ prompt: i, answer: "w" + i, hint: "h" + i });
  return { id: "sq/lesson-4", title: "L4", revealMs: 5000, cards };
}

/* Wrap a storage shim so every key it is asked about is logged. */
function spyStorage(storage) {
  const log = [];
  for (const fn of ["getItem", "setItem", "removeItem"]) {
    const real = storage[fn].bind(storage);
    storage[fn] = (k, v) => { log.push({ fn, key: String(k) }); return real(k, v); };
  }
  return log;
}

function play(h, ratings) {
  for (const r of ratings) {
    if (r === "timeout") { h.fireTimer(); h.click("toggleBtn"); continue; }
    h.click("toggleBtn");
    h.advance(500);
    h.click(r ? "rateKnewBtn" : "rateNotYetBtn");
  }
}

test("full 10-card test: ratings + best stored under languagebasics.progress; reload keeps them", () => {
  const storage = makeLocalStorage();
  storage.seedRaw("lb.mastery", '{"v":1,"cards":{}}'); // another app's data
  storage.seedRaw("lb.prefs", '{"v":1,"lessons":{}}');
  const log = spyStorage(storage);

  const h = makeEngineEnv({ modules: MODULES, storage });
  h.engine.start(lesson(20)); // page load
  const streakAfterLoad = storage.getItem("languagebasics.streak");
  assert.equal(streakAfterLoad, null, "page load does not mark the streak");

  h.engine.startTest(lesson(20));
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 10");
  // reveal-only first: nothing stored
  h.click("toggleBtn");
  assert.equal(storage.getItem("languagebasics.progress"), null, "a reveal stores nothing");
  h.advance(500);
  h.click("rateKnewBtn");
  play(h, [true, false, "timeout", true, true, false, true, true, true]);
  assert.equal(h.elements.resultScore.textContent, "You knew 7 of 10.");
  assert.equal(h.elements.resultBest.textContent, "New personal best!");
  assert.equal(h.elements.resultLesson.textContent, "This lesson: 7 of 20 known.");
  assert.equal(h.elements.resultList.children.length, 3);
  assert.equal(h.elements.resultFooter.textContent, "Your progress is saved on this device only.");

  const saved = JSON.parse(storage.getItem("languagebasics.progress"));
  assert.equal(saved.v, 1);
  const rec = saved.lessons["sq/lesson-4"];
  assert.equal(Object.keys(rec.cards).length, 10);
  assert.equal(rec.best.score, 7);
  assert.equal(rec.best.of, 10);
  for (const k of Object.keys(rec.cards)) {
    assert.ok(rec.cards[k].t > 1e12, "epoch ms timestamps");
  }
  const streak = JSON.parse(storage.getItem("languagebasics.streak"));
  assert.equal(streak.current, 1, "the first rating marked today");

  // Practice round: updates known, never the best.
  h.advance(500); // the results buttons ignore input for 500 ms
  h.click("resultPracticeBtn");
  play(h, [true, true, true]);
  assert.equal(h.elements.resultTitle.textContent, "Practice results");
  assert.equal(h.elements.resultLesson.textContent, "This lesson: 10 of 20 known.");
  assert.equal(JSON.parse(storage.getItem("languagebasics.progress")).lessons["sq/lesson-4"].best.score, 7);

  // "Reload": a fresh stack over the same storage.
  const h2 = makeEngineEnv({ modules: MODULES, storage });
  const c = h2.engine.knownSummary(lesson(20));
  assert.equal(c.known, 10);
  assert.equal(c.total, 20);
  h2.engine.startTest(lesson(20));
  // Unknown-first: the 10 cards not yet known come first.
  const shown = [];
  for (let i = 0; i < 10; i++) {
    shown.push(Number(h2.elements.number.textContent));
    h2.click("toggleBtn"); h2.advance(500); h2.click("rateKnewBtn");
  }
  const known = Object.keys(JSON.parse(storage.getItem("languagebasics.progress")).lessons["sq/lesson-4"].cards);
  assert.equal(known.length, 20, "the second test reached the 10 untested cards");
  assert.equal(h2.elements.resultScore.textContent, "You knew 10 of 10.");
  assert.equal(h2.elements.resultBest.textContent, "New personal best!");

  const lbTouched = log.filter((e) => e.key.startsWith("lb."));
  assert.equal(lbTouched.length, 0, "no lb.* key read, written or deleted: " + JSON.stringify(lbTouched));
  assert.equal(log.filter((e) => e.fn === "removeItem" && e.key !== "languagebasics.__probe__").length, 0);
  assert.equal(storage.getItem("lb.mastery"), '{"v":1,"cards":{}}', "the other app's data is untouched");
  const keys = new Set(log.filter((e) => e.fn === "setItem").map((e) => e.key));
  for (const k of keys) {
    assert.ok(k === "languagebasics.progress" || k === "languagebasics.streak" || k === "languagebasics.__probe__", k);
  }
});

test("a smaller lesson (3 cards) tests 3; the best is 'of 3'", () => {
  const storage = makeLocalStorage();
  const h = makeEngineEnv({ modules: MODULES, storage });
  h.engine.startTest(lesson(3));
  play(h, [true, true, false]);
  assert.equal(h.elements.resultScore.textContent, "You knew 2 of 3.");
  const best = JSON.parse(storage.getItem("languagebasics.progress")).lessons["sq/lesson-4"].best;
  assert.equal(best.of, 3);
  // Tie on the next full test keeps the old one.
  h.advance(500);
  h.click("resultAgainBtn");
  play(h, [true, false, true]);
  assert.equal(h.elements.resultBest.textContent, "You matched your best.");
  h.advance(500);
  h.click("resultAgainBtn");
  play(h, [false, false, true]);
  assert.equal(h.elements.resultBest.textContent, "Your best: 2 of 3.");
});

test("blocked storage (private window): the test still runs; footer says it can't be saved", () => {
  const h = makeEngineEnv({ modules: MODULES, throwOnSet: true });
  h.engine.startTest(lesson(2));
  play(h, [true, false]);
  assert.equal(h.elements.resultScore.textContent, "You knew 1 of 2.");
  assert.equal(h.elements.resultFooter.textContent, "Progress can't be saved in this browser (private window?).");
});
