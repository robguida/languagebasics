/* Test helper (LB-36): a small fake DOM + sandbox for driving the REAL
 * engine.js test flow headless, optionally with the REAL game.js, store.js,
 * progress.js and streak.js loaded over the in-memory localStorage shim.
 *
 * Node built-ins only (node:fs, node:path, node:vm). No jsdom.
 *
 * What it models (just enough for the engine):
 *   - elements by id with hidden / textContent / innerHTML / style / onclick /
 *     classList / setAttribute / focus, plus tiny child lists for the results
 *     list (createElement / createTextNode / appendChild / removeChild);
 *   - document keydown listeners (with event.target support);
 *   - ONE captured setTimeout callback (the reveal timer) fired on demand;
 *   - a controllable wall clock for the 500 ms rating lock (LBEngine._setClock).
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { makeLocalStorage } = require("./local-storage-shim.js");

const SRC = path.resolve(__dirname, "..", "..", "src");

const IDS = [
  "number", "word", "pronunciation", "label", "recall", "bar", "toggleBtn", "title",
  "testProgress", "studyControls", "rateControls", "rateKnewBtn", "rateNotYetBtn",
  "testMeWrap", "testMeBtn", "stopTestBtn", "studyHint", "testHint",
  "resultModal", "resultTitle", "resultScore", "resultBest", "resultLesson",
  "resultListHead", "resultList", "resultNone", "resultFooter", "resultAnnounce",
  "resultClose", "resultPracticeBtn", "resultAgainBtn", "resultDoneBtn",
  "masteryReadout", "masteryLesson", "streakCount",
];

const TAGS = {
  toggleBtn: "BUTTON", rateKnewBtn: "BUTTON", rateNotYetBtn: "BUTTON", testMeBtn: "BUTTON",
  stopTestBtn: "BUTTON", resultClose: "BUTTON", resultPracticeBtn: "BUTTON",
  resultAgainBtn: "BUTTON", resultDoneBtn: "BUTTON", resultList: "UL",
};

function makeNode(tag) {
  const node = {
    tagName: tag || "DIV",
    hidden: false,
    textContent: "",
    innerHTML: "",
    className: "",
    style: {},
    offsetWidth: 0,
    onclick: null,
    attrs: {},
    children: [],
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener() {},
    removeEventListener() {},
  };
  return node;
}

/* Flatten a node's visible text (text nodes + textContent). */
function textOf(node) {
  if (!node) return "";
  if (node.nodeType === 3) return node.data;
  if (node.tagName === "BR") return "\n";
  let out = node.textContent || "";
  for (const c of node.children || []) out += textOf(c);
  return out;
}

/**
 * @param {object} [opts]
 *   opts.modules: array of src file names to load before engine.js
 *                 (e.g. ["store.js","game.js","progress.js","streak.js"]).
 *   opts.window:  extra window props (stubs) merged in BEFORE modules load.
 *   opts.storage: a localStorage shim (default: a fresh one when store.js loads).
 *   opts.throwOnSet: pass through to the shim (blocked storage).
 */
function makeEngineEnv(opts) {
  opts = opts || {};
  const elements = {};
  let focused = null;
  for (const id of IDS) {
    const el = makeNode(TAGS[id]);
    el.id = id;
    el.focus = () => { focused = el; };
    if (id === "resultModal") {
      el.classes = new Set();
      el.classList = {
        add: (c) => el.classes.add(c),
        remove: (c) => el.classes.delete(c),
        contains: (c) => el.classes.has(c),
      };
      el.querySelectorAll = () => [];
      el.contains = () => true;
    }
    elements[id] = el;
  }
  const cardEl = makeNode("SECTION");
  cardEl.id = "(card)";
  cardEl.focus = () => { focused = cardEl; };
  const timerWrap = makeNode("DIV");
  timerWrap.id = "(timer)";

  const docListeners = [];
  const documentShim = {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => (sel === ".card" ? cardEl : sel === ".timer" ? timerWrap : null),
    addEventListener(type, fn, capture) { docListeners.push({ type, fn, capture: !!capture }); },
    removeEventListener(type, fn, capture) {
      const i = docListeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture);
      if (i >= 0) docListeners.splice(i, 1);
    },
    createElement: (tag) => makeNode(String(tag).toUpperCase()),
    createTextNode: (data) => ({ nodeType: 3, data: String(data) }),
    get activeElement() { return focused; },
    title: "",
  };

  let timerCb = null;
  let clock = 1000000;
  const warnings = [];

  const windowShim = Object.assign({ LB_LESSONS: [] }, opts.window || {});
  const needsStore = (opts.modules || []).includes("store.js");
  const storage = opts.storage || (needsStore ? makeLocalStorage({ throwOnSet: !!opts.throwOnSet }) : undefined);
  if (storage) windowShim.localStorage = storage;

  const sandbox = {
    window: windowShim,
    document: documentShim,
    console: { warn: (...a) => warnings.push(a), log() {} },
    setTimeout: (fn) => { timerCb = fn; return 1; },
    clearTimeout: () => { timerCb = null; },
  };
  vm.createContext(sandbox);
  for (const m of opts.modules || []) {
    const file = path.join(SRC, m);
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  const enginePath = path.join(SRC, "engine.js");
  vm.runInContext(fs.readFileSync(enginePath, "utf8"), sandbox, { filename: enginePath });
  const engine = windowShim.LBEngine;
  engine._setClock(() => clock);

  function keydown(key, target, extra) {
    let prevented = false;
    const ev = Object.assign({ key, target: target || null, preventDefault: () => { prevented = true; } }, extra || {});
    for (const l of docListeners.slice()) if (l.type === "keydown") l.fn(ev);
    return prevented;
  }

  return {
    engine, window: windowShim, elements, cardEl, timerWrap, storage, warnings, sandbox,
    get focused() { return focused; },
    advance(ms) { clock += ms; },
    fireTimer() { const cb = timerCb; if (cb) cb(); },
    timerPending() { return timerCb != null; },
    click(id) { const el = elements[id]; if (el && typeof el.onclick === "function") el.onclick({ target: el }); },
    keydown,
    listenerCount(type) { return docListeners.filter((l) => l.type === type).length; },
    resultOpen() { return elements.resultModal.classes.has("open"); },
    listTexts() { return elements.resultList.children.map(textOf); },
  };
}

module.exports = { makeEngineEnv, textOf, IDS };
