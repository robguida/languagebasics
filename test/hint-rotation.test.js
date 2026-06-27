/* SEAM A unit tests for the pure hint-example rotation module (LB-18).
 *
 * Run:  node --test
 *
 * window.LBHint.pick(hint, cycleIndex) chooses ONE example from a " / "-separated
 * hint, cycling through all parts across views. A hint with NO delimiter (every
 * number-lesson hint) must return BYTE-IDENTICAL to its input. Loads the REAL
 * src/hint.js in a node:vm sandbox (same convention as the leitner/mastery
 * units). Built-ins only: node:test, node:assert, node:fs, node:vm, node:path.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HINT_PATH = path.resolve(__dirname, "..", "src", "hint.js");
const HINT_SRC = fs.readFileSync(HINT_PATH, "utf8");

function loadHint() {
  const sandbox = {
    window: {},
    console: { warn() {}, log() {} },
    Number, isFinite, Math, String,
  };
  vm.createContext(sandbox);
  vm.runInContext(HINT_SRC, sandbox, { filename: HINT_PATH });
  return sandbox.window.LBHint;
}

test("module loads and exposes pick/segments/DELIM", () => {
  const H = loadHint();
  assert.ok(H, "window.LBHint must be defined");
  assert.equal(typeof H.pick, "function");
  assert.equal(typeof H.segments, "function");
  assert.equal(H.DELIM, " / ");
});

test("delimiter does NOT collide with the answer ' | ' line separator", () => {
  const H = loadHint();
  assert.notEqual(H.DELIM, " | ", "hint delim must differ from the answer separator");
});

test("no-delimiter hint returns byte-identical (number lessons unaffected)", () => {
  const H = loadHint();
  // Real number-lesson hints, plus empties.
  for (const raw of ["Nyuh", "Kah ter buh they yet", "They yet", ""]) {
    for (const idx of [0, 1, 2, 5, 99]) {
      assert.equal(H.pick(raw, idx), raw,
        `single-segment hint "${raw}" must be returned unchanged at index ${idx}`);
    }
  }
});

test("3-example hint cycles through all parts across views", () => {
  const H = loadHint();
  const hint = "ana (Ah nah, side) / baba (Bah bah, father) / mal (Mahl, mountain)";
  const parts = H.segments(hint);
  assert.equal(parts.length, 3, "must split into 3 examples");
  // Indices 0,1,2 walk through each example; index 3 wraps to the first.
  assert.equal(H.pick(hint, 0), "ana (Ah nah, side)");
  assert.equal(H.pick(hint, 1), "baba (Bah bah, father)");
  assert.equal(H.pick(hint, 2), "mal (Mahl, mountain)");
  assert.equal(H.pick(hint, 3), "ana (Ah nah, side)", "index wraps modulo count");
  assert.equal(H.pick(hint, 7), "baba (Bah bah, father)", "7 mod 3 = 1");
});

test("picked example never contains the delimiter (one clean example per view)", () => {
  const H = loadHint();
  const hint = "dy (Doo, two) / sy (Soo, eye) / yll (Ool, star)";
  for (let i = 0; i < 9; i++) {
    assert.ok(H.pick(hint, i).indexOf(" / ") === -1,
      "a single rendered example must not contain the delimiter");
  }
});

test("non-finite / negative cycle index is treated as 0", () => {
  const H = loadHint();
  const hint = "a (x) / b (y) / c (z)";
  assert.equal(H.pick(hint, -1), "a (x)");
  assert.equal(H.pick(hint, NaN), "a (x)");
  assert.equal(H.pick(hint, undefined), "a (x)");
});

test("null/undefined hint is safe", () => {
  const H = loadHint();
  assert.equal(H.pick(null, 0), "");
  assert.equal(H.pick(undefined, 1), "");
  // segments() is built in the vm realm, so compare by length (cross-realm
  // arrays are not deepStrictEqual-comparable by reference).
  assert.equal(H.segments(null).length, 0);
});
