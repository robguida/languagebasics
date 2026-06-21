/* LB-9: window.LBPrefs — per-lesson reveal-timer + card-order preferences, and
 * the engine's resolvedRevealMs() resolution seam.
 *
 * Run:  node --test
 *
 * prefs.js is an IIFE that, at load, assigns window.LBPrefs and reads/writes the
 * `lb.prefs` namespace THROUGH window.LBStore (LB-8). To exercise the real
 * round-trip we load BOTH store.js and prefs.js into ONE shared node:vm sandbox
 * backed by the reusable LB-8 localStorage shim — so LBPrefs talks to a genuine
 * LBStore over a genuine (in-memory) Storage, exactly as in the browser.
 *
 * This is PURE-LOGIC coverage — that's where the value is:
 *   1. LBPrefs round-trip: set/get revealMs + order; per-lesson isolation.
 *   2. Timer clamp + default: clampSeconds clamps to 1-20s (both boundaries,
 *      out-of-range high/low, non-numeric -> default); 5s/5000ms default when
 *      nothing is stored.
 *   3. Resolution order (engine seam): stored override wins -> lesson.revealMs
 *      -> 5000; the NO-STORE path is byte-identical to pre-LB-9 (regression
 *      guard for the existing 42 tests).
 *   4. Units: storage is in MILLISECONDS; the user-facing value is SECONDS,
 *      converted at the boundary (clampSeconds works in seconds; getRevealMs
 *      returns ms).
 *
 * Built-ins only: node:test, node:assert, node:fs, node:path, node:vm. The
 * localStorage shim is the one built for LB-8 and reused here verbatim.
 *
 * MANUAL (not unit-tested here — see report): the settings.js modal DOM
 * behavior (hamburger open/close, focus trap, Esc-to-close, focus return,
 * backdrop click, aria-expanded) is real-DOM/focus behavior the vm shim does
 * not model cleanly. It is verified manually in a browser.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { makeStoreSandbox, STORE_SRC } = require("./helpers/local-storage-shim.js");

const PREFS_SRC_PATH = path.resolve(__dirname, "..", "src", "prefs.js");
const PREFS_SRC = fs.readFileSync(PREFS_SRC_PATH, "utf8");
const ENGINE_PATH = path.resolve(__dirname, "..", "src", "engine.js");
const ENGINE_SRC = fs.readFileSync(ENGINE_PATH, "utf8");

/* Load store.js + prefs.js into one fresh sandbox so LBPrefs round-trips through
 * a real LBStore over the LB-8 shim. Returns the live LBPrefs/LBStore plus the
 * window + storage handles for inspection. Pass { noStorage: true } or
 * { throwOnSet: true } straight through to the shim. */
function loadPrefs(opts) {
  const ctx = makeStoreSandbox(opts);
  vm.runInContext(fs.readFileSync(STORE_SRC, "utf8"), ctx.sandbox, { filename: STORE_SRC });
  vm.runInContext(PREFS_SRC, ctx.sandbox, { filename: PREFS_SRC_PATH });
  return {
    LBPrefs: ctx.window.LBPrefs,
    LBStore: ctx.window.LBStore,
    window: ctx.window,
    storage: ctx.storage,
    warnings: ctx.warnings,
  };
}

/* Load prefs.js with NO store.js present (window has no LBStore). This is the
 * engine-unit-test environment: every getter must return null so the engine
 * falls through to its original behavior. */
