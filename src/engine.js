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

  function start(lesson) {
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

    if (toggleBtn) toggleBtn.addEventListener("click", toggle);
    document.addEventListener("keydown", function (event) {
      // Space/Enter mirror the single button: reveal, then next.
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toggle();
      }
      // "n" retained as a power-user shortcut to force the next card
      // regardless of phase (skip without revealing).
      if (event.key.toLowerCase() === "n") nextCard();
    });

    nextCard();
  }

  // Public surface.
  window.LBEngine = { start: start, DEFAULTS: DEFAULTS };
})();
