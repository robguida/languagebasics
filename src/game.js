/* LanguageBasics game/test mode — pure logic (LB-11).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBGame. DOM-FREE, so it is unit-testable in a node:vm
 * sandbox directly (same convention as store.js / prefs.js / leitner.js). This
 * module owns ONLY the pure parts of game mode:
 *   - count selection / clamping (5 / 10 / 20, capped at the deck size),
 *   - building the game pool from a deck (shuffle + slice to the chosen count),
 *   - the self-rate -> event mapping ({ card, gotIt, responseMs }),
 *   - score % from a list of events,
 *   - the "review these" list = the prompts of the missed cards.
 *
 * The DOM wiring (showing prompts, the Got it / Missed it buttons, the reveal,
 * the end screen) lives in engine.js. engine.js feeds raw inputs in and renders
 * what comes back, so all the scoring math stays here where tests can reach it.
 *
 * LB-12 SEAM: makeSelfRateEvent() is the single shared mapping that turns a
 * (card, gotIt, responseMs) self-rate into a clean event object. The engine's
 * self-rate handler calls it and then (a) feeds the event to scoring and
 * (b) — guarded — to LBLeitner.recordResult. LB-12 extends the SAME handler to
 * also pass the event's responseMs to LBMastery.record(...) for speed-tiered
 * mastery; it does NOT need to rework this module or the handler shape. The
 * event already carries responseMs for exactly that purpose.
 */
