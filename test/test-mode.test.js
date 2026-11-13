/* LB-36 test mode — the learner rates each card ("I knew it" / "Not yet").
 *
 * Run:  node --test
 *
 * Replaces the LB-15 test-mode-signal tests (where a fast reveal scored). The
 * REAL engine.js runs in a node:vm sandbox with a small fake DOM
 * (helpers/engine-dom.js). The reveal timer is captured and fired on demand,
 * and the rating-lock clock is driven by hand, so nothing depends on a wall
 * clock.
 *
 * "Never happens" checks COUNT CALLS on spies (LBProgress.record,
 * recordTestResult, LBStreak.markActive) — they do not rely on a throw.
 *
 * Covers (learning spec §10 + tech design §4):
 *   reveal alone records nothing; 500 ms rating lock; Space/Enter ignored while
 *   rating; K/1 and N/2 keys; timeout = Not yet with "Time's up" + "Next card";
 *   one record per card / double-click cannot double-record; results screen
 *   (score, missed list, practice again, test again, done); practice rounds
 *   never count for the personal best; a stopped test gives no results and no
 *   personal best; the personal-best line; N of M known; the no-storage
 *   footer; streak not marked on load, marked on first rating; bad card
 *   skipped; flag off => no test path; focus after reveal.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { makeEngineEnv } = require("./helpers/engine-dom.js");

function lessonOf(n, extra) {
  const cards = [];
  for (let i = 1; i <= n; i++) cards.push({ prompt: i, answer: "w" + i, hint: "h" + i });
  return Object.assign({ id: "sq/test-mode", title: "Test Mode", revealMs: 5000, cards }, extra || {});
}

/* Spies standing in for LBProgress + LBStreak (counts every call). */
function spies(opts) {
  opts = opts || {};
  const calls = { record: [], best: [], mark: 0, knownMap: 0 };
  const known = opts.known || {};
  const LBProgress = {
    record(id, prompt, knew) { calls.record.push({ id, prompt: String(prompt), knew }); known[String(prompt)] = knew === true; return true; },
    knownMap() { calls.knownMap++; const m = {}; for (const k of Object.keys(known)) if (known[k]) m[k] = true; return m; },
    knownCount(id, deck) { let k = 0; for (const c of deck) if (known[String(c.prompt)]) k++; return { known: k, total: deck.length }; },
    recordTestResult(id, score, of) { calls.best.push({ score, of }); return opts.bestResult ? opts.bestResult(score, of) : { status: "new", best: { score, of } }; },
    isPersistent() { return opts.persistent !== false; },
  };
  const LBStreak = { markActive() { calls.mark++; } };
  return { calls, window: { LBProgress, LBStreak } };
}

function env(opts) {
  const s = spies(opts);
  const e = makeEngineEnv({ modules: ["game.js"], window: Object.assign({}, s.window, (opts && opts.window) || {}) });
  return Object.assign(e, { calls: s.calls });
}

const LOCK = 500;

/* Reveal the current card and wait out the lock. */
function revealAndUnlock(h) {
  h.click("toggleBtn");
  h.advance(LOCK);
}

/* ------------------------------ reveal + rate ------------------------------ */

test("reveal alone records nothing (record called 0 times)", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  assert.equal(h.elements.toggleBtn.textContent, "Reveal it");
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 3");
  h.click("toggleBtn");
  h.advance(10000);
  assert.equal(h.calls.record.length, 0, "a reveal must not record");
  assert.equal(h.calls.best.length, 0);
  assert.equal(h.elements.word.hidden, false, "answer shows");
  assert.equal(h.elements.pronunciation.hidden, false, "hint shows");
  assert.equal(h.elements.rateControls.hidden, false, "rating buttons show");
  assert.equal(h.elements.studyControls.hidden, true, "Reveal it is replaced");
  assert.equal(h.timerPending(), false, "the timer stops on reveal");
});

test("after reveal, focus goes to the answer region (not a button)", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  h.click("toggleBtn");
  assert.equal(h.focused, h.cardEl);
});

test("rating lock: clicks inside 500 ms are ignored; after it, one rating records", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  h.click("toggleBtn");
  h.click("rateKnewBtn");            // 0 ms
  h.advance(499);
  h.click("rateKnewBtn");            // 499 ms
  h.keydown("k", h.cardEl);          // key also locked
  assert.equal(h.calls.record.length, 0, "nothing lands inside the lock");
  h.advance(1);
  h.click("rateKnewBtn");            // 500 ms
  assert.equal(h.calls.record.length, 1);
  assert.equal(h.calls.record[0].knew, true);
});

