/* LB-15 test-mode signal logic — the manual-reveal-vs-timeout -> gotIt mapping
 * and the single-fire (one self-rate per card) guard.
 *
 * Run:  node --test
 *
 * LB-15 removed the "Got it" / "Missed it" buttons. Test mode reuses the SAME
 * single #toggleBtn as study and the per-lesson reveal TIMER is the scoring
 * signal:
 *   - click "Reveal it" BEFORE the timer fires  => handleSelfRate(gotIt=true,
 *     responseMs = now - cardShownAt), and the timer is cancelled,
 *   - the timer reaches 0 (auto-reveal)         => handleSelfRate(gotIt=false),
 *   - a per-card `rated` guard makes commitAndReveal idempotent: whichever of
 *     the click or the timeout happens first wins; the other is a no-op. So
 *     EXACTLY one { card, gotIt, responseMs } event commits per card.
 *
 * Why this IS unit-testable here (no flakiness): the engine's `setTimeout` and
 * `clearTimeout` are the sandbox's — we capture the reveal callback instead of
 * firing it on a wall clock, and a monotonic nowTs() stub makes responseMs
 * deterministic. So the timer-race is driven by explicit calls, never by a real
 * clock. This is the SAME capture pattern button-toggle.test.js already uses.
 *
 * What stays MANUAL (browser) — documented in the ticket's manual checklist,
 * NOT here: that the on-screen timer BAR visually counts down and that real
 * mouse/keyboard timing feels right. This file proves the LOGIC; the browser
 * proves the feel.
 *
 * The pure scoring (makeSelfRateEvent / buildPool / summarize) is covered in
 * game.test.js — this file does NOT re-test it. Here LBGame is a thin spy so we
 * can observe exactly which { gotIt, responseMs } the engine commits per card.
 *
 * Built-ins only: node:test, node:assert, node:fs, node:path, node:vm.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ENGINE_PATH = path.resolve(__dirname, "..", "src", "engine.js");
const ENGINE_SRC = fs.readFileSync(ENGINE_PATH, "utf8");

/* DOM + window shim for test mode.
 *
 * Beyond the static element stubs (the full id set startTest touches), this:
 *   - captures the per-card reveal setTimeout callback (the miss signal) so the
 *     timer-expiry path is invokable on demand instead of on a wall clock,
 *   - honors clearTimeout so the `rated`/manual-reveal path can prove it
 *     actually cancels the pending timeout (the captured cb is nulled),
 *   - records the toggle button's .onclick (startTest wires via .onclick) and
 *     the document keydown handler,
 *   - drives a monotonic `now` so responseMs is deterministic,
 *   - installs a thin LBGame spy: buildPool returns the deck clamped to N in
 *     order (deterministic), makeSelfRateEvent records each { card, gotIt,
 *     responseMs } the engine commits, summarize is a trivial roll-up.
 */
