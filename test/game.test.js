/* LB-11: window.LBGame — pure game/test-mode logic.
 *
 * Run:  node --test
 *
 * game.js is a DOM-FREE IIFE that assigns window.LBGame at load. It needs no
 * LBStore and touches no DOM, so we load it into a minimal node:vm sandbox
 * (just window + Math + the JS built-ins it uses). Built-ins only: node:test,
 * node:assert, node:fs, node:path, node:vm.
 *
 * Coverage (the pure parts the engine relies on):
 *   - clampCount: choice clamping to deck size, "all cards" degrade, empty deck
 *   - shuffle: returns a permutation, does NOT mutate input, deterministic rng
 *   - buildPool: shuffle + clamp; fewer-than-asked uses all; pure
 *   - makeSelfRateEvent: the shared { card, gotIt, responseMs } mapping +
 *     gotIt strict-boolean coercion + responseMs sanitizing
 *   - scorePercent / countGotIt: % and count of "Got it"
 *   - reviewList: prompts of MISSED cards, in order, skipping bad entries
 *   - summarize: the one-call end-screen payload
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const GAME_PATH = path.resolve(__dirname, "..", "src", "game.js");
const GAME_SRC = fs.readFileSync(GAME_PATH, "utf8");

/* Load game.js into a fresh sandbox. Optional rng override is not needed at
 * load (the module reads Math.random at call time); we pass a deterministic rng
 * directly to shuffle/buildPool where determinism matters. */
function loadGame() {
  const windowShim = {};
  const sandbox = { window: windowShim, Math, String, Array, Number, isFinite };
  vm.createContext(sandbox);
  vm.runInContext(GAME_SRC, sandbox, { filename: GAME_PATH });
  return sandbox.window.LBGame;
}

// A deterministic rng that always returns 0 -> Fisher-Yates becomes a fixed,
// reproducible permutation so shuffle/buildPool are assertable.
function zeroRng() { return 0; }

function deck(n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push({ prompt: i, answer: "w" + i });
  return out;
}

/* ------------------------------- clampCount ------------------------------- */

test("LBGame: clampCount returns the request when it fits the deck", () => {
  const G = loadGame();
  assert.equal(G.clampCount(5, 11), 5);
  assert.equal(G.clampCount(10, 11), 10);
});

test("LBGame: clampCount caps the request at the deck size", () => {
  const G = loadGame();
  assert.equal(G.clampCount(20, 9), 9, "asking for 20 of a 9-card deck uses 9");
  assert.equal(G.clampCount(10, 6), 6);
});

test("LBGame: clampCount on an empty deck is 0", () => {
  const G = loadGame();
  assert.equal(G.clampCount(5, 0), 0);
  assert.equal(G.clampCount(5, -3), 0);
});

test("LBGame: clampCount degrades a bad request to 'all cards'", () => {
  const G = loadGame();
  assert.equal(G.clampCount(0, 8), 8);
  assert.equal(G.clampCount(-2, 8), 8);
  assert.equal(G.clampCount(NaN, 8), 8);
});

/* -------------------------------- shuffle --------------------------------- */

test("LBGame: shuffle returns a permutation (same members) and does not mutate input", () => {
  const G = loadGame();
  const input = deck(5);
  const snapshot = input.map((c) => c.prompt);
  const out = G.shuffle(input, Math.random);
  assert.equal(out.length, input.length);
  // Realm-safe: compare via join (arrays cross the vm boundary with a foreign
  // Array prototype, so deepStrictEqual's prototype check would false-fail).
  assert.equal(input.map((c) => c.prompt).join(","), snapshot.join(","),
    "shuffle must not mutate the caller's array");
  const outPrompts = out.map((c) => c.prompt).sort((a, b) => a - b);
  assert.equal(outPrompts.join(","), "1,2,3,4,5", "all members preserved");
});

test("LBGame: shuffle skips null/bad entries", () => {
  const G = loadGame();
  const out = G.shuffle([{ prompt: 1 }, null, { prompt: 2 }, undefined], Math.random);
  assert.equal(out.length, 2, "null/undefined entries are dropped");
});

test("LBGame: shuffle with a deterministic rng is reproducible", () => {
  const G = loadGame();
  const a = G.shuffle(deck(6), zeroRng).map((c) => c.prompt);
  const b = G.shuffle(deck(6), zeroRng).map((c) => c.prompt);
  assert.deepEqual(a, b, "same rng -> same order");
});

