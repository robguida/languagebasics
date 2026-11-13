/* LanguageBasics daily-practice streak (LB-13).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBStreak. Pure logic, DOM-free, so it is unit-testable in a
 * node:vm sandbox directly (same convention as store.js / prefs.js / leitner.js /
 * game.js / mastery.js). It reads/writes streak state THROUGH window.LBStore
 * (LB-8) under the `languagebasics.streak` namespace.
 *
 * DESIGN ETHIC: a CALM streak. It quietly counts days practiced in a row. There
 * is NO nagging, NO guilt, NO loss warnings, NO punishment. A missed day simply
 * resets the count to 1 on the next practice — the data layer carries no negative
 * messaging. The display layer (index.html) keeps the same calm tone.
 *
 * Stored shape under languagebasics.streak (LBStore stamps the v field, not us):
 *   {
 *     v: 1,
 *     current:       3,            // days practiced in a row, through lastActiveDay
 *     longest:       7,            // best run ever
 *     lastActiveDay: "2026-06-20", // LOCAL date STRING "YYYY-MM-DD", NOT a timestamp
 *     goalPerDay:    1             // reserved; one practice/day counts the day
 *   }
 *
 * WHY A DATE STRING, NOT A TIMESTAMP: streaks are about CALENDAR days in the
 * user's own locale. Storing a "YYYY-MM-DD" local-date string (not an epoch ms)
 * sidesteps timezone and DST math entirely — two practices are "the same day" iff
 * their local date strings match, and "consecutive" iff their dates differ by one
 * calendar day. All comparison is done on the date strings via a noon-anchored
 * Date (see dayDiff) so a DST transition can never shift the day count.
 *
 * TESTABILITY: every pure function takes an injectable "today" ("YYYY-MM-DD")
 * so tests are fully deterministic. todayString() supplies the browser's local
 * date as the default the app uses; tests pass fixed dates instead.
 *
 * GRACEFUL DEGRADATION: every LBStore touch is guarded. A missing or blocked
 * LBStore means reads return a fresh empty state and writes are no-ops, so
 * markActive() never throws and the getters keep working.
 */
