/* LB-13: window.LBStreak — calm daily-practice streak logic.
 *
 * Run:  node --test
 *
 * streak.js is an IIFE that, at load, assigns window.LBStreak and reads/writes
 * streak state THROUGH window.LBStore (LB-8) under the `languagebasics.streak` namespace.
 * To exercise the real persistence round-trip we load BOTH store.js and
 * streak.js into ONE shared node:vm sandbox backed by the reusable LB-8
 * localStorage shim — so LBStreak talks to a genuine LBStore over a genuine
 * (in-memory) Storage, exactly as in the browser. Same pattern as
 * store.test.js / prefs.test.js / leitner.test.js / game.test.js /
 * mastery.test.js.
 *
 * DETERMINISM: every date-aware function takes an injectable `today`
 * ("YYYY-MM-DD"). Every test below passes FIXED dates, never the real clock, so
 * the suite is reproducible day-to-day. The only place the wall clock is read is
 * todayString(), which is exercised separately (shape only, not a fixed value).
 *
 * Coverage:
 *   1. First practice ever -> current 1, longest 1, lastActiveDay set, goal met.
 *   2. Same-day repeat is idempotent (no double-count).
 *   3. Consecutive days grow the streak (3-in-a-row).
 *   4. A gap (>1 day) resets current to 1; longest is preserved.
 *   5. Longest survives a break (build 3, break, restart -> longest 3).
 *   6. Month-end + leap-day boundaries count as +1; non-consecutive resets.
 *   7. getState is READ-ONLY — a lapsed read shows current 0 but does NOT mutate
 *      storage (the stored value survives until markActive runs).
 *   8. goalMetToday true ONLY when lastActiveDay === today.
 *   9. Persistence round-trips the shim; with NO LBStore, calls don't throw and
 *      degrade sanely (fresh state, no-op writes).
 *  10. isValidDay rejects malformed strings without throwing.
 *
 * Built-ins only: node:test, node:assert, node:fs, node:path, node:vm. The
 * localStorage shim is the one built for LB-8 and reused here verbatim.
 *
 * MANUAL (not unit-tested here — see report): the live engine seam
 * (engine.start() -> markStreakActive() in a real browser session) and the
 * index.html streak readout rendering. Both are DOM/integration surfaces.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { makeStoreSandbox, STORE_SRC } = require("./helpers/local-storage-shim.js");

const STREAK_SRC_PATH = path.resolve(__dirname, "..", "src", "streak.js");
const STREAK_SRC = fs.readFileSync(STREAK_SRC_PATH, "utf8");

const KEY = "languagebasics.streak";

/* Load store.js + streak.js into one fresh sandbox so LBStreak round-trips
 * through a real LBStore over the LB-8 shim. Returns the live LBStreak/LBStore
 * plus the window + storage handles for inspection. */
function loadStreak(opts) {
  const ctx = makeStoreSandbox(opts);
  vm.runInContext(fs.readFileSync(STORE_SRC, "utf8"), ctx.sandbox, { filename: STORE_SRC });
  vm.runInContext(STREAK_SRC, ctx.sandbox, { filename: STREAK_SRC_PATH });
  return {
    LBStreak: ctx.window.LBStreak,
    LBStore: ctx.window.LBStore,
    window: ctx.window,
    storage: ctx.storage,
    warnings: ctx.warnings,
  };
}

/* Load streak.js with NO store.js present (window has no LBStore). This is the
 * engine-unit-test environment: reads return a fresh empty state, writes are
 * no-ops, nothing throws. */
