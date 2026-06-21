/* Test helper: a reusable in-memory localStorage shim for the vm sandbox.
 *
 * Built once for LB-8 (window.LBStore) and reused by later personalize/gamify
 * tickets (LB-9 … LB-13) that also persist through localStorage. Mirrors the
 * patterns in load-lesson.js: zero npm deps, Node built-ins only, and a plain
 * factory you drop onto a `window` shim before running src/ code in a vm
 * context.
 *
 * What it provides:
 *  - A spec-shaped Storage: getItem / setItem / removeItem / clear / key /
 *    length — enough that store.js's probe (setItem + removeItem) and reads
 *    behave like a real browser localStorage.
 *  - throwOnSet mode: setItem throws (simulating quota-exceeded, Safari private
 *    mode, or otherwise-blocked storage). store.js detects this at its init
 *    probe and degrades to its in-memory fallback. Toggleable so a test can
 *    also make writes start failing partway through a session.
 *  - seedRaw(key, rawString): plant a raw, un-stamped string under a key so a
 *    test can hit the corrupt-JSON and version-mismatch read paths without
 *    going through store.set() (which would always stamp valid v:VERSION JSON).
 *
 * Usage in a test:
 *   const { makeLocalStorage, makeStoreSandbox, loadStore } =
 *     require("./helpers/local-storage-shim.js");
 *   const { LBStore, window, storage } = loadStore();          // happy path
 *   const blocked = loadStore({ throwOnSet: true });           // degraded path
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const STORE_SRC = path.resolve(__dirname, "..", "..", "src", "store.js");

/**
 * Build a standalone in-memory Storage object that quacks like localStorage.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.throwOnSet=false] when true, setItem throws a
 *        DOMException-like error (simulates quota-exceeded / blocked storage).
 * @returns {Storage-like} object with the Web Storage surface plus two test
 *        affordances: `throwOnSet` (mutable flag) and `seedRaw(key, raw)`.
 */
function makeLocalStorage(opts) {
  opts = opts || {};
  // Backing map kept off the public surface so it can't collide with a key
  // literally named "store" etc.
  const data = new Map();

  const storage = {
    // Mutable so a test can flip writes to failing mid-session.
    throwOnSet: !!opts.throwOnSet,

    getItem(key) {
      key = String(key);
      return data.has(key) ? data.get(key) : null;
    },

    setItem(key, value) {
      if (storage.throwOnSet) {
        // Shape mirrors a real browser quota error closely enough for code
        // that only ever try/catches around the call.
        const err = new Error("QuotaExceededError: setItem blocked (shim)");
        err.name = "QuotaExceededError";
        throw err;
      }
      data.set(String(key), String(value));
    },

    removeItem(key) {
      data.delete(String(key));
    },

    clear() {
      data.clear();
    },

    key(index) {
      const keys = Array.from(data.keys());
      return index >= 0 && index < keys.length ? keys[index] : null;
    },

    get length() {
      return data.size;
    },

    /* Test-only: plant a raw string under `key` WITHOUT going through setItem's
     * throwOnSet gate or any stamping. Lets a test seed corrupt JSON or a
     * wrong-version object so store.get() exercises its fallback paths. */
    seedRaw(key, raw) {
      data.set(String(key), String(raw));
    },
  };

  return storage;
}

/**
 * Build a vm sandbox shaped the way store.js expects: a `window` carrying the
 * localStorage shim, plus a quiet `console`. Same minimal-shim philosophy as
 * load-lesson.js.
 *
 * @param {object} [opts] forwarded to makeLocalStorage (e.g. { throwOnSet }).
 *        If opts.noStorage is true, window has NO localStorage at all (simulates
 *        an environment where the property is absent, not just throwing).
 * @returns {{ sandbox: object, window: object, storage: (Storage|undefined) }}
 */
function makeStoreSandbox(opts) {
  opts = opts || {};
  const warnings = [];
  const storage = opts.noStorage ? undefined : makeLocalStorage(opts);
  const windowShim = {};
  if (storage) windowShim.localStorage = storage;

  const sandbox = {
    window: windowShim,
    // Capture warns so tests can assert on degradation messaging if they want,
    // while keeping the runner output clean (load-lesson.js silences console).
    console: {
      warn() {
        warnings.push(Array.prototype.slice.call(arguments));
      },
      log() {},
    },
  };
  vm.createContext(sandbox);

  return { sandbox, window: windowShim, storage, warnings };
}

/**
 * Load src/store.js inside a fresh sandbox and return its public LBStore plus
 * the handles a test needs to drive and inspect it.
 *
 * @param {object} [opts] forwarded to makeStoreSandbox / makeLocalStorage:
 *        { throwOnSet?: boolean, noStorage?: boolean }
 * @returns {{ LBStore: object, window: object, storage: (Storage|undefined),
 *             warnings: Array }}
 */
function loadStore(opts) {
  const ctx = makeStoreSandbox(opts);
  const code = fs.readFileSync(STORE_SRC, "utf8");
  vm.runInContext(code, ctx.sandbox, { filename: STORE_SRC });
  return {
    LBStore: ctx.window.LBStore,
    window: ctx.window,
    storage: ctx.storage,
    warnings: ctx.warnings,
  };
}

module.exports = { makeLocalStorage, makeStoreSandbox, loadStore, STORE_SRC };
