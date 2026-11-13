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

test("answer text is plain text nodes split by <br> (never innerHTML), in study and test", () => {
  const h = env();
  const lesson = { id: "sq/html", title: "H", revealMs: 5000,
    cards: [{ prompt: 1, answer: "<img src=x onerror=alert(1)> | b&amp;c", hint: "h" }] };
  for (const run of [() => h.engine.start(lesson), () => h.engine.startTest(lesson)]) {
    run();
    const w = h.elements.word;
    assert.equal(w.innerHTML, "", "innerHTML is never written");
    assert.deepEqual(w.children.map((c) => (c.nodeType === 3 ? "T:" + c.data : c.tagName)),
      ["T:<img src=x onerror=alert(1)>", "BR", "T:b&amp;c"], "two text nodes around one <br>");
  }
});

/* ------------------------------- time's up -------------------------------- */

test("timer runs out -> Not yet recorded automatically, 'Time's up', one 'Next card' button", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  h.fireTimer();
  assert.equal(h.calls.record.length, 1);
  assert.equal(h.calls.record[0].knew, false, "timeout = Not yet");
  assert.equal(h.elements.label.textContent, "Time's up. Marked to practice.");
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
  h.advance(LOCK); // the results buttons ignore input for 500 ms
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
  h.advance(LOCK);
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
  h.advance(LOCK);
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
    h.advance(LOCK);
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
  // Card 3 is in its prompt phase: grab the TEST's own reveal timer.
  const testTimer = h.lastTimer();
  assert.ok(testTimer, "card 3's test timer is running");
  h.click("stopTestBtn");
  assert.equal(h.calls.record.length, 2, "ratings already given stay");
  assert.equal(h.calls.best.length, 0, "recordTestResult called 0 times");
  assert.equal(h.resultOpen(), false, "no results screen");
  assert.equal(exits, 1);
  assert.equal(h.isTimerPending(testTimer.id), false, "Stop test cleared the test's timer");
  assert.equal(h.pendingTimerCount(), 1, "only study's own timer is running");
  // Even if that old callback still fired, it must not rate the card.
  testTimer.fn();
  assert.equal(h.calls.record.length, 2, "the old test timer cannot rate after stopping");
  assert.equal(h.elements.label.textContent, "", "no time's-up line after stopping");
});

/* --------------------------- results input lock ---------------------------- */

test("results: focus goes to the dialog title, not a button", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  runAll(h, [true, false]);
  assert.ok(h.resultOpen());
  assert.equal(h.focused, h.elements.resultTitle, "focus on the title");
  const html = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "..", "src", "index.html"), "utf8");
  assert.ok(html.includes('<h2 id="resultTitle" class="modal-title" tabindex="-1">'), "the title can take focus");
});

test("results: buttons and backdrop ignore input for 500 ms after opening; Esc stays live", () => {
  for (const [id, after] of [
    ["resultAgainBtn", (h) => h.elements.testProgress.textContent === "Card 1 of 2"],
    ["resultPracticeBtn", (h) => h.elements.testProgress.textContent === "Card 1 of 1"],
    ["resultDoneBtn", (h) => h.elements.testMeWrap.hidden === false],
    ["resultClose", (h) => h.elements.testMeWrap.hidden === false],
    ["backdrop", (h) => h.elements.testMeWrap.hidden === false],
  ]) {
    const h = env();
    h.engine.startTest(lessonOf(2));
    runAll(h, [true, false]);
    const press = () => (id === "backdrop"
      ? h.elements.resultModal.onclick({ target: h.elements.resultModal })
      : h.click(id));
    press();                                   // +0 ms: the double-click's 2nd click
    assert.ok(h.resultOpen(), id + " at +0 ms: results stay open");
    h.advance(LOCK - 1);
    press();                                   // +499 ms
    assert.ok(h.resultOpen(), id + " at +499 ms: results stay open");
    assert.equal(h.calls.best.length, 1, id + ": no new round started");
    h.advance(1);
    press();                                   // +500 ms
    assert.equal(h.resultOpen(), false, id + " at +500 ms: acts");
    assert.ok(after(h), id + ": did its job");
  }
  // Esc is never locked.
  const h = env();
  h.engine.startTest(lessonOf(2));
  runAll(h, [true, false]);
  h.keydown("Escape", null);
  assert.equal(h.resultOpen(), false, "Esc closes at +0 ms");
});