test("I knew it -> recorded, next card at once (no extra Next click)", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  revealAndUnlock(h);
  h.click("rateKnewBtn");
  assert.equal(h.elements.testProgress.textContent, "Card 2 of 3");
  assert.equal(h.elements.toggleBtn.textContent, "Reveal it");
  assert.equal(h.elements.word.hidden, true, "next prompt hides the answer");
});

test("Not yet -> recorded as not known", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  revealAndUnlock(h);
  h.click("rateNotYetBtn");
  assert.equal(h.calls.record.length, 1);
  assert.equal(h.calls.record[0].knew, false);
});

test("double-click on I knew it cannot double-record", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  revealAndUnlock(h);
  h.click("rateKnewBtn");
  h.click("rateKnewBtn"); // second click lands while card 2 is in its prompt phase
  assert.equal(h.calls.record.length, 1, "exactly one record");
});

test("Space/Enter do NOTHING in the rating phase (no record, no advance)", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  h.click("toggleBtn");
  h.advance(5000); // lock long gone
  const p1 = h.keydown(" ", h.cardEl);
  const p2 = h.keydown("Enter", h.cardEl);
  const p3 = h.keydown("Enter", null);
  assert.equal(h.calls.record.length, 0, "record called 0 times");
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 3", "still on card 1");
  assert.ok(p1 && p2 && p3, "the keys are swallowed (no page scroll / stray click)");
});

test("keys: K or 1 = I knew it; N or 2 = Not yet (only while rating)", () => {
  const h = env();
  h.engine.startTest(lessonOf(5));
  h.keydown("k", h.cardEl); // prompt phase: K does nothing
  assert.equal(h.calls.record.length, 0);
  for (const [key, knew] of [["k", true], ["1", true], ["N", false], ["2", false]]) {
    h.keydown("Enter", h.elements.toggleBtn); // reveal via Enter
    h.advance(LOCK);
    h.keydown(key, h.cardEl);
    assert.equal(h.calls.record[h.calls.record.length - 1].knew, knew, key);
  }
  assert.equal(h.calls.record.length, 4);
});

test("keys with Ctrl/Alt/Meta held are ignored", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  revealAndUnlock(h);
  h.keydown("k", h.cardEl, { ctrlKey: true });
  h.keydown("1", h.cardEl, { altKey: true });
  assert.equal(h.calls.record.length, 0);
});

test("Space/Enter reveal in the prompt phase; they do not hijack another focused button", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  h.keydown("Enter", h.elements.stopTestBtn); // focused Stop test keeps its own Enter
  assert.equal(h.elements.word.hidden, true, "not revealed");
  h.keydown(" ", h.elements.toggleBtn);
  assert.equal(h.elements.word.hidden, false, "revealed");
  assert.equal(h.calls.record.length, 0);
});

/* ------------------------------- time's up -------------------------------- */

test("timer runs out -> Not yet recorded automatically, 'Time's up', one 'Next card' button", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  h.fireTimer();
  assert.equal(h.calls.record.length, 1);
  assert.equal(h.calls.record[0].knew, false, "timeout = Not yet");
  assert.equal(h.elements.label.textContent, "Time's up");
  assert.equal(h.elements.toggleBtn.textContent, "Next card");
  assert.equal(h.elements.toggleBtn.attrs["aria-label"], "Next card");
  assert.equal(h.elements.rateControls.hidden, true, "no rating buttons after a time-out");
  assert.equal(h.elements.word.hidden, false, "answer shows");
  // Space/Enter = Next card here.
  h.keydown("Enter", h.elements.toggleBtn);
  assert.equal(h.elements.testProgress.textContent, "Card 2 of 3");
  assert.equal(h.calls.record.length, 1, "advancing does not record again");
  assert.equal(h.elements.label.textContent, "", "label cleared on the next card");
});

test("a manual reveal cancels the timer; a stale timer can never rate the card", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  h.click("toggleBtn");
  assert.equal(h.timerPending(), false);
  // Rating keys after a time-out phase are ignored too.
  const h2 = env();
  h2.engine.startTest(lessonOf(2));
  h2.fireTimer();
  h2.advance(LOCK);
  h2.keydown("k", h2.cardEl);
  h2.click("rateKnewBtn");
  assert.equal(h2.calls.record.length, 1, "only the automatic Not yet");
  assert.equal(h2.calls.record[0].knew, false);
});