function loadPrefsNoStore() {
  const sandbox = { window: {}, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(PREFS_SRC, sandbox, { filename: PREFS_SRC_PATH });
  return { LBPrefs: sandbox.window.LBPrefs, window: sandbox.window };
}

/* Engine seam helper: load engine.js into a sandbox whose window optionally
 * carries an LBPrefs (real or stubbed). We only need resolvedRevealMs's
 * observable effect — the revealMs the engine commits to — so we capture it via
 * the bar animation string the engine writes (it embeds revealMs/1000 + "s").
 * A minimal DOM shim mirrors loop-resilience.test.js. */
function makeEngineSandbox(lbPrefsStub) {
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
  if (lbPrefsStub) windowShim.LBPrefs = lbPrefsStub;

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

/* The engine writes `bar.style.animation = "shrink " + (revealMs/1000) + "s ..."`.
 * Parse the seconds back out so we can assert which revealMs the engine resolved
 * to, without exposing any internals. */
function resolvedSecondsFrom(elements) {
  const anim = String(elements.bar.style.animation);
  const m = /shrink\s+([\d.]+)s/.exec(anim);
  return m ? Number(m[1]) : null;
}

/* ----------------------------- public surface ----------------------------- */

test("LBPrefs: loads and exposes the public surface", () => {
  const { LBPrefs } = loadPrefs();
  assert.ok(LBPrefs, "window.LBPrefs must be defined after load");
  for (const fn of ["getRevealMs", "getOrder", "setRevealMs", "setOrder", "setLesson", "getLesson", "clampSeconds", "getQuizCount", "setQuizCount"]) {
    assert.equal(typeof LBPrefs[fn], "function", `${fn} must be a function`);
  }
  assert.equal(LBPrefs.MIN_SECONDS, 1, "MIN_SECONDS must be 1");
  assert.equal(LBPrefs.MAX_SECONDS, 20, "MAX_SECONDS must be 20");
  assert.equal(LBPrefs.DEFAULTS.revealMs, 5000, "default revealMs must be 5000 (5s)");
  assert.equal(LBPrefs.DEFAULTS.order, "random", "default order must be 'random'");
  assert.equal(LBPrefs.DEFAULTS.quizCount, 10, "default quizCount must be 10");
  // Compare element-wise (not deepStrictEqual): QUIZ_COUNTS is constructed inside
  // the vm sandbox, so its Array prototype is the sandbox realm's, which trips
  // deepStrictEqual's cross-realm prototype check. The VALUES are what matter.
  assert.equal(Array.from(LBPrefs.QUIZ_COUNTS).join(","), "5,10,20",
    "QUIZ_COUNTS must be the offered choices [5,10,20]");
});

/* --------------------------- 1. round-trip + isolation --------------------- */

test("LBPrefs round-trip: setRevealMs then getRevealMs returns the stored ms", () => {
  const { LBPrefs } = loadPrefs();
  const wrote = LBPrefs.setRevealMs("sq/lesson-1", 8000);
  assert.equal(wrote, true, "set should reach localStorage (return true) with a real shim");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), 8000, "getRevealMs must return the stored ms");
});

test("LBPrefs round-trip: setOrder then getOrder returns the stored order", () => {
  const { LBPrefs } = loadPrefs();
  LBPrefs.setOrder("sq/lesson-1", "leitner");
  assert.equal(LBPrefs.getOrder("sq/lesson-1"), "leitner", "getOrder must return the stored order");
  LBPrefs.setOrder("sq/lesson-1", "random");
  assert.equal(LBPrefs.getOrder("sq/lesson-1"), "random", "order can be flipped back to random");
});

test("LBPrefs round-trip: revealMs and order coexist on one lesson", () => {
  const { LBPrefs } = loadPrefs();
  LBPrefs.setRevealMs("sq/lesson-3", 12000);
  LBPrefs.setOrder("sq/lesson-3", "leitner");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-3"), 12000, "revealMs preserved after order write");
  assert.equal(LBPrefs.getOrder("sq/lesson-3"), "leitner", "order preserved after revealMs write");
});

test("LBPrefs isolation: lesson-1's timer does not affect lesson-2", () => {
  const { LBPrefs } = loadPrefs();
  LBPrefs.setRevealMs("sq/lesson-1", 3000);
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), 3000, "lesson-1 stored");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-2"), null,
    "lesson-2 has no override -> null (no bleed from lesson-1)");

  LBPrefs.setRevealMs("sq/lesson-2", 9000);
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), 3000, "lesson-1 unchanged after writing lesson-2");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-2"), 9000, "lesson-2 stored independently");
});

