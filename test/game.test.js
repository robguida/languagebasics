/* LB-11 / LB-36: window.LBGame — pure game/test-mode logic.
 *
 * Run:  node --test
 *
 * game.js is a DOM-FREE IIFE that assigns window.LBGame at load. It needs no
 * LBStore and touches no DOM, so we load it into a minimal node:vm sandbox
 * (just window + Math + the JS built-ins it uses). Built-ins only: node:test,
 * node:assert, node:fs, node:path, node:vm.
 *
 * Coverage (the pure parts the engine relies on; LB-36 retired the score
 * percent, the 5/10/20 count choices and the time-used math):
 *   - clampCount / testSize: min(10, deck), empty deck, bad input
 *   - shuffle: returns a permutation, does NOT mutate input, deterministic rng
 *   - buildTestPool: NOT-known cards first, then known, cut to min(10, deck)
 *   - buildRetryPool: only the missed cards, unknown prompts skipped
 *   - makeSelfRateEvent: { card, gotIt } with strict-boolean gotIt
 *   - countGotIt / missedCards / reviewList / summarize: the results payload
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
 * directly to shuffle where determinism matters. */
function loadGame() {
  const windowShim = {};
  const sandbox = { window: windowShim, Math, String, Array, Number, isFinite };
  vm.createContext(sandbox);
  vm.runInContext(GAME_SRC, sandbox, { filename: GAME_PATH });
  return sandbox.window.LBGame;
}

// A deterministic rng that always returns 0 -> Fisher-Yates becomes a fixed,
// reproducible permutation so shuffle is assertable.
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

test("LBGame: buildPool is retired (LB-36: a test uses buildTestPool / buildRetryPool)", () => {
  const G = loadGame();
  assert.equal(G.buildPool, undefined);
});


/* =========================== LB-36 additions ============================ */

test("LB-36: retired pieces are gone (count choices, percent, time math)", () => {
  const G = loadGame();
  for (const gone of ["COUNT_CHOICES", "scorePercent", "timePossibleMs", "perCardUsedMs", "timeUsedMs"]) {
    assert.equal(G[gone], undefined, gone + " must be retired");
  }
});

test("LB-36 testSize: min(10, card count); 0 for an empty or bad deck", () => {
  const G = loadGame();
  assert.equal(G.TEST_SIZE, 10);
  assert.equal(G.testSize(80), 10, "big lesson -> 10");
  assert.equal(G.testSize(10), 10);
  assert.equal(G.testSize(3), 3, "es digraphs (3 cards) -> a 3-card test");
  assert.equal(G.testSize(0), 0);
  assert.equal(G.testSize(NaN), 0);
});

test("LB-36 buildTestPool: cards NOT known come first, then known ones", () => {
  const G = loadGame();
  const d = deck(12);
  const known = { "1": true, "2": true, "3": true, "4": true, "5": true, "6": true, "7": true, "8": true };
  const pool = G.buildTestPool(d, known, Math.random);
  assert.equal(pool.length, 10, "cut to 10");
  const firstFour = pool.slice(0, 4).map((c) => String(c.prompt)).sort();
  assert.equal(firstFour.join(","), ["10", "11", "12", "9"].sort().join(","), "all 4 unknown cards lead");
  for (const c of pool.slice(4)) assert.ok(known[String(c.prompt)], "the rest are known cards");
  assert.equal(new Set(pool.map((c) => c.prompt)).size, 10, "no card twice");
});

test("LB-36 buildTestPool: more unknown than 10 -> only unknown cards", () => {
  const G = loadGame();
  const pool = G.buildTestPool(deck(20), { "1": true, "2": true }, Math.random);
  assert.equal(pool.length, 10);
  assert.ok(pool.every((c) => c.prompt !== 1 && c.prompt !== 2), "known cards are not reached");
});

test("LB-36 buildTestPool: a lesson under 10 cards uses every card once", () => {
  const G = loadGame();
  const pool = G.buildTestPool(deck(3), {}, Math.random);
  assert.equal(pool.length, 3);
  assert.equal(pool.map((c) => c.prompt).sort().join(","), "1,2,3");
});

test("LB-36 buildTestPool: bad deck entries are skipped, never abort", () => {
  const G = loadGame();
  const d = [null, { prompt: 1, answer: "a" }, "junk", { answer: "x" }, { prompt: "", answer: "y" }, { prompt: 2, answer: "b" }];
  const pool = G.buildTestPool(d, null, Math.random);
  assert.equal(pool.map((c) => c.prompt).sort().join(","), "1,2");
  assert.equal(G.buildTestPool(null, {}).length, 0);
  assert.equal(G.buildTestPool([], {}).length, 0);
});

test("LB-36 buildTestPool: a known map with prototype names does not mark cards known", () => {
  const G = loadGame();
  const d = [{ prompt: "toString", answer: "a" }, { prompt: 1, answer: "b" }];
  const pool = G.buildTestPool(d, {}, zeroRng);
  assert.equal(pool.length, 2, "both cards in the pool");
});

test("LB-36 buildRetryPool: only the missed cards, each once; unknown prompts skipped", () => {
  const G = loadGame();
  const pool = G.buildRetryPool(deck(10), ["3", 7, "7", "99", null, ""], Math.random);
  assert.equal(pool.map((c) => c.prompt).sort().join(","), "3,7");
  assert.equal(G.buildRetryPool(deck(10), []).length, 0, "nothing missed -> empty");
  assert.equal(G.buildRetryPool(deck(10), null).length, 0);
  assert.equal(G.buildRetryPool(null, ["1"]).length, 0);
});

test("LB-36 makeSelfRateEvent: { card, gotIt } with a strict boolean", () => {
  const G = loadGame();
  const card = { prompt: 1, answer: "a" };
  const e = G.makeSelfRateEvent(card, true);
  assert.equal(e.card, card);
  assert.equal(e.gotIt, true);
  assert.equal(e.responseMs, undefined, "no timing in the event any more");
  assert.equal(G.makeSelfRateEvent(card, "yes").gotIt, false);
  assert.equal(G.makeSelfRateEvent(card, 1).gotIt, false);
  assert.equal(G.makeSelfRateEvent(card).gotIt, false);
});

test("LB-36 summarize: total, known count, missed cards and prompts in order", () => {
  const G = loadGame();
  const c = deck(4);
  const events = [
    { card: c[0], gotIt: true }, { card: c[1], gotIt: false },
    null, { card: c[2], gotIt: false }, { card: null, gotIt: false }, { card: c[3], gotIt: true },
  ];
  const s = G.summarize(events);
  assert.equal(s.total, 6);
  assert.equal(s.gotIt, 2);
  assert.equal(Array.from(s.review).join(","), "2,3");
  assert.equal(s.missed.map((x) => x.prompt).join(","), "2,3");
  const empty = G.summarize("nope");
  assert.equal(empty.total, 0);
  assert.equal(empty.gotIt, 0);
  assert.equal(empty.review.length, 0);
});