/* -------------------------------- results --------------------------------- */

function runAll(h, ratings) {
  for (const r of ratings) {
    if (r === "timeout") { h.fireTimer(); h.click("toggleBtn"); continue; }
    revealAndUnlock(h);
    h.click(r ? "rateKnewBtn" : "rateNotYetBtn");
  }
}

test("one record per card over a full run; results show 'You knew k of n.'", () => {
  const h = env();
  h.engine.startTest(lessonOf(4));
  runAll(h, [true, false, "timeout", true]);
  assert.equal(h.calls.record.length, 4);
  assert.ok(h.resultOpen(), "results modal open");
  assert.equal(h.elements.resultTitle.textContent, "Test results");
  assert.equal(h.elements.resultScore.textContent, "You knew 2 of 4.");
  assert.equal(h.elements.resultListHead.hidden, false);
  assert.equal(h.elements.resultListHead.textContent, "Cards to practice");
  assert.equal(h.elements.resultList.children.length, 2, "both missed cards listed");
  for (const t of h.listTexts()) assert.match(t, /^\d+ → w\d+h\d+$/, "prompt → answer, hint under: " + t);
  assert.equal(h.elements.resultPracticeBtn.hidden, false, "Practice these again shows");
  assert.equal(h.elements.resultNone.hidden, true);
  assert.equal(h.elements.resultLesson.textContent, "This lesson: 2 of 4 known.");
  assert.equal(h.elements.resultFooter.textContent, "Your progress is saved on this device only.");
  assert.equal(h.calls.best.length, 1, "a full test reports to the personal best once");
  assert.equal(h.calls.best[0].score, 2);
  assert.equal(h.calls.best[0].of, 4);
  assert.match(h.elements.resultAnnounce.textContent, /^You knew 2 of 4\. New personal best! This lesson: 2 of 4 known\.$/);
});

test("none missed -> 'You knew them all. Nice work.' and no Practice button", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  runAll(h, [true, true]);
  assert.equal(h.elements.resultNone.hidden, false);
  assert.equal(h.elements.resultNone.textContent, "You knew them all. Nice work.");
  assert.equal(h.elements.resultPracticeBtn.hidden, true);
  assert.equal(h.elements.resultListHead.hidden, true);
});

test("personal-best line: new / tie / lower", () => {
  const cases = [
    [{ status: "new" }, "New personal best!"],
    [{ status: "tie" }, "You matched your best."],
    [{ status: "lower", best: { score: 9, of: 10 } }, "Your best: 9 of 10."],
  ];
  for (const [res, text] of cases) {
    const h = env({ bestResult: (score, of) => Object.assign({ best: { score, of } }, res) });
    h.engine.startTest(lessonOf(2));
    runAll(h, [true, false]);
    assert.equal(h.elements.resultBest.textContent, text);
    assert.equal(h.elements.resultBest.hidden, false);
  }
});

test("practice these again: only the missed cards; never counts for the personal best", () => {
  const h = env();
  h.engine.startTest(lessonOf(5));
  runAll(h, [false, true, false, true, true]);
  const missed = h.calls.record.filter((r) => !r.knew).map((r) => r.prompt).sort();
  assert.equal(h.calls.best.length, 1);
  h.click("resultPracticeBtn");
  assert.equal(h.resultOpen(), false, "modal closes for the round");
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 2", "only the 2 missed cards");
  const seen = [];
  for (let i = 0; i < 2; i++) {
    seen.push(String(h.elements.number.textContent));
    revealAndUnlock(h);
    h.click(i === 0 ? "rateKnewBtn" : "rateNotYetBtn");
  }
  assert.deepEqual(seen.sort(), missed, "the practice pool is the missed list");
  assert.equal(h.calls.record.length, 7, "practice ratings DO update known");
  assert.equal(h.calls.best.length, 1, "recordTestResult NOT called for a practice round");
  assert.equal(h.elements.resultTitle.textContent, "Practice results");
  assert.equal(h.elements.resultBest.hidden, true, "no personal-best line on practice");
  assert.equal(h.elements.resultScore.textContent, "You knew 1 of 2.");
  // It may repeat until nothing is missed.
  h.click("resultPracticeBtn");
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 1");
  revealAndUnlock(h);
  h.click("rateKnewBtn");
  assert.equal(h.elements.resultNone.textContent, "All caught up on this list.");
  assert.equal(h.elements.resultPracticeBtn.hidden, true);
  assert.equal(h.calls.best.length, 1);
});