test("LBPrefs isolation: order is also per-lesson", () => {
  const { LBPrefs } = loadPrefs();
  LBPrefs.setOrder("sq/lesson-1", "leitner");
  assert.equal(LBPrefs.getOrder("sq/lesson-1"), "leitner");
  assert.equal(LBPrefs.getOrder("sq/lesson-2"), null, "lesson-2 order untouched -> null");
});

test("LBPrefs: unset lesson -> getRevealMs and getOrder both return null", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.getRevealMs("sq/lesson-5"), null, "never-set revealMs -> null");
  assert.equal(LBPrefs.getOrder("sq/lesson-5"), null, "never-set order -> null");
});

test("LBPrefs: missing lessonId -> null, no throw", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.getRevealMs(), null, "no lessonId -> null");
  assert.equal(LBPrefs.getRevealMs(""), null, "empty lessonId -> null");
  assert.equal(LBPrefs.getOrder(undefined), null, "undefined lessonId -> null");
});

/* --------------------------- 2. clamp + default --------------------------- */

test("clampSeconds: low boundary 1 stays 1; high boundary 20 stays 20", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.clampSeconds(1), 1, "1s is the min, kept as-is");
  assert.equal(LBPrefs.clampSeconds(20), 20, "20s is the max, kept as-is");
});

test("clampSeconds: out-of-range high clamps to 20, low clamps to 1", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.clampSeconds(21), 20, "above max clamps down to 20");
  assert.equal(LBPrefs.clampSeconds(999), 20, "far above max clamps to 20");
  assert.equal(LBPrefs.clampSeconds(0), 1, "below min clamps up to 1");
  assert.equal(LBPrefs.clampSeconds(-5), 1, "negative clamps to 1");
});

test("clampSeconds: in-range value passes through (rounded)", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.clampSeconds(7), 7, "in-range integer unchanged");
  assert.equal(LBPrefs.clampSeconds(7.4), 7, "rounds down to nearest second");
  assert.equal(LBPrefs.clampSeconds(7.6), 8, "rounds up to nearest second");
});

test("clampSeconds: non-numeric falls back to the 5s default, then clamps in-range", () => {
  const { LBPrefs } = loadPrefs();
  const def = Math.round(LBPrefs.DEFAULTS.revealMs / 1000); // 5
  assert.equal(LBPrefs.clampSeconds("abc"), def, "non-numeric string -> 5s default");
  assert.equal(LBPrefs.clampSeconds(NaN), def, "NaN -> 5s default");
  assert.equal(LBPrefs.clampSeconds(undefined), def, "undefined -> 5s default");
  assert.equal(LBPrefs.clampSeconds(null), 1,
    "null coerces to 0 via Number(), which clamps up to the 1s min");
});

test("default: nothing stored -> getRevealMs null; DEFAULTS.revealMs is 5000 (5s)", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), null,
    "no stored value -> null (engine owns the real 5000 fallback)");
  assert.equal(LBPrefs.DEFAULTS.revealMs, 5000, "the UI default is 5s expressed as 5000ms");
});

test("getRevealMs: a stored non-positive / non-number value is treated as unset (null)", () => {
  const { LBPrefs, LBStore } = loadPrefs();
  // Plant invalid revealMs values directly through LBStore to bypass setLesson's
  // own validation, then confirm the getter rejects them as unset.
  LBStore.set("lb.prefs", { lessons: { "sq/lesson-1": { revealMs: 0 } } });
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), null, "0 ms -> null");
  LBStore.set("lb.prefs", { lessons: { "sq/lesson-1": { revealMs: -100 } } });
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), null, "negative ms -> null");
  LBStore.set("lb.prefs", { lessons: { "sq/lesson-1": { revealMs: "5000" } } });
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), null, "string ms -> null (must be a number)");
});

/* --------------------------- 3. resolution order (engine seam) ------------ */

test("engine seam: stored override WINS over lesson.revealMs", () => {
  // Stub LBPrefs returning a 9000ms override; lesson hardcodes 5000.
  const stub = { getRevealMs: () => 9000 };
  const { engine, elements } = makeEngineSandbox(stub);
  engine.start({ id: "sq/lesson-1", title: "X", revealMs: 5000, cards: [{ prompt: 1, answer: "një" }] });
  assert.equal(resolvedSecondsFrom(elements), 9, "override (9s) must beat lesson.revealMs (5s)");
});

