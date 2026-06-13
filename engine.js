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
 * Generic card schema (Tommy can validate against this):
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
    // Placeholder copy. Robby drops final microcopy in here (or per-card via
    // card.recallPrompt) WITHOUT touching this engine.
    recallPrompt: "Say it out loud, then reveal."
  };

  // Length-based font auto-shrink ladder (generalized from lesson 6).
  // Short prompts never reach these thresholds, so they keep the CSS default.
  function promptFontSize(text) {
    var len = String(text).length;
    if (len >= 10) return "3.8rem";
    if (len >= 8)  return "4.5rem";
    if (len >= 6)  return "5.5rem";
    if (len >= 4)  return "6.5rem";
    return ""; // empty => fall back to the .number CSS clamp
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

  function start(lesson) {
    var revealMs = (lesson && typeof lesson.revealMs === "number" && lesson.revealMs > 0)
      ? lesson.revealMs
      : DEFAULTS.revealMs;
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
    var nextBtn = document.getElementById("nextBtn");
    var showBtn = document.getElementById("showBtn");
    var titleEl = document.getElementById("title");

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

    function randomCard() {
      var card;
      do {
        card = deck[Math.floor(Math.random() * deck.length)];
      } while (deck.length > 1 && card.prompt === lastPrompt);
      lastPrompt = card.prompt;
      return card;
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
      labelEl.textContent = "Albanian spelling:";
      if (recallEl) recallEl.hidden = true;
      clearTimeout(timer);
      barEl.style.animationPlayState = "paused";
    }

    function nextCard() {
      current = randomCard();

      numberEl.style.fontSize = promptFontSize(current.prompt);
      numberEl.textContent = current.prompt;

      wordEl.innerHTML = renderAnswer(current.answer);
      pronEl.textContent = current.hint;

      wordEl.hidden = true;
      pronEl.hidden = true;
      labelEl.textContent = "What is this number in Albanian?";
      if (recallEl) {
        recallEl.textContent = current.recallPrompt || recallPrompt;
        recallEl.hidden = false;
      }

      clearTimeout(timer);
      resetBar();
      timer = setTimeout(showAnswer, revealMs);
    }

    nextBtn.addEventListener("click", nextCard);
    showBtn.addEventListener("click", showAnswer);
    document.addEventListener("keydown", function (event) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        showAnswer();
      }
      if (event.key.toLowerCase() === "n") nextCard();
    });

    nextCard();
  }

  // Public surface.
  window.LBEngine = { start: start, DEFAULTS: DEFAULTS };
})();
