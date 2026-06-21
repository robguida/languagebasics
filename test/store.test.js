/* LB-8: window.LBStore — the versioned, JSON-safe localStorage wrapper.
 *
 * Run:  node --test
 *
 * store.js is an IIFE that, at load, probes window.localStorage and assigns
 * window.LBStore. We load it inside a fresh node:vm sandbox per case (so no
 * state leaks between tests) using the reusable localStorage shim — the same
 * minimal-shim approach as test/helpers/load-lesson.js. Built-ins only:
 * node:test, node:assert, node:fs, node:path, node:vm.
 *
 * Coverage:
 *   - public surface: VERSION, KEYS, persistent
 *   - round-trip get/set for each of the 4 namespace keys
 *   - key isolation (writing one key doesn't bleed into another)
 *   - unknown key: get -> fallback, set -> false
 *   - corrupt JSON -> fallback, never throws
 *   - version mismatch (v:2 / no v) -> fallback
 *   - non-object / null value -> set returns false
 *   - throwOnSet (quota / Safari-private / blocked): set -> false, no throw,
 *     get still serves the value from the in-memory mirror this session
 *   - set does not mutate the caller's object
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadStore, makeLocalStorage } = require("./helpers/local-storage-shim.js");

const KEYS = ["lb.prefs", "lb.leitner", "lb.mastery", "lb.streak"];

/* ----------------------------- public surface ----------------------------- */

test("LBStore: loads and exposes the public surface", () => {
  const { LBStore } = loadStore();
  assert.ok(LBStore, "window.LBStore must be defined after load");
  assert.equal(typeof LBStore.get, "function", "get must be a function");
  assert.equal(typeof LBStore.set, "function", "set must be a function");
  assert.equal(LBStore.VERSION, 1, "VERSION must be 1");
  // LBStore.KEYS is an array from the vm realm, so prototype-strict deepEqual
  // would fail on the realm boundary; compare contents via join instead.
  assert.ok(Array.isArray(LBStore.KEYS), "KEYS must be an array");
  assert.equal(LBStore.KEYS.join(","), KEYS.join(","), "KEYS must be the 4 namespace keys in order");
});

test("LBStore: persistent is true when localStorage is usable", () => {
  const { LBStore } = loadStore();
  assert.equal(LBStore.persistent, true, "real shim storage => persistent true");
});

/* --------------------------- round-trip per key --------------------------- */

for (const key of KEYS) {
  test(`LBStore: round-trips get/set for ${key}`, () => {
    const { LBStore } = loadStore();
    const value = { sample: key, n: 42, nested: { ok: true } };

    const wrote = LBStore.set(key, value);
    assert.equal(wrote, true, `${key}: set should reach localStorage (return true)`);

    const got = LBStore.get(key);
    assert.ok(got, `${key}: get should return the stored object`);
    assert.equal(got.sample, key, `${key}: payload field round-trips`);
    assert.equal(got.n, 42, `${key}: number field round-trips`);
    // NOTE: got is parsed inside the vm realm, so its Object.prototype differs
    // from this file's. assert.deepEqual is prototype-strict and would fail on
    // the realm boundary alone — compare the nested shape by its own fields,
    // which is what actually matters for the round-trip.
    assert.ok(got.nested && typeof got.nested === "object", `${key}: nested survives`);
    assert.equal(got.nested.ok, true, `${key}: nested field round-trips`);
    assert.equal(got.v, LBStore.VERSION, `${key}: stored record carries v:VERSION`);
  });
}

/* ------------------------------ key isolation ----------------------------- */

test("LBStore: keys are isolated — writing lb.prefs does not affect lb.mastery", () => {
  const { LBStore } = loadStore();

  LBStore.set("lb.prefs", { revealMs: 7000 });
  // lb.mastery was never written.
  assert.equal(LBStore.get("lb.mastery"), null, "unwritten key returns fallback (null)");
  assert.equal(LBStore.get("lb.mastery", "DEFAULT"), "DEFAULT", "unwritten key returns provided fallback");

  // Writing a second key must not disturb the first.
  LBStore.set("lb.mastery", { scored: 3 });
  assert.equal(LBStore.get("lb.prefs").revealMs, 7000, "lb.prefs survived the lb.mastery write");
  assert.equal(LBStore.get("lb.mastery").scored, 3, "lb.mastery holds its own value");
});

/* ------------------------------ unknown key ------------------------------- */

test("LBStore: unknown key -> get returns fallback, set returns false", () => {
  const { LBStore } = loadStore();

  assert.equal(LBStore.get("lb.nope"), null, "unknown key get -> default null fallback");
  assert.equal(LBStore.get("lb.nope", 99), 99, "unknown key get -> provided fallback");
  assert.equal(LBStore.set("lb.nope", { a: 1 }), false, "unknown key set -> false");
});

/* ----------------------------- corrupt JSON ------------------------------- */

test("LBStore: corrupt JSON -> get returns fallback and does NOT throw", () => {
  const { LBStore, storage } = loadStore();

  // Plant raw, unparseable bytes directly under a valid key.
  storage.seedRaw("lb.prefs", "{not valid json:::");

  let got;
  assert.doesNotThrow(() => {
    got = LBStore.get("lb.prefs", "FALLBACK");
  }, "corrupt JSON must never throw out of get");
  assert.equal(got, "FALLBACK", "corrupt JSON returns the fallback");
});

