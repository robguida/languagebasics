/* LB-39 - the static privacy page and the three links to it.
 *
 * Node built-ins only. Reads the real src/ files. The Tab-trap checks drive
 * the REAL engine.js through the fake-DOM helper.
 *
 * Covers: the page ships in src/; it has no script, style block, inline style
 * or on* handler; its one outside address; the approved lines are present and
 * the banned wording is absent; the counter line is held while the page counter
 * is dark; the three links exist and the two always-on ones are not tagged
 * data-feature="testing"; the results dialog's Tab trap reaches the link and
 * wraps; page basics (one h1, lang, viewport).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeEngineEnv } = require("./helpers/engine-dom.js");

const SRC = path.resolve(__dirname, "..", "src");
const PAGE_PATH = path.join(SRC, "privacy.html");
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

/* Visible text of the page: tags dropped, quote entities decoded. */
function pageText(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ");
}

/* ------------------------------ the page ships ------------------------------ */

test("privacy.html ships in src/ (and is not parked)", () => {
  assert.ok(fs.existsSync(PAGE_PATH), "src/privacy.html exists");
  assert.ok(!fs.existsSync(path.resolve(__dirname, "..", "parked", "privacy.html")));
  assert.ok(fs.statSync(PAGE_PATH).size > 500, "not an empty stub");
});

test("privacy.html: no <script>, <style>, style= or on* handlers", () => {
  const html = fs.readFileSync(PAGE_PATH, "utf8");
  assert.ok(!/<script/i.test(html), "no <script>");
  assert.ok(!/<style/i.test(html), "no <style>");
  assert.ok(!/\sstyle\s*=/i.test(html), "no inline style=");
  assert.ok(!/\son[a-z]+\s*=/i.test(html), "no on* handler");
  assert.ok(!/javascript:/i.test(html), "no javascript: URL");
});

