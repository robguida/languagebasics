/* Button-toggle state-machine regression for Ticket A + B.
 *
 * Run:  node --test
 *
 * Ticket B replaced the two buttons (nextBtn + showBtn) with ONE toggle
 * button id="toggleBtn". The state machine:
 *   - Prompt phase  (revealed=false): button text "Reveal it";
 *       click  -> showAnswer() reveals, button becomes "Next Card".
 *   - Revealed phase (revealed=true): button text "Next Card";
 *       click  -> nextCard() advances, button resets to "Reveal it".
 *   - Timer expiry: the revealMs setTimeout fires showAnswer(), which OWNS the
 *       relabel -> identical end-state to a manual reveal ("Next Card").
 * Keyboard: space/Enter call the shared toggle(); "n" forces next-card.
 *
 * Ticket A: showAnswer() blanks the ANSWER-side label (labelEl.textContent="").
 *
 * `revealed` is a closure-local in engine.js and is not exposed, so each
 * transition is asserted via the observable outputs the engine drives off it:
 * the button's textContent, the answer-label text, and wordEl.hidden.
 *
 * This loads the REAL engine.js in a vm with an upgraded DOM shim that
 * captures click + keydown handlers and the setTimeout callback so they can
 * be invoked deterministically. Built-ins only: node:test/assert/fs/path/vm.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ENGINE_PATH = path.resolve(__dirname, "..", "src", "engine.js");
const ENGINE_SRC = fs.readFileSync(ENGINE_PATH, "utf8");

/* Upgraded DOM shim.
 *
 * Beyond the static element stubs, this:
 *   - records per-element addEventListener handlers (toggleBtn click),
 *   - records document-level keydown handlers,
 *   - captures the setTimeout callback (revealMs auto-reveal) instead of
 *     firing or dropping it, so the timer-expiry path is invokable on demand.
 *
 * Helpers returned: clickToggle(), keydown(key), fireTimer().
 */
function makeDomShim() {
  const warnings = [];
  const elements = {};
  const ids = [
    "number", "word", "pronunciation", "label",
    "recall", "bar", "toggleBtn", "title",
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
      _listeners: listeners,
      addEventListener(type, fn) {
        (listeners[type] || (listeners[type] = [])).push(fn);
      },
    };
  }

  const docListeners = {};
  const documentShim = {
    getElementById: (id) => elements[id] || null,
    addEventListener(type, fn) {
      (docListeners[type] || (docListeners[type] = [])).push(fn);
    },
    set title(v) { this._title = v; },
    get title() { return this._title; },
  };

  // Captured revealMs timeout callback (the auto-reveal). null until set().
  let timerCb = null;
  const windowShim = { LB_LESSONS: [] };

  const sandbox = {
    window: windowShim,
    document: documentShim,
    console: { warn: (...a) => warnings.push(a), log() {} },
    setTimeout: (fn) => { timerCb = fn; return 1; }, // capture, do not fire
    clearTimeout: () => { /* leave timerCb so the test can fire it on demand */ },
    Math, String, Array,
  };

  function fireEl(id, type, event) {
    const fns = elements[id]._listeners[type] || [];
    for (const fn of fns) fn(event);
  }
  function fireDoc(type, event) {
    const fns = docListeners[type] || [];
    for (const fn of fns) fn(event);
  }

  return {
    sandbox, windowShim, elements, warnings,
    // Drive the toggle button click handler.
    clickToggle: () => fireEl("toggleBtn", "click"),
    // Drive a keydown with a fake event carrying preventDefault tracking.
    keydown: (key) => {
      let prevented = false;
      fireDoc("keydown", { key, preventDefault: () => { prevented = true; } });
      return prevented;
    },
    // Fire the most-recently-scheduled revealMs auto-reveal timeout.
    fireTimer: () => { if (timerCb) timerCb(); },
  };
}

function loadEngine(sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SRC, sandbox, { filename: ENGINE_PATH });
  return sandbox.window.LBEngine;
}

// A clean two-card deck so nextCard() always has something valid to render.
function cleanLesson() {
  return {
    id: "sq/test-toggle",
    title: "Toggle",
    revealMs: 5000,
    cards: [
      { prompt: 1, answer: "një" },
      { prompt: 2, answer: "dy" },
    ],
  };
}

test("initial prompt phase: button reads 'Reveal it', word hidden", () => {
  const { sandbox, elements } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  assert.equal(elements.toggleBtn.textContent, "Reveal it",
    "fresh card must start in prompt phase with 'Reveal it'");
  assert.equal(elements.word.hidden, true, "answer word hidden in prompt phase");
});

test("manual reveal: click flips to revealed phase, button reads 'Next Card'", () => {
  const { sandbox, elements, clickToggle } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  clickToggle(); // prompt -> reveal

  assert.equal(elements.toggleBtn.textContent, "Next Card",
    "after reveal the button must read 'Next Card'");
  assert.equal(elements.word.hidden, false, "answer word visible after reveal");
});

test("advance: click in revealed phase resets to prompt phase 'Reveal it'", () => {
  const { sandbox, elements, clickToggle } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  clickToggle(); // reveal
  assert.equal(elements.toggleBtn.textContent, "Next Card");

  clickToggle(); // next card

  assert.equal(elements.toggleBtn.textContent, "Reveal it",
    "advancing must reset the button to 'Reveal it'");
  assert.equal(elements.word.hidden, true, "next card hides the answer again");
});