/* -------------------------------- buildPool ------------------------------- */

test("LBGame: buildPool returns exactly the clamped count", () => {
  const G = loadGame();
  assert.equal(G.buildPool(deck(11), 5, Math.random).length, 5);
  assert.equal(G.buildPool(deck(9), 20, Math.random).length, 9,
    "fewer cards than asked -> all of them");
});

test("LBGame: buildPool cards are all real members of the deck", () => {
  const G = loadGame();
  const pool = G.buildPool(deck(11), 5, Math.random);
  for (const c of pool) {
    assert.ok(c.prompt >= 1 && c.prompt <= 11, "pool card came from the deck");
  }
  // No duplicates in the pool.
  const seen = new Set(pool.map((c) => c.prompt));
  assert.equal(seen.size, pool.length, "no duplicate cards in a pool");
});

test("LBGame: buildPool on an empty deck is empty", () => {
  const G = loadGame();
  assert.equal(G.buildPool([], 5, Math.random).length, 0);
});

/* ---------------------------- makeSelfRateEvent --------------------------- */

test("LBGame: makeSelfRateEvent builds { card, gotIt, responseMs }", () => {
  const G = loadGame();
  const card = { prompt: 7, answer: "shtatë" };
  const evt = G.makeSelfRateEvent(card, true, 1234);
  assert.equal(evt.card, card);
  assert.equal(evt.gotIt, true);
  assert.equal(evt.responseMs, 1234);
});

test("LBGame: makeSelfRateEvent coerces gotIt to a strict boolean", () => {
  const G = loadGame();
  assert.equal(G.makeSelfRateEvent({}, 1, 0).gotIt, false, "truthy non-true -> false");
  assert.equal(G.makeSelfRateEvent({}, "yes", 0).gotIt, false);
  assert.equal(G.makeSelfRateEvent({}, false, 0).gotIt, false);
  assert.equal(G.makeSelfRateEvent({}, true, 0).gotIt, true);
});

test("LBGame: makeSelfRateEvent sanitizes responseMs (negative/NaN -> 0)", () => {
  const G = loadGame();
  assert.equal(G.makeSelfRateEvent({}, true, -5).responseMs, 0);
  assert.equal(G.makeSelfRateEvent({}, true, NaN).responseMs, 0);
  assert.equal(G.makeSelfRateEvent({}, true, "900").responseMs, 900,
    "numeric string is coerced");
});

/* ------------------------- scorePercent / countGotIt ---------------------- */

test("LBGame: scorePercent is the rounded percent of 'Got it'", () => {
  const G = loadGame();
  const events = [
    { gotIt: true }, { gotIt: false }, { gotIt: true }, { gotIt: true },
  ];
  assert.equal(G.scorePercent(events), 75);
  assert.equal(G.countGotIt(events), 3);
});

test("LBGame: scorePercent of an empty list is 0", () => {
  const G = loadGame();
  assert.equal(G.scorePercent([]), 0);
  assert.equal(G.countGotIt([]), 0);
});

test("LBGame: scorePercent rounds to the nearest integer (1 of 3 -> 33)", () => {
  const G = loadGame();
  assert.equal(G.scorePercent([{ gotIt: true }, { gotIt: false }, { gotIt: false }]), 33);
});

/* ------------------------------- reviewList ------------------------------- */

test("LBGame: reviewList is the prompts of the MISSED cards, in order", () => {
  const G = loadGame();
  const events = [
    { card: { prompt: 1 }, gotIt: true },
    { card: { prompt: 2 }, gotIt: false },
    { card: { prompt: 3 }, gotIt: false },
    { card: { prompt: 4 }, gotIt: true },
  ];
  assert.equal(G.reviewList(events).join(","), "2,3");
});

test("LBGame: reviewList is empty when nothing was missed", () => {
  const G = loadGame();
  assert.equal(G.reviewList([{ card: { prompt: 1 }, gotIt: true }]).length, 0);
});

test("LBGame: reviewList skips events with no usable prompt", () => {
  const G = loadGame();
  const events = [
    { card: { prompt: "" }, gotIt: false },
    { card: null, gotIt: false },
    { card: { prompt: 5 }, gotIt: false },
  ];
  assert.equal(G.reviewList(events).join(","), "5");
});

/* ------------------------------- summarize -------------------------------- */

