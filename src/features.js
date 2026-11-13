/* LanguageBasics — FEATURE FLAGS (LB-34).
 *
 * Vanilla JS, no build step, no fetch, file:// safe. Loaded as a plain <script>
 * in index.html BEFORE the code that reads it.
 *
 * ONE switch: window.LB_FEATURES.testing
 *
 *   false (shipped) => every testing / scoring / quizzing piece is OFF for users:
 *                      the Test mode switch, the "Number of questions for
 *                      Quizzes" setting, the results modal, the mastery
 *                      readouts (header overall + per-lesson), the streak
 *                      display, and the Random/Leitner card-order setting
 *                      (cards are always plain random). Plain flashcard study
 *                      is unchanged.
 *   true            => all of it comes back. The code is all still here.
 *
 * TO TURN TESTING BACK ON: change `testing: false` to `testing: true` below.
 * Nothing else needs to change.
 *
 * HOW "OFF" WORKS: markup tagged data-feature="testing" in index.html is
 * REMOVED from the page when the flag is off, so it cannot be seen or reached
 * (not merely hidden). The engine / bootstrap also check the flag, so the code
 * paths cannot start a test or use Leitner order even if called directly. Old
 * localStorage state (order pref, quiz count, mastery, streak) is simply ignored
 * while off and is still there when the flag is turned back on.
 *
 * A missing flag object (e.g. the engine unit-test sandboxes) counts as ON, so
 * existing behaviour is unchanged wherever this file is not loaded.
 */
(function () {
  "use strict";

  var features = { testing: false };
  if (typeof window !== "undefined") {
    window.LB_FEATURES = features;
  }

  /** True when the named feature is on. Unknown/missing flag => on. */
  function isOn(name) {
    try {
      var f = (typeof window !== "undefined") ? window.LB_FEATURES : null;
      if (!f || typeof f !== "object") return true;
      return f[name] !== false;
    } catch (err) {
      return true;
    }
  }

  /** Remove every element tagged data-feature="<name>" when that feature is off.
   *  Loop continues past any element that fails to detach. */
  function applyFeatureMarkup(name) {
    if (isOn(name)) return 0;
    if (typeof document === "undefined" || !document.querySelectorAll) return 0;
    var nodes = document.querySelectorAll('[data-feature="' + name + '"]');
    var removed = 0;
    for (var i = 0; i < nodes.length; i++) {
      try {
        var n = nodes[i];
        if (n && n.parentNode) { n.parentNode.removeChild(n); removed++; }
      } catch (err) { /* keep going: one bad node never aborts the rest */ }
    }
    return removed;
  }

  if (typeof window !== "undefined") {
    window.LBFeatures = { isOn: isOn, applyFeatureMarkup: applyFeatureMarkup };
    // The markup sits above this script tag, so it is already parsed.
    applyFeatureMarkup("testing");
  }
})();
