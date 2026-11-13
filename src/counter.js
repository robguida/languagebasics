/* LanguageBasics page counter (LB-36).
 *
 * Vanilla JS, no build step, no fetch, no cookies. Works on file:// (it simply
 * does nothing there).
 *
 * One global: window.LBCounter. Counts page views with GoatCounter using a
 * plain image request. SHIPS DARK: while GOATCOUNTER_CODE below is "", it sends
 * nothing at all.
 *
 * What a ping carries, and nothing else:
 *   p   = "/languagebasics/" + the resolved lesson id (already whitelisted by
 *         the page bootstrap, re-checked here), e.g. /languagebasics/sq/lesson-1.
 *         Never built from location.pathname or location.search.
 *   r   = the referring SITE's origin only (e.g. https://www.google.com), and
 *         only when it is a different site. Same-site or unreadable -> left out.
 *   rnd = a cache-buster (GoatCounter ignores it).
 * Never q, s or t; never the query string. The image request itself sends no
 * Referer header (referrerPolicy "no-referrer").
 *
 * When it skips: no/invalid code, not https: (file://, http:), an automated
 * browser (navigator.webdriver), or a lesson id that fails the checks. At most
 * one ping per lesson id per page load. Every error is swallowed; it never
 * throws and never blocks the page.
 */
(function () {
  "use strict";

  // ---- the ONE config spot. Empty = dark (sends nothing). ----
  var GOATCOUNTER_CODE = "";

  // The code becomes part of a host name, so it must be a plain label.
  var CODE_RE = /^[a-z0-9-]{2,50}$/;
  // A constant base path, never read from location.
  var BASE_PATH = "/languagebasics/";
  // Lesson ids look like "sq/lesson-1" or "ja/alphabet-hiragana-1".
  var LESSON_RE = /^[a-z]{2,3}\/[a-z0-9-]{1,60}$/;

  var sentFor = {};

  function validCode(code) {
    return typeof code === "string" && CODE_RE.test(code);
  }

  /* The manifest whitelist, when it is loaded (it always is on the page). */
  function isAllowedLesson(lessonId, win) {
    if (typeof lessonId !== "string" || !LESSON_RE.test(lessonId)) return false;
    try {
      if (win && win.LBManifest && win.LB_LANGUAGES &&
          typeof win.LBManifest.buildAllowedMap === "function") {
        var allowed = win.LBManifest.buildAllowedMap(win.LB_LANGUAGES);
        return Object.prototype.hasOwnProperty.call(allowed, lessonId) &&
          allowed[lessonId] === true;
      }
    } catch (err) {
      return false;
    }
    return true; // no manifest (e.g. tests): the strict pattern above stands
  }

  /* Cross-site referrer ORIGIN only, else "". */
  function referrerOrigin(referrer, pageOrigin) {
    try {
      if (typeof referrer !== "string" || referrer === "") return "";
      var origin = new URL(referrer).origin;
      if (!origin || origin === "null") return "";
      if (!/^https?:\/\//.test(origin)) return "";
      if (origin === pageOrigin) return "";
      return origin;
    } catch (err) {
      return "";
    }
  }

  /* buildUrl(code, lessonId, ref, rnd) -> the count URL, or "" when the code
   * or lesson id is not valid. Pure. */
  function buildUrl(code, lessonId, ref, rnd) {
    if (!validCode(code)) return "";
    if (typeof lessonId !== "string" || !LESSON_RE.test(lessonId)) return "";
    var url = "https://" + code + ".goatcounter.com/count" +
      "?p=" + encodeURIComponent(BASE_PATH + lessonId);
    if (ref) url += "&r=" + encodeURIComponent(ref);
    url += "&rnd=" + encodeURIComponent(String(rnd == null ? "" : rnd));
    return url;
  }

  /* ping(lessonId) -> true when an image request was started. */
  function ping(lessonId) {
    try {
      var win = (typeof window !== "undefined") ? window : null;
      if (!win) return false;
      var code = GOATCOUNTER_CODE;
      if (!validCode(code)) return false;                 // dark / bad code
      var loc = win.location;
      if (!loc || loc.protocol !== "https:") return false; // file://, http:
      var nav = win.navigator;
      if (nav && nav.webdriver === true) return false;     // automated browser
      if (!isAllowedLesson(lessonId, win)) return false;
      if (sentFor[lessonId] === true) return false;        // one per load
      var ImageCtor = win.Image;
      if (typeof ImageCtor !== "function") return false;

      var doc = win.document;
      var ref = referrerOrigin(doc ? doc.referrer : "", loc.origin);
      var rnd = Math.random().toString(36).slice(2, 10);
      var url = buildUrl(code, lessonId, ref, rnd);
      if (!url) return false;

      sentFor[lessonId] = true;
      var img = new ImageCtor();
      img.referrerPolicy = "no-referrer";
      img.onload = function () { /* ignore */ };
      img.onerror = function () { /* ignore: counting must never matter */ };
      img.src = url;
      return true;
    } catch (err) {
      return false;
    }
  }

  if (typeof window !== "undefined") {
    window.LBCounter = {
      ping: ping,
      buildUrl: buildUrl,
      referrerOrigin: referrerOrigin,
      isConfigured: function () { return validCode(GOATCOUNTER_CODE); },
      BASE_PATH: BASE_PATH
    };
  }
})();
