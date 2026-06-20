/* LanguageBasics shared flashcard engine.
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * A lesson is supplied as a global object (see content/sq/*.js) of shape:
 *   {
 *     id:          "sq/lesson-1",                 // string, for the selector
 *     title:       "Albanian Numbers: 1-10",      // shown in <h1>
 *     revealMs:    5000,                           // optional, default 5000
 *     recallPrompt:"Say it out loud, then reveal.", // optional, see DEFAULTS
 *     cards: [ { prompt, answer, hint, audio }, ... ]
 *   }
 *
 * Generic card schema (the test suite validates against this):
 *   prompt  : string|number  required  -> the number shown first
 *   answer  : string         required  -> the Albanian word(s); " | " => line break
 *   hint    : string         optional  -> pronunciation (may be "")
 *   audio   : string         optional  -> reserved for future audio src ("")
 *
 * The original lessons used {n, word, pronunciation}. The data files map
 * that onto {prompt, answer, hint, audio} so this engine sees one shape.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    revealMs: 5000,
    // Placeholder copy. Final microcopy goes here (or per-card via
    // card.recallPrompt) WITHOUT touching this engine.
    recallPrompt: "Say it out loud, then reveal."
  };

  // Length-based font auto-shrink ladder for the NUMBER (generalized from
  // lesson 6, extended for the big-number set so the long comma-formatted
  // quadrillions, e.g. "1,000,000,000,000,000" (21 chars), fit the card and
  // do not bleed past its edge.
  // Short prompts (lessons 1-4 are <=2 chars) never reach these thresholds,
  // so they keep the CSS .number clamp default and look unchanged.
  function promptFontSize(text) {
    var len = String(text).length;
    if (len >= 19) return "2.0rem"; // quadrillions (15 zeros + commas)
    if (len >= 15) return "2.6rem"; // trillions
    if (len >= 12) return "3.1rem"; // billions
    if (len >= 10) return "3.8rem";
    if (len >= 8)  return "4.5rem";
    if (len >= 6)  return "5.5rem";
    if (len >= 4)  return "6.5rem";
    return ""; // empty => fall back to the .number CSS clamp
  }

  // Length-based font auto-shrink ladder for the ANSWER WORD. Long Albanian
  // big-number spellings (e.g. "një kuadrilion") otherwise sit at the CSS
  // clamp max and bleed past the card. Short answers (lessons 1-4) never
  // reach these thresholds, so they keep the CSS .word clamp and look
  // unchanged. Uses the longest single rendered line (after " | " splits)
  // so a stacked multi-line answer is measured by its widest line.
  function wordFontSize(answer) {
    var parts = String(answer).split(" | ");
    var len = 0;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length > len) len = parts[i].length;
    }
    if (len >= 16) return "1.9rem";
    if (len >= 13) return "2.4rem";
    if (len >= 10) return "3.0rem";
    return ""; // empty => fall back to the .word CSS clamp
  }

  // Multi-part answers use " | " as a line separator (lessons 2 and 6).
  function renderAnswer(answer) {
    return String(answer).split(" | ").join("<br>");
  }

  /* Normalize and validate one raw card. Returns a clean card object, or
   * null if the card is unusable. LOOP RESILIENCE (global rule): the caller
   * skips nulls and keeps going — one bad card never aborts the deck. */
  function normalizeCard(raw, index) {
    if (raw == null || typeof raw !== "object") {
      console.warn("[engine] skipping card #" + index + ": not an object", raw);
      return null;
    }
    if (raw.prompt == null || String(raw.prompt) === "") {
      console.warn("[engine] skipping card #" + index + ": missing prompt", raw);
      return null;
    }
    if (raw.answer == null || String(raw.answer) === "") {
      console.warn("[engine] skipping card #" + index + ": missing answer", raw);
      return null;
    }
    return {
      prompt: String(raw.prompt),
      answer: String(raw.answer),
      hint: raw.hint == null ? "" : String(raw.hint),
      audio: raw.audio == null ? "" : String(raw.audio),
      // Per-card recall override, else engine default (set later).
      recallPrompt: raw.recallPrompt == null ? null : String(raw.recallPrompt)
    };
  }

  function buildDeck(lesson) {
    var out = [];
    var rawCards = (lesson && Array.isArray(lesson.cards)) ? lesson.cards : [];
    for (var i = 0; i < rawCards.length; i++) {
      var card; // resilience: a throw inside normalize must not kill the loop
      try {
        card = normalizeCard(rawCards[i], i);
      } catch (err) {
        console.warn("[engine] skipping card #" + i + ": threw during parse", err);
        card = null;
      }
      if (card) out.push(card);
    }
    return out;
  }

  /* LB-9 seam: the per-lesson reveal-timer override.
   *
   * Resolution order for the reveal duration:
   *   1. A user-set per-lesson override stored under lb.prefs (LBPrefs), if any.
   *   2. The lesson's hardcoded revealMs.
   *   3. The engine default (5000ms).
   *
   * CRITICAL: when LBPrefs is absent (engine unit tests, store.js not loaded)
   * OR there is no stored value for this lesson, resolvedRevealMs returns null
   * and we fall straight through to the lesson/default value — byte-identical to
   * the pre-LB-9 behavior. This is what keeps the existing 42 tests green: the
   * test sandboxes provide no window.LBStore, so this path is never taken there.
   */
  function resolvedRevealMs(lesson) {
    try {
      if (lesson && lesson.id && typeof window !== "undefined" &&
          window.LBPrefs && typeof window.LBPrefs.getRevealMs === "function") {
        var override = window.LBPrefs.getRevealMs(lesson.id);
        if (typeof override === "number" && override > 0) return override;
      }
    } catch (err) {
      // Any failure reading prefs => no override, fall back. Never abort start.
      console.warn("[engine] reveal-timer pref read failed; using lesson default", err);
    }
    return null;
  }

  /* LB-9 a11y: set/clear an attribute, guarded so the engine unit-test DOM
   * shim (which stubs only id/style/hidden/textContent/innerHTML) never throws
   * when the helpers are absent. A real browser element always has them. */
  function setAttr(el, name, value) {
    if (el && typeof el.setAttribute === "function") el.setAttribute(name, value);
  }
  function removeAttr(el, name) {
    if (el && typeof el.removeAttribute === "function") el.removeAttribute(name);
  }

  /* LB-10 seam: which card-order source should drive nextCard for this lesson?
   *
   * Resolution:
   *   - "leitner"  ONLY when the lesson's order pref (via LBPrefs) is exactly
   *     "leitner" AND LBLeitner is present. Then the engine asks LBLeitner for
   *     the next card.
   *   - "random"   for "random", no pref, no LBPrefs, or no LBLeitner — the
   *     EXISTING random behavior, byte-identical to pre-LB-10.
   *
   * CRITICAL: the engine unit-test sandboxes provide no window.LBPrefs and no
   * window.LBLeitner, so this always returns "random" there and the original
   * randomCard() path runs unchanged — that is what keeps the existing tests
   * green. Any failure reading the pref also falls through to "random".
   */
  function resolvedOrderSource(lesson) {
    try {
      if (lesson && lesson.id && typeof window !== "undefined" &&
          window.LBPrefs && typeof window.LBPrefs.getOrder === "function" &&
          window.LBLeitner && typeof window.LBLeitner.nextCard === "function") {
        if (window.LBPrefs.getOrder(lesson.id) === "leitner") return "leitner";
      }
    } catch (err) {
      // Any failure reading the order pref => random. Never abort start.
      console.warn("[engine] card-order pref read failed; using random", err);
    }
    return "random";
  }

  /* LB-10/LB-11 seam: timestamp when a card is shown. LB-11/LB-12 will read it
   * for response-time scoring; nothing consumes it yet. performance.now() when
   * available (sub-ms monotonic), else Date.now(). Guarded so the engine
   * unit-test sandbox (which has neither global) never throws. */
  function nowTs() {
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

  /* LB-13 seam: mark today as "practiced" when a study session starts (opening/
   * using a lesson counts). Guarded — only when LBStreak is present. The engine
   * unit-test sandboxes provide no window.LBStreak, so this never fires there and
   * the existing tests are byte-identical. markActive never throws, but guard the
   * call site too so the engine runs fine when streak.js is absent. */
  function markStreakActive() {
    try {
      if (typeof window !== "undefined" && window.LBStreak &&
          typeof window.LBStreak.markActive === "function") {
        window.LBStreak.markActive();
      }
    } catch (err) {
      // A streak update must never affect starting the lesson. Swallow + continue.
      console.warn("[engine] streak markActive failed; continuing", err);
    }
  }

  function start(lesson) {
    // LB-13: studying a lesson counts as practicing today (guarded; no-op when
    // streak.js / LBStore is absent, e.g. the engine unit-test sandbox).
    markStreakActive();

    var override = resolvedRevealMs(lesson);
    var revealMs = (override != null)
      ? override
      : ((lesson && typeof lesson.revealMs === "number" && lesson.revealMs > 0)
        ? lesson.revealMs
        : DEFAULTS.revealMs);
    var recallPrompt = (lesson && lesson.recallPrompt)
      ? String(lesson.recallPrompt)
      : DEFAULTS.recallPrompt;

    var deck = buildDeck(lesson);

    var numberEl = document.getElementById("number");
    var wordEl = document.getElementById("word");
    var pronEl = document.getElementById("pronunciation");
    var labelEl = document.getElementById("label");
    var recallEl = document.getElementById("recall");
    var barEl = document.getElementById("bar");
    var toggleBtn = document.getElementById("toggleBtn");
    var titleEl = document.getElementById("title");
    // LB-9 a11y: the answer region (.card, holds #word/#pronunciation, keeps its
    // aria-live="polite"). Guarded — the engine unit-test DOM shim only stubs
    // getElementById, so a missing querySelector must not throw.
    var cardEl = (typeof document.querySelector === "function")
      ? document.querySelector(".card")
      : null;

    if (lesson && lesson.title && titleEl) {
      titleEl.textContent = lesson.title;
      document.title = lesson.title;
    }

    if (!deck.length) {
      // Nothing renderable — degrade gracefully rather than throw.
      if (labelEl) labelEl.textContent = "No cards available for this lesson.";
      if (numberEl) numberEl.textContent = "";
      console.warn("[engine] lesson has no valid cards", lesson);
      return;
    }

    var current = null;
    var timer = null;
    var lastPrompt = null;
    // LB-10/LB-11: when the current card was shown. Captured in nextCard();
    // nothing consumes it yet (response-time scoring lands in LB-11/LB-12).
    var cardShownAt = null;
    // Ticket B: single-toggle state. false = prompt phase ("Reveal it"),
    // true = revealed phase ("Next Card"). Set by reveal (manual or timer)
    // and by nextCard (reset).
    var revealed = false;

    // LB-10: decide the card-order source for this lesson ONCE at start.
    // "leitner" => ask LBLeitner; anything else => the original random path.
    var orderSource = resolvedOrderSource(lesson);

    function randomCard() {
      var card;
      do {
        card = deck[Math.floor(Math.random() * deck.length)];
      } while (deck.length > 1 && card.prompt === lastPrompt);
      lastPrompt = card.prompt;
      return card;
    }

    /* LB-10 order provider: pick the next card from the resolved source.
     *
     * - "leitner": LBLeitner.nextCard(lessonId, deck, current) does the
     *   Leitner-weighted pick AND the no-repeat-twice guard (it excludes the
     *   current card). We still keep lastPrompt in sync so a later switch back
     *   to the random path keeps its guard meaningful. If LBLeitner returns
     *   nothing (defensive), fall back to randomCard().
     * - anything else: randomCard() — byte-identical to the pre-LB-10 path. */
    function pickNextCard() {
      if (orderSource === "leitner") {
        try {
          var picked = window.LBLeitner.nextCard(lesson.id, deck, current);
          if (picked) {
            lastPrompt = picked.prompt;
            return picked;
          }
        } catch (err) {
          console.warn("[engine] leitner pick failed; using random", err);
        }
      }
      return randomCard();
    }

    function resetBar() {
      // Drive the CSS bar duration from revealMs so it matches the timeout.
      barEl.style.animation = "none";
      void barEl.offsetWidth; // force reflow so the animation restarts
      barEl.style.animationPlayState = "running";
      barEl.style.animation = "shrink " + (revealMs / 1000) + "s linear forwards";
    }

    function showAnswer() {
      if (!current) return;
      wordEl.hidden = false;
      pronEl.hidden = (current.hint === "");
      labelEl.textContent = "";
      if (recallEl) recallEl.hidden = true;
      clearTimeout(timer);
      barEl.style.animationPlayState = "paused";
      // Ticket B: reveal owns the relabel so the timer-expiry auto-reveal
      // flips the toggle button to "Next Card" too, not just a manual click.
      revealed = true;
      if (toggleBtn) {
        toggleBtn.textContent = "Next Card";
        // LB-9 a11y: the button now advances; relabel it. No
        // aria-pressed — the button does two different jobs, swapping the
        // aria-label is the correct pattern.
        setAttr(toggleBtn, "aria-label", "Go to the next card");
      }
      // LB-9 a11y: clear the "answer hidden" label so the aria-live region does
      // not talk over the freshly-revealed word/pronunciation.
      removeAttr(cardEl, "aria-label");
    }

    function nextCard() {
      current = pickNextCard();
      // LB-10/LB-11: stamp when this card was shown (for response-time scoring
      // in a later ticket). Nothing reads it yet.
      cardShownAt = nowTs();

      numberEl.style.fontSize = promptFontSize(current.prompt);
      numberEl.textContent = current.prompt;

      wordEl.style.fontSize = wordFontSize(current.answer);
      wordEl.innerHTML = renderAnswer(current.answer);
      pronEl.textContent = current.hint;

      wordEl.hidden = true;
      pronEl.hidden = true;
      // Prompt text removed (issue-remove-card-prompt-text): nothing renders
      // above the number on any lesson. Keep elements present but empty/hidden.
      labelEl.textContent = "";
      if (recallEl) {
        recallEl.textContent = "";
        recallEl.hidden = true;
      }

      // Ticket B: back to prompt phase — reset toggle state + label.
      revealed = false;
      if (toggleBtn) {
        toggleBtn.textContent = "Reveal it";
        // LB-9 a11y: prompt phase — the button reveals.
        setAttr(toggleBtn, "aria-label", "Reveal the Albanian word");
      }
      // LB-9 a11y: answer is hidden again — describe the region for the
      // aria-live announcement.
      setAttr(cardEl, "aria-label",
        "Answer hidden. Press Reveal to show the Albanian word and pronunciation.");

      clearTimeout(timer);
      resetBar();
      timer = setTimeout(showAnswer, revealMs);
    }

    // Ticket B: one action that does whatever the current phase calls for —
    // reveal if still in the prompt phase, else advance to the next card.
    function toggle() {
      if (revealed) {
        nextCard();
      } else {
        showAnswer();
      }
    }

    // LB-14: name the study handlers so the session can be cleanly torn down
    // when test mode takes over the card region (no stacked listeners on a
    // study<->test switch). Behavior is byte-identical to before: the same
    // click + keydown logic, just held in named functions instead of inline
    // anonymous ones. stopStudySession() (below) detaches them.
    function onToggleClick() { toggle(); }
    function onStudyKeydown(event) {
      // Space/Enter mirror the single button: reveal, then next.
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toggle();
      }
      // "n" retained as a power-user shortcut to force the next card
      // regardless of phase (skip without revealing).
      if (event.key.toLowerCase() === "n") nextCard();
    }

    if (toggleBtn) toggleBtn.addEventListener("click", onToggleClick);
    document.addEventListener("keydown", onStudyKeydown);

    // LB-14: register this study session's teardown so a switch into test mode
    // can stop the timer + remove the listeners before test mode reuses the same
    // card region. Guarded so the engine unit-test sandboxes (no removeEventListener
    // on the document shim is fine; we feature-detect) never throw.
    activeStudyTeardown = function () {
      try { clearTimeout(timer); } catch (err) { /* ignore */ }
      if (toggleBtn && typeof toggleBtn.removeEventListener === "function") {
        toggleBtn.removeEventListener("click", onToggleClick);
      }
      if (typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", onStudyKeydown);
      }
    };

    nextCard();
  }

  // LB-14: the teardown for the currently-running study session, set by start().
  // null when no study session is active (e.g. while test mode owns the region).
  var activeStudyTeardown = null;

  /* LB-14: stop the active study session (timer + listeners) so test mode can
   * take over the shared card region without double-handling input. No-op when
   * no study session is active. Never throws. */
  function stopStudySession() {
    if (typeof activeStudyTeardown === "function") {
      try { activeStudyTeardown(); } catch (err) { /* ignore */ }
    }
    activeStudyTeardown = null;
  }

  /* ===================================================================== *
   * LB-14: TEST MODE (in-place, reuses the flashcard region)               *
   *                                                                        *
   * Self-rated, scored quiz over the CURRENT lesson's deck. There is no    *
   * separate overlay or end screen anymore (LB-11's gameModal was removed  *
   * in LB-14). Test mode is driven by a switch on the flashcard screen:    *
   * the bootstrap calls LBEngine.startTest(lesson, N) when the switch is   *
   * turned ON and LBEngine.start(lesson) when it is turned OFF.            *
   *                                                                        *
   * startTest() reuses the SAME #number / #word / #pronunciation region as *
   * study, swapping the single "Reveal it" button for two buttons          *
   * ("Got it" / "Missed it"). Study mode (start() above) is untouched and  *
   * byte-identical — the engine unit tests provide no LBStore/LBGame/etc., *
   * so all the test-mode wiring below is guarded and never fires there.    *
   *                                                                        *
   * Per-card flow:                                                         *
   *   show number -> user recalls -> taps "Got it" / "Missed it" (commit   *
   *   via handleSelfRate) -> THEN reveal the Albanian word + pronunciation *
   *   so the user can check -> "Next Card" -> next card.                   *
   * After N cards: a one-line result is shown IN the card region with      *
   *   "Study" (switch off) and "Test again" actions.                       *
   *                                                                        *
   * All scoring math is pure and lives in window.LBGame (game.js); this    *
   * code only feeds inputs in and renders what comes back. handleSelfRate  *
   * (below) is the shared commit hook reused verbatim from LB-11/LB-12.    *
   * ===================================================================== */

  /* The single shared self-rate hook (LB-11/LB-12 seam).
   *
   * Builds the canonical event { card, gotIt, responseMs } via LBGame, wires
   * the result into LBLeitner (guarded — only when present), and returns the
   * event so the game flow can record it for scoring.
   *
   * LB-12 extends THIS function: add a guarded LBMastery.record(lessonId, evt)
   * here using evt.responseMs for speed-tiered mastery. The event shape and the
   * call site already carry everything LB-12 needs — no rework required.
   *
   *   lessonId   : the active lesson id (for the Leitner card key).
   *   card       : the card being rated (the engine's normalized card object).
   *   gotIt      : true = "Got it", false = "Missed it".
   *   cardShownAt: the timestamp captured when this card was shown (nowTs()).
   */
  function handleSelfRate(lessonId, card, gotIt, cardShownAt) {
    var responseMs = 0;
    var shown = (typeof cardShownAt === "number") ? cardShownAt : null;
    if (shown != null) {
      var diff = nowTs() - shown;
      if (isFinite(diff) && diff >= 0) responseMs = diff;
    }

    // Canonical event via the pure mapping (single source of truth).
    var evt;
    if (typeof window !== "undefined" && window.LBGame &&
        typeof window.LBGame.makeSelfRateEvent === "function") {
      evt = window.LBGame.makeSelfRateEvent(card, gotIt, responseMs);
    } else {
      // Defensive fallback if game.js failed to load — keep the same shape.
      evt = { card: card, gotIt: gotIt === true, responseMs: responseMs };
    }

    // Wire Leitner (completes LB-10's loop). Guarded: only when LBLeitner is
    // present. recordResult never throws, but guard the call site too so the
    // game runs fine when leitner.js is absent.
    try {
      if (typeof window !== "undefined" && window.LBLeitner &&
          typeof window.LBLeitner.recordResult === "function" && lessonId) {
        window.LBLeitner.recordResult(lessonId, card, evt.gotIt);
      }
    } catch (err) {
      console.warn("[engine] leitner recordResult failed; continuing", err);
    }

    // LB-12 SEAM: feed the event to speed-tiered mastery. Guarded — only when
    // LBMastery is present (engine unit-test sandboxes have none, so this never
    // fires there and LB-11 behavior is byte-identical). record() never throws,
    // but guard the call site too so the game runs fine when mastery.js is absent.
    try {
      if (typeof window !== "undefined" && window.LBMastery &&
          typeof window.LBMastery.record === "function" && lessonId) {
        window.LBMastery.record(lessonId, evt);
      }
    } catch (err) {
      console.warn("[engine] mastery record failed; continuing", err);
    }

    return evt;
  }

  // LB-14: the teardown for the currently-running test session (timer + the
  // test-mode keydown listener), set by startTest(). null when no test session
  // is active. stopTestSession() runs it before study mode resumes.
  var activeTestTeardown = null;

  /* LB-14: stop the active test session (its keydown listener) so study mode can
   * take back the shared card region without double-handling input. No-op when no
   * test session is active. Never throws. */
  function stopTestSession() {
    if (typeof activeTestTeardown === "function") {
      try { activeTestTeardown(); } catch (err) { /* ignore */ }
    }
    activeTestTeardown = null;
  }

  /* startTest(lesson, requestedCount) — run an N-card self-rated test on the
   * CURRENT lesson, reusing the SAME flashcard region as study mode.
   *
   * The bootstrap calls this when the "Test mode" switch is turned ON; turning it
   * OFF calls start(lesson) to return to normal study. Test mode:
   *   - replaces the single "Reveal it" button with "Got it" / "Missed it",
   *   - on either tap: commits via the shared handleSelfRate hook (records
   *     gotIt + responseMs -> LBLeitner.recordResult + LBMastery.record), THEN
   *     reveals the Albanian word + pronunciation so the user can check,
   *   - "Next Card" advances; after N cards a one-line result reuses the card
   *     region with "Study" (switch off) and "Test again" actions.
   *
   * N comes from the GLOBAL quizCount pref (passed in by the bootstrap). The pool
   * is built by the pure LBGame.buildPool, respecting the lesson's order pref via
   * the deck the engine passes (the deck order is irrelevant — buildPool shuffles;
   * Leitner weighting is applied per-card by surfacing order, which v1 test mode
   * keeps simple: a shuffled N-card pool from the lesson deck).
   *
   * GUARDED: requires the static test-mode markup AND window.LBGame. The engine
   * unit-test sandboxes have neither, so this returns early and never affects the
   * existing study tests. */
  function startTest(lesson, requestedCount) {
    // Ensure no study session is still listening on the shared region/keys.
    stopStudySession();
    // Restart cleanly if a prior test session was active.
    stopTestSession();

    var lessonId = (lesson && lesson.id) ? String(lesson.id) : "";
    var deck = buildDeck(lesson);

    // ----- shared card-region DOM (reused from study) + test controls --------
    var numberEl = document.getElementById("number");
    var wordEl = document.getElementById("word");
    var pronEl = document.getElementById("pronunciation");
    var labelEl = document.getElementById("label");
    var recallEl = document.getElementById("recall");
    var barWrap = (typeof document.querySelector === "function")
      ? document.querySelector(".timer") : null;
    var cardEl = (typeof document.querySelector === "function")
      ? document.querySelector(".card") : null;
    var studyControls = document.getElementById("studyControls");
    var testControls = document.getElementById("testControls");
    var rateRow = document.getElementById("testRate");
    var gotBtn = document.getElementById("testGotBtn");
    var missedBtn = document.getElementById("testMissedBtn");
    var nextWrap = document.getElementById("testNextWrap");
    var nextBtn = document.getElementById("testNextBtn");
    var progressEl = document.getElementById("testProgress");
    var resultRow = document.getElementById("testResult");

    // Test mode REQUIRES its static markup + the pure game module. Without
    // either (engine unit-test sandboxes), bail without touching study state.
    if (!numberEl || !gotBtn || !missedBtn || !nextBtn ||
        typeof window === "undefined" || !window.LBGame ||
        typeof window.LBGame.buildPool !== "function") {
      console.warn("[engine] test-mode markup or LBGame missing; cannot start test");
      return;
    }

    function setHidden(el, hidden) { if (el) el.hidden = hidden; }

    // Build the N-card pool via the pure module (shuffle + clamp to count).
    var pool = window.LBGame.buildPool(deck, requestedCount);
    if (!pool.length) {
      console.warn("[engine] no cards available for test", lesson);
      return;
    }

    var idx = 0;            // index into pool
    var events = [];        // self-rate events, one per played card
    var cardShownAt = null; // when the current card was shown

    // ----- enter test mode: swap study controls for the test controls -------
    setHidden(studyControls, true);
    setHidden(testControls, false);
    setHidden(resultRow, true);
    // The reveal timer + its bar do not belong to test mode (the user commits a
    // self-rate before the answer shows). Hide the timer bar while testing.
    setHidden(barWrap, true);
    if (labelEl) labelEl.textContent = "";

    function showCard() {
      var card = pool[idx];

      if (progressEl) {
        progressEl.textContent = "Card " + (idx + 1) + " of " + pool.length;
        progressEl.hidden = false;
      }

      // Prompt (reuse the same font auto-shrink ladder as study mode).
      numberEl.style.fontSize = promptFontSize(card.prompt);
      numberEl.textContent = card.prompt;

      // Answer prepared but hidden until the self-rate commits.
      wordEl.style.fontSize = wordFontSize(card.answer);
      wordEl.innerHTML = renderAnswer(card.answer);
      wordEl.hidden = true;
      pronEl.textContent = card.hint;
      pronEl.hidden = true;
      if (recallEl) { recallEl.textContent = ""; recallEl.hidden = true; }

      // Recall phase: Got it / Missed it visible, Next hidden.
      setHidden(rateRow, false);
      setHidden(nextWrap, true);

      // LB-9 a11y parity: answer hidden again — describe the region.
      setAttr(cardEl, "aria-label",
        "Answer hidden. Rate yourself, then the Albanian word and pronunciation show.");

      // Stamp when the card was shown — drives responseMs in the self-rate hook.
      cardShownAt = nowTs();

      if (typeof gotBtn.focus === "function") gotBtn.focus();
    }

    function revealAnswer() {
      var card = pool[idx];
      wordEl.hidden = false;
      pronEl.hidden = (card.hint === "");
      // Reveal phase: rate buttons hidden, Next visible.
      setHidden(rateRow, true);
      setHidden(nextWrap, false);
      // LB-9 a11y: clear the "answer hidden" label so the aria-live region does
      // not talk over the freshly-revealed word/pronunciation.
      removeAttr(cardEl, "aria-label");
      if (typeof nextBtn.focus === "function") nextBtn.focus();
    }

    function rate(gotIt) {
      var card = pool[idx];
      // The single shared hook: builds the event, wires Leitner + Mastery
      // (guarded), returns the event. Same hook study/LB-11 used.
      var evt = handleSelfRate(lessonId, card, gotIt, cardShownAt);
      events.push(evt);
      // Commit happens BEFORE the reveal — now show the answer to verify.
      revealAnswer();
    }

    function advance() {
      idx++;
      if (idx >= pool.length) {
        showResult();
      } else {
        showCard();
      }
    }

    /* Show the one-line result IN the card region (no overlay). Reuses #number
     * for the headline and #word for the mastery hint, then offers Study / Test
     * again via the test-controls row. */
    function showResult() {
      var summary = (typeof window.LBGame.summarize === "function")
        ? window.LBGame.summarize(events)
        : { total: events.length, gotIt: 0, percent: 0, review: [] };

      // Headline result line, sized down to fit the card (it is text, not a
      // big number) — reuse #number as the result area.
      numberEl.style.fontSize = "1.6rem";
      numberEl.textContent = "Quiz done — " + summary.gotIt + "/" +
        summary.total + " (" + summary.percent + "%)";

      wordEl.style.fontSize = "1.1rem";
      wordEl.innerHTML = "Mastery updated above.";
      wordEl.hidden = false;
      pronEl.textContent = "";
      pronEl.hidden = true;
      if (progressEl) progressEl.hidden = true;

      // Swap the rate/next rows for the result actions (Study / Test again).
      setHidden(rateRow, true);
      setHidden(nextWrap, true);
      setHidden(resultRow, false);

      setAttr(cardEl, "aria-label", "");
      var studyBtn = document.getElementById("testResultStudyBtn");
      if (studyBtn && typeof studyBtn.focus === "function") studyBtn.focus();
    }

    // ----- keyboard: Enter/Space mirror the active phase action --------------
    function onTestKeydown(event) {
      var k = event.key;
      // Only intercept the action keys; never fight typing elsewhere.
      if (k !== " " && k !== "Enter") return;
      // Rate phase: do not hijack — the user must pick Got it / Missed it
      // explicitly. Reveal phase: Enter/Space advances (mirrors "Next Card").
      if (rateRow && rateRow.hidden === false) return;
      if (nextWrap && nextWrap.hidden === false) {
        event.preventDefault();
        advance();
      }
    }

    // ----- wire controls (re-assigned per startTest; .onclick is idempotent) -
    gotBtn.onclick = function () { rate(true); };
    missedBtn.onclick = function () { rate(false); };
    nextBtn.onclick = advance;

    document.addEventListener("keydown", onTestKeydown);

    // Register teardown so a switch back to study removes the listener.
    activeTestTeardown = function () {
      if (typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", onTestKeydown);
      }
    };

    showCard();
  }

  /* LB-14: leave test mode and resume normal study. Restores the study controls
   * + timer bar and re-runs start() on the lesson (a fresh study session, which
   * re-registers study's own listeners). Guarded for the no-markup case. */
  function endTest(lesson) {
    stopTestSession();
    var studyControls = document.getElementById("studyControls");
    var testControls = document.getElementById("testControls");
    var resultRow = document.getElementById("testResult");
    var barWrap = (typeof document.querySelector === "function")
      ? document.querySelector(".timer") : null;
    if (studyControls) studyControls.hidden = false;
    if (testControls) testControls.hidden = true;
    if (resultRow) resultRow.hidden = true;
    if (barWrap) barWrap.hidden = false;
    start(lesson);
  }

  // Public surface. startGame removed in LB-14 (the overlay quiz is gone);
  // startTest/endTest drive the in-place, switch-controlled test mode.
  window.LBEngine = {
    start: start,
    startTest: startTest,
    endTest: endTest,
    DEFAULTS: DEFAULTS
  };
})();