test("Test me again starts a fresh full test (counts for the personal best)", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  runAll(h, [true, true, false]);
  h.click("resultAgainBtn");
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 3");
  runAll(h, [true, true, true]);
  assert.equal(h.calls.best.length, 2);
});

test("Done / X / Esc / backdrop all return to study", () => {
  for (const how of ["done", "x", "esc", "backdrop"]) {
    let exits = 0;
    const h = env();
    h.engine.startTest(lessonOf(2), () => { exits++; });
    runAll(h, [true, false]);
    assert.ok(h.resultOpen());
    if (how === "done") h.click("resultDoneBtn");
    if (how === "x") h.click("resultClose");
    if (how === "esc") h.keydown("Escape", null);
    if (how === "backdrop") h.elements.resultModal.onclick({ target: h.elements.resultModal });
    assert.equal(h.resultOpen(), false, how);
    assert.equal(exits, 1, how + ": onExit once");
    assert.equal(h.elements.testMeWrap.hidden, false, "Test me is back");
    assert.equal(h.elements.stopTestBtn.hidden, true);
    assert.equal(h.elements.studyHint.hidden, false);
    assert.equal(h.elements.toggleBtn.textContent, "Reveal it", "study prompt phase");
    // Study records nothing.
    h.click("toggleBtn");
    h.fireTimer();
    assert.equal(h.calls.record.length, 2, how + ": study adds no record");
  }
});

test("Stop test: ratings given stay; no results screen; no personal best", () => {
  let exits = 0;
  const h = env();
  h.engine.startTest(lessonOf(5), () => { exits++; });
  assert.equal(h.elements.stopTestBtn.hidden, false, "Stop test shows during a test");
  assert.equal(h.elements.testMeWrap.hidden, true, "Test me hides during a test");
  assert.equal(h.elements.testHint.hidden, false);
  assert.equal(h.elements.studyHint.hidden, true);
  runAll(h, [true, false]);
  h.click("stopTestBtn");
  assert.equal(h.calls.record.length, 2, "ratings already given stay");
  assert.equal(h.calls.best.length, 0, "recordTestResult called 0 times");
  assert.equal(h.resultOpen(), false, "no results screen");
  assert.equal(exits, 1);
  assert.equal(h.timerPending(), true, "study's own timer is running again");
  h.fireTimer();
  assert.equal(h.calls.record.length, 2, "the old test timer cannot rate after stopping");
});

test("no-storage footer when progress cannot be saved", () => {
  const h = env({ persistent: false });
  h.engine.startTest(lessonOf(1));
  runAll(h, [true]);
  assert.equal(h.elements.resultFooter.textContent, "Progress can't be saved in this browser (private window?).");
});

/* --------------------------------- pool ----------------------------------- */

test("pool: not-known cards first; a lesson under 10 cards tests every card", () => {
  const h = env({ known: { "1": true, "2": true } });
  h.engine.startTest(lessonOf(12));
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 10");
  const first = [];
  for (let i = 0; i < 10; i++) {
    first.push(String(h.elements.number.textContent));
    revealAndUnlock(h);
    h.click("rateKnewBtn");
  }
  assert.ok(!first.includes("1") && !first.includes("2"), "known cards fall off the end: " + first);

  const small = env();
  small.engine.startTest(lessonOf(3));
  assert.equal(small.elements.testProgress.textContent, "Card 1 of 3");
});

test("loop resilience: a bad card is skipped and the test continues", () => {
  const h = env();
  const lesson = { id: "sq/dirty", title: "D", revealMs: 5000,
    cards: [{ prompt: 1, answer: "a" }, null, { prompt: 2 }, "junk", { prompt: 3, answer: "c" }] };
  assert.doesNotThrow(() => h.engine.startTest(lesson));
  assert.equal(h.elements.testProgress.textContent, "Card 1 of 2");
  runAll(h, [true, true]);
  assert.equal(h.elements.resultScore.textContent, "You knew 2 of 2.");
});

