/* LB-10: window.LBLeitner — the Leitner spaced-repetition box logic, and the
 * engine's resolvedOrderSource() card-order seam.
 *
 * Run:  node --test
 *
 * leitner.js is an IIFE that, at load, assigns window.LBLeitner and reads/writes
 * box state THROUGH window.LBStore (LB-8) under the `lb.leitner` namespace. To
 * exercise the real persistence round-trip we load BOTH store.js and leitner.js
 * into ONE shared node:vm sandbox backed by the reusable LB-8 localStorage shim
 * — so LBLeitner talks to a genuine LBStore over a genuine (in-memory) Storage,
 * exactly as in the browser. Same pattern as store.test.js / prefs.test.js.
 *
 * This is PURE-LOGIC coverage — that's where the value is:
 *   1. cardId format = `lessonId:prompt`.
 *   2. Default box: unseen card -> box 1.
 *   3. recordResult promote: gotIt=true climbs 1->2->...->5 and CAPS at 5.
 *   4. recordResult demote: gotIt=false from any box -> box 1.
 *   5. Persistence: box state round-trips through the shim; per-lesson and
 *      per-card isolation (one card's box never moves another's).
 *   6. nextCard weighting: low-box cards surface materially more often than
 *      high-box (ratio sanity check, not exact); the just-shown card is excluded
 *      unless it is the only card.
 *   7. Graceful no-store: with no LBStore present, calls degrade and never throw.
 *
 * Plus a light engine-seam regression: with no LBPrefs/LBLeitner (the existing
 * engine-test environment) the engine still uses the random path. The full
 * order-provider integration is mostly manual — see the report.
 *
 * Built-ins only: node:test, node:assert, node:fs, node:path, node:vm. The
 * localStorage shim is the one built for LB-8 and reused here verbatim.
 *
 * MANUAL (not unit-tested here — see report): the live engine "leitner" order
 * path end-to-end in a browser (LBPrefs.getOrder === "leitner" wiring
 * LBLeitner.nextCard into the deck), the self-rate UI feeding recordResult
 * (that UI is LB-11), and the lastSeen monotonic timing in a real session.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { makeStoreSandbox, STORE_SRC } = require("./helpers/local-storage-shim.js");

const LEITNER_SRC_PATH = path.resolve(__dirname, "..", "src", "leitner.js");
const LEITNER_SRC = fs.readFileSync(LEITNER_SRC_PATH, "utf8");
const ENGINE_PATH = path.resolve(__dirname, "..", "src", "engine.js");
const ENGINE_SRC = fs.readFileSync(ENGINE_PATH, "utf8");

/* Load store.js + leitner.js into one fresh sandbox so LBLeitner round-trips
 * through a real LBStore over the LB-8 shim. Returns the live LBLeitner/LBStore
 * plus the window + storage handles for inspection. Pass { noStorage: true } or
 * { throwOnSet: true } straight through to the shim.
 *
 * The sandbox carries the host Math so nextCard()'s Math.random() draw runs with
 * genuine randomness (the weighting test relies on real distribution). */
function loadLeitner(opts) {
  const ctx = makeStoreSandbox(opts);
  ctx.sandbox.Math = Math;
  vm.runInContext(fs.readFileSync(STORE_SRC, "utf8"), ctx.sandbox, { filename: STORE_SRC });
  vm.runInContext(LEITNER_SRC, ctx.sandbox, { filename: LEITNER_SRC_PATH });
  return {
    LBLeitner: ctx.window.LBLeitner,
    LBStore: ctx.window.LBStore,
    window: ctx.window,
    storage: ctx.storage,
    warnings: ctx.warnings,
  };
}

/* Load leitner.js with NO store.js present (window has no LBStore). This is the
 * engine-unit-test environment: reads return defaults, writes are no-ops, and
 * nothing throws. */
function loadLeitnerNoStore() {
  const sandbox = { window: {}, console: { warn() {}, log() {} }, Math };
  vm.createContext(sandbox);
  vm.runInContext(LEITNER_SRC, sandbox, { filename: LEITNER_SRC_PATH });
  return { LBLeitner: sandbox.window.LBLeitner, window: sandbox.window };
}

