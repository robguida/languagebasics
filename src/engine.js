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

  /* LB-18 SEAM A: per-card example rotation for the alphabet cards.
   *
   * Alphabet cards pack THREE example words into `hint` (" / "-separated) and we
   * want the learner to see ONE per view, cycling through all three across
   * repeated views. The pick is keyed on CARD IDENTITY (lessonId:prompt), NOT
   * pool position — Leitner reorders and test mode reshuffles, so position is
   * not a stable key. exampleCycle holds a per-identity view counter that
   * survives study<->test switches within a page load.
   *
   * The PURE selection logic lives in window.LBHint (hint.js, unit-tested like
   * leitner.js/mastery.js). This is only the bookkeeping + a guarded call:
   *   - LBHint absent (engine unit-test sandboxes have no LBHint) => return the
   *     raw hint, byte-identical to pre-LB-18.
   *   - hint has no " / " (every NUMBER lesson) => LBHint.pick returns it
   *     unchanged, also byte-identical.
   * The example is shown on reveal/back ONLY; it never gates answer time. */
  var exampleCycle = {};

  function nextExampleIndex(lessonId, prompt) {
    var key = String(lessonId) + ":" + String(prompt);
    var i = (typeof exampleCycle[key] === "number") ? exampleCycle[key] : 0;
    exampleCycle[key] = i + 1;
    return i;
  }

  function renderHint(lessonId, card) {
    var raw = card.hint;
    try {
      if (typeof window !== "undefined" && window.LBHint &&
          typeof window.LBHint.pick === "function") {
        var idx = nextExampleIndex(lessonId, card.prompt);
        return window.LBHint.pick(raw, idx);
      }
    } catch (err) {
      // Any rotation failure => show the raw hint. Never abort the card.
      console.warn("[engine] hint example pick failed; using raw hint", err);
    }
    return raw;
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
      // LB-34: testing flag off => Leitner order is unavailable (it depends on
      // test-mode ratings); always plain random. Missing flag object => on.
      if (typeof window !== "undefined" && window.LB_FEATURES &&
          window.LB_FEATURES.testing === false) return "random";
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
    // LB-18 SEAM A: identity for the per-card example-rotation key.
    var lessonId = (lesson && lesson.id) ? String(lesson.id) : "";

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
      // LB-18 SEAM A: rotate to ONE example for alphabet cards; raw hint for
      // number cards / when LBHint is absent (byte-identical to before).
      pronEl.textContent = renderHint(lessonId, current);

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
   * LB-15: TEST MODE (in-place, single button, the TIMER is the signal)    *
   *                                                                        *
   * Self-rated, scored quiz over the CURRENT lesson's deck. Driven by a    *
   * switch on the flashcard screen: the bootstrap calls                     *
   * LBEngine.startTest(lesson, N) when the switch is turned ON and          *
   * LBEngine.start(lesson) when it is turned OFF.                          *
   *                                                                        *
   * LB-15 simplifies LB-14: there are NO "Got it" / "Missed it" buttons.   *
   * Test mode reuses the SAME single "Reveal it / Next Card" button as     *
   * study, and the per-lesson reveal TIMER (resolvedRevealMs) is the       *
   * scoring signal. Study mode (start() above) is untouched and            *
   * byte-identical — the engine unit tests provide no LBStore/LBGame/etc., *
   * so all the test-mode wiring below is guarded and never fires there.    *
   *                                                                        *
   * Per-card flow:                                                         *
   *   show number + run the visible timer -> the user recalls.            *
   *     - click "Reveal it" BEFORE the timer hits 0  => they KNEW it:      *
   *       handleSelfRate(gotIt=true, responseMs=now-shown). The timer is   *
   *       cancelled so it cannot also fire for this card.                  *
   *     - the timer reaches 0 and the card auto-reveals => they MISSED it: *
   *       handleSelfRate(gotIt=false).                                     *
   *   Either way ONE self-rate per card (a per-card guard ensures the      *
   *   manual-click path and the timer-expiry path can never both commit).  *
   *   After the reveal the button reads "Next Card" and advances.          *
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

  // LB-15: the teardown for the currently-running test session (its reveal
  // timer + the toggle-button click handler + the test-mode keydown listener),
  // set by startTest(). null when no test session is active. stopTestSession()
  // runs it before study mode resumes.
  var activeTestTeardown = null;

  /* LB-15: stop the active test session (its timer + click/keydown listeners) so
   * study mode can take back the shared card region without double-handling input
   * or leaving a stray timer running. No-op when no test session is active. Never
   * throws. */
  function stopTestSession() {
    if (typeof activeTestTeardown === "function") {
      try { activeTestTeardown(); } catch (err) { /* ignore */ }
    }
    activeTestTeardown = null;
  }

  /* startTest(lesson, requestedCount) — run an N-card self-rated test on the
   * CURRENT lesson, reusing the SAME flashcard region AND the SAME single
   * "Reveal it / Next Card" button as study mode.
   *
   * The bootstrap calls this when the "Test mode" switch is turned ON; turning it
   * OFF calls start(lesson) to return to normal study. LB-15 test mode:
   *   - uses the ONE study button (#toggleBtn) and the per-lesson reveal TIMER,
   *   - the timer is the scoring signal:
   *       * click "Reveal it" BEFORE the timer hits 0  => gotIt = true, with
   *         responseMs = now - cardShownAt (so faster = better mastery level);
   *         the timer is cancelled so it cannot also fire for this card,
   *       * the timer reaches 0 (auto-reveal)          => gotIt = false (miss,
   *         which drives the mastery decay),
   *   - either path commits via the shared handleSelfRate hook (records
   *     gotIt + responseMs -> LBLeitner.recordResult + LBMastery.record),
   *   - a per-card "rated" guard ensures EXACTLY one self-rate per card — the
   *     manual-click path and the timer-expiry path can never both commit,
   *   - the button then reads "Next Card" and advances; after N cards a one-line
   *     result reuses the card region with "Study" (switch off) / "Test again".
   *
   * N comes from the GLOBAL quizCount pref (passed in by the bootstrap). The pool
   * is built by the pure LBGame.buildPool (shuffle + clamp to count).
   *
   * GUARDED: requires the static markup (#toggleBtn) AND window.LBGame. The engine
   * unit-test sandboxes have no LBGame, so this returns early and never affects the
   * existing study tests. */
  function startTest(lesson, requestedCount, onExit) {
    // LB-34: testing flag off => a test can never start, even if called directly.
    if (typeof window !== "undefined" && window.LB_FEATURES &&
        window.LB_FEATURES.testing === false) {
      return;
    }
    // Ensure no study session is still listening on the shared region/keys.
    stopStudySession();
    // Restart cleanly if a prior test session was active.
    stopTestSession();

    // LB-16: optional callback the bootstrap supplies so dismissing the result
    // modal can flip the test switch OFF (kept out of the engine so the engine
    // owns no switch-UI knowledge). Guarded everywhere it is called.
    var exitCallback = (typeof onExit === "function") ? onExit : null;

    var lessonId = (lesson && lesson.id) ? String(lesson.id) : "";
    var deck = buildDeck(lesson);

    // ----- reveal duration (same resolution order as study mode) -------------
    var override = resolvedRevealMs(lesson);
    var revealMs = (override != null)
      ? override
      : ((lesson && typeof lesson.revealMs === "number" && lesson.revealMs > 0)
        ? lesson.revealMs
        : DEFAULTS.revealMs);

    // ----- shared card-region DOM (reused from study) + test controls --------
    var numberEl = document.getElementById("number");
    var wordEl = document.getElementById("word");
    var pronEl = document.getElementById("pronunciation");
    var labelEl = document.getElementById("label");
    var recallEl = document.getElementById("recall");
    var barEl = document.getElementById("bar");
    var barWrap = (typeof document.querySelector === "function")
      ? document.querySelector(".timer") : null;
    var cardEl = (typeof document.querySelector === "function")
      ? document.querySelector(".card") : null;
    var studyControls = document.getElementById("studyControls");
    var testControls = document.getElementById("testControls");
    var toggleBtn = document.getElementById("toggleBtn");
    var nextWrap = document.getElementById("testNextWrap");
    var progressEl = document.getElementById("testProgress");
    // LB-16: the test-result MODAL (replaces the in-card Study / Test-again row).
    var resultModal = document.getElementById("resultModal");
    var resultScoreEl = document.getElementById("resultScore");
    var resultTimeEl = document.getElementById("resultTime");
    var resultMasteryEl = document.getElementById("resultMastery");
    var resultCloseX = document.getElementById("resultClose");
    var resultCloseBtn = document.getElementById("resultCloseBtn");

    // Test mode REQUIRES the single study button + the pure game module. Without
    // either (engine unit-test sandboxes have no LBGame), bail without touching
    // study state.
    if (!numberEl || !toggleBtn ||
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

    var idx = 0;             // index into pool
    var events = [];         // self-rate events, one per played card
    var cardShownAt = null;  // when the current card was shown
    var timer = null;        // the per-card reveal timeout (the miss signal)
    var rated = false;       // one-self-rate-per-card guard (click vs timeout)
    var revealed = false;    // false = prompt phase ("Reveal it"), true = revealed

    // ----- enter test mode: swap study controls for the test result row, but
    // keep the SAME #toggleBtn (reused) and SHOW the timer bar (it is the miss
    // signal in LB-15). studyControls hosts #toggleBtn, so it stays visible.
    setHidden(studyControls, false);
    setHidden(testControls, false);
    setHidden(nextWrap, true);     // the old test "Next" button is unused now
    setHidden(barWrap, false);     // LB-15: the timer IS visible during a test
    if (labelEl) labelEl.textContent = "";

    function resetBar() {
      if (!barEl) return;
      // Drive the CSS bar duration from revealMs so it matches the timeout.
      barEl.style.animation = "none";
      void barEl.offsetWidth; // force reflow so the animation restarts
      barEl.style.animationPlayState = "running";
      barEl.style.animation = "shrink " + (revealMs / 1000) + "s linear forwards";
    }

    function showCard() {
      var card = pool[idx];
      rated = false;
      revealed = false;

      if (progressEl) {
        progressEl.textContent = "Card " + (idx + 1) + " of " + pool.length;
        progressEl.hidden = false;
      }

      // Prompt (reuse the same font auto-shrink ladder as study mode).
      numberEl.style.fontSize = promptFontSize(card.prompt);
      numberEl.textContent = card.prompt;

      // Answer prepared but hidden until reveal.
      wordEl.style.fontSize = wordFontSize(card.answer);
      wordEl.innerHTML = renderAnswer(card.answer);
      wordEl.hidden = true;
      // LB-18 SEAM A: same per-card example rotation as study mode (lessonId is
      // already resolved above in startTest).
      pronEl.textContent = renderHint(lessonId, card);
      pronEl.hidden = true;
      if (recallEl) { recallEl.textContent = ""; recallEl.hidden = true; }

      // Prompt phase: the single button reveals.
      if (toggleBtn) {
        toggleBtn.textContent = "Reveal it";
        setAttr(toggleBtn, "aria-label", "Reveal the Albanian word");
      }

      // LB-9 a11y parity: answer hidden again — describe the region.
      setAttr(cardEl, "aria-label",
        "Answer hidden. Reveal before the timer runs out to mark it known.");

      // Stamp when the card was shown — drives responseMs in the self-rate hook.
      cardShownAt = nowTs();

      // Start the visible reveal timer; expiry = miss (auto-reveal, gotIt false).
      clearTimeout(timer);
      resetBar();
      timer = setTimeout(onTimeout, revealMs);

      if (typeof toggleBtn.focus === "function") toggleBtn.focus();
    }

    /* Commit exactly one self-rate for the current card, then reveal. The
     * `rated` guard makes this idempotent per card: whichever of the manual
     * click or the timer expiry happens first wins; the other is a no-op. */
    function commitAndReveal(gotIt) {
      if (rated) return;
      rated = true;
      // Cancel the timer so a manual reveal can't also fire the timeout miss.
      clearTimeout(timer);
      if (barEl) barEl.style.animationPlayState = "paused";

      var card = pool[idx];
      // The single shared hook: builds the event, wires Leitner + Mastery
      // (guarded), returns the event. Same hook study/LB-11/LB-14 used.
      var evt = handleSelfRate(lessonId, card, gotIt, cardShownAt);
      events.push(evt);

      // Reveal the answer so the user can check, and flip the button to advance.
      revealed = true;
      wordEl.hidden = false;
      pronEl.hidden = (card.hint === "");
      if (toggleBtn) {
        toggleBtn.textContent = "Next Card";
        setAttr(toggleBtn, "aria-label", "Go to the next card");
      }
      // LB-9 a11y: clear the "answer hidden" label so the aria-live region does
      // not talk over the freshly-revealed word/pronunciation.
      removeAttr(cardEl, "aria-label");
      if (toggleBtn && typeof toggleBtn.focus === "function") toggleBtn.focus();
    }

    // Manual reveal BEFORE the timer => they knew it (gotIt true, with speed).
    function onManualReveal() { commitAndReveal(true); }
    // Timer reached 0 => they missed it (gotIt false; drives mastery decay).
    function onTimeout() { commitAndReveal(false); }

    function advance() {
      idx++;
      if (idx >= pool.length) {
        showResult();
      } else {
        showCard();
      }
    }

    // The single button: reveal (manual = got it) while in prompt phase, else
    // advance to the next card — mirrors study mode's toggle shape.
    function toggle() {
      if (revealed) {
        advance();
      } else {
        onManualReveal();
      }
    }

    /* LB-16: format a millisecond total as seconds with ONE decimal, e.g.
     * 15000 -> "15.0", 5000 -> "5.0". Pure-ish (no DOM); kept inline because it
     * is display formatting, not scoring math (the totals come from LBGame). */
    function fmtSeconds(ms) {
      var n = Number(ms);
      if (!isFinite(n) || n < 0) n = 0;
      return (n / 1000).toFixed(1);
    }

    // LB-16: whether the result modal is currently open (used by the keydown
    // handler so action keys don't drive a card that is no longer live).
    var resultOpen = false;

    /* LB-16: dismiss the result modal — the SINGLE way out (Close button, Esc,
     * or backdrop click all route here). Closes the modal, returns to normal
     * study via endTest, and (guarded) flips the test switch OFF via onExit.
     * Idempotent: a no-op once already dismissed. */
    function dismissResult() {
      if (!resultOpen) return;
      resultOpen = false;
      if (resultModal && resultModal.classList &&
          typeof resultModal.classList.remove === "function") {
        resultModal.classList.remove("open");
      }
      if (typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", onResultKeydown, true);
      }
      // Return to normal study mode (re-runs start() on the lesson).
      endTest(lesson);
      // Flip the test switch OFF so the UI matches study mode resuming.
      if (exitCallback) {
        try { exitCallback(); } catch (err) { /* ignore */ }
      }
    }

    /* LB-16: while the result modal is open, Esc dismisses it. */
    function onResultKeydown(event) {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        dismissResult();
      }
    }

    /* LB-16: show the end-of-test result as a clean MODAL (role=dialog,
     * aria-modal, Esc + backdrop-click + a single Close button). Renders the
     * score AND the time summary. The single way to dismiss is Close/Esc/backdrop;
     * dismissing turns test mode OFF and returns to study (see dismissResult).
     *
     * Falls back to a minimal in-card line ONLY if the modal markup is missing,
     * so the engine never strands the user without a result. */
    function showResult() {
      clearTimeout(timer);
      if (barWrap) barWrap.hidden = true; // no live card -> hide the timer bar
      if (progressEl) progressEl.hidden = true;

      var summary = (typeof window.LBGame.summarize === "function")
        ? window.LBGame.summarize(events)
        : { total: events.length, gotIt: 0, percent: 0, review: [] };

      // ----- TIME totals via the pure LBGame functions (LB-16) -----
      // possible = N questions * the per-lesson timer; used = sum of each card
      // clamped to the timer (a timeout counts the full timer). The pure math
      // guarantees used <= possible.
      var possibleMs = (typeof window.LBGame.timePossibleMs === "function")
        ? window.LBGame.timePossibleMs(summary.total, revealMs)
        : summary.total * revealMs;
      var usedMs = (typeof window.LBGame.timeUsedMs === "function")
        ? window.LBGame.timeUsedMs(events, revealMs)
        : 0;

      var scoreText = "You scored " + summary.gotIt + " of " + summary.total +
        " (" + summary.percent + "%)";
      var timeText = "You used " + fmtSeconds(usedMs) + " seconds of " +
        fmtSeconds(possibleMs) + " possible";

      // If the modal markup is missing (defensive), degrade to the card region.
      if (!resultModal || !resultModal.classList ||
          typeof resultModal.classList.add !== "function") {
        numberEl.style.fontSize = "1.4rem";
        numberEl.textContent = scoreText;
        wordEl.style.fontSize = "1.0rem";
        wordEl.textContent = timeText;
        wordEl.hidden = false;
        pronEl.hidden = true;
        return;
      }

      // ----- populate + open the modal -----
      if (resultScoreEl) resultScoreEl.textContent = scoreText;
      if (resultTimeEl) {
        // Bold the two numbers per the spec wording without inline styles.
        resultTimeEl.innerHTML = "You used <strong>" + fmtSeconds(usedMs) +
          " seconds</strong> of <strong>" + fmtSeconds(possibleMs) +
          " possible</strong>";
      }
      if (resultMasteryEl) {
        resultMasteryEl.textContent = "Your mastery levels have been updated.";
      }

      resultModal.classList.add("open");
      resultOpen = true;
      if (typeof document.addEventListener === "function") {
        document.addEventListener("keydown", onResultKeydown, true);
      }

      // Move focus into the dialog (the Close button).
      if (resultCloseBtn && typeof resultCloseBtn.focus === "function") {
        resultCloseBtn.focus();
      } else if (typeof resultModal.focus === "function") {
        resultModal.focus();
      }
    }

    // ----- keyboard: Enter/Space mirror the single button --------------------
    function onTestKeydown(event) {
      var k = event.key;
      // Only intercept the action keys; never fight typing elsewhere.
      if (k !== " " && k !== "Enter") return;
      // While the result modal is open there is no live card to act on.
      if (resultOpen) return;
      event.preventDefault();
      toggle();
    }

    // ----- wire the single button (.onclick is idempotent across startTest) --
    toggleBtn.onclick = toggle;

    document.addEventListener("keydown", onTestKeydown);

    // LB-16: wire the result-modal dismissals — Close button (#resultClose X and
    // #resultCloseBtn), plus a backdrop click (clicking the scrim outside the
    // panel). .onclick is idempotent across startTest so a restart doesn't stack
    // handlers. All three route through dismissResult (the single way out).
    if (resultCloseX) resultCloseX.onclick = dismissResult;
    if (resultCloseBtn) resultCloseBtn.onclick = dismissResult;
    function onResultBackdrop(event) {
      if (event.target === resultModal) dismissResult();
    }
    if (resultModal) resultModal.onclick = onResultBackdrop;

    // Register teardown so a switch back to study stops the timer + removes the
    // listeners (and detaches the click handlers the engine owns here).
    activeTestTeardown = function () {
      try { clearTimeout(timer); } catch (err) { /* ignore */ }
      if (toggleBtn) toggleBtn.onclick = null;
      if (typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", onTestKeydown);
        document.removeEventListener("keydown", onResultKeydown, true);
      }
      // LB-16: detach the modal handlers + ensure the modal is closed.
      if (resultCloseX) resultCloseX.onclick = null;
      if (resultCloseBtn) resultCloseBtn.onclick = null;
      if (resultModal) {
        resultModal.onclick = null;
        if (resultModal.classList &&
            typeof resultModal.classList.remove === "function") {
          resultModal.classList.remove("open");
        }
      }
      resultOpen = false;
    };

    showCard();
  }

  /* LB-15: leave test mode and resume normal study. Restores the study controls
   * + timer bar and re-runs start() on the lesson (a fresh study session, which
   * re-registers study's own listeners and resets #toggleBtn). Guarded for the
   * no-markup case. */
  function endTest(lesson) {
    stopTestSession();
    var studyControls = document.getElementById("studyControls");
    var testControls = document.getElementById("testControls");
    // LB-16: close the result modal if it is still open (the in-card result row
    // was removed in LB-16; the modal is the only result surface now).
    var resultModal = document.getElementById("resultModal");
    var barWrap = (typeof document.querySelector === "function")
      ? document.querySelector(".timer") : null;
    if (studyControls) studyControls.hidden = false;
    if (testControls) testControls.hidden = true;
    if (resultModal && resultModal.classList &&
        typeof resultModal.classList.remove === "function") {
      resultModal.classList.remove("open");
    }
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