test("results: a held Enter from the last 'Next card' cannot start a round", () => {
  const h = env();
  h.engine.startTest(lessonOf(1));
  h.fireTimer();                                   // time's up on the only card
  h.keydown("Enter", h.elements.toggleBtn);        // Next card -> results
  assert.ok(h.resultOpen());
  // The auto-repeat Enter now lands on the focused title, not a button.
  assert.equal(h.focused, h.elements.resultTitle);
  h.keydown("Enter", h.focused, { repeat: true });
  h.keydown("Enter", h.focused, { repeat: true });
  assert.ok(h.resultOpen(), "results stay open");
  assert.equal(h.calls.record.length, 1, "no practice round started");
});

test("results: a clock that jumps backwards does not keep the buttons locked", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  runAll(h, [true, false]);
  h.advance(-3600 * 1000);
  h.click("resultDoneBtn");
  assert.equal(h.resultOpen(), false);
});

test("no-storage footer when progress cannot be saved", () => {
  const h = env({ persistent: false });
  h.engine.startTest(lessonOf(1));
  runAll(h, [true]);
  assert.equal(h.elements.resultFooter.textContent, "Progress can't be saved here. Private browsing may be on.");
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

test("streak: a manual reveal in study marks the day (button click and key)", () => {
  const h = env();
  h.engine.start(lessonOf(3));
  h.click("toggleBtn"); // the study button's real click listener
  assert.equal(h.elements.word.hidden, false, "the click revealed the card");
  assert.equal(h.calls.mark, 1, "a manual click reveal marks the day");
  h.click("toggleBtn"); // next card
  h.keydown(" ", null); // keyboard reveal
  assert.equal(h.calls.mark, 2, "a manual key reveal marks too");
});

test("study with the flag ON: clicks, keys and the timer record no rating", () => {
  const h = env();
  h.engine.start(lessonOf(3));
  for (let i = 0; i < 4; i++) h.click("toggleBtn"); // reveal, next, reveal, next
  h.fireTimer();                                     // idle auto-reveal
  h.keydown("Enter", null);                          // next
  h.keydown(" ", h.elements.toggleBtn);              // reveal
  h.keydown("n", null);                              // skip
  assert.equal(h.calls.record.length, 0, "record called 0 times in study");
  assert.equal(h.calls.best.length, 0, "recordTestResult called 0 times in study");
});

/* ------------------- study keys vs. other focused controls ------------------ */

test("study: Enter/Space on a focused Test me keeps its own click (no reveal, no streak)", () => {
  const h = env();
  h.engine.start(lessonOf(3));
  assert.equal(h.keydown("Enter", h.elements.testMeBtn), false, "Enter not prevented");
  assert.equal(h.keydown(" ", h.elements.testMeBtn), false, "Space not prevented");
  assert.equal(h.elements.word.hidden, true, "the study card stays hidden");
  assert.equal(h.calls.mark, 0, "markActive called 0 times");
  // Same for Stop test, a link, the lesson picker and the settings slider.
  for (const target of [h.elements.stopTestBtn, { tagName: "A" }, { tagName: "SELECT" }, { tagName: "INPUT" }]) {
    assert.equal(h.keydown("Enter", target), false, target.tagName + " keeps Enter");
  }
  assert.equal(h.elements.word.hidden, true);
  // With nothing else focused (or the card button itself), the keys still work.
  assert.equal(h.keydown(" ", null), true, "Space on the page is used");
  assert.equal(h.elements.word.hidden, false, "Space still reveals");
  assert.equal(h.calls.mark, 1);
});

test("study: 'n' does not skip while typing in a form field; modifier keys are ignored", () => {
  const h = env();
  h.engine.start(lessonOf(30));
  const first = h.elements.number.textContent;
  h.keydown("n", { tagName: "INPUT" });
  h.keydown("n", { tagName: "SELECT" });
  h.keydown("N", { tagName: "TEXTAREA" });
  assert.equal(h.elements.number.textContent, first, "no skip from a form field");
  assert.equal(h.keydown(" ", null, { ctrlKey: true }), false, "Ctrl+Space ignored");
  assert.equal(h.keydown("Enter", null, { metaKey: true }), false, "Meta+Enter ignored");
  h.keydown("n", null, { altKey: true });
  assert.equal(h.elements.number.textContent, first, "Alt+N ignored");
  assert.equal(h.elements.word.hidden, true);
  h.keydown("n", null);
  assert.notEqual(h.elements.number.textContent, first, "plain n still skips");
});

test("study: a held key (auto-repeat) never acts again", () => {
  const h = env();
  h.engine.start(lessonOf(3));
  assert.equal(h.keydown("Enter", h.elements.testMeBtn, { repeat: true }), true,
    "a repeat on Test me is swallowed so a held Enter cannot press it");
  assert.equal(h.keydown("Enter", null, { repeat: true }), true);
  assert.equal(h.elements.word.hidden, true, "a repeat does not reveal");
  assert.equal(h.calls.mark, 0);
});

test("study and test: no shortcut acts while the settings dialog is open", () => {
  let open = true;
  const h = env({ window: { LBSettings: { isOpen: () => open } } });
  h.engine.start(lessonOf(3));
  const first = h.elements.number.textContent;
  assert.equal(h.keydown(" ", null), false);
  h.keydown("n", null);
  assert.equal(h.elements.word.hidden, true, "study: no reveal behind the dialog");
  assert.equal(h.elements.number.textContent, first, "study: no skip behind the dialog");
  h.engine.startTest(lessonOf(3));
  open = false;
  h.click("toggleBtn");
  h.advance(LOCK);
  open = true;
  const settingsClose = { tagName: "BUTTON" };
  h.keydown("k", settingsClose);
  h.keydown("1", null);
  h.keydown("n", h.cardEl);
  assert.equal(h.calls.record.length, 0, "test: K/1/N do not rate behind the dialog");
  open = false;
  h.keydown("k", h.cardEl);
  assert.equal(h.calls.record.length, 1, "after it closes, K rates");
});

test("test: a held Enter on Next card does not also reveal the next card", () => {
  const h = env();
  h.engine.startTest(lessonOf(3));
  h.fireTimer();                                   // time's up on card 1
  h.keydown("Enter", h.elements.toggleBtn);        // Next card
  assert.equal(h.elements.testProgress.textContent, "Card 2 of 3");
  assert.equal(h.keydown("Enter", h.elements.toggleBtn, { repeat: true }), true);
  assert.equal(h.elements.word.hidden, true, "card 2 stays hidden");
  assert.equal(h.keydown("Enter", h.elements.stopTestBtn, { repeat: true }), true,
    "a repeat on Stop test is swallowed too");
  assert.equal(h.elements.stopTestBtn.hidden, false, "still in the test");
});

test("after Done / Esc / Stop test, focus moves to Test me", () => {
  for (const how of ["done", "esc", "stop"]) {
    const h = env();
    h.engine.startTest(lessonOf(2));
    if (how === "stop") {
      h.click("stopTestBtn");
    } else {
      runAll(h, [true, false]);
      h.advance(LOCK);
      if (how === "done") h.click("resultDoneBtn");
      else h.keydown("Escape", null);
    }
    assert.equal(h.focused, h.elements.testMeBtn, how);
  }
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
    'countEl.textContent = "No streak yet.";',
    "<title>LanguageBasics</title>",
    '<h1 id="title">LanguageBasics</h1>',
  ]) assert.ok(html.includes(s), "index.html has: " + s);
  assert.ok(!/Albanian/.test(html), "the shared page shell names no one language");
  assert.ok(!html.includes("Start a streak today!"), "old streak copy is gone");
  assert.ok(html.indexOf('id="rateNotYetBtn"') < html.indexOf('id="rateKnewBtn"'), "Not yet is on the left");
});

test("rating phase: Enter on another focused button keeps its native action (not swallowed)", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  h.click("toggleBtn");
  h.advance(LOCK);
  const settingsClose = { tagName: "BUTTON" };
  assert.equal(h.keydown("Enter", settingsClose), false, "not prevented");
  assert.equal(h.keydown("Enter", h.elements.rateKnewBtn), false, "a focused rating button gets its own click");
  assert.equal(h.calls.record.length, 0, "the keydown handler itself recorded nothing");
});

test("rating keys are ignored while typing in a form field", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  h.click("toggleBtn");
  h.advance(LOCK);
  h.keydown("k", { tagName: "INPUT" });
  h.keydown("1", { tagName: "SELECT" });
  assert.equal(h.calls.record.length, 0);
  h.keydown("k", h.cardEl);
  assert.equal(h.calls.record.length, 1);
});

test("a device clock that jumps backwards does not leave the rating locked", () => {
  const h = env();
  h.engine.startTest(lessonOf(2));
  h.click("toggleBtn");
  h.advance(-3600 * 1000); // clock set back an hour
  h.click("rateKnewBtn");
  assert.equal(h.calls.record.length, 1);
});
