/* LanguageBasics hint-example rotation (LB-18).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBHint. Pure logic, DOM-free, so it is unit-testable in a
 * node:vm sandbox directly (same convention as leitner.js / mastery.js / game.js).
 *
 * WHY THIS EXISTS (LB-18 alphabet section):
 *   Alphabet cards put the phonetic SOUND in `answer` and pack THREE example
 *   words into `hint` (the inverse of the number cards). We want the learner to
 *   see ONE example per view and to cycle through all three across repeated
 *   views of the same card — without picking by pool position (Leitner reorders
 *   and test mode reshuffles, so position is not stable). The engine therefore
 *   keys a per-card cycle counter on CARD IDENTITY (lessonId:prompt) and asks
 *   this module which example to show for a given cycle index.
 *
 * DELIMITER (documented): examples inside a hint are separated by  " / "  (space
 *   slash space). It is deliberately NOT the answer field's " | " line separator
 *   (lessons 2 and 6 use " | " to stack answer lines), so the two never collide.
 *   The NUMBER lessons' hints contain no " / ", so they have exactly ONE segment
 *   and render BYTE-IDENTICALLY to pre-LB-18 (pick() returns the hint unchanged).
 */
(function () {
  "use strict";

  // Example separator inside an alphabet card's hint. Chosen to not collide with
  // the answer field's " | " line separator. Number-lesson hints never contain
  // it, so they are single-segment and unaffected.
  var DELIM = " / ";

  /* segments(hint) -> the hint split into its example parts. A hint with no
   * delimiter yields a single-element array (the whole hint). null/undefined
   * yields []. Pure; never throws. */
  function segments(hint) {
    if (hint == null) return [];
    return String(hint).split(DELIM);
  }

  /* pick(hint, cycleIndex) -> the ONE example to show for this view.
   *
   *   - hint has NO delimiter (single segment, e.g. every number-lesson hint):
   *     returns the hint unchanged (String(hint)) -> byte-identical to before.
   *   - hint has multiple segments: returns segments[cycleIndex mod count], so
   *     repeated views of the same card walk through all its examples in order.
   *
   * cycleIndex is the engine's per-card counter, keyed on card identity. A
   * non-finite / negative index is treated as 0. Pure; never throws. */
  function pick(hint, cycleIndex) {
    var parts = segments(hint);
    if (parts.length <= 1) return hint == null ? "" : String(hint);
    var i = Number(cycleIndex);
    if (!isFinite(i) || i < 0) i = 0;
    i = Math.floor(i) % parts.length;
    return parts[i];
  }

  // Public surface.
  window.LBHint = {
    pick: pick,
    segments: segments,
    DELIM: DELIM
  };
})();