function loadStreakNoStore() {
  const sandbox = { window: {}, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(STREAK_SRC, sandbox, { filename: STREAK_SRC_PATH });
  return { LBStreak: sandbox.window.LBStreak, window: sandbox.window };
}

/* Read the raw persisted languagebasics.streak record straight off the LBStore (the truth on
 * disk), independent of any LBStreak read path. Returns null if absent. */
function rawStored(LBStore) {
  return LBStore.get(KEY, null);
}

// ---------------------------------------------------------------------------
// 1. First practice ever.
// ---------------------------------------------------------------------------

test("first practice ever: current 1, longest 1, lastActiveDay set, goal met", () => {
  const { LBStreak } = loadStreak();

  const state = LBStreak.markActive("2026-06-20");

  assert.equal(state.current, 1, "a first-ever practice starts a 1-day streak");
  assert.equal(state.longest, 1, "longest tracks the first day too");
  assert.equal(state.lastActiveDay, "2026-06-20", "lastActiveDay is set to today");
  assert.equal(LBStreak.isGoalMetToday("2026-06-20"), true,
    "today's goal is met the moment it's marked");
  assert.equal(LBStreak.getCurrent("2026-06-20"), 1,
    "getCurrent on the same day reflects the live streak");
});

// ---------------------------------------------------------------------------
// 2. Same-day repeat is idempotent.
// ---------------------------------------------------------------------------

test("same-day repeat: marking the same date twice does NOT double-count", () => {
  const { LBStreak, LBStore } = loadStreak();

  LBStreak.markActive("2026-06-20");
  const state = LBStreak.markActive("2026-06-20"); // same day again

  assert.equal(state.current, 1, "a second mark on the same calendar day is a no-op");
  assert.equal(state.longest, 1, "longest is unaffected by a same-day repeat");

  const stored = rawStored(LBStore);
  assert.equal(stored.current, 1, "persisted current stays 1 after a same-day repeat");
  assert.equal(stored.lastActiveDay, "2026-06-20");
});

// ---------------------------------------------------------------------------
// 3. Consecutive days grow the streak.
// ---------------------------------------------------------------------------

test("consecutive days: 06-20, 06-21, 06-22 -> current 3, longest 3", () => {
  const { LBStreak } = loadStreak();

  LBStreak.markActive("2026-06-20");
  LBStreak.markActive("2026-06-21");
  const state = LBStreak.markActive("2026-06-22");

  assert.equal(state.current, 3, "three consecutive calendar days = a 3-day streak");
  assert.equal(state.longest, 3, "longest matches the new high-water mark");
  assert.equal(state.lastActiveDay, "2026-06-22");
});

// ---------------------------------------------------------------------------
// 4. A gap (>1 day) resets current to 1; longest preserved.
// ---------------------------------------------------------------------------

test("gap resets: 06-20 then 06-23 (2-day gap) -> current back to 1, longest stays", () => {
  const { LBStreak } = loadStreak();

  LBStreak.markActive("2026-06-20"); // current 1, longest 1
  const state = LBStreak.markActive("2026-06-23"); // gap of 3 days

  assert.equal(state.current, 1, "a gap of more than one day starts a fresh 1-day streak");
  assert.equal(state.longest, 1, "longest is never reduced by a gap");
  assert.equal(state.lastActiveDay, "2026-06-23");
});

// ---------------------------------------------------------------------------
// 5. Longest survives a break.
// ---------------------------------------------------------------------------

test("longest preserved: build a 3-streak, break it, restart -> longest 3, current resets", () => {
  const { LBStreak } = loadStreak();

  // Build a 3-day run.
  LBStreak.markActive("2026-06-20");
  LBStreak.markActive("2026-06-21");
  LBStreak.markActive("2026-06-22"); // current 3, longest 3

  // Break it with a gap, then practice once more.
  const afterBreak = LBStreak.markActive("2026-06-25"); // gap -> current 1

  assert.equal(afterBreak.current, 1, "current resets to 1 after the break");
  assert.equal(afterBreak.longest, 3, "longest still reflects the earlier 3-day run");

  // Continue from the restart — a single day after restart is 2, still below 3.
  const next = LBStreak.markActive("2026-06-26");
  assert.equal(next.current, 2, "the restart run continues normally");
  assert.equal(next.longest, 3, "longest only updates once the run exceeds the prior best");
  assert.equal(LBStreak.getLongest(), 3, "getLongest reports the preserved best");
});

// ---------------------------------------------------------------------------
// 6. Month-end + leap-day boundaries (dayDiff correctness).
// ---------------------------------------------------------------------------

test("month boundary: 2026-01-31 -> 2026-02-01 counts as +1", () => {
  const { LBStreak } = loadStreak();

  LBStreak.markActive("2026-01-31");
  const state = LBStreak.markActive("2026-02-01");

  assert.equal(state.current, 2, "crossing a month end on consecutive days continues the streak");
  assert.equal(LBStreak.dayDiff("2026-01-31", "2026-02-01"), 1,
    "dayDiff across a month end is exactly 1");
});

test("leap day: 2024-02-28 -> 2024-02-29 counts as +1 (2024 is a leap year)", () => {
  const { LBStreak } = loadStreak();

  LBStreak.markActive("2024-02-28");
  const state = LBStreak.markActive("2024-02-29");

  assert.equal(state.current, 2, "Feb 28 -> Feb 29 in a leap year is consecutive");
  assert.equal(LBStreak.dayDiff("2024-02-28", "2024-02-29"), 1,
    "dayDiff Feb28->Feb29 (leap) is exactly 1");
  // And the next real day, Mar 1 in a leap year, continues.
  const next = LBStreak.markActive("2024-03-01");
  assert.equal(next.current, 3, "Feb 29 -> Mar 1 (leap year) continues the streak");
  assert.equal(LBStreak.dayDiff("2024-02-29", "2024-03-01"), 1,
    "dayDiff Feb29->Mar1 (leap) is exactly 1");
});

test("non-leap year: 2025-02-28 -> 2025-03-01 counts as +1 (no Feb 29)", () => {
  const { LBStreak } = loadStreak();

  LBStreak.markActive("2025-02-28");
  const state = LBStreak.markActive("2025-03-01");

  assert.equal(state.current, 2, "Feb 28 -> Mar 1 in a non-leap year is consecutive");
  assert.equal(LBStreak.dayDiff("2025-02-28", "2025-03-01"), 1,
    "dayDiff Feb28->Mar1 (non-leap) is exactly 1");
});

test("non-consecutive across a boundary resets: 2026-01-31 -> 2026-02-02 (gap)", () => {
  const { LBStreak } = loadStreak();

  LBStreak.markActive("2026-01-31"); // current 1
  const state = LBStreak.markActive("2026-02-02"); // skipped Feb 1

  assert.equal(state.current, 1, "a skipped day across a month boundary resets the streak");
  assert.equal(LBStreak.dayDiff("2026-01-31", "2026-02-02"), 2,
    "dayDiff across the boundary with one skipped day is 2 (a gap)");
});

// ---------------------------------------------------------------------------
// 7. getState is READ-ONLY — a lapsed read must not mutate storage.
// ---------------------------------------------------------------------------

test("getState is read-only: a lapsed read shows current 0 but does NOT mutate storage", () => {
  const { LBStreak, LBStore } = loadStreak();

  // Build a 3-day run ending 06-22.
  LBStreak.markActive("2026-06-20");
  LBStreak.markActive("2026-06-21");
  LBStreak.markActive("2026-06-22"); // stored current 3, longest 3

  const before = rawStored(LBStore);
  assert.deepEqual(
    { current: before.current, longest: before.longest, lastActiveDay: before.lastActiveDay },
    { current: 3, longest: 3, lastActiveDay: "2026-06-22" },
    "precondition: a 3-day run is persisted"
  );

  // Read FAR in the future — the streak has lapsed.
  const view = LBStreak.getState("2026-06-30");
  assert.equal(view.current, 0, "display current is 0 once the streak has lapsed");
  assert.equal(view.longest, 3, "longest is still reported on a lapsed read");
  assert.equal(view.alive, false, "the view reports the streak as not alive");

  // The crucial assertion: storage is UNCHANGED by the read.
  const after = rawStored(LBStore);
  assert.deepEqual(after, before, "getState must NOT mutate the persisted record");
  assert.equal(after.current, 3, "stored current still 3 after a lapsed getState");
  assert.equal(after.lastActiveDay, "2026-06-22", "stored lastActiveDay untouched by a read");

  // markActive is what actually applies the reset.
  const reset = LBStreak.markActive("2026-06-30");
  assert.equal(reset.current, 1, "markActive (not getState) is what resets the lapsed streak");
  assert.equal(reset.longest, 3, "longest survives the eventual reset");
});

test("getState alive window: today and yesterday show stored current; 2+ days lapses", () => {
  const { LBStreak } = loadStreak();
  LBStreak.markActive("2026-06-20"); // current 1, lastActiveDay 06-20

  assert.equal(LBStreak.getState("2026-06-20").current, 1, "same day -> alive, shows current");
  assert.equal(LBStreak.getState("2026-06-21").current, 1, "yesterday-active -> still alive");
  assert.equal(LBStreak.getState("2026-06-22").current, 0, "two days later -> lapsed, shows 0");
  assert.equal(LBStreak.getState("2026-06-22").alive, false, "two days later is not alive");
});

// ---------------------------------------------------------------------------
// 8. goalMetToday true ONLY when lastActiveDay === today.
// ---------------------------------------------------------------------------

test("goalMetToday: true only on the exact active day", () => {
  const { LBStreak } = loadStreak();
  LBStreak.markActive("2026-06-20");

  assert.equal(LBStreak.getState("2026-06-20").goalMetToday, true,
    "goal met on the day it was marked");
  assert.equal(LBStreak.isGoalMetToday("2026-06-20"), true, "getter agrees on the active day");

  assert.equal(LBStreak.getState("2026-06-21").goalMetToday, false,
    "the next day, today's goal is not yet met (streak still alive, but not met)");
  assert.equal(LBStreak.isGoalMetToday("2026-06-21"), false, "getter agrees the next day");
  assert.equal(LBStreak.isGoalMetToday("2026-06-19"), false,
    "a day BEFORE the active day does not count today's goal as met");
});

// ---------------------------------------------------------------------------
// 9. Persistence round-trip + graceful degradation with NO store.
// ---------------------------------------------------------------------------

test("persistence: state round-trips the shim across a fresh read", () => {
  const { LBStreak, LBStore } = loadStreak();

  LBStreak.markActive("2026-06-20");
  LBStreak.markActive("2026-06-21"); // current 2, longest 2

  // Round-trip via the getters (which re-read storage) and the raw store.
  assert.equal(LBStreak.getLongest(), 2, "longest persisted and re-read");
  assert.equal(LBStreak.getCurrent("2026-06-21"), 2, "current persisted and re-read");

  const stored = rawStored(LBStore);
  assert.deepEqual(
    { current: stored.current, longest: stored.longest,
      lastActiveDay: stored.lastActiveDay, goalPerDay: stored.goalPerDay },
    { current: 2, longest: 2, lastActiveDay: "2026-06-21", goalPerDay: 1 },
    "the full persisted shape matches what was marked"
  );
});

test("persistence: a second LBStreak over the SAME storage sees the prior run", () => {
  // Build state in one sandbox, then load a fresh streak.js over the SAME
  // storage to prove the persistence is in the store, not the closure.
  const ctxOpts = {};
  const first = loadStreak(ctxOpts);
  first.LBStreak.markActive("2026-06-20");
  first.LBStreak.markActive("2026-06-21"); // current 2, longest 2

  // New sandbox sharing the SAME backing storage map: re-point a fresh sandbox
  // at the same store by seeding the raw record the first run persisted.
  const raw = first.storage.getItem("languagebasics.streak");
  const second = loadStreak();
  second.storage.seedRaw("languagebasics.streak", raw);

  assert.equal(second.LBStreak.getLongest(), 2,
    "a fresh LBStreak reads the persisted longest from storage");
  const cont = second.LBStreak.markActive("2026-06-22");
  assert.equal(cont.current, 3, "continuing a persisted run grows it correctly");
});

test("degradation: with NO LBStore, calls don't throw and return a sane fresh state", () => {
  const { LBStreak } = loadStreakNoStore();

  // markActive must not throw and must report a fresh-but-sane 1-day result.
  let state;
  assert.doesNotThrow(() => { state = LBStreak.markActive("2026-06-20"); },
    "markActive must never throw when LBStore is absent");
  assert.equal(state.current, 1, "without a store, markActive still computes a 1-day result");

  // Reads degrade to empty (nothing persisted, so each read is fresh).
  assert.equal(LBStreak.getLongest(), 0,
    "without a store, getLongest reads a fresh empty state");
  assert.doesNotThrow(() => LBStreak.getState("2026-06-21"),
    "getState must never throw without a store");
  assert.equal(LBStreak.getCurrent("2026-06-20"), 0,
    "without persistence, a subsequent read sees nothing stored");
});

test("degradation: blocked storage (throwOnSet) -> markActive does not throw", () => {
  const { LBStreak } = loadStreak({ throwOnSet: true });

  let state;
  assert.doesNotThrow(() => { state = LBStreak.markActive("2026-06-20"); },
    "a blocked write must never abort the practice that triggered it");
  assert.equal(state.current, 1, "the in-session result is still computed when writes fail");
});

// ---------------------------------------------------------------------------
// 10. isValidDay + unusable-today handling (no throw on malformed input).
// ---------------------------------------------------------------------------

test("isValidDay: accepts well-formed YYYY-MM-DD, rejects malformed without throwing", () => {
  const { LBStreak } = loadStreak();

  assert.equal(LBStreak.isValidDay("2026-06-20"), true, "canonical date is valid");
  assert.equal(LBStreak.isValidDay("2024-02-29"), true, "leap day shape is valid");

  // Malformed / wrong-type inputs all return false, none throw.
  for (const bad of ["", "2026-6-20", "2026/06/20", "20260620", "not-a-date",
                     "2026-06-20T00:00", null, undefined, 20260620, {}, []]) {
    assert.doesNotThrow(() => LBStreak.isValidDay(bad),
      "isValidDay must not throw on bad input: " + String(bad));
    assert.equal(LBStreak.isValidDay(bad), false,
      "isValidDay rejects malformed input: " + String(bad));
  }
});

test("unusable today: markActive with a malformed date leaves stored state unchanged", () => {
  const { LBStreak, LBStore } = loadStreak();
  LBStreak.markActive("2026-06-20"); // current 1
  const before = rawStored(LBStore);

  const state = LBStreak.markActive("not-a-date");
  assert.equal(state.current, 1, "an unusable today returns the unchanged stored state");

  const after = rawStored(LBStore);
  assert.deepEqual(after, before, "a malformed today must not mutate persisted state");
});

test("dayDiff: returns null for malformed inputs (no throw), correct sign otherwise", () => {
  const { LBStreak } = loadStreak();

  assert.equal(LBStreak.dayDiff("2026-06-20", "2026-06-20"), 0, "same day -> 0");
  assert.equal(LBStreak.dayDiff("2026-06-20", "2026-06-21"), 1, "next day -> 1");
  assert.equal(LBStreak.dayDiff("2026-06-21", "2026-06-20"), -1, "backward -> negative");
  assert.equal(LBStreak.dayDiff(null, "2026-06-20"), null, "no prior day -> null");
  assert.equal(LBStreak.dayDiff("bad", "2026-06-20"), null, "malformed from -> null");
});

test("todayString: returns a well-formed local date string (shape, not a fixed value)", () => {
  const { LBStreak } = loadStreak();
  const t = LBStreak.todayString();
  assert.equal(LBStreak.isValidDay(t), true,
    "todayString must produce a valid YYYY-MM-DD string");
});