/* Build a deck of plain card objects from a list of prompts. */
function deckOf(prompts) {
  return prompts.map((p) => ({ prompt: p, answer: "w" + p, hint: "", audio: "" }));
}

/* Engine seam helper (mirrors prefs.test.js): load engine.js into a sandbox
 * whose window optionally carries LBPrefs / LBLeitner stubs. We observe which
 * order source the engine commits to indirectly — the random path is the only
 * one available when neither global is present, which is the regression we care
 * about. A minimal DOM shim mirrors loop-resilience.test.js. */
function makeEngineSandbox(stubs) {
  stubs = stubs || {};
  const elements = {};
  const ids = ["number", "word", "pronunciation", "label", "recall", "bar", "toggleBtn", "title"];
  for (const id of ids) {
    elements[id] = {
      id, style: {}, hidden: false, textContent: "", innerHTML: "",
      offsetWidth: 0, addEventListener() {},
    };
  }
  const documentShim = {
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
    addEventListener() {},
    set title(v) { this._title = v; },
    get title() { return this._title; },
  };
  const windowShim = { LB_LESSONS: [] };
  if (stubs.LBPrefs) windowShim.LBPrefs = stubs.LBPrefs;
  if (stubs.LBLeitner) windowShim.LBLeitner = stubs.LBLeitner;

  const sandbox = {
    window: windowShim,
    document: documentShim,
    console: { warn() {}, log() {} },
    setTimeout: () => 0,
    clearTimeout: () => {},
    Math, String, Array,
  };
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SRC, sandbox, { filename: ENGINE_PATH });
  return { engine: sandbox.window.LBEngine, elements };
}

/* ----------------------------- public surface ----------------------------- */

test("LBLeitner: loads and exposes the public surface", () => {
  const { LBLeitner } = loadLeitner();
  assert.ok(LBLeitner, "window.LBLeitner must be defined after load");
  for (const fn of ["recordResult", "nextCard", "getBox", "getState", "cardId"]) {
    assert.equal(typeof LBLeitner[fn], "function", `${fn} must be a function`);
  }
  assert.equal(LBLeitner.BOX_COUNT, 5, "BOX_COUNT must be 5");
  assert.equal(LBLeitner.MIN_BOX, 1, "MIN_BOX must be 1");
  assert.equal(LBLeitner.MAX_BOX, 5, "MAX_BOX must be 5");
  assert.equal(LBLeitner.STORE_KEY, "lb.leitner", "STORE_KEY must be lb.leitner");
});

/* --------------------------- 1. cardId format ----------------------------- */

test("cardId: format is `lessonId:prompt` from a card object", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.cardId("sq/lesson-1", { prompt: 7 }), "sq/lesson-1:7",
    "cardId joins lessonId and card.prompt with a colon");
});

test("cardId: accepts a raw prompt value (not only a card object)", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.cardId("sq/lesson-2", 15), "sq/lesson-2:15",
    "a raw prompt is stringified into the id");
  assert.equal(LBLeitner.cardId("sq/lesson-1", { prompt: 0 }), "sq/lesson-1:0",
    "prompt 0 is a valid, non-empty id (must not be dropped as falsy)");
});

test("cardId: missing lessonId or empty prompt -> null (unusable)", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.cardId("", { prompt: 7 }), null, "no lessonId -> null");
  assert.equal(LBLeitner.cardId("sq/lesson-1", { prompt: "" }), null, "empty prompt -> null");
  assert.equal(LBLeitner.cardId("sq/lesson-1", {}), null, "no prompt field -> null");
  assert.equal(LBLeitner.cardId("sq/lesson-1", null), null, "null card -> null");
});

/* --------------------------- 2. default box ------------------------------- */

test("default box: an unseen card reports box 1 (MIN_BOX)", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.getBox("sq/lesson-1", { prompt: 3 }), 1,
    "a never-recorded card defaults to box 1");
});