test("a throwing LBProgress.record never aborts the test", () => {
  const h = makeEngineEnv({ modules: ["game.js"], window: {
    LBProgress: { record() { throw new Error("boom"); }, knownMap() { return {}; } },
  } });
  h.engine.startTest(lessonOf(2));
  revealAndUnlock(h);
  assert.doesNotThrow(() => h.click("rateKnewBtn"));
  assert.equal(h.elements.testProgress.textContent, "Card 2 of 2");
});

/* -------------------------------- streak ---------------------------------- */

test("streak: NOT marked on page load or test start; marked on the first rating", () => {
  const h = env();
  h.engine.start(lessonOf(3));            // page load (study)
  assert.equal(h.calls.mark, 0, "page load marks nothing");
  h.fireTimer();                          // idle auto-reveal in study
  assert.equal(h.calls.mark, 0, "an idle timer reveal marks nothing");
  h.engine.startTest(lessonOf(3));
  assert.equal(h.calls.mark, 0, "starting a test marks nothing");
  h.click("toggleBtn");
  assert.equal(h.calls.mark, 0, "a test reveal marks nothing");
  h.advance(LOCK);
  h.click("rateKnewBtn");
  assert.equal(h.calls.mark, 1, "the first rating marks the day");
});

test("streak: a manual reveal in study marks the day", () => {
  const h = env();
  h.engine.start(lessonOf(3));
  h.click("toggleBtn"); // study uses addEventListener, not onclick — use the keyboard path
  h.keydown(" ", null);
  assert.ok(h.calls.mark >= 1, "manual study reveal marks");
});

/* ---------------------------- flag + guards -------------------------------- */

test("flag OFF: startTest does nothing and nothing is recorded or marked", () => {
  const h = env({ window: { LB_FEATURES: { testing: false } } });
  h.engine.startTest(lessonOf(3));
  assert.equal(h.elements.testProgress.textContent, "", "no test card shown");
  assert.equal(h.calls.knownMap, 0, "no pool built");
  h.engine.start(lessonOf(3));
  h.keydown(" ", null); // manual study reveal
  assert.equal(h.calls.mark, 0, "no streak while testing is off");
  assert.equal(h.calls.record.length, 0);
});

test("knownSummary: N of M over the normalized deck; null without LBProgress", () => {
  const h = env({ known: { "1": true } });
  const lesson = { id: "x/y", cards: [{ prompt: 1, answer: "a" }, null, { prompt: 2, answer: "b" }] };
  const c = h.engine.knownSummary(lesson);
  assert.equal(c.known, 1);
  assert.equal(c.total, 2, "the bad card is not counted in M");
  const bare = makeEngineEnv({});
  assert.equal(bare.engine.knownSummary(lesson), null);
});

test("copy + aria: Reveal it / card label (study and test), rating buttons stay in markup", () => {
  const h = env();
  h.engine.start(lessonOf(2));
  assert.equal(h.elements.toggleBtn.attrs["aria-label"], "Reveal the answer");
  assert.equal(h.cardEl.attrs["aria-label"], "Answer hidden. Press Reveal it to show the answer and pronunciation.");
  h.engine.startTest(lessonOf(2));
  assert.equal(h.elements.toggleBtn.textContent, "Reveal it");
  assert.equal(h.elements.toggleBtn.attrs["aria-label"], "Reveal the answer");
  assert.equal(h.cardEl.attrs["aria-label"], "Answer hidden. Press Reveal it to show the answer and pronunciation.");
  h.click("toggleBtn");
  assert.equal(h.cardEl.attrs["aria-label"], undefined, "label cleared so the live region reads the answer");
  const html = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "..", "src", "index.html"), "utf8");
  for (const s of [
    'aria-label="I knew it. Mark this card as known">I knew it</button>',
    'aria-label="Not yet. Mark this card to practice">Not yet</button>',
    'aria-label="Test me. Start a test on this lesson">Test me</button>',
    'aria-label="Stop test and go back to studying" hidden>Stop test</button>',
    'Say it out loud, then reveal. Tap "I knew it" only if you got it right.',
    "Say it out loud, then reveal. When the timer ends, the answer shows.",
    "How many seconds you get to think before the answer shows. Used in",
  ]) assert.ok(html.includes(s), "index.html has: " + s);
  assert.ok(html.indexOf('id="rateNotYetBtn"') < html.indexOf('id="rateKnewBtn"'), "Not yet is on the left");
});