test("LBGame: summarize returns { total, gotIt, percent, review }", () => {
  const G = loadGame();
  const events = [
    { card: { prompt: 1 }, gotIt: true },
    { card: { prompt: 2 }, gotIt: false },
    { card: { prompt: 3 }, gotIt: true },
    { card: { prompt: 4 }, gotIt: false },
  ];
  const s = G.summarize(events);
  assert.equal(s.total, 4);
  assert.equal(s.gotIt, 2);
  assert.equal(s.percent, 50);
  assert.equal(s.review.join(","), "2,4");
});

test("LBGame: summarize of an empty game is all-zero with empty review", () => {
  const G = loadGame();
  const s = G.summarize([]);
  assert.equal(s.total, 0);
  assert.equal(s.gotIt, 0);
  assert.equal(s.percent, 0);
  assert.equal(s.review.length, 0);
});

/* ===================================================================== *
 * LB-11 HARDENING: boundary + defensive-guard gaps the initial 21      *
 * tests did not cover. Same loadGame()/zeroRng()/deck() shims, no deps. *
 * ===================================================================== */

/* ----------------------- clampCount: more bad input ---------------------- */

test("LBGame: clampCount degrades non-numeric and Infinity requests to 'all cards'", () => {
  const G = loadGame();
  // Number("abc") -> NaN, Number("") -> 0, both <= 0 / non-finite => all cards.
  assert.equal(G.clampCount("abc", 8), 8, "string request -> all cards");
  assert.equal(G.clampCount(undefined, 8), 8, "undefined request -> all cards");
  assert.equal(G.clampCount(Infinity, 8), 8, "Infinity request -> all cards");
  assert.equal(G.clampCount(-Infinity, 8), 8, "-Infinity request -> all cards");
});

test("LBGame: clampCount with a non-numeric deck size is 0 (never invents cards)", () => {
  const G = loadGame();
  assert.equal(G.clampCount(5, "lots"), 0, "non-numeric deck size -> 0");
  assert.equal(G.clampCount(5, NaN), 0, "NaN deck size -> 0");
  assert.equal(G.clampCount(5, Infinity), 0, "non-finite deck size -> 0");
});

test("LBGame: clampCount floors a fractional request", () => {
  const G = loadGame();
  assert.equal(G.clampCount(5.9, 11), 5, "fractional request is floored");
});

/* ------------------------- shuffle: rng is wired ------------------------- */

test("LBGame: shuffle actually uses the injected rng to set the order (specific permutation)", () => {
  const G = loadGame();
  // With rng() === 0, Fisher-Yates swaps each out[j] with out[0] from j=len-1
  // down to 1. For [1,2,3,4,5] that walks the original first element to the end:
  //   start  1 2 3 4 5
  //   j=4 swap idx4<->idx0 -> 5 2 3 4 1
  //   j=3 swap idx3<->idx0 -> 4 2 3 5 1
  //   j=2 swap idx2<->idx0 -> 3 2 4 5 1
  //   j=1 swap idx1<->idx0 -> 2 3 4 5 1
  const out = G.shuffle(deck(5), zeroRng).map((c) => c.prompt);
  assert.equal(out.join(","), "2,3,4,5,1",
    "zeroRng must produce exactly this deterministic permutation");
});

test("LBGame: shuffle of a non-array / empty input returns an empty array (no throw)", () => {
  const G = loadGame();
  assert.equal(G.shuffle(null).length, 0);
  assert.equal(G.shuffle(undefined).length, 0);
  assert.equal(G.shuffle("not an array").length, 0);
  assert.equal(G.shuffle([]).length, 0);
});

/* ----------------------- buildPool: rng + bad deck ----------------------- */

test("LBGame: buildPool threads the injected rng (deterministic pool order)", () => {
  const G = loadGame();
  // Same zeroRng permutation as above, then sliced to the clamped count of 3.
  const out = G.buildPool(deck(5), 3, zeroRng).map((c) => c.prompt);
  assert.equal(out.join(","), "2,3,4", "buildPool = deterministic shuffle then slice");
});

test("LBGame: buildPool on a non-array deck is empty (no throw)", () => {
  const G = loadGame();
  assert.equal(G.buildPool(null, 5, Math.random).length, 0);
  assert.equal(G.buildPool(undefined, 5).length, 0);
});

/* --------------------- makeSelfRateEvent: Infinity ms -------------------- */