test("default state: unseen card -> { box: 1, lastSeen: 0 }", () => {
  const { LBLeitner } = loadLeitner();
  const st = LBLeitner.getState("sq/lesson-1", { prompt: 3 });
  assert.equal(st.box, 1, "default box is 1");
  assert.equal(st.lastSeen, 0, "default lastSeen is 0 (never seen)");
});

/* --------------------------- 3. recordResult promote ---------------------- */

test("recordResult promote: gotIt=true climbs 1->2->3->4->5 and CAPS at 5", () => {
  const { LBLeitner } = loadLeitner();
  const card = { prompt: 7 };
  const expected = [2, 3, 4, 5, 5, 5]; // 6 calls: climbs to 5, then caps
  for (let i = 0; i < expected.length; i++) {
    const newBox = LBLeitner.recordResult("sq/lesson-1", card, true);
    assert.equal(newBox, expected[i],
      `call #${i + 1}: gotIt=true -> box ${expected[i]} (returns the new box)`);
    assert.equal(LBLeitner.getBox("sq/lesson-1", card), expected[i],
      `call #${i + 1}: getBox agrees with the returned box`);
  }
});

test("recordResult: returns the new box for the caller to assert on", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.recordResult("sq/lesson-1", { prompt: 1 }, true), 2,
    "first correct on a fresh card -> box 2, returned");
});

test("recordResult: unusable card id -> null, no throw", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.recordResult("sq/lesson-1", { prompt: "" }, true), null,
    "empty prompt -> null (nothing to record)");
});

/* --------------------------- 4. recordResult demote ----------------------- */

test("recordResult demote: gotIt=false from any box -> box 1", () => {
  const { LBLeitner } = loadLeitner();
  const card = { prompt: 9 };
  // Climb to box 4 first.
  LBLeitner.recordResult("sq/lesson-1", card, true); // 2
  LBLeitner.recordResult("sq/lesson-1", card, true); // 3
  LBLeitner.recordResult("sq/lesson-1", card, true); // 4
  assert.equal(LBLeitner.getBox("sq/lesson-1", card), 4, "climbed to box 4");

  const demoted = LBLeitner.recordResult("sq/lesson-1", card, false);
  assert.equal(demoted, 1, "a miss drops straight to box 1 (returns 1)");
  assert.equal(LBLeitner.getBox("sq/lesson-1", card), 1, "getBox confirms box 1");
});

test("recordResult demote: gotIt=false from box 5 (the top) -> box 1", () => {
  const { LBLeitner } = loadLeitner();
  const card = { prompt: 10 };
  for (let i = 0; i < 5; i++) LBLeitner.recordResult("sq/lesson-1", card, true);
  assert.equal(LBLeitner.getBox("sq/lesson-1", card), 5, "card is at the top box 5");
  assert.equal(LBLeitner.recordResult("sq/lesson-1", card, false), 1,
    "a miss from box 5 still resets all the way to box 1");
});

test("recordResult demote: gotIt=false on a fresh (box 1) card stays at box 1", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.recordResult("sq/lesson-1", { prompt: 4 }, false), 1,
    "a miss on a never-seen card stays at box 1 (no underflow)");
});

/* --------------------------- 5. persistence + isolation ------------------- */

test("persistence: box state round-trips through LBStore (write, re-read all)", () => {
  const { LBLeitner, LBStore } = loadLeitner();
  const card = { prompt: 7 };
  LBLeitner.recordResult("sq/lesson-1", card, true); // box 2
  LBLeitner.recordResult("sq/lesson-1", card, true); // box 3

  // The value is genuinely persisted under lb.leitner (not just in a local var).
  const raw = LBStore.get("lb.leitner");
  assert.ok(raw && raw.lessons, "lb.leitner holds a lessons map");
  assert.equal(raw.lessons["sq/lesson-1"]["sq/lesson-1:7"].box, 3,
    "the stored record carries the box value");
  assert.equal(raw.v, LBStore.VERSION, "LBStore stamped v:VERSION on the record");
});

