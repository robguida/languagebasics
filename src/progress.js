/* LanguageBasics learner progress (LB-36).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBProgress. Pure logic, DOM-free, so it is unit-testable
 * in a node:vm sandbox directly (same convention as store.js / prefs.js /
 * streak.js / game.js). It reads/writes THROUGH window.LBStore under the
 * `languagebasics.progress` key. It replaces the retired speed-tier mastery.js.
 *
 * THE RULE: the learner, not the clock, says what they knew.
 *   - Only a rating records anything. A reveal records nothing.
 *   - A card is KNOWN when its LAST rating was "knew" ("I knew it").
 *   - Any later "notyet" ("Not yet" button, or the timer running out in a test)
 *     makes it not known again. One rating is enough either way.
 *
 * Stored shape (LBStore stamps v; we never read or write any lb.* key):
 *   {
 *     v: 1,
 *     lessons: {
 *       "sq/lesson-1": {
 *         cards: { "7": { r: "knew" | "notyet", t: <Date.now() ms> } },
 *         best:  { score: 9, of: 10, t: <Date.now() ms> }
 *       }
 *     }
 *   }
 * Card key = String(prompt) inside the lesson's record.
 *
 * TIMESTAMPS: Date.now() epoch ms, never performance.now(). Every write takes
 * an optional `now` (ms) so tests are deterministic.
 *
 * LOOP RESILIENCE: every read validates PER RECORD. One bad card record is
 * skipped (never counted, dropped on the next write of that lesson); it never
 * drops the rest of the lesson. A missing/blocked LBStore means reads return
 * empty and writes are no-ops. Nothing here throws.
 */
