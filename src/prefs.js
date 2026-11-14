/* LanguageBasics per-lesson preferences (LB-9, trimmed in LB-36).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBPrefs. A tiny, lesson-keyed read/write layer over
 * window.LBStore for the `languagebasics.prefs` namespace. The settings modal
 * writes through it; the engine reads through it at deck/card build.
 *
 * Stored shape under languagebasics.prefs:
 *   {
 *     v: 1,                                  // stamped by LBStore, not us
 *     lessons: {
 *       "sq/lesson-1": { revealMs: 5000 },
 *       "sq/alphabet-all": { revealMs: 10000 }
 *     }
 *   }
 *
 * LB-36: the reveal timer is the ONLY setting. The card-order (Random/Leitner)
 * and the global quiz-count settings were retired with the old score mode; a
 * test is always min(10, lesson card count) cards.
 *
 * Units: revealMs is stored in MILLISECONDS (matches the engine + lesson data).
 * The UI shows/edits seconds and converts at the boundary — not here.
 *
 * CRITICAL CONTRACT (keeps the engine tests green): when there is NO stored
 * value for a lesson, getRevealMs() returns null. The engine treats null as
 * "no override" and falls back to the lesson's hardcoded revealMs / default.
 * A missing or blocked LBStore also yields null.
 */
(function () {
  "use strict";

  var STORE_KEY = "languagebasics.prefs";

  // Defaults the UI uses when a lesson has never been configured. NOT applied
  // by the getters (which return null for "unset") — the engine owns the real
  // fallback. The modal reads these to seed its controls.
  var DEFAULTS = {
    revealMs: 5000      // 5s
  };

  var MIN_SECONDS = 1;
  var MAX_SECONDS = 20;

  /* Is LBStore present this session? Never throws. */
  function hasStore() {
    return !!(typeof window !== "undefined" && window.LBStore &&
      typeof window.LBStore.get === "function" &&
      typeof window.LBStore.set === "function");
  }

  /* Read the whole prefs object, or a safe empty shape. Never throws. */
  function readAll() {
    if (!hasStore()) return { lessons: {} };
    var obj = null;
    try {
      obj = window.LBStore.get(STORE_KEY, null);
    } catch (err) {
      obj = null;
    }
    if (obj == null || typeof obj !== "object" || typeof obj.lessons !== "object" ||
        obj.lessons == null || Array.isArray(obj.lessons)) {
      return { lessons: {} };
    }
    return obj;
  }

  /* The stored prefs object for one lesson, or null if none. Never throws. */
  function getLesson(lessonId) {
    // "__proto__" is never a lesson key (it would swap the map's prototype).
    if (!lessonId || lessonId === "__proto__") return null;
    var all = readAll();
    if (!Object.prototype.hasOwnProperty.call(all.lessons, lessonId)) return null;
    var entry = all.lessons[lessonId];
    return (entry && typeof entry === "object") ? entry : null;
  }

  /* getRevealMs(lessonId) -> stored override in ms, or null if unset/invalid. */
  function getRevealMs(lessonId) {
    var entry = getLesson(lessonId);
    if (!entry) return null;
    var ms = entry.revealMs;
    if (typeof ms !== "number" || !isFinite(ms) || ms <= 0) return null;
    return ms;
  }

  /* Merge a partial patch ({ revealMs? }) into one lesson's prefs and persist.
   * No-op (returns false) when LBStore is missing. Returns whatever
   * LBStore.set returns (true = reached localStorage, false = memory only). */
  function setLesson(lessonId, patch) {
    if (!lessonId || lessonId === "__proto__" || !patch || typeof patch !== "object") return false;
    if (!hasStore()) return false;

    var all = readAll();
    var prev = Object.prototype.hasOwnProperty.call(all.lessons, lessonId)
      ? all.lessons[lessonId] : null;
    var entry = {};
    if (prev && typeof prev === "object" && typeof prev.revealMs === "number" &&
        isFinite(prev.revealMs) && prev.revealMs > 0) {
      entry.revealMs = prev.revealMs;
    }

    if (patch.revealMs != null && typeof patch.revealMs === "number" &&
        isFinite(patch.revealMs) && patch.revealMs > 0) {
      entry.revealMs = patch.revealMs;
    }

    all.lessons[lessonId] = entry;
    try {
      // LBStore stamps v:VERSION itself; pass the lessons map through.
      return window.LBStore.set(STORE_KEY, { lessons: all.lessons });
    } catch (err) {
      return false;
    }
  }

  function setRevealMs(lessonId, ms) {
    return setLesson(lessonId, { revealMs: ms });
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
    setRevealMs: setRevealMs,
    setLesson: setLesson,
    getLesson: getLesson,
    clampSeconds: clampSeconds,
    DEFAULTS: DEFAULTS,
    MIN_SECONDS: MIN_SECONDS,
    MAX_SECONDS: MAX_SECONDS,
    STORE_KEY: STORE_KEY
  };
})();