test("persistence: a fresh module re-reading the SAME storage sees the box (survives reload)", () => {
  // Write through one (store + leitner) stack, then load a SECOND leitner.js
  // over the SAME storage object and confirm the box value survives the reload.
  const ctx = makeStoreSandbox();
  ctx.sandbox.Math = Math;
  vm.runInContext(fs.readFileSync(STORE_SRC, "utf8"), ctx.sandbox, { filename: STORE_SRC });
  vm.runInContext(LEITNER_SRC, ctx.sandbox, { filename: LEITNER_SRC_PATH });
  const card = { prompt: 7 };
  ctx.window.LBLeitner.recordResult("sq/lesson-1", card, true); // 2
  ctx.window.LBLeitner.recordResult("sq/lesson-1", card, true); // 3
  assert.equal(ctx.window.LBLeitner.getBox("sq/lesson-1", card), 3, "box 3 before reload");

  // Reload a fresh store + leitner over the SAME underlying storage (the shim's
  // backing map persists because we reuse the same storage object).
  const sandbox2 = {
    window: { localStorage: ctx.storage },
    console: { warn() {}, log() {} },
    Math,
  };
  vm.createContext(sandbox2);
  vm.runInContext(fs.readFileSync(STORE_SRC, "utf8"), sandbox2, { filename: STORE_SRC });
  vm.runInContext(LEITNER_SRC, sandbox2, { filename: LEITNER_SRC_PATH });
  assert.equal(sandbox2.window.LBLeitner.getBox("sq/lesson-1", card), 3,
    "the box value survives a full module reload over the same storage");
});

test("isolation: one card's box change does not move another card's box", () => {
  const { LBLeitner } = loadLeitner();
  const a = { prompt: 1 };
  const b = { prompt: 2 };
  LBLeitner.recordResult("sq/lesson-1", a, true); // a -> 2
  LBLeitner.recordResult("sq/lesson-1", a, true); // a -> 3
  assert.equal(LBLeitner.getBox("sq/lesson-1", a), 3, "card a climbed to box 3");
  assert.equal(LBLeitner.getBox("sq/lesson-1", b), 1, "card b is untouched -> still box 1");

  LBLeitner.recordResult("sq/lesson-1", b, true); // b -> 2
  assert.equal(LBLeitner.getBox("sq/lesson-1", a), 3, "card a unchanged after writing card b");
  assert.equal(LBLeitner.getBox("sq/lesson-1", b), 2, "card b moved independently to box 2");
});

test("isolation: the SAME prompt in two lessons keeps separate boxes", () => {
  const { LBLeitner } = loadLeitner();
  const card = { prompt: 5 };
  LBLeitner.recordResult("sq/lesson-1", card, true); // lesson-1:5 -> 2
  LBLeitner.recordResult("sq/lesson-1", card, true); // lesson-1:5 -> 3
  assert.equal(LBLeitner.getBox("sq/lesson-1", card), 3, "lesson-1 copy of prompt 5 is box 3");
  assert.equal(LBLeitner.getBox("sq/lesson-2", card), 1,
    "lesson-2 copy of the same prompt is independent -> still box 1");
});

/* --------------------------- 6. nextCard weighting ------------------------ */

test("nextCard: a single-card deck returns that card (graceful, no exclusion)", () => {
  const { LBLeitner } = loadLeitner();
  const deck = deckOf([7]);
  const picked = LBLeitner.nextCard("sq/lesson-1", deck, deck[0]);
  assert.equal(picked.prompt, 7,
    "with only one card it is returned even though it is the currentCard");
});

test("nextCard: empty / non-array deck -> null, no throw", () => {
  const { LBLeitner } = loadLeitner();
  assert.equal(LBLeitner.nextCard("sq/lesson-1", [], null), null, "empty deck -> null");
  assert.equal(LBLeitner.nextCard("sq/lesson-1", null, null), null, "non-array deck -> null");
});

test("nextCard: NEVER returns the just-shown card over many draws (multi-card deck)", () => {
  const { LBLeitner } = loadLeitner();
  const deck = deckOf([1, 2, 3, 4, 5]);
  const current = deck[2]; // prompt 3
  for (let i = 0; i < 2000; i++) {
    const picked = LBLeitner.nextCard("sq/lesson-1", deck, current);
    assert.notEqual(picked.prompt, current.prompt,
      "the just-shown card must be excluded from the pick");
  }
});