test("privacy.html: exactly one outside address, and it is https://bengusa.pro/privacy/", () => {
  const html = fs.readFileSync(PAGE_PATH, "utf8");
  const urls = html.match(/(?:https?:)?\/\/[^\s"'<>)]+/gi) || [];
  assert.deepEqual(urls, ["https://bengusa.pro/privacy/"]);
  // Every href/src is either that address or a relative file.
  const refs = [...html.matchAll(/\s(?:href|src)\s*=\s*"([^"]*)"/gi)].map((m) => m[1]);
  assert.ok(refs.length >= 3, "page has its stylesheet and links");
  for (const r of refs) {
    assert.ok(r === "https://bengusa.pro/privacy/" || !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(r), "outside ref: " + r);
  }
});

test("privacy.html: page basics (one h1, html lang=en, viewport meta, back link)", () => {
  const html = fs.readFileSync(PAGE_PATH, "utf8");
  assert.equal((html.match(/<h1[\s>]/gi) || []).length, 1, "exactly one h1");
  assert.match(html, /<html[^>]*\blang="en"/i);
  assert.match(html, /<meta[^>]*name="viewport"[^>]*width=device-width/i);
  assert.match(html, /<a href="index\.html">Back to lessons<\/a>/);
});

/* ------------------------------ the wording ------------------------------ */

const MUST_SAY = [
  "Your progress stays in this browser.",
  "Your lesson timer settings.",
  'Each card you marked "I knew it" or "Not yet", and when.',
  "Your best test score for each lesson.",
  "Your practice streak.",
  "Only in this browser, on this device.",
  "There is no account and no sign-in.",
  "No cookies. No ads. The app does not track you.",
  "Anyone who uses this browser on this device can see it.",
  "In a private window, nothing is kept once you close it.",
  "In your browser settings, clear the site data for bengusa.pro.",
  "This also wipes saved data for the other apps on bengusa.pro.",
  "The server that sends you these pages keeps normal web logs.",
  "If this changes, this note changes first.",
];

test("privacy.html: every approved line is present", () => {
  const text = pageText(fs.readFileSync(PAGE_PATH, "utf8"));
  for (const line of MUST_SAY) assert.ok(text.includes(line), "missing: " + line);
  for (const h of ["What we keep", "Where it lives", "How to delete it", "The pages themselves"]) {
    assert.ok(text.includes(h), "missing heading: " + h);
  }
});

test("privacy.html: banned wording is absent", () => {
  const raw = fs.readFileSync(PAGE_PATH, "utf8").toLowerCase();
  const text = pageText(fs.readFileSync(PAGE_PATH, "utf8")).toLowerCase();
  const banned = ["100% private", "anonymous", "secure", "encrypted", "only you can see",
    "gdpr", "ccpa", "compliant", "__probe__", "languagebasics.prefs", "languagebasics.progress", "languagebasics.streak"];
  for (const b of banned) {
    assert.ok(!text.includes(b), "banned wording present in text: " + b);
    assert.ok(!raw.includes(b), "banned wording present in markup: " + b);
  }
});

test("privacy.html: counter line is held while the page counter is dark (paired with counter.js)", () => {
  const m = read("counter.js").match(/var GOATCOUNTER_CODE\s*=\s*"([^"]*)"/);
  assert.ok(m, "GOATCOUNTER_CODE declaration found in counter.js");
  const text = pageText(fs.readFileSync(PAGE_PATH, "utf8"));
  const counterLine = /We count page visits/i.test(text);
  const neverSent = text.includes("It is never sent to us or anyone else.");
  if (m[1] === "") {
    assert.equal(counterLine, false, "counter dark: the counter line must not be on the page");
    assert.equal(neverSent, true, "counter dark: the 'never sent' claim is still true and stays");
  } else {
    assert.equal(counterLine, true, "counter on: the page must say it counts visits");
    assert.equal(neverSent, false, "counter on: 'never sent to us' is no longer true and must go");
  }
});

/* ------------------------------ the three links ------------------------------ */

/* Walk index.html (scripts and comments stripped) and report, for the element
 * with the given id, its own attributes and the open tags that enclose it. */
function ancestorsOf(html, id) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/gi, "<script></script>");
  const VOID = new Set(["meta", "link", "input", "br", "img", "hr", "source", "area", "base", "col", "wbr"]);
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const close = m[1], t = m[2].toLowerCase(), attrs = m[3];
    if (close) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === t) { stack.length = i; break; }
      continue;
    }
    const idm = attrs.match(/\bid="([^"]*)"/);
    if (idm && idm[1] === id) return { found: true, attrs, ancestors: stack.slice() };
    if (!VOID.has(t) && !/\/\s*$/.test(attrs)) stack.push({ tag: t, attrs });
  }
  return { found: false, attrs: "", ancestors: [] };
}
const taggedTesting = (a) => /data-feature="testing"/.test(a.attrs);

const LINKS = ["privacyLink", "settingsPrivacyLink", "resultsPrivacyLink"];

test("index.html: all three privacy links exist and point at privacy.html", () => {
  const html = read("index.html");
  for (const id of LINKS) {
    const r = ancestorsOf(html, id);
    assert.ok(r.found, "#" + id + " exists");
    assert.match(r.attrs, /\bhref="privacy\.html"/, "#" + id + " href");
  }
});

test("index.html: #privacyLink and #settingsPrivacyLink are NOT under any data-feature=testing element", () => {
  const html = read("index.html");
  for (const id of ["privacyLink", "settingsPrivacyLink"]) {
    const r = ancestorsOf(html, id);
    assert.ok(r.found, "#" + id + " exists");
    assert.ok(!taggedTesting(r), "#" + id + " itself not tagged");
    for (const a of r.ancestors) {
      assert.ok(!taggedTesting(a), "#" + id + " sits inside a tagged <" + a.tag + "> and would vanish with testing:false");
    }
  }
});

test("index.html: the results link is inside the results dialog (the testing-only part)", () => {
  const r = ancestorsOf(read("index.html"), "resultsPrivacyLink");
  assert.ok(r.ancestors.some((a) => /\bid="resultModal"/.test(a.attrs)), "inside #resultModal");
});

/* ------------------------------ results Tab trap ------------------------------ */

function lessonOf(n) {
  const cards = [];
  for (let i = 1; i <= n; i++) cards.push({ prompt: i, answer: "w" + i, hint: "h" + i });
  return { id: "sq/lb39", title: "LB39", revealMs: 5000, cards };
}

/* Open the real results dialog and install a selector-aware querySelectorAll
 * that returns the dialog's focusables in DOM order: Close, Practice (hidden),
 * Again, Done, then the privacy link. It honours only the selector parts
 * "button" and "a[href]", so the ENGINE's selector decides what is reachable. */
