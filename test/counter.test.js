/* LB-36: window.LBCounter — the GoatCounter page counter (ships dark).
 *
 * Run:  node --test
 *
 * Loads the REAL src/counter.js into a node:vm sandbox with a fake window
 * (location, document.referrer, navigator, Image). Image is a SPY that counts
 * every construction, so "never sends" is proven by a count of 0 — not by the
 * absence of a throw. To test a configured counter, the test swaps the code
 * constant in the source text (the one config spot), exactly as a release
 * would.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadManifest } = require("./helpers/load-lesson.js");

const COUNTER_PATH = path.resolve(__dirname, "..", "src", "counter.js");
const COUNTER_SRC = fs.readFileSync(COUNTER_PATH, "utf8");
const DARK_LINE = 'var GOATCOUNTER_CODE = "";';

function withCode(code) {
  assert.ok(COUNTER_SRC.includes(DARK_LINE), "the one config line exists and ships empty");
  return COUNTER_SRC.replace(DARK_LINE, "var GOATCOUNTER_CODE = " + JSON.stringify(code) + ";");
}

function load(src, opts) {
  opts = opts || {};
  const images = [];
  function ImageSpy() {
    const img = { src: "", referrerPolicy: "", onload: null, onerror: null };
    images.push(img);
    if (opts.imageThrows) throw new Error("no images here");
    return img;
  }
  const href = opts.href || "https://bengusa.pro/languagebasics/?lesson=sq/lesson-1&secret=1";
  const u = new URL(href);
  const win = {
    location: { protocol: u.protocol, origin: u.origin, href, pathname: u.pathname, search: u.search },
    document: { referrer: opts.referrer == null ? "" : opts.referrer },
    navigator: { webdriver: !!opts.webdriver },
    Image: ImageSpy,
  };
  if (opts.manifest) {
    const { languages, LBManifest } = loadManifest();
    win.LB_LANGUAGES = languages;
    win.LBManifest = LBManifest;
  }
  const sandbox = { window: win, URL, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: COUNTER_PATH });
  return { C: win.LBCounter, images, win };
}

test("ships dark: no code -> no Image is ever created", () => {
  const { C, images } = load(COUNTER_SRC, { manifest: true });
  assert.equal(C.isConfigured(), false);
  assert.equal(C.ping("sq/lesson-1"), false);
  assert.equal(images.length, 0, "Image constructed 0 times");
});

test("a bad code never sends (it could otherwise inject a host)", () => {
  for (const bad of ["evil.com/x", "a", "UPPER", "has space", "x".repeat(51), "ok?x=1", "a@b"]) {
    const { C, images } = load(withCode(bad), { manifest: true });
    assert.equal(C.ping("sq/lesson-1"), false, bad);
    assert.equal(images.length, 0, bad + ": Image constructed 0 times");
  }
});

test("configured: one image ping with a clean path and no Referer header", () => {
  const { C, images } = load(withCode("languagebasics-test"), { manifest: true });
  assert.equal(C.ping("sq/lesson-1"), true);
  assert.equal(images.length, 1);
  const img = images[0];
  assert.equal(img.referrerPolicy, "no-referrer");
  const u = new URL(img.src);
  assert.equal(u.origin, "https://languagebasics-test.goatcounter.com");
  assert.equal(u.pathname, "/count");
  assert.equal(u.searchParams.get("p"), "/languagebasics/sq/lesson-1");
  for (const banned of ["q", "s", "t", "b"]) assert.equal(u.searchParams.has(banned), false, banned + " never sent");
  assert.ok(!img.src.includes("secret"), "never the page's query string");
  assert.ok(!img.src.includes("lesson%3Dsq"), "never location.search");
  assert.equal(u.searchParams.has("r"), false, "no referrer -> no r");
  assert.ok(u.searchParams.get("rnd"), "cache-buster present");
});

test("one ping per load (per lesson id)", () => {
  const { C, images } = load(withCode("lbtest"), { manifest: true });
  C.ping("sq/lesson-1");
  C.ping("sq/lesson-1");
  C.ping("sq/lesson-1");
  assert.equal(images.length, 1);
});

test("file:// and http: never send", () => {
  for (const href of ["file:///C:/x/src/index.html?lesson=sq/lesson-1", "http://bengusa.pro/languagebasics/"]) {
    const { C, images } = load(withCode("lbtest"), { href, manifest: true });
    assert.equal(C.ping("sq/lesson-1"), false, href);
    assert.equal(images.length, 0, href);
  }
});

test("an automated browser (navigator.webdriver) never sends", () => {
  const { C, images } = load(withCode("lbtest"), { webdriver: true, manifest: true });
  assert.equal(C.ping("sq/lesson-1"), false);
  assert.equal(images.length, 0);
});

test("referrer: only a cross-site ORIGIN, never a path or query", () => {
  const cross = load(withCode("lbtest"), { referrer: "https://www.google.com/search?q=albanian+numbers", manifest: true });
  cross.C.ping("sq/lesson-1");
  const u = new URL(cross.images[0].src);
  assert.equal(u.searchParams.get("r"), "https://www.google.com");
  assert.ok(!cross.images[0].src.includes("albanian"), "the referrer's query never leaves");

  const same = load(withCode("lbtest"), { referrer: "https://bengusa.pro/other-page?x=1", manifest: true });
  same.C.ping("sq/lesson-1");
  assert.equal(new URL(same.images[0].src).searchParams.has("r"), false, "same site -> no r");

  const junk = load(withCode("lbtest"), { referrer: "not a url", manifest: true });
  junk.C.ping("sq/lesson-1");
  assert.equal(new URL(junk.images[0].src).searchParams.has("r"), false, "unparseable -> no r");
});

test("lesson id must be whitelisted (manifest) and well-formed", () => {
  const { C, images } = load(withCode("lbtest"), { manifest: true });
  for (const bad of ["sq/lesson-5", "../../etc", "sq/lesson-1?x=1", "sq/<script>", "", null, 42, "zz/lesson-1"]) {
    assert.equal(C.ping(bad), false, String(bad));
  }
  assert.equal(images.length, 0);
});

test("an Image that throws or errors is swallowed; ping never throws", () => {
  const { C } = load(withCode("lbtest"), { imageThrows: true, manifest: true });
  assert.doesNotThrow(() => C.ping("sq/lesson-1"));
  const ok = load(withCode("lbtest"), { manifest: true });
  ok.C.ping("sq/lesson-1");
  assert.doesNotThrow(() => ok.images[0].onerror());
  assert.doesNotThrow(() => ok.images[0].onload());
});

test("buildUrl is pure and refuses bad input", () => {
  const { C } = load(COUNTER_SRC);
  assert.equal(C.buildUrl("", "sq/lesson-1", "", "x"), "");
  assert.equal(C.buildUrl("ok-code", "bad id", "", "x"), "");
  assert.equal(C.buildUrl("ok-code", "sq/lesson-1", "", "abc"),
    "https://ok-code.goatcounter.com/count?p=%2Flanguagebasics%2Fsq%2Flesson-1&rnd=abc");
});

test("index.html loads counter.js with a relative path and pings the resolved lesson id", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "..", "src", "index.html"), "utf8");
  assert.ok(html.includes('<script src="counter.js"></script>'));
  assert.ok(/LBCounter\.ping\(window\.LB_LESSON\.id\)/.test(html), "pings the loaded (whitelisted) lesson id");
  assert.ok(!/LBCounter\.ping\([^)]*location/.test(html), "never from location");
});
