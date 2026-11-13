/* LB-34: the "testing" feature flag + parked number lessons.
 *
 * Proves, with Node built-ins only (no deps):
 *   - flag OFF: every testing/scoring piece of markup is removed from the
 *     page and the engine cannot start a test (LB-36: Leitner order, the Test
 *     mode switch and the quiz-count setting are retired, not just hidden);
 *   - flag ON: the markup stays and the engine paths work again (recoverable);
 *   - lessons 5 and 6 are gone from the picker, whitelist and rollup counts in
 *     all four languages, and a typed ?lesson= for them is rejected, while
 *     their data files stay recoverable in parked/.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadLesson, loadManifest, parkedDir, contentDir } = require("./helpers/load-lesson.js");

const SRC = path.resolve(__dirname, "..", "src");
const FEATURES_SRC = fs.readFileSync(path.join(SRC, "features.js"), "utf8");
const ENGINE_SRC = fs.readFileSync(path.join(SRC, "engine.js"), "utf8");
const INDEX_HTML = fs.readFileSync(path.join(SRC, "index.html"), "utf8");

// Every id that is about testing/scoring and must be tagged for removal (LB-36).
const TESTING_IDS = [
  "streakCount", "masteryReadout", "testProgress", "rateControls",
  "testMeWrap", "stopTestBtn", "testHint", "resultModal",
];

/* ---------------------------- fake DOM for features.js -------------------- */

function fakeDocument(tagged) {
  const live = [];
  for (const t of tagged) {
    const node = { id: t.id, parentNode: null };
    node.parentNode = {
      removeChild(n) {
        const i = live.indexOf(n);
        if (i >= 0) live.splice(i, 1);
        n.parentNode = null;
      },
    };
    live.push(node);
  }
  return {
    live,
    querySelectorAll(sel) {
      return sel === '[data-feature="testing"]' ? live.slice() : [];
    },
  };
}

function runFeatures(src, doc) {
  const sandbox = { window: {}, document: doc, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "features.js" });
  return sandbox.window;
}

/* ---------------------------- flag default + markup ----------------------- */

test("features.js ships with testing OFF", () => {
  const w = runFeatures(FEATURES_SRC, fakeDocument([]));
  assert.equal(w.LB_FEATURES.testing, false);
  assert.equal(w.LBFeatures.isOn("testing"), false);
});

test("flag OFF: all data-feature=testing markup is removed (unreachable)", () => {
  const doc = fakeDocument(TESTING_IDS.map((id) => ({ id })));
  runFeatures(FEATURES_SRC, doc);
  assert.equal(doc.live.length, 0, "no testing node may remain in the page");
});

test("flag ON: the same markup stays in the page (recoverable)", () => {
  const doc = fakeDocument(TESTING_IDS.map((id) => ({ id })));
  const on = FEATURES_SRC.replace("{ testing: false }", "{ testing: true }");
  assert.notEqual(on, FEATURES_SRC, "flip must change the source");
  const w = runFeatures(on, doc);
  assert.equal(w.LBFeatures.isOn("testing"), true);
  assert.equal(doc.live.length, TESTING_IDS.length, "nothing removed when on");
});

test("a missing flag object counts as ON (other environments unchanged)", () => {
  const w = runFeatures(FEATURES_SRC, fakeDocument([]));
  w.LB_FEATURES = undefined;
  assert.equal(w.LBFeatures.isOn("testing"), true);
});

test("a node that fails to detach does not abort removal of the rest", () => {
  const doc = fakeDocument([{ id: "a" }, { id: "b" }, { id: "c" }]);
  doc.live[0].parentNode = { removeChild() { throw new Error("boom"); } };
  runFeatures(FEATURES_SRC, doc);
  assert.deepEqual(doc.live.map((n) => n.id), ["a"], "only the failing node remains");
});

function tagFor(re) {
  const m = re.exec(INDEX_HTML);
  assert.ok(m, "markup not found: " + re);
  return /data-feature="testing"/.test(m[0]);
}

