/* Loop-resilience regression for the engine deck builder.
 *
 * Run:  node --test
 *
 * Global rule (Rob): a single bad item in a loop must NOT abort the loop.
 * The engine's normalizeCard/buildDeck path must skip null / missing-answer /
 * missing-prompt / garbage cards (warning on each) while every valid card
 * survives — no throw, no abort.
 *
 * This loads the REAL engine.js (not a copy of its logic) inside a vm with a
 * minimal DOM + window shim, runs LBEngine.start() on a deliberately dirty
 * deck, and asserts on observable behavior: it does not throw, it warns once
 * per bad card, and it renders a valid card.
 *
 * Built-ins only: node:test, node:assert, node:fs, node:vm. No npm installs.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ENGINE_PATH = path.resolve(__dirname, "..", "src", "engine.js");
const ENGINE_SRC = fs.readFileSync(ENGINE_PATH, "utf8");

/* Minimal DOM shim — just enough for engine.start() to run headless.
 * Every getElementById id the engine touches returns a stub element. */
function makeDomShim() {
  const warnings = [];
  const elements = {};
  const ids = [
    "number", "word", "pronunciation", "label",
    "recall", "bar", "toggleBtn", "title",
  ];
  for (const id of ids) {
    elements[id] = {
      id,
      style: {},
      hidden: false,
      textContent: "",
      innerHTML: "",
      offsetWidth: 0,
      addEventListener() {},
    };
  }

  const documentShim = {
    getElementById: (id) => elements[id] || null,
    addEventListener() {},
    set title(v) { this._title = v; },
    get title() { return this._title; },
  };

  const windowShim = { LB_LESSONS: [] };

  const sandbox = {
    window: windowShim,
    document: documentShim,
    console: { warn: (...a) => warnings.push(a), log() {} },
    setTimeout: () => 0,    // fire nothing — we are not testing the timer here
    clearTimeout: () => {},
    Math, String, Array,
  };
  return { sandbox, windowShim, elements, warnings };
}

function loadEngine(sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SRC, sandbox, { filename: ENGINE_PATH });
  return sandbox.window.LBEngine;
}

test("engine loads and exposes LBEngine.start", () => {
  const { sandbox } = makeDomShim();
  const engine = loadEngine(sandbox);
  assert.ok(engine, "window.LBEngine must be defined");
  assert.equal(typeof engine.start, "function", "LBEngine.start must be a function");
});

test("dirty deck: invalid cards skipped, valid cards survive, no throw", () => {
  const { sandbox, elements, warnings } = makeDomShim();
  const engine = loadEngine(sandbox);

  // Interleave valid cards with every flavor of bad card.
  const lesson = {
    id: "sq/test-dirty",
    title: "Dirty Deck",
    revealMs: 5000,
    cards: [
      { prompt: 1, answer: "një", hint: "nyuh", audio: "" }, // valid
      null,                                                    // null
      { prompt: 2, answer: "dy" },                             // valid (no hint/audio)
      { prompt: 3 },                                           // missing answer
      { answer: "katër" },                                     // missing prompt
      "garbage",                                               // not an object
      42,                                                      // not an object
      { prompt: "", answer: "x" },                             // empty prompt
      { prompt: 5, answer: "" },                               // empty answer
      { prompt: 10, answer: "dhjetë", hint: "", audio: "" },  // valid
    ],
  };

  // Must not throw despite 7 bad cards interleaved.
  assert.doesNotThrow(() => engine.start(lesson), "start() must not throw on a dirty deck");

  // 7 bad cards => at least 7 warnings (one per skipped card).
  assert.ok(
    warnings.length >= 7,
    `expected >= 7 skip warnings, got ${warnings.length}`
  );

  // A valid card rendered: numberEl.textContent got set to a surviving prompt.
  const rendered = String(elements.number.textContent);
  assert.ok(rendered.length > 0, "a valid card must have rendered (number text set)");
  assert.ok(
    ["1", "2", "10"].includes(rendered),
    `rendered prompt should be one of the 3 valid cards, got "${rendered}"`
  );
});

test("all-invalid deck: degrades gracefully, no throw, no render", () => {
  const { sandbox, elements } = makeDomShim();
  const engine = loadEngine(sandbox);

  const lesson = {
    id: "sq/test-empty",
    title: "All Bad",
    revealMs: 5000,
    cards: [null, "x", 7, { prompt: 1 }, { answer: "y" }],
  };

  assert.doesNotThrow(() => engine.start(lesson), "start() must not throw when no card is valid");
  // Engine sets a graceful "No cards available" label rather than crashing.
  assert.match(
    String(elements.label.textContent),
    /no cards/i,
    "empty valid-deck should show the graceful no-cards label"
  );
});

test("valid-only deck: every card survives the builder", () => {
  const { sandbox, warnings } = makeDomShim();
  const engine = loadEngine(sandbox);

  const lesson = {
    id: "sq/test-clean",
    title: "Clean",
    revealMs: 5000,
    cards: [
      { prompt: 1, answer: "një" },
      { prompt: 2, answer: "dy" },
      { prompt: 3, answer: "tre" },
    ],
  };

  assert.doesNotThrow(() => engine.start(lesson));
  assert.equal(warnings.length, 0, "a clean deck must produce zero skip warnings");
});