test("nextCard weighting: low-box cards surface materially more than high-box", () => {
  const { LBLeitner } = loadLeitner();
  // Deck of 4 cards. Push two to box 5 (lowest weight) and leave two at box 1
  // (highest weight). No currentCard so the whole deck is the candidate pool.
  const deck = deckOf([1, 2, 3, 4]);
  // Cards 3 and 4 climb to box 5; cards 1 and 2 stay at box 1.
  for (let i = 0; i < 5; i++) {
    LBLeitner.recordResult("sq/lesson-1", deck[2], true);
    LBLeitner.recordResult("sq/lesson-1", deck[3], true);
  }
  assert.equal(LBLeitner.getBox("sq/lesson-1", deck[2]), 5, "card 3 is box 5");
  assert.equal(LBLeitner.getBox("sq/lesson-1", deck[3]), 5, "card 4 is box 5");
  assert.equal(LBLeitner.getBox("sq/lesson-1", deck[0]), 1, "card 1 is box 1");
  assert.equal(LBLeitner.getBox("sq/lesson-1", deck[1]), 1, "card 2 is box 1");

  // Weights: box1 -> 5, box5 -> 1. Low boxes total 10, high boxes total 2, so
  // low-box cards SHOULD be picked ~5x as often. We require materially more (a
  // ratio well above 1), not an exact figure — this is randomized.
  const N = 20000;
  let low = 0;
  let high = 0;
  for (let i = 0; i < N; i++) {
    const picked = LBLeitner.nextCard("sq/lesson-1", deck, null);
    if (picked.prompt === 1 || picked.prompt === 2) low++;
    else high++;
  }
  assert.ok(low > 0 && high > 0, "both groups must be reachable (every card stays drawable)");
  const ratio = low / high;
  // Expected ratio is ~5; assert it is clearly above 2 to be robust to variance.
  assert.ok(ratio > 2,
    `low-box cards must surface materially more often (got ratio low/high = ${ratio.toFixed(2)}, expected ~5)`);
});

test("nextCard weighting: with no stored boxes (all box 1) the pick is roughly uniform", () => {
  const { LBLeitner } = loadLeitner();
  // All cards default to box 1 -> equal weight -> roughly uniform, and the
  // current-card exclusion still holds.
  const deck = deckOf([1, 2, 3, 4]);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const picked = LBLeitner.nextCard("sq/lesson-1", deck, null);
    counts[picked.prompt]++;
  }
  for (const p of [1, 2, 3, 4]) {
    // Each should land near N/4 = 5000; allow a generous band for randomness.
    assert.ok(counts[p] > N / 8,
      `equal-box card ${p} should be picked roughly uniformly (got ${counts[p]} of ${N})`);
  }
});

/* --------------------------- 7. no-store degradation ---------------------- */

test("no LBStore: getBox/getState return defaults and never throw (engine env)", () => {
  const { LBLeitner } = loadLeitnerNoStore();
  assert.equal(LBLeitner.getBox("sq/lesson-1", { prompt: 7 }), 1,
    "no store -> getBox returns the box-1 default");
  const st = LBLeitner.getState("sq/lesson-1", { prompt: 7 });
  assert.equal(st.box, 1, "no store -> default box 1");
  assert.equal(st.lastSeen, 0, "no store -> default lastSeen 0");
});

test("no LBStore: recordResult computes the new box but persists nothing (no throw)", () => {
  const { LBLeitner } = loadLeitnerNoStore();
  let result;
  assert.doesNotThrow(() => { result = LBLeitner.recordResult("sq/lesson-1", { prompt: 7 }, true); },
    "recordResult must not throw without a store");
  assert.equal(result, 2,
    "it still returns the computed new box (box 1 + 1 = 2), it just can't persist it");
  // Nothing persisted: a re-read still reports the default box 1.
  assert.equal(LBLeitner.getBox("sq/lesson-1", { prompt: 7 }), 1,
    "no store -> the promotion did not stick (reads the default again)");
});