test("LBGame: makeSelfRateEvent sanitizes Infinity / -Infinity / missing responseMs to 0", () => {
  const G = loadGame();
  assert.equal(G.makeSelfRateEvent({}, true, Infinity).responseMs, 0, "Infinity -> 0");
  assert.equal(G.makeSelfRateEvent({}, true, -Infinity).responseMs, 0, "-Infinity -> 0");
  assert.equal(G.makeSelfRateEvent({}, true, undefined).responseMs, 0, "undefined -> 0");
  assert.equal(G.makeSelfRateEvent({}, true).responseMs, 0, "omitted arg -> 0");
});

test("LBGame: makeSelfRateEvent keeps a finite positive responseMs (incl. fractional)", () => {
  const G = loadGame();
  assert.equal(G.makeSelfRateEvent({}, true, 0).responseMs, 0, "zero is valid");
  assert.equal(G.makeSelfRateEvent({}, true, 12.5).responseMs, 12.5, "fractional kept");
});

/* ----------------------- scorePercent: round both ways ------------------- */

test("LBGame: scorePercent rounds up as well as down (2 of 3 -> 67)", () => {
  const G = loadGame();
  assert.equal(
    G.scorePercent([{ gotIt: true }, { gotIt: true }, { gotIt: false }]),
    67, "2/3 = 66.6.. rounds to 67");
});

test("LBGame: scorePercent / countGotIt on a non-array input are 0 (no throw)", () => {
  const G = loadGame();
  assert.equal(G.scorePercent(null), 0);
  assert.equal(G.scorePercent(undefined), 0);
  assert.equal(G.countGotIt(null), 0);
  assert.equal(G.countGotIt("nope"), 0);
});

/* --------------------- reviewList / summarize: bad input ----------------- */

test("LBGame: reviewList on a non-array input is an empty array (no throw)", () => {
  const G = loadGame();
  assert.equal(G.reviewList(null).length, 0);
  assert.equal(G.reviewList(undefined).length, 0);
});

test("LBGame: reviewList uses the bare card value when the card is not an object", () => {
  const G = loadGame();
  // reviewList falls back to the card itself as the prompt when card is a scalar.
  const out = G.reviewList([{ card: 42, gotIt: false }]);
  assert.equal(out.join(","), "42", "scalar card used as its own prompt");
});

test("LBGame: summarize on a non-array input is all-zero (no throw)", () => {
  const G = loadGame();
  const s = G.summarize(null);
  assert.equal(s.total, 0);
  assert.equal(s.gotIt, 0);
  assert.equal(s.percent, 0);
  assert.equal(s.review.length, 0);
});

/* ---------- makeSelfRateEvent feeds a (fake) recordResult correctly ------ *
 * The engine's handleSelfRate hook is PRIVATE to the engine IIFE (only      *
 * start/startGame/DEFAULTS are exported on window.LBEngine), so the hook     *
 * itself is integration/manual. What IS unit-testable is the contract the   *
 * hook depends on: makeSelfRateEvent's output is exactly what would be      *
 * passed to LBLeitner.recordResult(lessonId, card, evt.gotIt). We simulate  *
 * that downstream call with a fake recorder and assert the args it sees.    */

test("LBGame: makeSelfRateEvent output drives a fake recordResult with the right args", () => {
  const G = loadGame();
  const card = { prompt: 7, answer: "shtatë" };

  // Stand-in for window.LBLeitner.recordResult; captures what the engine hook
  // would forward (lessonId, card, evt.gotIt).
  const calls = [];
  function fakeRecordResult(lessonId, c, gotIt) {
    calls.push({ lessonId, c, gotIt });
  }

  // Replicate exactly what handleSelfRate does with the pure mapping: build the
  // canonical event, then forward (lessonId, card, evt.gotIt) to the recorder.
  const evt = G.makeSelfRateEvent(card, "truthy-not-true", 1500);
  fakeRecordResult("sq/lesson-1", evt.card, evt.gotIt);

  assert.equal(calls.length, 1, "recorder called exactly once");
  assert.equal(calls[0].lessonId, "sq/lesson-1");
  assert.equal(calls[0].c, card, "same card reference forwarded");
  assert.equal(calls[0].gotIt, false, "strict-boolean gotIt forwarded (truthy -> false)");
  assert.equal(evt.responseMs, 1500, "responseMs carried for the LB-12 mastery seam");
});