function makeTestModeShim(opts) {
  opts = opts || {};
  const warnings = [];
  const elements = {};
  const ids = [
    "number", "word", "pronunciation", "label", "recall", "bar",
    "toggleBtn", "title", "testProgress",
    "studyControls", "testControls", "testNextWrap", "testResult",
  ];
  for (const id of ids) {
    const listeners = {};
    elements[id] = {
      id,
      style: {},
      hidden: false,
      textContent: "",
      innerHTML: "",
      offsetWidth: 0,
      onclick: null,
      _listeners: listeners,
      addEventListener(type, fn) {
        (listeners[type] || (listeners[type] = [])).push(fn);
      },
      removeEventListener(type, fn) {
        const arr = listeners[type] || [];
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      },
      setAttribute() {},
      removeAttribute() {},
      focus() {},
    };
  }

  const docListeners = {};
  const documentShim = {
    getElementById: (id) => elements[id] || null,
    // .card and .timer are guarded with `typeof querySelector === "function"`;
    // returning null exercises that guard without extra stubs.
    querySelector: () => null,
    addEventListener(type, fn) {
      (docListeners[type] || (docListeners[type] = [])).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = docListeners[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    set title(v) { this._title = v; },
    get title() { return this._title; },
  };

  // Captured per-card reveal timeout callback (the miss signal). null when none
  // pending (e.g. after a manual reveal cancels it).
  let timerCb = null;
  let timerId = 0;

  // Monotonic clock for nowTs(). Starts at a base; advance() bumps it so a
  // manual reveal records a deterministic, positive responseMs.
  let clock = 1000;

  // LBGame spy — records every committed self-rate event.
  const committed = [];
  const LBGame = {
    buildPool: (deck, count) => deck.slice(0, count),
    makeSelfRateEvent: (card, gotIt, responseMs) => {
      const evt = { card, gotIt: gotIt === true, responseMs };
      committed.push(evt);
      return evt;
    },
    summarize: (events) => ({
      total: events.length,
      gotIt: events.filter((e) => e.gotIt).length,
      percent: 0,
      review: [],
    }),
  };

  const windowShim = { LB_LESSONS: [], LBGame };

  const sandbox = {
    window: windowShim,
    document: documentShim,
    console: { warn: (...a) => warnings.push(a), log() {} },
    setTimeout: (fn) => { timerCb = fn; return ++timerId; }, // capture, don't fire
    clearTimeout: () => { timerCb = null; },                 // honor cancellation
    // performance.now drives nowTs() (engine prefers performance over Date).
    performance: { now: () => clock },
    Math, String, Array, isFinite, Date,
  };

  return {
    sandbox, windowShim, elements, warnings, committed,
    // Click the single button (startTest wires via .onclick).
    clickToggle: () => { if (elements.toggleBtn.onclick) elements.toggleBtn.onclick(); },
    // Fire the most-recently-scheduled reveal timeout (the miss path).
    fireTimer: () => { if (timerCb) timerCb(); },
    // Is a reveal timeout still pending? (proves manual reveal cancelled it.)
    timerPending: () => timerCb != null,
    // Advance the monotonic clock so a manual reveal yields a positive responseMs.
    advance: (ms) => { clock += ms; },
    keydown: (key) => {
      let prevented = false;
      const fns = docListeners["keydown"] || [];
      for (const fn of fns) fn({ key, preventDefault: () => { prevented = true; } });
      return prevented;
    },
  };
}

function loadEngine(sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SRC, sandbox, { filename: ENGINE_PATH });
  return sandbox.window.LBEngine;
}

function lessonOf(n) {
  const cards = [];
  for (let i = 1; i <= n; i++) cards.push({ prompt: i, answer: "w" + i });
  return { id: "sq/test-mode", title: "Test Mode", revealMs: 5000, cards };
}

/* ------------------------- gotIt mapping: manual reveal -------------------- */

test("manual reveal before timeout => gotIt=true with a positive responseMs", () => {
  const h = makeTestModeShim();
  const engine = loadEngine(h.sandbox);

  engine.startTest(lessonOf(3), 3);
  assert.equal(h.elements.toggleBtn.textContent, "Reveal it",
    "card 1 starts in the prompt phase");

  h.advance(750);      // simulate 750ms of thinking time
  h.clickToggle();     // manual reveal -> gotIt=true

  assert.equal(h.committed.length, 1, "exactly one event committed on reveal");
  assert.equal(h.committed[0].gotIt, true, "manual reveal counts as got-it");
  assert.equal(h.committed[0].responseMs, 750,
    "responseMs is now - cardShownAt, so faster answers score lower ms");
  assert.equal(h.elements.toggleBtn.textContent, "Next Card",
    "after reveal the single button advances");
  assert.equal(h.elements.word.hidden, false, "the answer is revealed");
});

/* ------------------------- gotIt mapping: timeout ------------------------- */

test("timer expiry (no click) => gotIt=false (the miss/decay signal)", () => {
  const h = makeTestModeShim();
  const engine = loadEngine(h.sandbox);

  engine.startTest(lessonOf(3), 3);
  h.fireTimer();       // timer reached 0 with no manual reveal -> miss

  assert.equal(h.committed.length, 1, "exactly one event committed on timeout");
  assert.equal(h.committed[0].gotIt, false, "timeout counts as a miss");
  assert.equal(h.elements.toggleBtn.textContent, "Next Card",
    "the auto-reveal flips the single button to advance, same as manual");
  assert.equal(h.elements.word.hidden, false, "the answer is auto-revealed on miss");
});

/* --------------------- single-fire guard: click then timer ---------------- */

test("single-fire: a manual reveal cancels the timer (no double-count)", () => {
  const h = makeTestModeShim();
  const engine = loadEngine(h.sandbox);

  engine.startTest(lessonOf(3), 3);
  assert.equal(h.timerPending(), true, "a reveal timer is scheduled for the card");

  h.advance(300);
  h.clickToggle();     // manual reveal -> got-it, must cancel the timer
  assert.equal(h.timerPending(), false,
    "manual reveal must clearTimeout so the miss path cannot also fire");

  // Defense-in-depth: even if a stale timeout somehow fired, the rated guard
  // makes it a no-op. Fire it and prove no second event commits.
  h.fireTimer();
  assert.equal(h.committed.length, 1,
    "rated guard: timer firing after a manual reveal must NOT add a 2nd event");
  assert.equal(h.committed[0].gotIt, true, "the surviving event is the got-it");
});

/* --------------------- single-fire guard: timer then click ---------------- */

test("single-fire: a click after timeout advances, it does NOT re-rate", () => {
  const h = makeTestModeShim();
  const engine = loadEngine(h.sandbox);

  engine.startTest(lessonOf(3), 3);
  h.fireTimer();       // miss commits (gotIt=false)
  assert.equal(h.committed.length, 1);
  assert.equal(h.elements.toggleBtn.textContent, "Next Card");

  h.clickToggle();     // revealed phase -> this is ADVANCE, not a second rate

  assert.equal(h.committed.length, 1,
    "a click after a timeout-miss advances; it must not commit a 2nd event");
  assert.equal(h.elements.toggleBtn.textContent, "Reveal it",
    "advancing shows the next card's prompt phase");
});

/* ------------------- exactly one event per card across the run ------------ */

test("exactly one event per card over a full N-card run (mixed paths)", () => {
  const h = makeTestModeShim();
  const engine = loadEngine(h.sandbox);

  engine.startTest(lessonOf(3), 3);

  // Card 1: manual reveal (got it), then advance.
  h.advance(200); h.clickToggle();
  h.clickToggle(); // advance to card 2

  // Card 2: timeout (miss), then advance.
  h.fireTimer();
  h.clickToggle(); // advance to card 3

  // Card 3: manual reveal (got it), then advance -> result screen.
  h.advance(400); h.clickToggle();
  h.clickToggle(); // advance past the last card -> showResult()

  assert.equal(h.committed.length, 3, "exactly 3 events for a 3-card run");
  assert.deepEqual(
    h.committed.map((e) => e.gotIt),
    [true, false, true],
    "per-card gotIt follows the reveal-vs-timeout path taken on each card"
  );
});

/* ------------------- keyboard mirrors the single button ------------------- */

test("keyboard: Space before the timer commits a got-it (mirrors the button)", () => {
  const h = makeTestModeShim();
  const engine = loadEngine(h.sandbox);

  engine.startTest(lessonOf(2), 2);
  h.advance(500);
  const prevented = h.keydown(" ");

  assert.equal(prevented, true, "Space must call preventDefault in test mode");
  assert.equal(h.committed.length, 1, "Space-reveal commits one event");
  assert.equal(h.committed[0].gotIt, true, "Space before the timer = got-it");
  assert.equal(h.committed[0].responseMs, 500, "Space-reveal records responseMs too");
});

/* ------------- teardown: leaving test mode kills the pending timer -------- */

test("endTest stops the test timer so it cannot fire into study mode", () => {
  const h = makeTestModeShim();
  const engine = loadEngine(h.sandbox);

  engine.startTest(lessonOf(3), 3);
  assert.equal(h.timerPending(), true, "a test reveal timer is pending");

  engine.endTest(lessonOf(3)); // switch OFF -> stopTestSession() + start()

  // start() schedules ITS OWN study timer; the test is that no test-mode event
  // can still commit. Firing whatever timer is captured now must not push a
  // test self-rate event (study's auto-reveal does not call handleSelfRate).
  h.fireTimer();
  assert.equal(h.committed.length, 0,
    "after endTest, no test-mode self-rate event may commit");
});