/* ---------------------------- version mismatch ---------------------------- */

test("LBStore: version mismatch (v:2) -> fallback", () => {
  const { LBStore, storage } = loadStore();
  storage.seedRaw("lb.streak", JSON.stringify({ count: 5, v: 2 }));
  assert.equal(LBStore.get("lb.streak", "OLD"), "OLD", "v:2 record is not trusted -> fallback");
});

test("LBStore: missing version (no v) -> fallback", () => {
  const { LBStore, storage } = loadStore();
  storage.seedRaw("lb.streak", JSON.stringify({ count: 5 }));
  assert.equal(LBStore.get("lb.streak", "OLD"), "OLD", "unversioned record is not trusted -> fallback");
});

/* ----------------------------- bad set input ------------------------------ */

test("LBStore: non-object / null values -> set returns false", () => {
  const { LBStore } = loadStore();
  assert.equal(LBStore.set("lb.prefs", null), false, "null -> false");
  assert.equal(LBStore.set("lb.prefs", undefined), false, "undefined -> false");
  assert.equal(LBStore.set("lb.prefs", 5), false, "number -> false");
  assert.equal(LBStore.set("lb.prefs", "string"), false, "string -> false");
});

/* ------------------ graceful degradation: storage throws ------------------ */

test("LBStore: blocked storage (throwOnSet) -> persistent false, no throw at load", () => {
  // Init probe's setItem throws -> backend detected as unavailable.
  let result;
  assert.doesNotThrow(() => {
    result = loadStore({ throwOnSet: true });
  }, "a throwing localStorage must not throw out of store.js load");
  assert.equal(result.LBStore.persistent, false, "blocked storage => persistent false");
});

test("LBStore: blocked storage -> set returns false but in-memory mirror still serves get this session", () => {
  const { LBStore } = loadStore({ throwOnSet: true });

  let wrote;
  assert.doesNotThrow(() => {
    wrote = LBStore.set("lb.leitner", { box: 3, due: 12 });
  }, "set must not throw even when storage is blocked");
  assert.equal(wrote, false, "blocked write -> set returns false (memory only)");

  // Within the same session the in-memory mirror must still return the value.
  const got = LBStore.get("lb.leitner");
  assert.ok(got, "get serves the value from the in-memory mirror");
  assert.equal(got.box, 3, "mirrored payload round-trips");
  assert.equal(got.due, 12, "mirrored payload round-trips");
  assert.equal(got.v, LBStore.VERSION, "mirrored record carries v:VERSION");
});

test("LBStore: backend that starts throwing mid-session -> set returns false, no throw (documents read-shadowing limit)", () => {
  // Start with a working backend, then flip it to failing after load. This
  // documents store.js's ACTUAL contract boundary:
  //   - When a backend exists, get() reads the BACKEND first and only consults
  //     the in-memory mirror if the backend READ throws.
  //   - throwOnSet makes only WRITES throw; reads still succeed.
  //   - So after a failed mid-session write, get() returns the last value the
  //     backend actually persisted, NOT the newer memory-only value.
  // The "mirror serves the value this session" guarantee in the ticket is
  // scoped to the init-blocked case (no backend at all) — covered by the test
  // above. This test pins the mid-session behavior so a future change to the
  // read order is a deliberate, visible decision rather than a silent break.
  const storage = makeLocalStorage();
  const vm = require("node:vm");
  const fs = require("node:fs");
  const { STORE_SRC } = require("./helpers/local-storage-shim.js");
  const windowShim = { localStorage: storage };
  const sandbox = { window: windowShim, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(STORE_SRC, "utf8"), sandbox, { filename: STORE_SRC });
  const LBStore = windowShim.LBStore;

  assert.equal(LBStore.persistent, true, "backend healthy at init -> persistent true");
  assert.equal(LBStore.set("lb.streak", { count: 1 }), true, "healthy write -> true");

  // Now the backend starts throwing on writes (e.g. quota hit mid-session).
  storage.throwOnSet = true;
  let wrote;
  assert.doesNotThrow(() => {
    wrote = LBStore.set("lb.streak", { count: 2 });
  }, "set must not throw when backend fails mid-session");
  assert.equal(wrote, false, "failed mid-session write -> false");

  // Documented behavior: backend reads still work, so get() returns the last
  // value the backend persisted (count:1), shadowing the memory mirror's
  // count:2. If a future ticket wants memory to win here, that's a code change
  // to rawGet() + an update to this assertion.
  assert.equal(
    LBStore.get("lb.streak").count,
    1,
    "backend read shadows the memory mirror after a failed mid-session write"
  );
});

/* ------------------------ no mutation of caller object -------------------- */

test("LBStore: set does not mutate the caller's object", () => {
  const { LBStore } = loadStore();

  const input = { revealMs: 5000, mode: "leitner" };
  LBStore.set("lb.prefs", input);

  assert.equal("v" in input, false, "caller object must NOT gain a v field");
  assert.deepEqual(
    input,
    { revealMs: 5000, mode: "leitner" },
    "caller object is unchanged after set (shallow-clone before stamping)"
  );
});
