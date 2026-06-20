/* LanguageBasics per-lesson preferences (LB-9).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBPrefs. A tiny, lesson-keyed read/write layer over
 * window.LBStore (LB-8) for the `lb.prefs` namespace. The settings modal
 * writes through it; the engine reads through it at deck/card build.
 *
 * Stored shape under lb.prefs:
 *   {
 *     v: 1,                                  // stamped by LBStore, not us
 *     lessons: {
 *       "sq/lesson-1": { revealMs: 5000, order: "random" },
 *       "sq/lesson-6": { revealMs: 10000, order: "leitner" }
 *     }
 *   }
 *
 * Units: revealMs is stored in MILLISECONDS (matches the engine + lesson data).
 * The UI shows/edits seconds and converts at the boundary — not here.
 *
 * CRITICAL CONTRACT (keeps the existing engine tests green): when there is NO
 * stored value for a lesson, getRevealMs() returns null and getOrder() returns
 * null. The engine treats null as "no override" and falls back to the lesson's
 * hardcoded revealMs / default exactly as before. A missing or blocked LBStore
 * also yields null, so the no-store path is identical to today's behavior.
 */
(function () {
  "use strict";

  var STORE_KEY = "lb.prefs";

  // Defaults the UI uses when a lesson has never been configured. These are NOT
  // applied by the getters (which return null for "unset") — the engine owns
  // the real fallback. The modal reads these to seed its controls.
  var DEFAULTS = {
    revealMs: 5000,     // 5s
    order: "random"     // "random" | "leitner"
  };

  var MIN_SECONDS = 1;
  var MAX_SECONDS = 20;

  /* Is LBStore present this session? A missing store (e.g. the engine unit
   * tests, or store.js not loaded) means "no overrides" — every getter returns
   * null so the engine keeps its original behavior. Never throws. */
  function hasStore() {
    return !!(typeof window !== "undefined" && window.LBStore &&
      typeof window.LBStore.get === "function" &&
      typeof window.LBStore.set === "function");
  }

  /* Read the whole lb.prefs object, or a safe empty shape. Never throws. */
  function readAll() {
    if (!hasStore()) return { lessons: {} };
    var obj = window.LBStore.get(STORE_KEY, null);
    if (obj == null || typeof obj !== "object" || typeof obj.lessons !== "object" || obj.lessons == null) {
      return { lessons: {} };
    }
    return obj;
  }

  /* The stored prefs object for one lesson, or null if none. Never throws. */
  function getLesson(lessonId) {
    if (!lessonId) return null;
    var all = readAll();
    var entry = all.lessons[lessonId];
    return (entry && typeof entry === "object") ? entry : null;
  }

  /* getRevealMs(lessonId) -> stored override in ms, or null if unset/invalid.
   * null is the "no override" signal the engine falls back from. */
  function getRevealMs(lessonId) {
    var entry = getLesson(lessonId);
    if (!entry) return null;
    var ms = entry.revealMs;
    if (typeof ms !== "number" || !isFinite(ms) || ms <= 0) return null;
    return ms;
  }

  /* getOrder(lessonId) -> "random" | "leitner", or null if unset/invalid. */
  function getOrder(lessonId) {
    var entry = getLesson(lessonId);
    if (!entry) return null;
    var order = entry.order;
    if (order !== "random" && order !== "leitner") return null;
    return order;
  }

  /* Merge a partial patch ({ revealMs?, order? }) into one lesson's prefs and
   * persist. No-op (returns false) when LBStore is missing. Returns whatever
   * LBStore.set returns (true = reached localStorage, false = memory only). */
  function setLesson(lessonId, patch) {
    if (!lessonId || !patch || typeof patch !== "object") return false;
    if (!hasStore()) return false;

    var all = readAll();
    var entry = (all.lessons[lessonId] && typeof all.lessons[lessonId] === "object")
      ? all.lessons[lessonId]
      : {};

    if (patch.revealMs != null && typeof patch.revealMs === "number" &&
        isFinite(patch.revealMs) && patch.revealMs > 0) {
      entry.revealMs = patch.revealMs;
    }
    if (patch.order === "random" || patch.order === "leitner") {
      entry.order = patch.order;
    }

    all.lessons[lessonId] = entry;
    // LBStore stamps v:VERSION itself; pass the lessons map through.
    return window.LBStore.set(STORE_KEY, { lessons: all.lessons });
  }

  function setRevealMs(lessonId, ms) {
    return setLesson(lessonId, { revealMs: ms });
  }

  function setOrder(lessonId, order) {
    return setLesson(lessonId, { order: order });
  }

  // Seconds <-> ms helpers + clamping for the UI boundary.
  function clampSeconds(sec) {
    sec = Math.round(Number(sec));
    if (!isFinite(sec)) sec = Math.round(DEFAULTS.revealMs / 1000);
    if (sec < MIN_SECONDS) sec = MIN_SECONDS;
    if (sec > MAX_SECONDS) sec = MAX_SECONDS;
    return sec;
  }

  window.LBPrefs = {
    getRevealMs: getRevealMs,
    getOrder: getOrder,
    setRevealMs: setRevealMs,
    setOrder: setOrder,
    setLesson: setLesson,
    getLesson: getLesson,
    clampSeconds: clampSeconds,
    DEFAULTS: DEFAULTS,
    MIN_SECONDS: MIN_SECONDS,
    MAX_SECONDS: MAX_SECONDS,
    STORE_KEY: STORE_KEY
  };
})();