test("index.html: every testing/scoring/quizzing element is tagged", () => {
  for (const id of TESTING_IDS) {
    assert.ok(tagFor(new RegExp('<[a-z]+[^>]*id="' + id + '"[^>]*>')), "#" + id + " must be tagged");
  }
});

test("LB-36: retired UI is gone from index.html (switch, card order, quiz count, rollup, Leitner/mastery scripts)", () => {
  for (const gone of ['id="testModeToggle"', 'class="test-switch"', 'name="cardOrder"', 'name="quizCount"',
    "Card order", "Number of questions for Quizzes", 'id="masteryOverall"', 'id="testControls"',
    'src="leitner.js"', 'src="mastery.js"', 'id="resultTime"']) {
    assert.ok(!INDEX_HTML.includes(gone), gone + " must be gone");
  }
  assert.ok(!fs.existsSync(path.join(SRC, "leitner.js")), "leitner.js retired");
  assert.ok(!fs.existsSync(path.join(SRC, "mastery.js")), "mastery.js retired");
  for (const s of ["progress.js", "game.js", "streak.js", "counter.js"]) {
    assert.ok(INDEX_HTML.includes('<script src="' + s + '">'), s + " loaded");
  }
});

test("index.html: plain study controls are NOT tagged; flag loads first; paths are relative", () => {
  for (const id of ["toggleBtn", "studyControls", "revealSeconds", "lessonPicker", "languagePicker", "settingsBtn", "settingsModal"]) {
    const m = new RegExp('<[a-z]+[^>]*id="' + id + '"[^>]*>').exec(INDEX_HTML);
    assert.ok(m, "#" + id + " must exist");
    assert.ok(!/data-feature=/.test(m[0]), "#" + id + " (plain study) must stay");
  }
  const iFeat = INDEX_HTML.indexOf('<script src="features.js">');
  assert.ok(iFeat > 0, "features.js must be loaded");
  assert.ok(iFeat < INDEX_HTML.indexOf('<script src="content/languages.js">'), "before the manifest");
  assert.ok(iFeat < INDEX_HTML.indexOf('<script src="engine.js">'), "before the engine");
  assert.ok(!/src="\//.test(INDEX_HTML), "no root-absolute script paths");
});

/* ---------------------------- engine guards ------------------------------- */

/* opts.onTimeout(fn, delay) sees every setTimeout call, so a test can check
 * the real reveal delay (the plain stub throws the delay away). */
function engineSandbox(win, opts) {
  const ids = ["number", "word", "pronunciation", "label", "recall", "bar", "toggleBtn", "title",
    "testProgress", "studyControls", "rateControls", "rateKnewBtn", "rateNotYetBtn", "resultModal",
    "resultScore", "resultClose", "resultDoneBtn"];
  const elements = {};
  for (const id of ids) {
    elements[id] = {
      id, style: {}, hidden: false, textContent: "", innerHTML: "", offsetWidth: 0, onclick: null,
      classList: { add() {}, remove() {} },
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {},
    };
  }
  const documentShim = {
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  const windowShim = Object.assign({ LB_LESSONS: [] }, win);
  const sandbox = {
    window: windowShim, document: documentShim,
    console: { warn() {}, log() {} },
    setTimeout: (fn, delay) => { if (opts && opts.onTimeout) opts.onTimeout(fn, delay); return 0; },
    clearTimeout: () => {}, Math, String, Array,
  };
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SRC, sandbox, { filename: "engine.js" });
  return { engine: sandbox.window.LBEngine, elements };
}

const LESSON = { id: "sq/lesson-1", title: "X", cards: [{ prompt: 1, answer: "në" }, { prompt: 2, answer: "dy" }] };

/* Reveal timer with the flag OFF: the delay handed to setTimeout must be a
 * real number of ms (saved setting, else the lesson's, else the 5000 default). */
function firstRevealDelay(win, lesson) {
  const delays = [];
  const { engine } = engineSandbox(win, { onTimeout: (fn, d) => delays.push(d) });
  engine.start(lesson);
  assert.ok(delays.length > 0, "a reveal timeout was scheduled");
  return delays[0];
}

test("flag OFF: the saved reveal-timer setting drives the reveal delay", () => {
  const d = firstRevealDelay({
    LB_FEATURES: { testing: false },
    LBPrefs: { getRevealMs: () => 7000 },
  }, LESSON);
  assert.equal(typeof d, "number", "delay must be a number");
  assert.equal(d, 7000);
});

test("flag OFF, no saved setting: reveal delay is the lesson's revealMs, else 5000", () => {
  const withMs = firstRevealDelay({ LB_FEATURES: { testing: false } },
    Object.assign({}, LESSON, { revealMs: 10000 }));
  assert.equal(typeof withMs, "number");
  assert.equal(withMs, 10000);
  const dflt = firstRevealDelay({ LB_FEATURES: { testing: false } }, LESSON);
  assert.equal(typeof dflt, "number");
  assert.equal(dflt, 5000);
});

test("flag OFF: startTest never starts a test; flag ON: it does", () => {
  let pools = 0;
  const game = { buildTestPool: (deck) => { pools++; return deck.slice(); } };
  const off = engineSandbox({ LB_FEATURES: { testing: false }, LBGame: game });
  off.engine.startTest(LESSON);
  assert.equal(pools, 0, "no test pool built while testing is off");

  const on = engineSandbox({ LB_FEATURES: { testing: true }, LBGame: game });
  on.engine.startTest(LESSON);
  assert.equal(pools, 1, "test pool built when testing is on");
});

test("LB-36: Leitner is retired — a stored order and an LBLeitner global are never used", () => {
  let called = 0;
  const { engine, elements } = engineSandbox({
    LB_FEATURES: { testing: true },
    LBPrefs: { getOrder: () => "leitner" },
    LBLeitner: { nextCard: (id, deck) => { called++; return deck[1]; } },
  });
  engine.start(LESSON);
  assert.equal(called, 0, "LBLeitner.nextCard called 0 times");
  assert.ok(["1", "2"].includes(String(elements.number.textContent)), "plain random study");
});

/* ---------------------------- parked lessons 5 and 6 ---------------------- */

const LANGS = ["sq", "es", "ja", "bn"];

test("lessons 5 and 6 are not in the manifest, picker, whitelist or counts (all 4 languages)", () => {
  const { languages, LBManifest } = loadManifest();
  const allowed = LBManifest.buildAllowedMap(languages);
  const counts = LBManifest.buildLessonCounts(languages);
  for (const lang of LANGS) {
    for (const n of [5, 6]) {
      const id = lang + "/lesson-" + n;
      assert.ok(!allowed[id], id + " must be rejected by the ?lesson= whitelist");
      assert.equal(counts[id], undefined, id + " must have no count");
    }
    const values = LBManifest.buildPickerModel(languages, lang)
      .groups.flatMap((g) => g.options.map((o) => o.value));
    assert.ok(!values.some((v) => /lesson-[56]$/.test(v)), lang + " picker must not list lessons 5/6");
    assert.ok(values.includes(lang + "/lesson-4"), lang + " lesson 4 stays");
  }
});

test("rollup still adds up: 4 counted number decks per language, none from 5/6", () => {
  const { languages, LBManifest } = loadManifest();
  for (const lang of LANGS) {
    const rows = LBManifest.listLessonsForLanguage(languages, lang);
    const numbers = rows.filter((r) => /\/lesson-\d$/.test(r.id));
    assert.equal(numbers.length, 4, lang + ": 4 number lessons");
    assert.ok(numbers.every((r) => r.rollup === true));
  }
});

test("lessons 5 and 6 data files are parked, recoverable, and not under src/", () => {
  for (const lang of LANGS) {
    for (const n of [5, 6]) {
      assert.ok(!fs.existsSync(path.join(contentDir(lang), "lesson-" + n + ".js")),
        lang + "/lesson-" + n + ".js must not ship in src/");
      const { lesson } = loadLesson("lesson-" + n + ".js", lang, { parked: true });
      assert.equal(lesson.id, lang + "/lesson-" + n, "parked file still loads and keeps its id");
      assert.equal(lesson.cards.length, n === 5 ? 56 : 6, lang + "/lesson-" + n + " card count intact");
    }
  }
  assert.ok(parkedDir("sq").includes("parked"));
});