test("engine seam: no stored value -> falls back to lesson.revealMs", () => {
  // LBPrefs present but returns null (no override stored for this lesson).
  const stub = { getRevealMs: () => null };
  const { engine, elements } = makeEngineSandbox(stub);
  engine.start({ id: "sq/lesson-6", title: "X", revealMs: 10000, cards: [{ prompt: 1, answer: "një" }] });
  assert.equal(resolvedSecondsFrom(elements), 10, "no override -> lesson.revealMs (10s) used");
});

test("engine seam: no override AND no lesson.revealMs -> engine default 5000 (5s)", () => {
  const stub = { getRevealMs: () => null };
  const { engine, elements } = makeEngineSandbox(stub);
  engine.start({ id: "sq/lesson-1", title: "X", cards: [{ prompt: 1, answer: "një" }] });
  assert.equal(resolvedSecondsFrom(elements), 5, "no override + no lesson value -> 5000ms default");
});

test("engine seam REGRESSION: no LBPrefs at all -> identical to pre-LB-9 (lesson.revealMs)", () => {
  // This is exactly the existing-42-tests environment: window has no LBPrefs.
  const { engine, elements } = makeEngineSandbox(null);
  engine.start({ id: "sq/lesson-6", title: "X", revealMs: 10000, cards: [{ prompt: 1, answer: "një" }] });
  assert.equal(resolvedSecondsFrom(elements), 10,
    "no LBPrefs => engine uses lesson.revealMs exactly as before LB-9");
});

test("engine seam REGRESSION: no LBPrefs + no lesson.revealMs -> 5000 default (unchanged)", () => {
  const { engine, elements } = makeEngineSandbox(null);
  engine.start({ id: "sq/lesson-1", title: "X", cards: [{ prompt: 1, answer: "një" }] });
  assert.equal(resolvedSecondsFrom(elements), 5,
    "no LBPrefs + no lesson value => the pre-LB-9 5000ms default");
});

test("engine seam: a throwing LBPrefs.getRevealMs is swallowed -> falls back, no crash", () => {
  const stub = { getRevealMs: () => { throw new Error("boom"); } };
  const { engine, elements } = makeEngineSandbox(stub);
  assert.doesNotThrow(
    () => engine.start({ id: "sq/lesson-6", title: "X", revealMs: 10000, cards: [{ prompt: 1, answer: "një" }] }),
    "a failing pref read must not abort start()"
  );
  assert.equal(resolvedSecondsFrom(elements), 10, "pref read failure -> lesson.revealMs fallback");
});

test("engine seam END-TO-END: real LBPrefs+LBStore override flows into the engine", () => {
  // Wire the genuine prefs stack, store an override, then hand THAT LBPrefs to
  // the engine sandbox — proving the full set -> get -> resolve path, not a stub.
  const { LBPrefs } = loadPrefs();
  LBPrefs.setRevealMs("sq/lesson-1", 15000); // 15s
  const { engine, elements } = makeEngineSandbox(LBPrefs);
  engine.start({ id: "sq/lesson-1", title: "X", revealMs: 5000, cards: [{ prompt: 1, answer: "një" }] });
  assert.equal(resolvedSecondsFrom(elements), 15,
    "a really-stored 15s override resolves through the live LBPrefs into the engine");
});

/* --------------------------- 4. units (ms vs seconds) --------------------- */

test("units: storage is MILLISECONDS while the UI value is SECONDS", () => {
  const { LBPrefs } = loadPrefs();
  // UI edits seconds; the modal converts with seconds*1000 before storing.
  const uiSeconds = 8;
  LBPrefs.setRevealMs("sq/lesson-1", uiSeconds * 1000);
  const storedMs = LBPrefs.getRevealMs("sq/lesson-1");
  assert.equal(storedMs, 8000, "stored value is in ms (8s -> 8000ms)");
  assert.equal(storedMs / 1000, uiSeconds, "dividing by 1000 recovers the user-facing seconds");
});