test("full cycle: prompt -> reveal -> next -> reveal stays consistent", () => {
  const { sandbox, elements, clickToggle } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  assert.equal(elements.toggleBtn.textContent, "Reveal it");
  clickToggle();
  assert.equal(elements.toggleBtn.textContent, "Next Card");
  clickToggle();
  assert.equal(elements.toggleBtn.textContent, "Reveal it");
  clickToggle();
  assert.equal(elements.toggleBtn.textContent, "Next Card",
    "a second reveal must behave identically to the first");
});

test("timer expiry: auto-reveal owns the relabel -> 'Next Card' (same as manual)", () => {
  const { sandbox, elements, fireTimer } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  // Prompt phase before the timer fires.
  assert.equal(elements.toggleBtn.textContent, "Reveal it");
  assert.equal(elements.word.hidden, true);

  fireTimer(); // revealMs timeout -> showAnswer()

  assert.equal(elements.toggleBtn.textContent, "Next Card",
    "timer-expiry auto-reveal must flip the button to 'Next Card'");
  assert.equal(elements.word.hidden, false,
    "timer-expiry auto-reveal must show the answer");
});

test("post-timer click advances and resets to prompt phase", () => {
  const { sandbox, elements, fireTimer, clickToggle } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  fireTimer(); // auto-reveal
  assert.equal(elements.toggleBtn.textContent, "Next Card");

  clickToggle(); // should advance because revealed=true after the timer

  assert.equal(elements.toggleBtn.textContent, "Reveal it",
    "a click after timer-reveal must advance, not re-reveal");
  assert.equal(elements.word.hidden, true);
});

test("keyboard: space toggles reveal then next, preventDefault honored", () => {
  const { sandbox, elements, keydown } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  const prevented1 = keydown(" "); // reveal
  assert.equal(prevented1, true, "space must call preventDefault");
  assert.equal(elements.toggleBtn.textContent, "Next Card",
    "space in prompt phase reveals");

  const prevented2 = keydown(" "); // next
  assert.equal(prevented2, true, "space must call preventDefault on the next press too");
  assert.equal(elements.toggleBtn.textContent, "Reveal it",
    "space in revealed phase advances");
});

test("keyboard: Enter mirrors the toggle and honors preventDefault", () => {
  const { sandbox, elements, keydown } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  const prevented = keydown("Enter");
  assert.equal(prevented, true, "Enter must call preventDefault");
  assert.equal(elements.toggleBtn.textContent, "Next Card",
    "Enter in prompt phase reveals");
});

test("keyboard: 'n' forces next-card skip regardless of phase", () => {
  const { sandbox, elements, keydown } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  // In prompt phase, 'n' should skip straight to a fresh prompt (no reveal).
  assert.equal(elements.toggleBtn.textContent, "Reveal it");
  keydown("n");
  assert.equal(elements.toggleBtn.textContent, "Reveal it",
    "'n' from prompt phase yields a fresh prompt card");
  assert.equal(elements.word.hidden, true, "'n' skip must not reveal the answer");
});

/* Ticket A: answer-side label is blanked on reveal. */
test("label removal: showAnswer blanks the answer-side label ('' not 'Albanian spelling:')", () => {
  const { sandbox, elements, clickToggle } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  // Prompt-side label is the question; reveal must blank it.
  clickToggle();

  assert.equal(elements.label.textContent, "",
    "answer-side label must be blank after reveal");
  assert.notEqual(elements.label.textContent, "Albanian spelling:",
    "the old 'Albanian spelling:' answer label must be gone");
});

test("label removal via timer: auto-reveal also blanks the answer-side label", () => {
  const { sandbox, elements, fireTimer } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  fireTimer();

  assert.equal(elements.label.textContent, "",
    "timer-driven reveal must also blank the answer-side label");
});

/* issue-remove-card-prompt-text: NO instructional prompt text renders above
 * the number on any lesson card. nextCard() sets #label to "" and keeps
 * #recall empty + hidden in the prompt phase (previously it wrote
 * "What is this number in Albanian?" / "Say it out loud, then reveal.").
 * These guard the prompt-phase contract so a regression that re-adds prompt
 * copy above the number is caught. */
test("prompt phase: fresh card shows NO prompt text above the number (#label blank)", () => {
  const { sandbox, elements } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson()); // nextCard() runs on start -> prompt phase

  assert.equal(elements.label.textContent, "",
    "no instructional prompt text may render above the number");
  assert.notEqual(elements.label.textContent, "What is this number in Albanian?",
    "the old question prompt must be gone");
});

test("prompt phase: #recall stays empty and hidden on a fresh card", () => {
  const { sandbox, elements } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  assert.equal(elements.recall.textContent, "",
    "#recall must be empty in the prompt phase");
  assert.equal(elements.recall.hidden, true,
    "#recall must stay hidden in the prompt phase");
  assert.notEqual(elements.recall.textContent, "Say it out loud, then reveal.",
    "the old recall prompt must be gone");
});

test("advance to next card re-asserts the no-prompt-text contract", () => {
  const { sandbox, elements, clickToggle } = makeDomShim();
  const engine = loadEngine(sandbox);
  engine.start(cleanLesson());

  clickToggle(); // reveal
  clickToggle(); // nextCard() -> fresh prompt phase

  assert.equal(elements.label.textContent, "",
    "advancing to a new card must keep #label blank (no prompt text)");
  assert.equal(elements.recall.textContent, "",
    "advancing to a new card must keep #recall empty");
  assert.equal(elements.recall.hidden, true,
    "advancing to a new card must keep #recall hidden");
});