test("no LBStore: nextCard still picks a card and excludes the current one (no throw)", () => {
  const { LBLeitner } = loadLeitnerNoStore();
  const deck = deckOf([1, 2, 3]);
  const current = deck[0];
  for (let i = 0; i < 500; i++) {
    let picked;
    assert.doesNotThrow(() => { picked = LBLeitner.nextCard("sq/lesson-1", deck, current); },
      "nextCard must not throw without a store");
    assert.ok(picked, "a card is always returned");
    assert.notEqual(picked.prompt, current.prompt, "current card still excluded without a store");
  }
});

test("blocked storage (throwOnSet): recordResult does not throw; reads serve the mirror this session", () => {
  const { LBLeitner } = loadLeitner({ throwOnSet: true });
  let result;
  assert.doesNotThrow(() => { result = LBLeitner.recordResult("sq/lesson-1", { prompt: 7 }, true); },
    "a blocked write must not throw");
  assert.equal(result, 2, "the new box is still computed and returned (box 2)");
  // LBStore's in-memory mirror still serves the value within this session.
  assert.equal(LBLeitner.getBox("sq/lesson-1", { prompt: 7 }), 2,
    "the in-memory mirror serves the box this session even when persistence is blocked");
});

/* --------------------------- engine seam (light) -------------------------- */

test("engine seam REGRESSION: no LBPrefs/LBLeitner -> engine uses the random path (does not throw)", () => {
  // This is exactly the existing engine-test environment: window has neither
  // LBPrefs nor LBLeitner, so resolvedOrderSource() returns "random" and the
  // original randomCard() path runs. A multi-card lesson must start cleanly and
  // render a card (proving the random provider drove nextCard).
  const { engine, elements } = makeEngineSandbox(null);
  assert.doesNotThrow(
    () => engine.start({
      id: "sq/lesson-1", title: "X",
      cards: [{ prompt: 1, answer: "një" }, { prompt: 2, answer: "dy" }],
    }),
    "with no order globals the engine must start via the random path"
  );
  assert.ok(["1", "2"].includes(String(elements.number.textContent)),
    "the random path rendered one of the deck's cards");
});

test("engine seam: order='random' (LBPrefs present, LBLeitner present) still uses the random path", () => {
  // LBPrefs reports "random" -> the engine must NOT consult LBLeitner. We give a
  // LBLeitner stub whose nextCard throws; if the engine called it, start() would
  // surface that. It must not.
  const stubs = {
    LBPrefs: { getOrder: () => "random" },
    LBLeitner: { nextCard: () => { throw new Error("leitner must not be called for random order"); } },
  };
  const { engine, elements } = makeEngineSandbox(stubs);
  assert.doesNotThrow(
    () => engine.start({
      id: "sq/lesson-1", title: "X",
      cards: [{ prompt: 1, answer: "një" }, { prompt: 2, answer: "dy" }],
    }),
    "order=random must drive the random path, never LBLeitner"
  );
  assert.ok(["1", "2"].includes(String(elements.number.textContent)),
    "a card rendered via the random path");
});

test("engine seam: order='leitner' with LBLeitner present routes the pick through LBLeitner", () => {
  // Prove the seam actually delegates when order is "leitner": a stub LBLeitner
  // always returns the second card; the engine must render THAT card.
  let called = 0;
  const stubs = {
    LBPrefs: { getOrder: () => "leitner" },
    LBLeitner: {
      nextCard: (lessonId, deck) => { called++; return deck[1]; },
    },
  };
  const { engine, elements } = makeEngineSandbox(stubs);
  engine.start({
    id: "sq/lesson-1", title: "X",
    cards: [{ prompt: 1, answer: "një" }, { prompt: 2, answer: "dy" }],
  });
  assert.ok(called > 0, "the engine consulted LBLeitner.nextCard for order=leitner");
  assert.equal(String(elements.number.textContent), "2",
    "the engine rendered the card LBLeitner chose (the second card)");
});