test("units: clampSeconds operates in SECONDS, getRevealMs returns MS (boundary conversion)", () => {
  const { LBPrefs } = loadPrefs();
  const clampedSeconds = LBPrefs.clampSeconds(50); // -> 20 (max seconds)
  assert.equal(clampedSeconds, 20, "clamp works in the seconds domain");
  LBPrefs.setRevealMs("sq/lesson-1", clampedSeconds * 1000);
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), 20000, "20s persists as 20000ms");
});

/* --------------------------- 5. quizCount (LB-14 GLOBAL pref) ------------- */
/* quizCount is a NEW global (top-level lb.prefs) field added in LB-14. Unlike the
 * per-lesson getters it always returns a usable value (default 10, never null).
 * Only 5/10/20 are valid; anything else falls back to the default on read and is
 * rejected (returns false, no write) on set. The setLesson change that preserves
 * a stored quizCount is guarded by the coexistence round-trips below. */

test("quizCount: default is 10 when nothing is stored", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.getQuizCount(), 10, "no stored quizCount -> the 10 default");
});

test("quizCount round-trip: setQuizCount persists and getQuizCount returns it", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.setQuizCount(20), true, "valid set should reach localStorage (true)");
  assert.equal(LBPrefs.getQuizCount(), 20, "getQuizCount returns the stored value");
  assert.equal(LBPrefs.setQuizCount(5), true, "can change to another valid choice");
  assert.equal(LBPrefs.getQuizCount(), 5, "getQuizCount returns the updated value");
});

test("quizCount: every offered choice (5/10/20) is accepted and round-trips", () => {
  for (const n of [5, 10, 20]) {
    const { LBPrefs } = loadPrefs();
    assert.equal(LBPrefs.setQuizCount(n), true, `${n} is a valid choice -> accepted`);
    assert.equal(LBPrefs.getQuizCount(), n, `${n} round-trips`);
  }
});

test("quizCount: out-of-range / not-an-offered-choice values are rejected on set", () => {
  const { LBPrefs } = loadPrefs();
  for (const bad of [0, 1, 4, 6, 15, 25, 100, -10]) {
    assert.equal(LBPrefs.setQuizCount(bad), false, `${bad} is not in [5,10,20] -> set rejected (false)`);
  }
  // None of the rejected writes should have changed the stored value: still default.
  assert.equal(LBPrefs.getQuizCount(), 10, "after only-rejected sets, getQuizCount stays at the 10 default");
});

test("quizCount: non-numeric set is rejected (false), value stays default", () => {
  const { LBPrefs } = loadPrefs();
  for (const bad of ["ten", "abc", NaN, undefined, null, {}, []]) {
    assert.equal(LBPrefs.setQuizCount(bad), false, `non-numeric ${String(bad)} -> set rejected`);
  }
  assert.equal(LBPrefs.getQuizCount(), 10, "rejected non-numeric sets leave the default intact");
});

test("quizCount: a rejected set does NOT overwrite a previously valid value", () => {
  const { LBPrefs } = loadPrefs();
  assert.equal(LBPrefs.setQuizCount(20), true, "store a valid 20 first");
  assert.equal(LBPrefs.setQuizCount(7), false, "7 is invalid -> rejected");
  assert.equal(LBPrefs.getQuizCount(), 20, "the previously stored 20 survives the rejected write");
});

test("quizCount: a stored invalid/garbage value falls back to the default on read", () => {
  const { LBPrefs, LBStore } = loadPrefs();
  // Plant a garbage quizCount directly through LBStore, bypassing setQuizCount's
  // own validation, then confirm the getter rejects it back to the default.
  LBStore.set("lb.prefs", { quizCount: 7, lessons: {} });
  assert.equal(LBPrefs.getQuizCount(), 10, "stored 7 (not an offered choice) -> default 10 on read");
  LBStore.set("lb.prefs", { quizCount: "abc", lessons: {} });
  assert.equal(LBPrefs.getQuizCount(), 10, "stored non-numeric -> default 10 on read");
});

