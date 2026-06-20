/* LanguageBasics Leitner spaced-repetition queue (LB-10).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBLeitner. Pure logic, DOM-free, so it is unit-testable
 * in a node:vm sandbox directly. It reads/writes box state through
 * window.LBStore (LB-8) under the `lb.leitner` namespace, and is consumed by
 * engine.js as the "next card source" when a lesson's order pref is "leitner".
 *
 * Stored shape under lb.leitner (LBStore stamps the v field, not us):
 *   {
 *     v: 1,
 *     lessons: {
 *       "sq/lesson-1": {
 *         "sq/lesson-1:7": { box: 3, lastSeen: 1718840000000 }
 *       }
 *     }
 *   }
 *
 * CARD IDENTITY: the stable key is  lessonId + ":" + prompt  — verified unique
 * within every lesson (no duplicate prompts). cardId(lessonId, card) builds it.
 *
 * BOXES: 5 Leitner boxes, 1..5.
 *   - box 1 = least learned   -> comes up SOONEST / most often.
 *   - box 5 = best known      -> comes up LEAST often (seen less often).
 *   - New/unseen cards default to box 1.
 *
 * NEXT-CARD WEIGHTING RULE (kept deliberately simple + documented):
 *   Each candidate card is weighted by  weight = (BOX_COUNT + 1 - box).
 *   So box 1 -> weight 5, box 2 -> 4, box 3 -> 3, box 4 -> 2, box 5 -> 1.
 *   A card is then picked at random in proportion to its weight, so lower
 *   boxes (less-learned cards) surface more often while higher boxes still
 *   appear occasionally. We exclude the just-shown card from the candidate
 *   pool (the engine's existing no-repeat-twice guard) unless it is the only
 *   card. If the weighted draw somehow yields nothing (defensive), we fall
 *   back to a uniform random pick over the candidate pool.
 *
 * GRACEFUL DEGRADATION: every LBStore touch is guarded. A missing or blocked
 * LBStore means box reads return the default (box 1) and writes are no-ops, so
 * nextCard() still works (it just behaves like un-weighted-ish random) and
 * recordResult() never throws.
 */
