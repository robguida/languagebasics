/* LanguageBasics test mode — pure logic (LB-11, reworked in LB-36).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBGame. DOM-FREE, so it is unit-testable in a node:vm
 * sandbox directly. This module owns ONLY the pure parts of a test:
 *   - the test size: min(10, lesson card count),
 *   - the test pool: cards NOT known first (shuffled), then known cards
 *     (shuffled), cut to size,
 *   - the practice-again pool: only the missed cards (shuffled),
 *   - the rating -> event mapping ({ card, gotIt }),
 *   - the results summary (how many known, which were missed).
 *
 * LB-36 retired the 5/10/20 count choices, the score percent and the
 * time-used math. The learner rates each card; nothing is timed for scoring.
 *
 * The DOM wiring lives in engine.js. engine.js feeds raw inputs in and renders
 * what comes back, so all the test math stays here where tests can reach it.
 */
(function () {
  "use strict";

  // A full test is this many cards, or the whole lesson when it is smaller.
  var TEST_SIZE = 10;

  /* clampCount(requested, deckSize) -> a usable positive integer count.
   *   - non-numeric / <= 0 requested  => the deck size (never invent cards).
   *   - requested larger than the deck => the deck size.
   *   - empty deck => 0.
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

  /* testSize(deckSize) -> min(10, deckSize); 0 for an empty/bad deck. */
  function testSize(deckSize) {
    return clampCount(TEST_SIZE, deckSize);
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

  /* buildPool(deck, requestedCount, rng) -> shuffle the deck, then take the
   * clamped count. Pure; returns a NEW array. */
  function buildPool(deck, requestedCount, rng) {
    var clean = Array.isArray(deck) ? deck : [];
    var count = clampCount(requestedCount, clean.length);
    if (count === 0) return [];
    return shuffle(clean, rng).slice(0, count);
  }

  function promptKey(card) {
    if (!card || typeof card !== "object" || card.prompt == null) return null;
    var k = String(card.prompt);
    return k === "" ? null : k;
  }

  /* buildTestPool(deck, knownMap, rng) -> the cards for one FULL test:
   * cards NOT known first (shuffled), then known cards (shuffled), cut to
   * testSize(deck). knownMap is { "<prompt>": true } (LBProgress.knownMap).
   * A bad deck entry is skipped, never aborts. Pure; returns a NEW array. */
  function buildTestPool(deck, knownMap, rng) {
    var list = Array.isArray(deck) ? deck : [];
    var known = (knownMap && typeof knownMap === "object") ? knownMap : {};
    var unknownCards = [], knownCards = [];
    for (var i = 0; i < list.length; i++) {
      var key = promptKey(list[i]);
      if (key === null) continue; // skip a bad card, keep going
      if (Object.prototype.hasOwnProperty.call(known, key) && known[key] === true) {
        knownCards.push(list[i]);
      } else {
        unknownCards.push(list[i]);
      }
    }
    var size = testSize(unknownCards.length + knownCards.length);
    if (size === 0) return [];
    return shuffle(unknownCards, rng).concat(shuffle(knownCards, rng)).slice(0, size);
  }

  /* buildRetryPool(deck, missedPrompts, rng) -> the practice-again pool: the
   * deck cards whose prompt is in missedPrompts, each once, shuffled. Prompts
   * no longer in the deck are skipped. Empty/none => []. Pure. */
  function buildRetryPool(deck, missedPrompts, rng) {
    var list = Array.isArray(deck) ? deck : [];
    var wanted = {};
    var missed = Array.isArray(missedPrompts) ? missedPrompts : [];
    for (var i = 0; i < missed.length; i++) {
      if (missed[i] == null) continue;
      var k = String(missed[i]);
      if (k !== "") wanted[k] = true;
    }
    var out = [], seen = {};
    for (var j = 0; j < list.length; j++) {
      var key = promptKey(list[j]);
      if (key === null || !Object.prototype.hasOwnProperty.call(wanted, key) ||
          Object.prototype.hasOwnProperty.call(seen, key)) continue;
      seen[key] = true;
      out.push(list[j]);
    }
    return shuffle(out, rng);
  }

  /* makeSelfRateEvent(card, gotIt) -> the canonical rating event.
   * gotIt is coerced to a strict boolean ("I knew it" = true). Never throws. */
  function makeSelfRateEvent(card, gotIt) {
    return {
      card: card,
      gotIt: gotIt === true
    };
  }

  /* countGotIt(events) -> how many events were "I knew it". Never throws. */
  function countGotIt(events) {
    if (!Array.isArray(events)) return 0;
    var got = 0;
    for (var i = 0; i < events.length; i++) {
      if (events[i] && events[i].gotIt === true) got++;
    }
    return got;
  }

  /* missedCards(events) -> the cards rated "Not yet" (button or time's up), in
   * the order they were seen. Skips events with no usable card. */
  function missedCards(events) {
    var out = [];
    if (!Array.isArray(events)) return out;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (!e || e.gotIt === true) continue;
      if (promptKey(e.card) === null) continue;
      out.push(e.card);
    }
    return out;
  }

  /* reviewList(events) -> the prompts (as strings) of the missed cards. */
  function reviewList(events) {
    var cards = missedCards(events);
    var out = [];
    for (var i = 0; i < cards.length; i++) out.push(String(cards[i].prompt));
    return out;
  }

  /* summarize(events) -> { total, gotIt, review, missed }
   * total  = cards rated, gotIt = "I knew it" count,
   * review = missed prompts, missed = missed cards. Never throws. */
  function summarize(events) {
    var list = Array.isArray(events) ? events : [];
    return {
      total: list.length,
      gotIt: countGotIt(list),
      review: reviewList(list),
      missed: missedCards(list)
    };
  }

  // Public surface.
  window.LBGame = {
    TEST_SIZE: TEST_SIZE,
    clampCount: clampCount,
    testSize: testSize,
    shuffle: shuffle,
    buildPool: buildPool,
    buildTestPool: buildTestPool,
    buildRetryPool: buildRetryPool,
    makeSelfRateEvent: makeSelfRateEvent,
    countGotIt: countGotIt,
    missedCards: missedCards,
    reviewList: reviewList,
    summarize: summarize
  };
})();
