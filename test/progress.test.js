/* LB-36: window.LBProgress — "knew / not yet" per card, N of M known, and the
 * per-lesson personal best. Replaces the retired speed-tier mastery tests.
 *
 * Run:  node --test
 *
 * Loads the REAL store.js + progress.js into one node:vm sandbox over the
 * in-memory localStorage shim, so every read/write goes through a genuine
 * LBStore exactly as in the browser. Built-ins only.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { makeStoreSandbox, STORE_SRC } = require("./helpers/local-storage-shim.js");

const PROGRESS_PATH = path.resolve(__dirname, "..", "src", "progress.js");
const PROGRESS_SRC = fs.readFileSync(PROGRESS_PATH, "utf8");
const KEY = "languagebasics.progress";

function loadProgress(opts) {
  const ctx = makeStoreSandbox(opts);
  vm.runInContext(fs.readFileSync(STORE_SRC, "utf8"), ctx.sandbox, { filename: STORE_SRC });
  vm.runInContext(PROGRESS_SRC, ctx.sandbox, { filename: PROGRESS_PATH });
  return { P: ctx.window.LBProgress, LBStore: ctx.window.LBStore, storage: ctx.storage, window: ctx.window, sandbox: ctx.sandbox };
}

function deck(n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push({ prompt: String(i), answer: "w" + i });
  return out;
}

/* ------------------------------- the fold ---------------------------------- */

test("record: 'I knew it' makes a card known; stored as { r, t } with epoch ms", () => {
  const { P, LBStore } = loadProgress();
  assert.equal(P.isKnown("sq/lesson-1", 7), false, "nothing rated yet");
  assert.equal(P.record("sq/lesson-1", 7, true, 1763000000000), true, "reached storage");
  assert.equal(P.isKnown("sq/lesson-1", 7), true);
  const raw = LBStore.get(KEY);
  assert.equal(raw.v, 1);
  assert.equal(raw.lessons["sq/lesson-1"].cards["7"].r, "knew");
  assert.equal(raw.lessons["sq/lesson-1"].cards["7"].t, 1763000000000, "the injected clock is stored");
});

test("record: without an injected clock the time is Date.now() epoch ms (not performance.now)", () => {
  const { P } = loadProgress();
  const before = Date.now();
  P.record("sq/lesson-1", 1, true);
  const t = P.getLesson("sq/lesson-1").cards["1"].t;
  assert.ok(t >= before && t <= Date.now() + 5, "epoch ms, got " + t);
  assert.ok(t > 1e12, "an epoch timestamp, not a page-relative one");
});

test("known flips both ways: knew -> notyet -> knew", () => {
  const { P } = loadProgress();
  P.record("sq/lesson-1", "3", true, 1);
  assert.equal(P.isKnown("sq/lesson-1", "3"), true);
  P.record("sq/lesson-1", "3", false, 2); // Not yet (or time's up)
  assert.equal(P.isKnown("sq/lesson-1", "3"), false, "a later Not yet un-knows it");
  P.record("sq/lesson-1", "3", true, 3);
  assert.equal(P.isKnown("sq/lesson-1", "3"), true, "and one I knew it brings it back");
});

test("record: only a strict true counts as knew", () => {
  const { P } = loadProgress();
  P.record("sq/lesson-1", 1, "yes", 1);
  P.record("sq/lesson-1", 2, 1, 1);
  assert.equal(P.getLesson("sq/lesson-1").cards["1"].r, "notyet");
  assert.equal(P.getLesson("sq/lesson-1").cards["2"].r, "notyet");
});

test("record: missing lesson id or prompt is a no-op (false), nothing written", () => {
  const { P, storage } = loadProgress();
  assert.equal(P.record("", 1, true), false);
  assert.equal(P.record("sq/lesson-1", null, true), false);
  assert.equal(P.record("sq/lesson-1", "", true), false);
  assert.equal(storage.getItem(KEY), null);
});

test("isolation: same prompt in two lessons is independent", () => {
  const { P } = loadProgress();
  P.record("sq/lesson-1", 5, true, 1);
  assert.equal(P.isKnown("es/lesson-1", 5), false);
  P.record("es/lesson-1", 5, false, 1);
  assert.equal(P.isKnown("sq/lesson-1", 5), true);
});

/* ------------------------------ N of M known ------------------------------ */

test("knownCount: N of M over the loaded deck; 0 of M before any test", () => {
  const { P } = loadProgress();
  const d = deck(80);
  let c = P.knownCount("sq/lesson-4", d);
  assert.equal(c.known, 0);
  assert.equal(c.total, 80);
  P.record("sq/lesson-4", "1", true, 1);
  P.record("sq/lesson-4", "2", true, 1);
  P.record("sq/lesson-4", "3", false, 1);
  c = P.knownCount("sq/lesson-4", d);
  assert.equal(c.known, 2);
  assert.equal(c.total, 80);
});