(function () {
  "use strict";

  // The fixed count choices the UI offers. The chosen value is clamped to the
  // deck size (a 9-card lesson asked for 20 uses all 9). Kept here so the UI
  // and the tests share one source of truth.
  var COUNT_CHOICES = [5, 10, 20];

  /* clampCount(requested, deckSize) -> a usable positive integer count.
   *   - non-numeric / <= 0 requested  => 0 when the deck is empty, else the
   *     smallest sensible fallback is the deck size (we never invent cards).
   *   - requested larger than the deck => the deck size (use all of them).
   * Never throws. */
  function clampCount(requested, deckSize) {
    var size = (typeof deckSize === "number" && isFinite(deckSize) && deckSize > 0)
      ? Math.floor(deckSize)
      : 0;
    if (size === 0) return 0;
    var n = Math.floor(Number(requested));
    if (!isFinite(n) || n <= 0) return size; // degrade to "all cards"
    return n > size ? size : n;
  }

  /* shuffle(arr) -> a NEW array, Fisher-Yates shuffled. Pure (does not mutate
   * the input). rng is injectable for deterministic tests; defaults to
   * Math.random. Skips null/bad entries defensively (loop resilience). */
  function shuffle(arr, rng) {
    var random = (typeof rng === "function") ? rng : Math.random;
    var out = [];
    if (Array.isArray(arr)) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] != null) out.push(arr[i]);
      }
    }
    for (var j = out.length - 1; j > 0; j--) {
      var k = Math.floor(random() * (j + 1));
      var tmp = out[j];
      out[j] = out[k];
      out[k] = tmp;
    }
    return out;
  }

  /* buildPool(deck, requestedCount, rng) -> the cards for one game: shuffle the
   * deck, then take the clamped count. Pure; returns a NEW array. v1 pool is
   * the currently selected lesson's deck only (passed in by the engine). */
  function buildPool(deck, requestedCount, rng) {
    var clean = Array.isArray(deck) ? deck : [];
    var count = clampCount(requestedCount, clean.length);
    if (count === 0) return [];
    return shuffle(clean, rng).slice(0, count);
  }

  /* makeSelfRateEvent(card, gotIt, responseMs) -> the canonical self-rate event.
   * THIS IS THE SHARED HOOK'S CORE MAPPING (see file header / LB-12 seam).
   *   - gotIt is coerced to a strict boolean.
   *   - responseMs is coerced to a finite, non-negative number (0 if unusable).
   * Never throws. */
  function makeSelfRateEvent(card, gotIt, responseMs) {
    var ms = Number(responseMs);
    if (!isFinite(ms) || ms < 0) ms = 0;
    return {
      card: card,
      gotIt: gotIt === true,
      responseMs: ms
    };
  }

  /* scorePercent(events) -> whole-number percent of "Got it" over all events.
   * 0 events => 0. Rounds to the nearest integer. Never throws. */
  function scorePercent(events) {
    if (!Array.isArray(events) || events.length === 0) return 0;
    var got = 0;
    for (var i = 0; i < events.length; i++) {
      if (events[i] && events[i].gotIt === true) got++;
    }
    return Math.round((got / events.length) * 100);
  }

  /* countGotIt(events) -> how many events were "Got it". Never throws. */
  function countGotIt(events) {
    if (!Array.isArray(events)) return 0;
    var got = 0;
    for (var i = 0; i < events.length; i++) {
      if (events[i] && events[i].gotIt === true) got++;
    }
    return got;
  }

  /* reviewList(events) -> the prompts (as strings) of the MISSED cards, in the
   * order they were seen. This is the "review these" list shown on the end
   * screen. Skips events with no usable card/prompt. Never throws. */
  function reviewList(events) {
    var out = [];
    if (!Array.isArray(events)) return out;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (!e || e.gotIt === true) continue;
      var card = e.card;
      var prompt = (card && typeof card === "object") ? card.prompt : card;
      if (prompt == null || String(prompt) === "") continue;
      out.push(String(prompt));
    }
    return out;
  }

  /* summarize(events) -> the full end-screen payload in one call:
   *   { total, gotIt, percent, review }
   * total  = number of events (cards played)
   * gotIt  = number marked "Got it"
   * percent= scorePercent(events)
   * review = reviewList(events) (the missed prompts)
   * Never throws. */
  function summarize(events) {
    var list = Array.isArray(events) ? events : [];
    return {
      total: list.length,
      gotIt: countGotIt(list),
      percent: scorePercent(list),
      review: reviewList(list)
    };
  }

  /* ----------------------------- TIME TOTALS (LB-16) ----------------------- *
   * Pure time math for the result modal's "You used X.X of Y.Y possible" line.
   * DOM-free and testable. The engine tracks the per-lesson timer (timerMs) and
   * the per-card events during a session and passes them in here. Each event has
   * a responseMs (LB-11's canonical event already carries it). A card that timed
   * out has responseMs >= timerMs (the engine cancels the timer on a manual
   * reveal, so a known card's responseMs is < timerMs); clamping each card to
   * timerMs makes a timed-out card count the FULL timer and guarantees the used
   * total can never exceed the possible total. */

  /* coerceTimerMs(timerMs) -> a finite, non-negative timer in ms (0 if unusable).
   * Never throws. */
  function coerceTimerMs(timerMs) {
    var t = Number(timerMs);
    if (!isFinite(t) || t < 0) return 0;
    return t;
  }

  /* timePossibleMs(count, timerMs) -> the MAX time the run could have used:
   *   count questions * the per-lesson timer (ms). count is floored to a
   *   non-negative integer; a bad count or timer yields 0. Pure; never throws.
   *   E.g. timePossibleMs(5, 3000) === 15000. */
  function timePossibleMs(count, timerMs) {
    var n = Math.floor(Number(count));
    if (!isFinite(n) || n <= 0) return 0;
    var t = coerceTimerMs(timerMs);
    return n * t;
  }

  /* perCardUsedMs(responseMs, timerMs) -> one card's contribution to the used
   *   total: min(responseMs, timerMs). A manual (known) reveal counts its actual
   *   responseMs; a timed-out card (responseMs >= timerMs, or unusable) counts
   *   the FULL timer. Clamped so a single card never exceeds the timer. Pure;
   *   never throws. */
  function perCardUsedMs(responseMs, timerMs) {
    var t = coerceTimerMs(timerMs);
    var ms = Number(responseMs);
    if (!isFinite(ms) || ms < 0) return t; // unusable response => count full timer
    return ms < t ? ms : t;                // clamp to the timer (timeout = full)
  }

  /* timeUsedMs(events, timerMs) -> the SUM over the answered cards of each card's
   *   perCardUsedMs(event.responseMs, timerMs). Bad/missing events contribute the
   *   full timer (they still consumed a card slot). Pure; never throws. The total
   *   can never exceed timePossibleMs(events.length, timerMs) because every card
   *   is clamped to timerMs.
   *   E.g. 5 events all answered in 1000ms with a 3000ms timer => 5000ms used. */
  function timeUsedMs(events, timerMs) {
    var list = Array.isArray(events) ? events : [];
    var t = coerceTimerMs(timerMs);
    var total = 0;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var resp = (e && typeof e === "object") ? e.responseMs : NaN;
      total += perCardUsedMs(resp, t);
    }
    return total;
  }

  // Public surface.
  window.LBGame = {
    COUNT_CHOICES: COUNT_CHOICES,
    clampCount: clampCount,
    shuffle: shuffle,
    buildPool: buildPool,
    makeSelfRateEvent: makeSelfRateEvent,
    scorePercent: scorePercent,
    countGotIt: countGotIt,
    reviewList: reviewList,
    summarize: summarize,
    timePossibleMs: timePossibleMs,
    perCardUsedMs: perCardUsedMs,
    timeUsedMs: timeUsedMs
  };
})();