(function () {
  "use strict";

  var STORE_KEY = "languagebasics.progress";
  var KNEW = "knew";
  var NOT_YET = "notyet";

  var hasOwn = Object.prototype.hasOwnProperty;

  function hasStore() {
    return !!(typeof window !== "undefined" && window.LBStore &&
      typeof window.LBStore.get === "function" &&
      typeof window.LBStore.set === "function");
  }

  /* isPersistent() -> true when progress can really be saved (not a private
   * window / blocked storage). Drives the results-screen footer. */
  function isPersistent() {
    try {
      return !!(hasStore() && window.LBStore.persistent === true);
    } catch (err) {
      return false;
    }
  }

  function isPlainObject(o) {
    return o != null && typeof o === "object" && !Array.isArray(o);
  }

  function nowMs(now) {
    var n = Number(now);
    if (now != null && isFinite(n) && n >= 0) return n;
    try { return Date.now(); } catch (err) { return 0; }
  }

  /* A valid card record: { r: "knew"|"notyet", t: finite ms >= 0 }. */
  function cleanCardRecord(rec) {
    if (!isPlainObject(rec)) return null;
    if (rec.r !== KNEW && rec.r !== NOT_YET) return null;
    var t = Number(rec.t);
    if (typeof rec.t !== "number" || !isFinite(t) || t < 0) return null;
    return { r: rec.r, t: t };
  }

  /* A valid personal best: whole numbers, 1 <= of, 0 <= score <= of. */
  function cleanBest(b) {
    if (!isPlainObject(b)) return null;
    var score = b.score, of = b.of, t = b.t;
    if (typeof score !== "number" || typeof of !== "number") return null;
    if (!isFinite(score) || !isFinite(of)) return null;
    if (Math.floor(score) !== score || Math.floor(of) !== of) return null;
    if (of < 1 || score < 0 || score > of) return null;
    var tt = (typeof t === "number" && isFinite(t) && t >= 0) ? t : 0;
    return { score: score, of: of, t: tt };
  }

  /* Read the whole progress object as a safe shape. Never throws. */
  function readAll() {
    if (!hasStore()) return { lessons: {} };
    var obj = null;
    try {
      obj = window.LBStore.get(STORE_KEY, null);
    } catch (err) {
      obj = null;
    }
    if (!isPlainObject(obj) || !isPlainObject(obj.lessons)) return { lessons: {} };
    return obj;
  }

  /* One lesson's record, cleaned per record: { cards: {key: rec}, best }. A bad
   * card record is skipped; the rest of the lesson survives. Never throws. */
  function readLesson(all, lessonId) {
    var out = { cards: {}, best: null };
    if (!lessonId || !hasOwn.call(all.lessons, lessonId)) return out;
    var raw = all.lessons[lessonId];
    if (!isPlainObject(raw)) return out;
    if (isPlainObject(raw.cards)) {
      for (var key in raw.cards) {
        if (!hasOwn.call(raw.cards, key)) continue;
        try {
          var rec = cleanCardRecord(raw.cards[key]);
          if (rec) out.cards[key] = rec;
        } catch (err) {
          // one bad record never aborts the lesson
        }
      }
    }
    out.best = cleanBest(raw.best);
    return out;
  }

  function writeLesson(all, lessonId, lesson) {
    if (!hasStore()) return false;
    var rec = { cards: lesson.cards };
    if (lesson.best) rec.best = lesson.best;
    all.lessons[lessonId] = rec;
    try {
      return window.LBStore.set(STORE_KEY, { lessons: all.lessons });
    } catch (err) {
      return false;
    }
  }

  function cardKey(prompt) {
    return (prompt == null) ? "" : String(prompt);
  }

  /* getLesson(lessonId) -> the cleaned { cards, best } record. */
  function getLesson(lessonId) {
    return readLesson(readAll(), lessonId);
  }

  /* record(lessonId, prompt, knew, now) — store ONE rating for one card.
   * knew === true => "knew"; anything else => "notyet". Returns true when it
   * reached localStorage. No-op (false) for a missing lesson id / prompt. */
  function record(lessonId, prompt, knew, now) {
    var key = cardKey(prompt);
    if (!lessonId || key === "") return false;
    if (!hasStore()) return false;
    var all = readAll();
    var lesson = readLesson(all, lessonId);
    lesson.cards[key] = { r: (knew === true) ? KNEW : NOT_YET, t: nowMs(now) };
    return writeLesson(all, lessonId, lesson);
  }

  /* knownMap(lessonId) -> { "<prompt>": true } for every card whose last
   * rating was "knew". Used to put not-known cards first in a test. */
  function knownMap(lessonId) {
    var out = {};
    var cards = getLesson(lessonId).cards;
    for (var key in cards) {
      if (hasOwn.call(cards, key) && cards[key].r === KNEW) out[key] = true;
    }
    return out;
  }

  /* isKnown(lessonId, prompt) -> true iff the card's last rating was "knew". */
  function isKnown(lessonId, prompt) {
    var key = cardKey(prompt);
    var cards = getLesson(lessonId).cards;
    return hasOwn.call(cards, key) && cards[key].r === KNEW;
  }

  /* knownCount(lessonId, deck) -> { known: N, total: M } for "N of M known".
   * M = the cards in the LOADED deck (already normalized by the engine).
   * N = those deck cards whose stored last rating is "knew". Stored records for
   * cards no longer in the deck are ignored. One bad deck entry is skipped. */
  function knownCount(lessonId, deck) {
    var list = Array.isArray(deck) ? deck : [];
    var map = knownMap(lessonId);
    var known = 0, total = 0;
    for (var i = 0; i < list.length; i++) {
      var card = list[i];
      if (!card || typeof card !== "object" || card.prompt == null ||
          String(card.prompt) === "") continue; // skip a bad entry, keep going
      total++;
      if (map[cardKey(card.prompt)] === true) known++;
    }
    return { known: known, total: total };
  }

  /* getBest(lessonId) -> { score, of, t } or null. */
  function getBest(lessonId) {
    return getLesson(lessonId).best;
  }

  /* recordTestResult(lessonId, score, of, now) — a FINISHED FULL test only
   * (never a practice round, never a stopped test; the engine enforces that).
   * Replaces the stored best when: none stored, OR stored.of !== of (the deck
   * changed size), OR score > stored.score. A tie keeps the old one.
   * Returns { status: "new" | "tie" | "lower", best } (best = what is stored
   * after the call). Bad input => { status: "lower", best: stored }. */
  function recordTestResult(lessonId, score, of, now) {
    var all = readAll();
    var lesson = readLesson(all, lessonId);
    var stored = lesson.best;
    var candidate = cleanBest({ score: score, of: of, t: nowMs(now) });
    if (!lessonId || !candidate) return { status: "lower", best: stored };

    if (!stored || stored.of !== candidate.of || candidate.score > stored.score) {
      lesson.best = candidate;
      writeLesson(all, lessonId, lesson);
      return { status: "new", best: candidate };
    }
    if (candidate.score === stored.score) return { status: "tie", best: stored };
    return { status: "lower", best: stored };
  }

  window.LBProgress = {
    record: record,
    getLesson: getLesson,
    knownMap: knownMap,
    isKnown: isKnown,
    knownCount: knownCount,
    getBest: getBest,
    recordTestResult: recordTestResult,
    isPersistent: isPersistent,
    STORE_KEY: STORE_KEY,
    KNEW: KNEW,
    NOT_YET: NOT_YET
  };
})();