(function () {
  "use strict";

  var STORE_KEY = "lb.leitner";

  // Number of Leitner boxes. Box 1 = soonest/most-often, BOX_COUNT = least.
  var BOX_COUNT = 5;
  var MIN_BOX = 1;
  var MAX_BOX = BOX_COUNT;

  /* Is LBStore present this session? A missing store (engine/leitner unit
   * tests without store.js, or a blocked localStorage) means "no persisted
   * boxes" — reads return defaults, writes are no-ops. Never throws. */
  function hasStore() {
    return !!(typeof window !== "undefined" && window.LBStore &&
      typeof window.LBStore.get === "function" &&
      typeof window.LBStore.set === "function");
  }

  /* A monotonic-ish timestamp for lastSeen. performance.now() when available
   * (test sandboxes usually lack it), else Date.now(), else 0. Never throws. */
  function now() {
    try {
      if (typeof performance !== "undefined" &&
          typeof performance.now === "function") {
        return performance.now();
      }
    } catch (err) { /* fall through */ }
    try {
      if (typeof Date !== "undefined" && typeof Date.now === "function") {
        return Date.now();
      }
    } catch (err) { /* fall through */ }
    return 0;
  }

  /* The stable per-card key:  lessonId + ":" + prompt. Accepts a card object
   * (uses card.prompt) or a raw prompt value. Returns null if unusable. */
  function cardId(lessonId, card) {
    if (!lessonId) return null;
    var prompt = (card && typeof card === "object") ? card.prompt : card;
    if (prompt == null || String(prompt) === "") return null;
    return String(lessonId) + ":" + String(prompt);
  }

  /* Read the whole lb.leitner object, or a safe empty shape. Never throws. */
  function readAll() {
    if (!hasStore()) return { lessons: {} };
    var obj = null;
    try {
      obj = window.LBStore.get(STORE_KEY, null);
    } catch (err) {
      // Any read failure => treat as empty, never abort the caller.
      obj = null;
    }
    if (obj == null || typeof obj !== "object" ||
        typeof obj.lessons !== "object" || obj.lessons == null) {
      return { lessons: {} };
    }
    return obj;
  }

  /* The stored state map for one lesson ({ cardId: {box,lastSeen} }), or {}. */
  function readLesson(lessonId) {
    if (!lessonId) return {};
    var all = readAll();
    var entry = all.lessons[lessonId];
    return (entry && typeof entry === "object") ? entry : {};
  }

  /* Clamp a box value into [MIN_BOX, MAX_BOX]; default to MIN_BOX if invalid. */
  function clampBox(box) {
    if (typeof box !== "number" || !isFinite(box)) return MIN_BOX;
    box = Math.round(box);
    if (box < MIN_BOX) return MIN_BOX;
    if (box > MAX_BOX) return MAX_BOX;
    return box;
  }

  /* getBox(lessonId, card) -> the card's current box (1..5). Unseen/invalid
   * cards default to box 1 (MIN_BOX). Never throws. */
  function getBox(lessonId, card) {
    var id = cardId(lessonId, card);
    if (!id) return MIN_BOX;
    var lesson = readLesson(lessonId);
    var rec = lesson[id];
    if (!rec || typeof rec !== "object") return MIN_BOX;
    return clampBox(rec.box);
  }

  /* getState(lessonId, card) -> { box, lastSeen } for the card, defaults for
   * unseen. Mostly for tests/inspection. Never throws. */
  function getState(lessonId, card) {
    var id = cardId(lessonId, card);
    if (!id) return { box: MIN_BOX, lastSeen: 0 };
    var lesson = readLesson(lessonId);
    var rec = lesson[id];
    if (!rec || typeof rec !== "object") return { box: MIN_BOX, lastSeen: 0 };
    return {
      box: clampBox(rec.box),
      lastSeen: (typeof rec.lastSeen === "number" && isFinite(rec.lastSeen))
        ? rec.lastSeen : 0
    };
  }

  /* Persist a card's box + lastSeen under lesson -> cardId. No-op (returns
   * false) when LBStore is missing. Returns LBStore.set's result otherwise. */
  function writeCard(lessonId, id, box, lastSeen) {
    if (!hasStore() || !lessonId || !id) return false;
    var all = readAll();
    var lessons = all.lessons;
    var lesson = (lessons[lessonId] && typeof lessons[lessonId] === "object")
      ? lessons[lessonId]
      : {};
    lesson[id] = { box: clampBox(box), lastSeen: lastSeen };
    lessons[lessonId] = lesson;
    try {
      // LBStore stamps v:VERSION itself; pass the lessons map through.
      return window.LBStore.set(STORE_KEY, { lessons: lessons });
    } catch (err) {
      // Persist failure must never abort the caller (the card still showed).
      return false;
    }
  }

  /* recordResult(lessonId, card, gotIt)
   *   gotIt=true  -> promote one box (cap at MAX_BOX = seen less often).
   *   gotIt=false -> demote to box 1 (MIN_BOX = seen soonest).
   * Updates lastSeen to now(). Persists via LBStore. Never throws.
   * Returns the card's new box (so callers/tests can assert), or null if the
   * card id is unusable.
   *
   * LB-10 note: nothing calls this yet — the self-rate UI is LB-11. It must
   * exist and be correct now so LB-11 can feed it. */
  function recordResult(lessonId, card, gotIt) {
    var id = cardId(lessonId, card);
    if (!id) return null;
    var currentBox = getBox(lessonId, card);
    var newBox = gotIt ? clampBox(currentBox + 1) : MIN_BOX;
    writeCard(lessonId, id, newBox, now());
    return newBox;
  }

  /* nextCard(lessonId, cards, currentCard) -> the next card to show.
   *
   * Weighting rule (see file header): weight = (BOX_COUNT + 1 - box), so the
   * lowest box (least learned) is most likely to surface; the highest box is
   * least likely. The just-shown currentCard is excluded from the candidate
   * pool (no-repeat-twice) unless it is the only card. Defensive fallbacks
   * keep it from ever returning null when there is at least one valid card.
   *
   * `cards` is the engine's normalized deck (array of {prompt, answer, ...}).
   * Never throws; returns null only when there are no valid cards at all. */
  function nextCard(lessonId, cards, currentCard) {
    if (!Array.isArray(cards) || cards.length === 0) return null;
    if (cards.length === 1) return cards[0];

    var currentId = currentCard ? cardId(lessonId, currentCard) : null;

    // Build the candidate pool, excluding the just-shown card.
    var pool = [];
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (!c) continue; // resilience: skip a null/bad entry, keep going
      var id = cardId(lessonId, c);
      if (currentId && id === currentId) continue;
      pool.push(c);
    }
    // If excluding the current card emptied the pool (e.g. all entries share
    // its prompt), fall back to the full set so we always return something.
    if (pool.length === 0) pool = cards.slice();

    // Weighted random draw: sum weights, pick a point, walk to the winner.
    var total = 0;
    var weights = [];
    for (var j = 0; j < pool.length; j++) {
      var box = getBox(lessonId, pool[j]);
      var w = (BOX_COUNT + 1) - box; // box 1 -> BOX_COUNT, box BOX_COUNT -> 1
      if (w < 1) w = 1;              // defensive: every card stays drawable
      weights.push(w);
      total += w;
    }

    if (total > 0) {
      var point = Math.random() * total;
      var acc = 0;
      for (var k = 0; k < pool.length; k++) {
        acc += weights[k];
        if (point < acc) return pool[k];
      }
    }

    // Defensive uniform fallback (should be unreachable given total>0 above).
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Public surface.
  window.LBLeitner = {
    recordResult: recordResult,
    nextCard: nextCard,
    getBox: getBox,
    getState: getState,
    cardId: cardId,
    BOX_COUNT: BOX_COUNT,
    MIN_BOX: MIN_BOX,
    MAX_BOX: MAX_BOX,
    STORE_KEY: STORE_KEY
  };
})();