function trapEnv() {
  const h = makeEngineEnv({ modules: ["game.js"], window: {
    LBProgress: {
      record() { return true; },
      knownMap() { return {}; },
      knownCount(i, d) { return { known: 0, total: d.length }; },
      recordTestResult(i, s, o) { return { status: "new", best: { score: s, of: o } }; },
      isPersistent() { return true; },
    },
    LBStreak: { markActive() {} },
  } });
  let active = null;
  const els = h.elements;
  const link = { tagName: "A", id: "resultsPrivacyLink", hidden: false, focus() { active = link; } };
  for (const id of ["resultClose", "resultPracticeBtn", "resultAgainBtn", "resultDoneBtn", "resultTitle"]) {
    els[id].focus = () => { active = els[id]; };
  }
  const order = [els.resultClose, els.resultPracticeBtn, els.resultAgainBtn, els.resultDoneBtn, link];
  els.resultModal.querySelectorAll = (sel) => {
    const parts = String(sel).split(",").map((s) => s.trim());
    return order.filter((n) => (n.tagName === "BUTTON" && parts.includes("button")) || (n.tagName === "A" && parts.includes("a[href]")));
  };
  els.resultModal.contains = () => true;
  // Take over activeElement so a test can place focus on any node, link included.
  Object.defineProperty(h.sandbox.document, "activeElement", { get: () => active, configurable: true });
  h.engine.startTest(lessonOf(2));
  for (let i = 0; i < 2; i++) { h.click("toggleBtn"); h.advance(500); h.click("rateKnewBtn"); }
  assert.ok(h.resultOpen(), "results open");
  els.resultPracticeBtn.hidden = true; // nothing missed, so Practice stays hidden
  return { h, link, els, setActive: (n) => { active = n; }, getActive: () => active };
}

test("results Tab trap: Tab on the privacy link wraps to the Close button", () => {
  const t = trapEnv();
  t.setActive(t.link);
  const prevented = t.h.keydown("Tab", null, { shiftKey: false });
  assert.equal(prevented, true, "wrap prevents the browser default");
  assert.equal(t.getActive(), t.els.resultClose, "focus wrapped to the first control");
});

test("results Tab trap: Shift+Tab from the title (outside the list) lands on the privacy link, the last stop", () => {
  const t = trapEnv();
  t.setActive(t.els.resultTitle);
  const prevented = t.h.keydown("Tab", null, { shiftKey: true });
  assert.equal(prevented, true);
  assert.equal(t.getActive(), t.link, "the link is the last stop, so it is reachable");
});

test("results Tab trap: Shift+Tab on Close wraps to the link; Tab on Done is left to the browser (link comes next)", () => {
  const t = trapEnv();
  t.setActive(t.els.resultClose);
  t.h.keydown("Tab", null, { shiftKey: true });
  assert.equal(t.getActive(), t.link, "Shift+Tab from the first control wraps to the link");
  t.setActive(t.els.resultDoneBtn);
  const prevented = t.h.keydown("Tab", null, { shiftKey: false });
  assert.equal(prevented, false, "Done is no longer last, so the browser moves focus on to the link itself");
});

test("index.html: Done button comes before the results privacy link (the Tab order the trap tests assume)", () => {
  const html = read("index.html");
  const done = html.indexOf('id="resultDoneBtn"');
  const link = html.indexOf('id="resultsPrivacyLink"');
  assert.ok(done > -1 && link > -1, "both ids exist");
  assert.ok(done < link, "resultDoneBtn precedes resultsPrivacyLink");
});

test("styles.css: .privacy-link-modal hover/focus colour is set and is not white", () => {
  const css = read("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) =>
    /\.privacy-link-modal:(hover|focus-visible)/.test(m[1]) && /(^|;|\s)color\s*:/.test(m[2]));
  assert.ok(rules.length >= 1, "a .privacy-link-modal :hover/:focus-visible rule sets a colour");
  for (const m of rules) {
    const col = m[2].match(/(?:^|;|\s)color\s*:\s*([^;]+)/)[1].trim().toLowerCase();
    assert.ok(!/^(#fff|#ffffff|white)$/.test(col), "hover/focus colour must not be white, got " + col);
  }
});
