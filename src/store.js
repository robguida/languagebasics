/* LanguageBasics storage foundation (LB-8).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBStore. A tiny, JSON-safe, version-tagged wrapper over
 * localStorage that the personalize/gamify tickets read and write through.
 *
 * Namespaced top-level localStorage keys the app uses (LB-36: one prefix,
 * "languagebasics.", so nothing collides with another app on a shared origin):
 *   languagebasics.prefs    -> user preferences (per-lesson reveal timer)
 *   languagebasics.progress -> per-card "knew / not yet" ratings + personal best
 *   languagebasics.streak   -> streak counters
 *
 * LB-36: old "lb.*" keys are NEVER read, written or deleted. They may belong to
 * another app on the same origin, and the old mastery data was scored by
 * reveal speed, so it is not carried over. The KEYS whitelist below rejects
 * anything that is not one of the three keys above.
 *
 * Design notes:
 *  - VERSIONING: every stored object carries "v": 1. On read, a missing or
 *    mismatched version => return the fallback (we don't trust a shape we
 *    can't vouch for). A real migrator is a future concern; this is just the
 *    escape hatch so a future store.js can detect old data without throwing.
 *  - JSON-SAFE: set() stringifies, get() parses. Corrupt/unparseable JSON =>
 *    fallback, never a throw.
 *  - GRACEFUL DEGRADATION (continue-on-error rule): EVERY localStorage touch
 *    is wrapped in try/catch. If localStorage is missing, blocked (Safari
 *    private mode), or quota-exceeded, the module falls back to an in-memory
 *    object so the app keeps running — it just won't persist this session.
 */
(function () {
  "use strict";

  // Current storage schema version. Bump only alongside a real migrator.
  var VERSION = 1;

  // LB-36: the one key prefix. Every key the app stores starts with it.
  var PREFIX = "languagebasics.";

  // The allowed namespace keys. Kept as a lookup so a typo'd key is obvious.
  var KEYS = {};
  KEYS[PREFIX + "prefs"] = true;
  KEYS[PREFIX + "progress"] = true;
  KEYS[PREFIX + "streak"] = true;

  // Own-property check, so a key like "toString" can never pass the whitelist.
  function isKnownKey(key) {
    return typeof key === "string" && Object.prototype.hasOwnProperty.call(KEYS, key);
  }

  // In-memory fallback bucket. Used for the whole session when localStorage
  // is unavailable, and also as a best-effort mirror so a get() right after a
  // failed-to-persist set() still returns the value within the same session.
  var memory = {};

  /* Detect a usable localStorage ONCE at init. We don't just check for the
   * object's presence — Safari private mode exposes localStorage but throws
   * on write — so we probe with a real set/remove inside try/catch. */
  var backend = (function detectBackend() {
    try {
      var probe = "__lbstore_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (err) {
      // No localStorage, blocked, or quota-locked — degrade to memory only.
      console.warn("[store] localStorage unavailable; using in-memory fallback", err);
      return null;
    }
  })();

  // Whether persistence is actually available this session (exposed for callers
  // that may want to warn the user, e.g. "settings won't be saved").
  var persistent = backend !== null;

  /* Low-level read of a raw string for a key, from whichever backend we have.
   * Never throws; on any failure returns null. */
  function rawGet(key) {
    if (backend) {
      try {
        return backend.getItem(key);
      } catch (err) {
        console.warn("[store] read failed for " + key + "; using memory", err);
      }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  /* Low-level write of a raw string for a key. Always mirrors to memory so a
   * subsequent get() in the same session works even if the backend write
   * failed (quota). Never throws; returns true if it reached the backend. */
  function rawSet(key, str) {
    memory[key] = str;
    if (backend) {
      try {
        backend.setItem(key, str);
        return true;
      } catch (err) {
        console.warn("[store] write failed for " + key + "; kept in memory only", err);
      }
    }
    return false;
  }

  /* get(key, fallback)
   * Returns the parsed, version-checked object stored at `key`, or `fallback`.
   * Returns `fallback` (never throws) when:
   *   - key is not a known namespace
   *   - nothing is stored
   *   - the stored value is unparseable JSON
   *   - the parsed value's "v" is missing or != current VERSION
   * `fallback` defaults to null when omitted. */
  function get(key, fallback) {
    if (fallback === undefined) fallback = null;
    if (!isKnownKey(key)) {
      console.warn("[store] get: unknown key '" + key + "'");
      return fallback;
    }

    var str = rawGet(key);
    if (str == null) return fallback;

    var parsed;
    try {
      parsed = JSON.parse(str);
    } catch (err) {
      // Corrupt / partially-written value — don't trust it, don't throw.
      console.warn("[store] corrupt JSON at " + key + "; returning fallback", err);
      return fallback;
    }

    if (parsed == null || typeof parsed !== "object") return fallback;

    // Version gate: a missing or mismatched version means a shape we can't
    // vouch for (older/newer schema). Future tickets add a migrator here.
    if (parsed.v !== VERSION) {
      console.warn("[store] version mismatch at " + key +
        " (got " + parsed.v + ", want " + VERSION + "); returning fallback");
      return fallback;
    }

    return parsed;
  }

  /* set(key, value)
   * JSON-stringifies `value` (an object) with the current "v" stamped on, and
   * persists it under `key`. Never throws. Returns true if it reached
   * localStorage, false if it only landed in the in-memory fallback (or the
   * call was a no-op for a bad key).
   *
   * The stored object always carries v: VERSION. If the caller's value already
   * has a `v`, ours wins — the store owns the version field. */
  function set(key, value) {
    if (!isKnownKey(key)) {
      console.warn("[store] set: unknown key '" + key + "'");
      return false;
    }
    if (value == null || typeof value !== "object") {
      console.warn("[store] set: value must be an object for " + key, value);
      return false;
    }

    // Shallow-clone so we don't mutate the caller's object, then stamp version.
    var record = {};
    for (var k in value) {
      if (Object.prototype.hasOwnProperty.call(value, k)) record[k] = value[k];
    }
    record.v = VERSION;

    var str;
    try {
      str = JSON.stringify(record);
    } catch (err) {
      // Circular ref / non-serializable value — fail soft, don't throw.
      console.warn("[store] could not stringify value for " + key, err);
      return false;
    }

    return rawSet(key, str);
  }

  // Public surface. Small and obvious by design.
  window.LBStore = {
    get: get,
    set: set,
    VERSION: VERSION,
    PREFIX: PREFIX,
    persistent: persistent,
    // The known namespace keys, exposed read-only-ish for callers/tests.
    KEYS: Object.keys(KEYS)
  };
})();