test("knownCount: stored records for cards no longer in the deck are ignored", () => {
  const { P } = loadProgress();
  P.record("sq/lesson-1", "1", true, 1);
  P.record("sq/lesson-1", "gone", true, 1);
  P.record("sq/lesson-1", "also-gone", true, 1);
  const c = P.knownCount("sq/lesson-1", deck(3));
  assert.equal(c.known, 1, "only deck cards count");
  assert.equal(c.total, 3);
});

test("knownCount: a bad deck entry is skipped, the rest counted", () => {
  const { P } = loadProgress();
  P.record("sq/lesson-1", "1", true, 1);
  P.record("sq/lesson-1", "2", true, 1);
  const d = [{ prompt: "1" }, null, "junk", { prompt: "" }, { answer: "x" }, { prompt: "2" }];
  const c = P.knownCount("sq/lesson-1", d);
  assert.equal(c.total, 2);
  assert.equal(c.known, 2);
  assert.equal(P.knownCount("sq/lesson-1", null).total, 0);
});

test("loop resilience: one bad stored record is skipped; the rest of the lesson survives", () => {
  const { P, storage } = loadProgress();
  storage.seedRaw(KEY, JSON.stringify({
    v: 1,
    lessons: {
      "sq/lesson-1": {
        cards: {
          "1": { r: "knew", t: 5 },
          "2": { r: "maybe", t: 5 },        // bad rating
          "3": { r: "knew", t: "soon" },    // bad time
          "4": null,                         // not an object
          "5": "knew",                       // not an object
          "6": { r: "knew", t: 9 },
        },
        best: { score: 11, of: 10 },         // impossible best -> ignored
      },
      "sq/lesson-2": "corrupt",
    },
  }));
  const c = P.knownCount("sq/lesson-1", deck(6));
  assert.equal(c.known, 2, "cards 1 and 6 only");
  assert.equal(P.getBest("sq/lesson-1"), null, "a bad best is ignored");
  assert.equal(P.knownCount("sq/lesson-2", deck(3)).known, 0, "a corrupt lesson reads as empty");
  // A write to the lesson drops the bad records and keeps the good ones.
  P.record("sq/lesson-1", "2", true, 10);
  assert.equal(P.knownCount("sq/lesson-1", deck(6)).known, 3);
});

test("corrupt JSON / wrong version under the key -> empty progress, no throw", () => {
  for (const raw of ["{nope", JSON.stringify({ v: 2, lessons: {} }), JSON.stringify({ v: 1, lessons: [] })]) {
    const { P, storage } = loadProgress();
    storage.seedRaw(KEY, raw);
    assert.doesNotThrow(() => P.knownCount("sq/lesson-1", deck(3)));
    assert.equal(P.knownCount("sq/lesson-1", deck(3)).known, 0);
    assert.equal(P.getBest("sq/lesson-1"), null);
  }
});

test("knownMap: { prompt: true } only for cards whose last rating was knew", () => {
  const { P } = loadProgress();
  P.record("sq/lesson-1", "1", true, 1);
  P.record("sq/lesson-1", "2", false, 1);
  const m = P.knownMap("sq/lesson-1");
  assert.equal(m["1"], true);
  assert.equal(m["2"], undefined);
  assert.equal(Object.keys(m).length, 1);
});

/* ------------------------------ personal best ----------------------------- */

test("PB: none stored -> the first finished full test is the best ('new')", () => {
  const { P } = loadProgress();
  const r = P.recordTestResult("sq/lesson-1", 7, 10, 100);
  assert.equal(r.status, "new");
  assert.equal(r.best.score, 7);
  assert.equal(r.best.of, 10);
  assert.equal(P.getBest("sq/lesson-1").t, 100, "epoch ms stored");
});

test("PB: a bigger score replaces it ('new')", () => {
  const { P } = loadProgress();
  P.recordTestResult("sq/lesson-1", 7, 10, 1);
  const r = P.recordTestResult("sq/lesson-1", 9, 10, 2);
  assert.equal(r.status, "new");
  assert.equal(P.getBest("sq/lesson-1").score, 9);
});

test("PB: a tie keeps the old one ('tie')", () => {
  const { P } = loadProgress();
  P.recordTestResult("sq/lesson-1", 8, 10, 1);
  const r = P.recordTestResult("sq/lesson-1", 8, 10, 2);
  assert.equal(r.status, "tie");
  assert.equal(P.getBest("sq/lesson-1").t, 1, "the old record (and its date) is kept");
});

test("PB: a lower score keeps the old one ('lower')", () => {
  const { P } = loadProgress();
  P.recordTestResult("sq/lesson-1", 9, 10, 1);
  const r = P.recordTestResult("sq/lesson-1", 4, 10, 2);
  assert.equal(r.status, "lower");
  assert.equal(r.best.score, 9);
  assert.equal(P.getBest("sq/lesson-1").score, 9);
});