(function () {
  "use strict";

  var STORE_KEY = "languagebasics.streak";

  // The default daily goal: one practice marks the day as done. Stored so a
  // future ticket could raise it without a migration; nothing varies it yet.
  var DEFAULT_GOAL_PER_DAY = 1;

  /* Is LBStore present this session? A missing store (streak unit tests without
   * store.js, or a blocked localStorage) means "no persisted streak" — reads
   * return a fresh state, writes are no-ops. Never throws. */
  function hasStore() {
    return !!(typeof window !== "undefined" && window.LBStore &&
      typeof window.LBStore.get === "function" &&
      typeof window.LBStore.set === "function");
  }

  /* Zero-pad a number to 2 digits ("YYYY-MM-DD" month/day fields). */
  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* todayString() -> the browser's LOCAL date as "YYYY-MM-DD". This is the only
   * place the real clock is read; every pure function below accepts a date string
   * so tests stay deterministic. Never throws — falls back to "" if Date is
   * somehow unavailable (the callers treat "" as "no usable today"). */
  function todayString() {
    try {
      var d = new Date();
      return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    } catch (err) {
      return "";
    }
  }

  /* isValidDay(s) -> true for a well-formed "YYYY-MM-DD" string. Cheap shape
   * check; we don't validate calendar bounds (Date does that in dayDiff). */
  function isValidDay(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  /* dayDiff(fromDay, toDay) -> whole calendar days from fromDay to toDay
   * (toDay - fromDay), or null if either is not a valid date string.
   *   0  => same calendar day
   *   1  => toDay is the day immediately after fromDay
   *  >1  => a gap (one or more missed days)
   *  <0  => toDay is before fromDay (clock moved back / bad data)
   *
   * Both dates are anchored at LOCAL noon before differencing so a daylight-
   * saving transition (a 23- or 25-hour day) can never round the difference to
   * the wrong whole number of days. Never throws. */
  function dayDiff(fromDay, toDay) {
    if (!isValidDay(fromDay) || !isValidDay(toDay)) return null;
    try {
      var a = fromDay.split("-");
      var b = toDay.split("-");
      // Local-noon anchor: Date(year, monthIndex, day, 12).
      var from = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]), 12, 0, 0, 0);
      var to = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]), 12, 0, 0, 0);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
      var ms = to.getTime() - from.getTime();
      return Math.round(ms / 86400000); // 86400000 ms per day
    } catch (err) {
      return null;
    }
  }

  /* A fresh, never-practiced streak state. */
  function emptyState() {
    return {
      current: 0,
      longest: 0,
      lastActiveDay: null,
      goalPerDay: DEFAULT_GOAL_PER_DAY
    };
  }

  /* Coerce a non-negative integer, else fallback. Never throws. */
  function toCount(n, fallback) {
    var v = Number(n);
    if (!isFinite(v) || v < 0) return fallback;
    return Math.floor(v);
  }

  /* Read the persisted streak state, normalized to a safe shape. A missing store
   * or absent/invalid record yields emptyState(). Never throws. */
  function readState() {
    if (!hasStore()) return emptyState();
    var obj = null;
    try {
      obj = window.LBStore.get(STORE_KEY, null);
    } catch (err) {
      obj = null; // any read failure => treat as empty, never abort the caller
    }
    if (obj == null || typeof obj !== "object") return emptyState();
    var s = emptyState();
    s.current = toCount(obj.current, 0);
    s.longest = toCount(obj.longest, 0);
    s.lastActiveDay = isValidDay(obj.lastActiveDay) ? obj.lastActiveDay : null;
    s.goalPerDay = toCount(obj.goalPerDay, DEFAULT_GOAL_PER_DAY) || DEFAULT_GOAL_PER_DAY;
    // longest can never be below current.
    if (s.longest < s.current) s.longest = s.current;
    return s;
  }

  /* Persist a streak state. No-op (returns false) when LBStore is missing.
   * Never throws — a persist failure must not abort the practice that triggered
   * it (the day still happened). */
  function writeState(state) {
    if (!hasStore()) return false;
    try {
      // LBStore stamps v:VERSION itself; pass the fields through.
      return window.LBStore.set(STORE_KEY, {
        current: state.current,
        longest: state.longest,
        lastActiveDay: state.lastActiveDay,
        goalPerDay: state.goalPerDay
      });
    } catch (err) {
      return false;
    }
  }

  /* markActive(today) — record that the user practiced on `today`.
   *
   * `today` is an injectable "YYYY-MM-DD" (defaults to the local date). Rules:
   *   - today === lastActiveDay      -> already counted today; no change.
   *   - today is the day immediately after lastActiveDay (diff === 1)
   *                                  -> current += 1 (the streak continues).
   *   - any other case (no prior day, a gap > 1 day, or unusable/backward data)
   *                                  -> current = 1 (a fresh streak starts today).
   * Then longest = max(longest, current), lastActiveDay = today, and persist.
   *
   * GENTLE BY DESIGN: a missed day is not punished — it simply resets to 1 here,
   * with no negative state recorded. Returns the resulting state. Never throws.
   * If `today` is unusable (no clock), it returns the unchanged stored state. */
  function markActive(today) {
    if (today === undefined) today = todayString();
    var state = readState();
    if (!isValidDay(today)) return state; // no usable "today" — leave state as-is

    var diff = dayDiff(state.lastActiveDay, today); // null when no prior day

    if (diff === 0) {
      // Already practiced today — idempotent, nothing to change.
      return state;
    } else if (diff === 1) {
      // Consecutive calendar day — the streak grows.
      state.current = state.current + 1;
    } else {
      // No prior day, a gap of more than one day, or backward/garbled data:
      // start a fresh one-day streak. (No guilt — just begin again.)
      state.current = 1;
    }

    if (state.current > state.longest) state.longest = state.current;
    state.lastActiveDay = today;
    writeState(state);
    return state;
  }

  /* getState(today) — a READ-ONLY view of the streak for display, accounting for
   * `today` WITHOUT mutating storage (only markActive mutates).
   *
   * `today` is an injectable "YYYY-MM-DD" (defaults to the local date). The
   * displayed `current` reflects whether the streak is still ALIVE relative to
   * today:
   *   - last active day is today or yesterday (diff 0 or 1) -> streak alive;
   *     show the stored `current`.
   *   - a bigger gap, no prior day, or unusable data        -> streak lapsed;
   *     show current = 0 (but storage is untouched; markActive will reset to 1).
   *
   * Returns:
   *   {
   *     current:    displayed current run (0 if lapsed),
   *     longest:    best run ever (never reduced by a read),
   *     lastActiveDay,
   *     goalPerDay,
   *     goalMetToday: true iff lastActiveDay === today (today already counts),
   *     alive:        true iff the streak is still live relative to today
   *   }
   * Never throws. */
  function getState(today) {
    if (today === undefined) today = todayString();
    var state = readState();
    var diff = dayDiff(state.lastActiveDay, today);

    // Alive when the last active day is today (0) or yesterday (1).
    var alive = (diff === 0 || diff === 1);
    var goalMetToday = (diff === 0);

    return {
      current: alive ? state.current : 0,
      longest: state.longest,
      lastActiveDay: state.lastActiveDay,
      goalPerDay: state.goalPerDay,
      goalMetToday: goalMetToday,
      alive: alive
    };
  }

  /* getCurrent(today) -> the displayed current run (0 if lapsed). Convenience
   * getter over getState. Never throws. */
  function getCurrent(today) {
    return getState(today).current;
  }

  /* getLongest() -> the best run ever recorded. Never throws. */
  function getLongest() {
    return readState().longest;
  }

  /* isGoalMetToday(today) -> true iff today already counts toward the streak
   * (the user has practiced today). Never throws. */
  function isGoalMetToday(today) {
    return getState(today).goalMetToday;
  }

  // Public surface.
  window.LBStreak = {
    markActive: markActive,
    getState: getState,
    getCurrent: getCurrent,
    getLongest: getLongest,
    isGoalMetToday: isGoalMetToday,
    todayString: todayString,
    dayDiff: dayDiff,
    isValidDay: isValidDay,
    DEFAULT_GOAL_PER_DAY: DEFAULT_GOAL_PER_DAY,
    STORE_KEY: STORE_KEY
  };
})();