/* --- CRITICAL: setLesson <-> quizCount coexistence (guards the LB-14 setLesson
 * change so a per-lesson write never drops the global quizCount, and vice versa) */

test("coexistence: setQuizCount does NOT wipe an existing per-lesson lessons map", () => {
  const { LBPrefs } = loadPrefs();
  LBPrefs.setRevealMs("sq/lesson-1", 8000);
  LBPrefs.setOrder("sq/lesson-1", "leitner");
  LBPrefs.setQuizCount(20); // global write AFTER per-lesson writes

  assert.equal(LBPrefs.getQuizCount(), 20, "global quizCount stored");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), 8000, "per-lesson revealMs SURVIVES the global write");
  assert.equal(LBPrefs.getOrder("sq/lesson-1"), "leitner", "per-lesson order SURVIVES the global write");
});

test("coexistence: setLesson (revealMs/order) does NOT wipe the global quizCount", () => {
  const { LBPrefs } = loadPrefs();
  LBPrefs.setQuizCount(5); // global write FIRST
  LBPrefs.setRevealMs("sq/lesson-2", 12000); // per-lesson write AFTER
  LBPrefs.setOrder("sq/lesson-2", "random");

  assert.equal(LBPrefs.getRevealMs("sq/lesson-2"), 12000, "per-lesson revealMs stored");
  assert.equal(LBPrefs.getOrder("sq/lesson-2"), "random", "per-lesson order stored");
  assert.equal(LBPrefs.getQuizCount(), 5,
    "global quizCount SURVIVES the per-lesson write (guards the setLesson preserve-quizCount fix)");
});

test("coexistence: full interleaved round-trip — both survive repeated writes to each other", () => {
  const { LBPrefs } = loadPrefs();
  LBPrefs.setQuizCount(10);
  LBPrefs.setRevealMs("sq/lesson-1", 3000);
  LBPrefs.setQuizCount(20);                       // change global again
  LBPrefs.setOrder("sq/lesson-1", "leitner");     // touch lesson again
  LBPrefs.setRevealMs("sq/lesson-4", 7000);       // a second lesson
  LBPrefs.setQuizCount(5);                         // change global a third time

  assert.equal(LBPrefs.getQuizCount(), 5, "final global quizCount is the last valid write (5)");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), 3000, "lesson-1 revealMs intact through it all");
  assert.equal(LBPrefs.getOrder("sq/lesson-1"), "leitner", "lesson-1 order intact through it all");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-4"), 7000, "lesson-4 revealMs intact through it all");
});

/* --------------------------- no-store degradation ------------------------- */

test("no LBStore: every getter returns null and setters are no-ops (engine env)", () => {
  const { LBPrefs } = loadPrefsNoStore();
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), null, "no store -> getRevealMs null");
  assert.equal(LBPrefs.getOrder("sq/lesson-1"), null, "no store -> getOrder null");
  assert.equal(LBPrefs.setRevealMs("sq/lesson-1", 8000), false, "no store -> setRevealMs returns false");
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), null, "no store -> nothing persisted, still null");
  // quizCount degrades gracefully too: set is a no-op (false), get returns the default.
  assert.equal(LBPrefs.setQuizCount(20), false, "no store -> setQuizCount returns false");
  assert.equal(LBPrefs.getQuizCount(), 10, "no store -> getQuizCount returns the 10 default");
});

test("blocked storage (throwOnSet): setRevealMs returns false but does not throw", () => {
  const { LBPrefs } = loadPrefs({ throwOnSet: true });
  let result;
  assert.doesNotThrow(() => { result = LBPrefs.setRevealMs("sq/lesson-1", 8000); },
    "a blocked write must not throw");
  assert.equal(result, false, "blocked storage -> set reaches memory only -> false");
  // LBStore's in-memory mirror still serves the value within this session.
  assert.equal(LBPrefs.getRevealMs("sq/lesson-1"), 8000,
    "in-memory mirror serves the value this session even when persistence is blocked");
});
