/* LanguageBasics speed-tiered mastery (LB-12).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBMastery. Pure logic, DOM-free, so it is unit-testable in
 * a node:vm sandbox directly (same convention as store.js / prefs.js /
 * leitner.js / game.js). It reads/writes mastery state THROUGH window.LBStore
 * (LB-8) under the `lb.mastery` namespace, and is fed by engine.js's shared
 * self-rate hook (handleSelfRate) which already produces LB-11's canonical
 * event { card, gotIt, responseMs }.
 *
 * Stored shape under lb.mastery (LBStore stamps the v field, not us):
 *   {
 *     v: 1,
 *     lessons: {
 *       "sq/lesson-1": {
 *         "sq/lesson-1:7": { best: 2, lastMs: 1840, updated: 1718840000000 }
 *       }
 *     }
 *   }
 *
 * CARD IDENTITY: the stable key is  lessonId + ":" + prompt  — the SAME identity
 * Leitner uses (verified unique within every lesson). cardId(lessonId, card)
 * builds it.
 *
 * SPEED -> LEVEL (only when gotIt === true). Lower number = better. `<=` so an
 * exact boundary lands on the better tier:
 *   responseMs <= 1000  -> Level 1  (MASTERED)
 *   responseMs <= 2000  -> Level 2
 *   responseMs <= 3000  -> Level 3
 *   responseMs <= 4000  -> Level 4
 *   responseMs <= 5000  -> Level 5
 *   responseMs >  5000  -> NO level earned this attempt (too slow)
 *   gotIt === false     -> NO level earned, AND triggers decay (see below)
 *
 * BEST-LEVEL-WINS: we store the card's BEST (lowest-number) level ever achieved.
 * A new attempt only improves the stored best if it is a better (lower) level; a
 * worse attempt never lowers it — EXCEPT decay.
 *
 * DECAY-ON-MISS: gotIt === false makes the stored best WORSE by one step
 * (best = best + 1). If best was already 5 (the worst tracked level), a miss
 * drops it OFF mastery entirely (record cleared -> "no level"). It never falls
 * below Level 1 on the good end.
 *
 * DERIVED ROLLUPS are computed on read, never stored:
 *   - per-lesson level  = the SLOWEST (worst, highest-number) best-level among
 *     the lesson's cards; a card with no level counts as worse than Level 5. A
 *     lesson is "mastered" (Level 1) only when EVERY card is at best Level 1.
 *   - overall mastered  = true only when every card across all lessons is at
 *     Level 1.
 *
 * ORDER-INDEPENDENCE: all state is per-card and best-wins, so the same set of
 * attempts yields the same mastery regardless of Random vs Leitner order.
 *
 * GRACEFUL DEGRADATION: every LBStore touch is guarded. A missing or blocked
 * LBStore means reads return "no level" and writes are no-ops, so record() never
 * throws and the getters keep working (they just see no persisted mastery).
 */