test("PB: a changed test size (deck changed) replaces it even when lower", () => {
  const { P } = loadProgress();
  P.recordTestResult("es/alphabet-digraphs", 3, 3, 1);
  const r = P.recordTestResult("es/alphabet-digraphs", 2, 4, 2);
  assert.equal(r.status, "new");
  assert.equal(P.getBest("es/alphabet-digraphs").of, 4);
});

test("PB: impossible input is refused and nothing changes", () => {
  const { P } = loadProgress();
  P.recordTestResult("sq/lesson-1", 5, 10, 1);
  for (const [s, o] of [[11, 10], [-1, 10], [2.5, 10], [1, 0], ["5", 10], [NaN, 10]]) {
    const r = P.recordTestResult("sq/lesson-1", s, o, 2);
    assert.equal(r.status, "lower");
  }
  assert.equal(P.getBest("sq/lesson-1").score, 5);
});

test("PB and card ratings live side by side in one lesson record", () => {
  const { P } = loadProgress();
  P.record("sq/lesson-1", "1", true, 1);
  P.recordTestResult("sq/lesson-1", 1, 1, 2);
  P.record("sq/lesson-1", "2", true, 3);
  assert.equal(P.getBest("sq/lesson-1").score, 1, "a later rating keeps the best");
  assert.equal(P.knownCount("sq/lesson-1", deck(2)).known, 2);
});

/* --------------------------- storage + degrading -------------------------- */

test("only the languagebasics.progress key is ever touched (no lb.* keys)", () => {
  const { P, storage } = loadProgress();
  storage.seedRaw("lb.mastery", JSON.stringify({ v: 1, cards: { "sq/lesson-1:1": { best: 1 } } }));
  const touched = [];
  const g = storage.getItem.bind(storage), s = storage.setItem.bind(storage), r = storage.removeItem.bind(storage);
  storage.getItem = (k) => { touched.push(k); return g(k); };
  storage.setItem = (k, v) => { touched.push(k); return s(k, v); };
  storage.removeItem = (k) => { touched.push(k); return r(k); };
  P.record("sq/lesson-1", "1", true, 1);
  P.recordTestResult("sq/lesson-1", 1, 1, 1);
  P.knownCount("sq/lesson-1", deck(1));
  assert.ok(touched.length > 0);
  assert.ok(touched.every((k) => k === KEY), "touched: " + touched.join(","));
  assert.equal(P.isKnown("sq/lesson-1", "1"), true, "lb.mastery was never read into progress");
});

test("persistent=true with real storage; false when storage is blocked", () => {
  assert.equal(loadProgress().P.isPersistent(), true);
  const blocked = loadProgress({ throwOnSet: true });
  assert.equal(blocked.P.isPersistent(), false);
  // Still works for this session (memory mirror), never throws.
  assert.doesNotThrow(() => blocked.P.record("sq/lesson-1", "1", true, 1));
  assert.equal(blocked.P.isKnown("sq/lesson-1", "1"), true);
});

test("no LBStore at all: reads empty, writes no-op, never throws", () => {
  const sandbox = { window: {}, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(PROGRESS_SRC, sandbox, { filename: PROGRESS_PATH });
  const P = sandbox.window.LBProgress;
  assert.equal(P.record("sq/lesson-1", "1", true), false);
  assert.equal(P.knownCount("sq/lesson-1", deck(2)).known, 0);
  assert.equal(P.recordTestResult("sq/lesson-1", 1, 2).status, "new", "reported, but not saved");
  assert.equal(P.getBest("sq/lesson-1"), null);
  assert.equal(P.isPersistent(), false);
});

/* --------------------- LB-36: "__proto__" keys are skipped ------------------ */

test('a stored "__proto__" card key is skipped; it never swaps the cards map prototype', () => {
  const { P, storage } = loadProgress();
  storage.seedRaw(KEY, '{"v":1,"lessons":{"sq/lesson-1":{"cards":{' +
    '"__proto__":{"r":"knew","t":1},"7":{"r":"knew","t":2}}}}}');
  const lesson = P.getLesson("sq/lesson-1");
  assert.equal(Object.prototype.hasOwnProperty.call(lesson.cards, "7"), true, "the good record survives");
  assert.equal(Object.keys(lesson.cards).join(","), "7", "only the real card is kept");
  assert.equal(lesson.cards.r, undefined, "the bad record did not become the prototype");
  assert.equal(P.isKnown("sq/lesson-1", "7"), true);
  assert.deepEqual(Object.keys(P.knownMap("sq/lesson-1")), ["7"]);
  assert.equal(({}).r, undefined, "no global pollution");
});

test('record / recordTestResult refuse a "__proto__" lesson id or card prompt', () => {
  const { P, storage } = loadProgress();
  assert.equal(P.record("__proto__", 1, true, 5), false);
  assert.equal(P.record("sq/lesson-1", "__proto__", true, 5), false);
  assert.equal(P.recordTestResult("__proto__", 1, 2, 5).status, "lower");
  assert.equal(storage.getItem(KEY), null, "nothing written");
  assert.equal(P.getBest("__proto__"), null);
});