(function () {
  "use strict";

  var STORE_KEY = "lb.mastery";

  // Mastery levels run 1..5. Level 1 = MASTERED (fast + correct); Level 5 = the
  // slowest tracked tier. A card with no usable record has NO level (NONE).
  var BEST_LEVEL = 1;   // best achievable (mastered)
  var WORST_LEVEL = 5;  // slowest tracked tier
  var NONE = "none";    // no level earned / fell off mastery

  // Speed -> level ladder, evaluated with <= so an exact boundary lands on the
  // better (lower-number) tier. Kept as an ordered list so the boundaries live
  // in ONE place and are easy to tweak.
  var SPEED_TIERS = [
    { maxMs: 1000, level: 1 },
    { maxMs: 2000, level: 2 },
    { maxMs: 3000, level: 3 },
    { maxMs: 4000, level: 4 },
    { maxMs: 5000, level: 5 }
  ];

  /* Locked level-comment strings (LB-12). VERBATIM — kept here as the single
   * source of truth so copy tweaks happen in one place. Keys: 1..5 = per-level,
   * "all" = every lesson mastered, "none" = no level earned yet. The UI reads
   * these via commentFor(...) / OVERALL comment. No agent/team names anywhere. */
  var COMMENTS = {
    5: "Slow but you know! You've got the numbers — just way too slow for real talk.",
    4: "Progress, but no congress — still too slow for the conversation.",
    3: "Now we're talkin' — almost! Speeding up, not quite chat-ready.",
    2: "Two and quick — that's the trick! One notch from conversation-fast.",
    1: "One and done — fluent and fast! Lesson mastered.",
    all: "Every number, every lesson — mastered and fast. You OWN them.",
    none: "Keep practicing — answer in under 5 seconds to start earning mastery levels."
  };

  /* Is LBStore present this session? A missing store (mastery unit tests without
   * store.js, or a blocked localStorage) means "no persisted mastery" — reads
   * return NONE, writes are no-ops. Never throws. */
  function hasStore() {
    return !!(typeof window !== "undefined" && window.LBStore &&
      typeof window.LBStore.get === "function" &&
      typeof window.LBStore.set === "function");
  }

  /* A monotonic-ish timestamp for `updated`. performance.now() when available
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
   * (uses card.prompt) or a raw prompt value. Returns null if unusable. Mirrors
   * leitner.js's cardId exactly so the two modules key cards identically. */
  function cardId(lessonId, card) {
    if (!lessonId) return null;
    var prompt = (card && typeof card === "object") ? card.prompt : card;
    if (prompt == null || String(prompt) === "") return null;
    return String(lessonId) + ":" + String(prompt);
  }

  /* speedLevel(responseMs) -> the level EARNED purely from response time:
   *   a number 1..5 if within a tier, else NONE (slower than the last tier).
   * Pure; never throws. Caller only applies this when gotIt === true. */
  function speedLevel(responseMs) {
    var ms = Number(responseMs);
    if (!isFinite(ms) || ms < 0) return NONE;
    for (var i = 0; i < SPEED_TIERS.length; i++) {
      if (ms <= SPEED_TIERS[i].maxMs) return SPEED_TIERS[i].level;
    }
    return NONE;
  }

  /* Coerce a stored best value to a valid level 1..5, or NONE. Never throws. */
  function normalizeLevel(level) {
    if (level === NONE) return NONE;
    var n = Number(level);
    if (!isFinite(n)) return NONE;
    n = Math.round(n);
    if (n < BEST_LEVEL) return BEST_LEVEL; // never better than mastered
    if (n > WORST_LEVEL) return NONE;      // worse than the slowest tier => none
    return n;
  }

  /* Read the whole lb.mastery object, or a safe empty shape. Never throws. */
  function readAll() {
    if (!hasStore()) return { lessons: {} };
    var obj = null;
    try {
      obj = window.LBStore.get(STORE_KEY, null);
    } catch (err) {
      obj = null; // any read failure => treat as empty, never abort the caller
    }
    if (obj == null || typeof obj !== "object" ||
        typeof obj.lessons !== "object" || obj.lessons == null) {
      return { lessons: {} };
    }
    return obj;
  }

  /* The stored mastery map for one lesson ({ cardId: {best,lastMs,updated} }),
   * or {}. Never throws. */
  function readLesson(lessonId) {
    if (!lessonId) return {};
    var all = readAll();
    var entry = all.lessons[lessonId];
    return (entry && typeof entry === "object") ? entry : {};
  }

  /* Persist (or clear) a card's record under lesson -> cardId. Passing
   * best === NONE removes the record entirely (the card fell off mastery).
   * No-op (returns false) when LBStore is missing. Never throws. */
  function writeCard(lessonId, id, best, lastMs, updated) {
    if (!hasStore() || !lessonId || !id) return false;
    var all = readAll();
    var lessons = all.lessons;
    var lesson = (lessons[lessonId] && typeof lessons[lessonId] === "object")
      ? lessons[lessonId]
      : {};
    if (best === NONE) {
      delete lesson[id];
    } else {
      lesson[id] = { best: best, lastMs: lastMs, updated: updated };
    }
    lessons[lessonId] = lesson;
    try {
      // LBStore stamps v:VERSION itself; pass the lessons map through.
      return window.LBStore.set(STORE_KEY, { lessons: lessons });
    } catch (err) {
      // Persist failure must never abort the caller (the attempt still counted).
      return false;
    }
  }

  /* getBest(lessonId, card) -> the card's stored BEST level (1..5) or NONE for
   * an unseen / fell-off card. Never throws. */
  function getBest(lessonId, card) {
    var id = cardId(lessonId, card);
    if (!id) return NONE;
    var lesson = readLesson(lessonId);
    var rec = lesson[id];
    if (!rec || typeof rec !== "object") return NONE;
    return normalizeLevel(rec.best);
  }

  /* record(lessonId, evt) — fold one self-rate event into mastery.
   *
   * evt = { card, gotIt, responseMs } (LB-11's canonical event).
   *
   *   gotIt === true:
   *     earned = speedLevel(responseMs). If earned is a level AND it is better
   *     (lower-number) than the stored best, store it (best-level-wins). A slower
   *     attempt, or "too slow / no tier", never lowers the stored best.
   *   gotIt === false (decay-on-miss):
   *     stored best gets WORSE by one step. If there was no stored best, it stays
   *     NONE. If best was already WORST_LEVEL (5), it falls OFF mastery (NONE).
   *
   * Returns the card's resulting stored best (1..5 or NONE), or null if the card
   * id is unusable. Never throws. */
  function record(lessonId, evt) {
    if (!evt || typeof evt !== "object") return null;
    var card = evt.card;
    var id = cardId(lessonId, card);
    if (!id) return null;

    var prevBest = getBest(lessonId, card); // 1..5 or NONE
    var ts = now();

    if (evt.gotIt === true) {
      var earned = speedLevel(evt.responseMs); // 1..5 or NONE
      if (earned === NONE) {
        // Correct but too slow for any tier — does not earn or change a level.
        return prevBest;
      }
      // Best-level-wins: lower number is better. Only improve.
      if (prevBest === NONE || earned < prevBest) {
        var ms = Number(evt.responseMs);
        if (!isFinite(ms) || ms < 0) ms = 0;
        writeCard(lessonId, id, earned, ms, ts);
        return earned;
      }
      return prevBest; // existing best is as good or better — leave it.
    }

    // gotIt === false -> decay one step worse.
    if (prevBest === NONE) {
      return NONE; // nothing to decay
    }
    var decayed = prevBest + 1;
    if (decayed > WORST_LEVEL) {
      // Fell off the bottom tier — clear the record entirely.
      writeCard(lessonId, id, NONE, 0, ts);
      return NONE;
    }
    // lastMs is unknown on a miss; keep it 0 so we don't imply a fast time.
    writeCard(lessonId, id, decayed, 0, ts);
    return decayed;
  }

  /* getLessonLevel(lessonId, cards) -> the lesson's rolled-up level:
   *   the SLOWEST (worst, highest-number) best-level among the lesson's cards.
   *   A card with NO level counts as worse than Level 5, so any unlearned card
   *   makes the whole lesson NONE. Returns 1..5 or NONE.
   *   Empty/invalid `cards` -> NONE (nothing learned yet). Never throws. */
  function getLessonLevel(lessonId, cards) {
    if (!Array.isArray(cards) || cards.length === 0) return NONE;
    var worst = BEST_LEVEL; // start at the best; relax toward worse as we scan
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (!c) continue; // resilience: skip a null/bad entry, keep going
      var best = getBest(lessonId, c);
      if (best === NONE) return NONE; // an unlearned card dominates -> NONE
      if (best > worst) worst = best; // track the slowest (highest-number) level
    }
    return worst;
  }

  /* isLessonMastered(lessonId, cards) -> true only when EVERY card in the lesson
   * is at best Level 1. Never throws. */
  function isLessonMastered(lessonId, cards) {
    return getLessonLevel(lessonId, cards) === BEST_LEVEL;
  }

  /* LB-18 SEAM B: rollup-skip predicate. A lesson registry entry can carry
   * `rollup: false` to mean "do NOT count this deck in the overall mastery
   * rollup" — used by the combined alphabet deck (sq/alphabet-all), whose 36
   * cards already count once via the three group decks, so counting it again
   * would double-count and inflate the denominator. Any entry WITHOUT an
   * explicit rollup===false is counted (default-on, so the number decks and the
   * 3 alphabet group decks all count). Pure; never throws. */
  function isCountedLesson(entry) {
    return !(entry && typeof entry === "object" && entry.rollup === false);
  }

  /* countCountedLessons(allLessons) -> the rollup DENOMINATOR: how many lessons
   * count toward "X of N mastered", honoring the rollup-skip flag. index.html
   * calls this so the skip decision lives here (pure, testable) instead of
   * inline in the page. Never throws. */
  function countCountedLessons(allLessons) {
    if (!Array.isArray(allLessons)) return 0;
    var n = 0;
    for (var i = 0; i < allLessons.length; i++) {
      if (isCountedLesson(allLessons[i])) n++;
    }
    return n;
  }

  /* getOverallMastered(allLessons) -> true only when every COUNTED card across
   * all lessons is at Level 1.
   *
   * `allLessons` is an array of { id, cards } (the loaded lessons). Each entry
   * needs its real card list so we can roll up per lesson. Entries flagged
   * rollup:false are skipped (LB-18). An empty/invalid list -> false (nothing to
   * have mastered). Never throws. */
  function getOverallMastered(allLessons) {
    if (!Array.isArray(allLessons) || allLessons.length === 0) return false;
    var counted = 0;
    for (var i = 0; i < allLessons.length; i++) {
      var lesson = allLessons[i];
      if (!lesson || typeof lesson !== "object") return false;
      if (!isCountedLesson(lesson)) continue; // skip the rollup-excluded deck
      counted++;
      if (!isLessonMastered(lesson.id, lesson.cards)) return false;
    }
    return counted > 0;
  }

  /* countMasteredLessons(allLessons) -> how many COUNTED lessons are fully
   * mastered. Handy for the "X of N lessons mastered" readout. Skips entries
   * flagged rollup:false (LB-18). Never throws. */
  function countMasteredLessons(allLessons) {
    if (!Array.isArray(allLessons)) return 0;
    var n = 0;
    for (var i = 0; i < allLessons.length; i++) {
      var lesson = allLessons[i];
      if (lesson && typeof lesson === "object" && isCountedLesson(lesson) &&
          isLessonMastered(lesson.id, lesson.cards)) {
        n++;
      }
    }
    return n;
  }

  /* countLessonL1Records(lessonId) -> how many of a lesson's stored cards are at
   * best Level 1. UI convenience for the overall "X of N mastered" readout when
   * the app only has the active lesson's card data loaded (one lesson at a time).
   * A lesson with `expectedCount` cards is fully mastered only when this equals
   * expectedCount. Counts ONLY records normalized to Level 1. Never throws. */
  function countLessonL1Records(lessonId) {
    var lesson = readLesson(lessonId);
    var n = 0;
    for (var key in lesson) {
      if (!Object.prototype.hasOwnProperty.call(lesson, key)) continue;
      var rec = lesson[key];
      if (rec && typeof rec === "object" &&
          normalizeLevel(rec.best) === BEST_LEVEL) {
        n++;
      }
    }
    return n;
  }

  /* lessonMasteredByCount(lessonId, expectedCount) -> true when a lesson's
   * stored Level-1 records EQUAL its full card count. Lets the overall readout
   * judge mastery for lessons whose card prompts aren't currently loaded, using
   * the known per-lesson card count. expectedCount must be > 0. Never throws. */
  function lessonMasteredByCount(lessonId, expectedCount) {
    var count = Number(expectedCount);
    if (!isFinite(count) || count <= 0) return false;
    return countLessonL1Records(lessonId) === Math.floor(count);
  }

  /* commentFor(level) -> the locked comment string for a level (1..5) or NONE.
   * Unknown input falls back to the neutral "none" line. Never throws. */
  function commentFor(level) {
    var norm = normalizeLevel(level);
    if (norm === NONE) return COMMENTS.none;
    return COMMENTS[norm] || COMMENTS.none;
  }

  /* overallComment() -> the locked "all lessons mastered" celebration line. */
  function overallComment() {
    return COMMENTS.all;
  }

  // Public surface.
  window.LBMastery = {
    record: record,
    speedLevel: speedLevel,
    getBest: getBest,
    getLessonLevel: getLessonLevel,
    isLessonMastered: isLessonMastered,
    getOverallMastered: getOverallMastered,
    countMasteredLessons: countMasteredLessons,
    countCountedLessons: countCountedLessons,
    isCountedLesson: isCountedLesson,
    countLessonL1Records: countLessonL1Records,
    lessonMasteredByCount: lessonMasteredByCount,
    commentFor: commentFor,
    overallComment: overallComment,
    cardId: cardId,
    COMMENTS: COMMENTS,
    SPEED_TIERS: SPEED_TIERS,
    BEST_LEVEL: BEST_LEVEL,
    WORST_LEVEL: WORST_LEVEL,
    NONE: NONE,
    STORE_KEY: STORE_KEY
  };
})();
