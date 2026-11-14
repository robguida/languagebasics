/* LanguageBasics shared flashcard engine.
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * A lesson is supplied as a global object (see content/sq/*.js) of shape:
 *   {
 *     id:          "sq/lesson-1",                 // string, for the selector
 *     title:       "Numbers: 1-10",               // shown in <h1>
 *     revealMs:    5000,                           // optional, default 5000
 *     cards: [ { prompt, answer, hint, audio }, ... ]
 *   }
 *
 * Generic card schema (the test suite validates against this):
 *   prompt  : string|number  required  -> the prompt shown first
 *   answer  : string         required  -> the answer word(s); " | " => line break
 *   hint    : string         optional  -> pronunciation (may be "")
 *   audio   : string         optional  -> reserved for future audio src ("")
 *
 * The engine is language-agnostic: it never looks at card content beyond the
 * fields above.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    revealMs: 5000
  };

  /* LB-36: test-mode copy (final UX wording) and the rating lock. */
  var COPY = {
    revealIt: "Reveal it",
    revealAria: "Reveal the answer",
    nextCard: "Next card",
    nextCardAria: "Next card",
    timesUp: "Time's up. Marked to practice.",
    cardHidden: "Answer hidden. Press Reveal it to show the answer and pronunciation.",
    testTitle: "Test results",
    practiceTitle: "Practice results",
    listHeading: "Cards to practice",
    noneMissedTest: "You knew them all. Nice work.",
    noneMissedPractice: "All caught up on this list.",
    bestNew: "New personal best!",
    bestTie: "You matched your best.",
    footerSaved: "Your progress is saved on this device only.",
    footerNotSaved: "Progress can't be saved here. Private browsing may be on."
  };
  function cardOfText(i, n) { return "Card " + i + " of " + n; }
  function knewText(k, n) { return "You knew " + k + " of " + n + "."; }
  function bestLowerText(b, n) { return "Your best: " + b + " of " + n + "."; }
  function lessonKnownText(n, m) { return "This lesson: " + n + " of " + m + " known."; }

  // Rating buttons ignore clicks/keys for this long after a reveal, so a
  // double-click or a held Enter can never land on "I knew it".
  var RATING_LOCK_MS = 500;

  // Length-based font auto-shrink ladder for the PROMPT. Short prompts never
  // reach these thresholds, so they keep the CSS .number clamp default.
  function promptFontSize(text) {
    var len = String(text).length;
    if (len >= 19) return "2.0rem";
    if (len >= 15) return "2.6rem";
    if (len >= 12) return "3.1rem";
    if (len >= 10) return "3.8rem";
    if (len >= 8)  return "4.5rem";
    if (len >= 6)  return "5.5rem";
    if (len >= 4)  return "6.5rem";
    return ""; // empty => fall back to the .number CSS clamp
  }

  // Length-based font auto-shrink ladder for the ANSWER. Uses the longest
  // single rendered line (after " | " splits).
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

  // Multi-part answers use " | " as a line separator. Built from text nodes
  // and <br> elements (never innerHTML), so lesson text is always plain text.
  // A DOM without createTextNode (some unit-test shims) gets the lines as
  // plain text, one line per part.
  function setAnswer(el, answer) {
    if (!el) return;
    var parts = String(answer).split(" | ");
    var canBuild = typeof document !== "undefined" &&
      typeof document.createTextNode === "function" &&
      typeof document.createElement === "function" &&
      typeof el.appendChild === "function";
    if (!canBuild) {
      el.textContent = parts.join("\n");
      return;
    }
    el.textContent = "";
    while (el.firstChild) el.removeChild(el.firstChild);
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(parts[i]));
    }
  }

  /* LB-18 SEAM A: per-card example rotation for the alphabet cards, keyed on
   * CARD IDENTITY (lessonId:prompt), not pool position. The pure selection
   * lives in window.LBHint (hint.js). LBHint absent => the raw hint. */
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

  /* LB-9 seam: the per-lesson reveal-timer override (LBPrefs), else null so
   * the caller falls back to lesson.revealMs, then the 5000 ms default. */
  function resolvedRevealMs(lesson) {
    try {
      if (lesson && lesson.id && typeof window !== "undefined" &&
          window.LBPrefs && typeof window.LBPrefs.getRevealMs === "function") {
        var override = window.LBPrefs.getRevealMs(lesson.id);
        if (typeof override === "number" && override > 0) return override;
      }
    } catch (err) {
      console.warn("[engine] reveal-timer pref read failed; using lesson default", err);
    }
    return null;
  }

  function revealMsFor(lesson) {
    var override = resolvedRevealMs(lesson);
    if (override != null) return override;
    return (lesson && typeof lesson.revealMs === "number" && lesson.revealMs > 0)
      ? lesson.revealMs
      : DEFAULTS.revealMs;
  }

  /* a11y helpers, guarded so the unit-test DOM shims never throw. */
  function setAttr(el, name, value) {
    if (el && typeof el.setAttribute === "function") el.setAttribute(name, value);
  }
  function removeAttr(el, name) {
    if (el && typeof el.removeAttribute === "function") el.removeAttribute(name);
  }
  function focusEl(el) {
    try { if (el && typeof el.focus === "function") el.focus(); } catch (err) { /* ignore */ }
  }
  function setHidden(el, hidden) { if (el) el.hidden = hidden; }
  function byId(id) {
    return (typeof document !== "undefined" && document.getElementById)
      ? document.getElementById(id) : null;
  }
  function query(sel) {
    return (typeof document !== "undefined" && typeof document.querySelector === "function")
      ? document.querySelector(sel) : null;
  }

  /* Keyboard guards shared by the study and test key handlers (LB-36). */
  var CONTROLS = ["BUTTON", "A", "SELECT", "INPUT", "TEXTAREA"];
  var FORM_FIELDS = ["INPUT", "SELECT", "TEXTAREA"];
  function isTag(el, names) {
    var tag = (el && typeof el.tagName === "string") ? el.tagName.toUpperCase() : "";
    return names.indexOf(tag) !== -1;
  }
  // The settings dialog is open: the card's shortcut keys must not act behind it.
  function settingsOpen() {
    try {
      return !!(typeof window !== "undefined" && window.LBSettings &&
        typeof window.LBSettings.isOpen === "function" && window.LBSettings.isOpen());
    } catch (err) {
      return false;
    }
  }

  /* LB-34 flag: testing off => no scoring, no streak, no test. A missing flag
   * object (unit-test sandboxes) counts as ON. */
  function testingOn() {
    try {
      return !(typeof window !== "undefined" && window.LB_FEATURES &&
        window.LB_FEATURES.testing === false);
    } catch (err) {
      return true;
    }
  }

  /* LB-36: wall clock for the rating lock. Date.now() epoch ms (never
   * performance.now()). Swappable for tests via LBEngine._setClock. */
  var clock = function () { return Date.now(); };
  function nowMs() {
    try {
      var n = clock();
      return (typeof n === "number" && isFinite(n)) ? n : 0;
    } catch (err) {
      return 0;
    }
  }

  /* LB-36: tiny hook list so the page can refresh its readouts. Events:
   *   "practice" — a day was just marked practiced (streak may have changed),
   *   "progress" — a rating was stored (N of M known may have changed). */
  var hooks = {};
  function on(name, fn) {
    if (typeof name === "string" && typeof fn === "function") hooks[name] = fn;
  }
  function emit(name) {
    try {
      if (typeof hooks[name] === "function") hooks[name]();
    } catch (err) {
      console.warn("[engine] hook '" + name + "' failed; continuing", err);
    }
  }

  /* LB-36 streak: a day counts on the first REVEAL in study (a user action)
   * or the first rating in a test — never on page load. markActive is
   * idempotent within a day. Guarded; never throws. */
  function markPractice() {
    if (!testingOn()) return;
    try {
      if (typeof window !== "undefined" && window.LBStreak &&
          typeof window.LBStreak.markActive === "function") {
        window.LBStreak.markActive();
      }
    } catch (err) {
      console.warn("[engine] streak markActive failed; continuing", err);
    }
    emit("practice");
  }

  /* ===================================================================== *
   * STUDY MODE — plain random flashcards. Records nothing.                 *
   * ===================================================================== */
  function start(lesson) {
    var revealMs = revealMsFor(lesson);
    var lessonId = (lesson && lesson.id) ? String(lesson.id) : "";

    var deck = buildDeck(lesson);

    var numberEl = byId("number");
    var wordEl = byId("word");
    var pronEl = byId("pronunciation");
    var labelEl = byId("label");
    var recallEl = byId("recall");
    var barEl = byId("bar");
    var toggleBtn = byId("toggleBtn");
    var titleEl = byId("title");
    var cardEl = query(".card");

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
    // false = prompt phase ("Reveal it"), true = revealed phase ("Next Card").
    var revealed = false;

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
      labelEl.textContent = "";
      if (recallEl) recallEl.hidden = true;
      clearTimeout(timer);
      barEl.style.animationPlayState = "paused";
      // The timer-expiry auto-reveal flips the button too, not just a click.
      revealed = true;
      if (toggleBtn) {
        toggleBtn.textContent = "Next Card";
        setAttr(toggleBtn, "aria-label", "Go to the next card");
      }
      removeAttr(cardEl, "aria-label");
    }

    function nextCard() {
      current = randomCard();

      numberEl.style.fontSize = promptFontSize(current.prompt);
      numberEl.textContent = current.prompt;

      wordEl.style.fontSize = wordFontSize(current.answer);
      setAnswer(wordEl, current.answer);
      pronEl.textContent = renderHint(lessonId, current);

      wordEl.hidden = true;
      pronEl.hidden = true;
      // No prompt text renders above the prompt on any lesson.
      labelEl.textContent = "";
      if (recallEl) {
        recallEl.textContent = "";
        recallEl.hidden = true;
      }

      revealed = false;
      if (toggleBtn) {
        toggleBtn.textContent = COPY.revealIt;
        setAttr(toggleBtn, "aria-label", COPY.revealAria);
      }
      setAttr(cardEl, "aria-label", COPY.cardHidden);

      clearTimeout(timer);
      resetBar();
      timer = setTimeout(showAnswer, revealMs);
    }

    // One action that does whatever the current phase calls for. A MANUAL
    // reveal (button / key) counts the day as practiced (LB-36); the timer's
    // auto-reveal does not, so an idle open page never builds a streak.
    function toggle() {
      if (revealed) {
        nextCard();
      } else {
        showAnswer();
        markPractice();
      }
    }

    function onToggleClick() { toggle(); }
    // Same focused-control rules as the test handler (onTestKeydown): a key
    // pressed on another control (Test me, Stop test, a picker, the settings
    // dialog) keeps its own action and is never cancelled here.
    function onStudyKeydown(event) {
      if (!event || event.ctrlKey || event.metaKey || event.altKey) return;
      if (settingsOpen()) return;
      var k = event.key;
      if (typeof k !== "string") return;
      var target = event.target;
      // Never act on keys typed into a form field (picker, slider).
      if (target && isTag(target, FORM_FIELDS)) return;
      if (k === " " || k === "Enter") {
        // A held key acts once: auto-repeats are swallowed, so holding Enter
        // on Done cannot go on to press "Test me" or reveal a card.
        if (event.repeat) { event.preventDefault(); return; }
        if (target && target !== toggleBtn && isTag(target, CONTROLS)) return;
        // Space/Enter mirror the single button: reveal, then next.
        event.preventDefault();
        toggle();
        return;
      }
      // "n" retained as a power-user shortcut to force the next card
      // regardless of phase (skip without revealing).
      if (k.toLowerCase() === "n") nextCard();
    }

    if (toggleBtn) toggleBtn.addEventListener("click", onToggleClick);
    document.addEventListener("keydown", onStudyKeydown);

    // Teardown so a test can take over the shared card region cleanly.
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

  var activeStudyTeardown = null;

  function stopStudySession() {
    if (typeof activeStudyTeardown === "function") {
      try { activeStudyTeardown(); } catch (err) { /* ignore */ }
    }
    activeStudyTeardown = null;
  }

  /* ===================================================================== *
   * TEST MODE (LB-36) — the learner rates each card.                       *
   *                                                                        *
   * Per card:                                                              *
   *   prompt + "Card i of n" + timer bar, one button "Reveal it".          *
   *   - Reveal (button, Space/Enter) before the timer ends: the answer     *
   *     shows, the timer stops, and "Not yet" / "I knew it" replace the    *
   *     button. A reveal records NOTHING. The rating buttons ignore input  *
   *     for 500 ms. Space/Enter do nothing while rating; K or 1 = I knew   *
   *     it, N or 2 = Not yet. Focus goes to the answer region.             *
   *   - A rating is stored (LBProgress) and the next card shows at once.   *
   *   - The timer running out shows the answer, records "Not yet", says    *
   *     "Time's up. Marked to practice.", and offers one "Next card".      *
   *   - "Stop test" goes back to study: ratings given stay; no results,    *
   *     no personal best.                                                  *
   * After the last card: the results modal (missed list, personal best on  *
   * a full test, N of M known, Practice these again / Test me again /      *
   * Done). Practice rounds use only the missed cards, update "known", and  *
   * never count for the personal best.                                     *
   * ===================================================================== */

  /* Store one rating (guarded). Returns the event. */
  function handleSelfRate(lessonId, card, gotIt) {
    var evt;
    if (typeof window !== "undefined" && window.LBGame &&
        typeof window.LBGame.makeSelfRateEvent === "function") {
      evt = window.LBGame.makeSelfRateEvent(card, gotIt);
    } else {
      evt = { card: card, gotIt: gotIt === true };
    }
    try {
      if (typeof window !== "undefined" && window.LBProgress &&
          typeof window.LBProgress.record === "function" && lessonId && card) {
        window.LBProgress.record(lessonId, card.prompt, evt.gotIt);
      }
    } catch (err) {
      console.warn("[engine] progress record failed; continuing", err);
    }
    return evt;
  }

  /* knownSummary(lesson) -> { known, total } for "N of M known" over the
   * loaded (normalized) deck, or null when LBProgress is not loaded. */
  function knownSummary(lesson) {
    try {
      if (typeof window === "undefined" || !window.LBProgress ||
          typeof window.LBProgress.knownCount !== "function") return null;
      var id = (lesson && lesson.id) ? String(lesson.id) : "";
      return window.LBProgress.knownCount(id, buildDeck(lesson));
    } catch (err) {
      console.warn("[engine] known summary failed", err);
      return null;
    }
  }

  var activeTestTeardown = null;

  function stopTestSession() {
    if (typeof activeTestTeardown === "function") {
      try { activeTestTeardown(); } catch (err) { /* ignore */ }
    }
    activeTestTeardown = null;
  }

  /* Show/hide the test-only chrome around the shared card region. */
  function setTestChrome(inTest) {
    setHidden(byId("testMeWrap"), inTest);
    setHidden(byId("stopTestBtn"), !inTest);
    setHidden(byId("studyHint"), inTest);
    setHidden(byId("testHint"), !inTest);
    setHidden(byId("testProgress"), !inTest);
    setHidden(byId("rateControls"), true);
    setHidden(byId("studyControls"), false);
    setHidden(query(".timer"), false);
  }


  /* startTest(lesson, onExit) — run a full test on the CURRENT lesson.
   * onExit (optional) is called after the test ends and study resumes. */
  function startTest(lesson, onExit) {
    // LB-34: testing flag off => a test can never start, even if called directly.
    if (!testingOn()) return;

    var exitCallback = (typeof onExit === "function") ? onExit : null;
    var lessonId = (lesson && lesson.id) ? String(lesson.id) : "";
    var deck = buildDeck(lesson);
    var revealMs = revealMsFor(lesson);

    var numberEl = byId("number");
    var wordEl = byId("word");
    var pronEl = byId("pronunciation");
    var labelEl = byId("label");
    var recallEl = byId("recall");
    var barEl = byId("bar");
    var barWrap = query(".timer");
    var cardEl = query(".card");
    var studyControls = byId("studyControls");
    var toggleBtn = byId("toggleBtn");
    var rateControls = byId("rateControls");
    var knewBtn = byId("rateKnewBtn");
    var notYetBtn = byId("rateNotYetBtn");
    var progressEl = byId("testProgress");
    var stopBtn = byId("stopTestBtn");
    // Results modal.
    var resultModal = byId("resultModal");
    var resultTitleEl = byId("resultTitle");
    var resultScoreEl = byId("resultScore");
    var resultBestEl = byId("resultBest");
    var resultLessonEl = byId("resultLesson");
    var resultListHead = byId("resultListHead");
    var resultListEl = byId("resultList");
    var resultNoneEl = byId("resultNone");
    var resultFooterEl = byId("resultFooter");
    var resultAnnounceEl = byId("resultAnnounce");
    var resultCloseX = byId("resultClose");
    var practiceBtn = byId("resultPracticeBtn");
    var againBtn = byId("resultAgainBtn");
    var doneBtn = byId("resultDoneBtn");

    var G = (typeof window !== "undefined") ? window.LBGame : null;
    if (!numberEl || !toggleBtn || !G || typeof G.buildTestPool !== "function") {
      console.warn("[engine] test-mode markup or LBGame missing; cannot start test");
      return;
    }
    if (!deck.length) {
      console.warn("[engine] no cards available for test", lesson);
      return;
    }

    // Take over the card region.
    stopStudySession();
    stopTestSession();

    var pool = [];
    var isPractice = false;
    var idx = 0;
    var events = [];
    var timer = null;
    var phase = "idle";   // "prompt" | "rating" | "timeout" | "done" | "idle"
    var lockUntil = 0;
    var resultOpen = false;
    var resultOpenedAt = 0;
    var lastMissed = [];

    function knownMapNow() {
      try {
        if (window.LBProgress && typeof window.LBProgress.knownMap === "function") {
          return window.LBProgress.knownMap(lessonId);
        }
      } catch (err) {
        console.warn("[engine] known map read failed; treating all as not known", err);
      }
      return {};
    }

    function resetBar() {
      if (!barEl) return;
      barEl.style.animation = "none";
      void barEl.offsetWidth;
      barEl.style.animationPlayState = "running";
      barEl.style.animation = "shrink " + (revealMs / 1000) + "s linear forwards";
    }

    function showRating(show) {
      setHidden(rateControls, !show);
      setHidden(studyControls, show);
    }

    function showCard() {
      var card = pool[idx];
      phase = "prompt";

      if (progressEl) {
        progressEl.textContent = cardOfText(idx + 1, pool.length);
        progressEl.hidden = false;
      }

      numberEl.style.fontSize = promptFontSize(card.prompt);
      numberEl.textContent = card.prompt;

      wordEl.style.fontSize = wordFontSize(card.answer);
      setAnswer(wordEl, card.answer);
      wordEl.hidden = true;
      pronEl.textContent = renderHint(lessonId, card);
      pronEl.hidden = true;
      if (labelEl) labelEl.textContent = "";
      if (recallEl) { recallEl.textContent = ""; recallEl.hidden = true; }

      showRating(false);
      toggleBtn.textContent = COPY.revealIt;
      setAttr(toggleBtn, "aria-label", COPY.revealAria);
      setAttr(cardEl, "aria-label", COPY.cardHidden);

      clearTimeout(timer);
      resetBar();
      timer = setTimeout(onTimeout, revealMs);

      focusEl(toggleBtn);
    }

    function showAnswerFields(card) {
      clearTimeout(timer);
      if (barEl) barEl.style.animationPlayState = "paused";
      wordEl.hidden = false;
      pronEl.hidden = (card.hint === "");
      removeAttr(cardEl, "aria-label");
    }

    // Reveal before the timer ends. Records NOTHING.
    function reveal() {
      if (phase !== "prompt") return;
      showAnswerFields(pool[idx]);
      phase = "rating";
      lockUntil = nowMs() + RATING_LOCK_MS;
      showRating(true);
      // Focus the answer region, not a button, so a held key lands nowhere.
      focusEl(cardEl);
    }

    function commit(card, knew) {
      events.push(handleSelfRate(lessonId, card, knew));
      markPractice();
      emit("progress");
    }

    // "I knew it" (true) / "Not yet" (false) — exactly one per card.
    function rate(knew) {
      if (phase !== "rating") return;
      // The 500 ms lock. If the device clock jumped backwards since the
      // reveal, do not stay locked.
      var now = nowMs();
      if (now < lockUntil && now >= lockUntil - RATING_LOCK_MS) return;
      phase = "busy";
      commit(pool[idx], knew === true);
      advance();
    }

    // Timer ran out in the prompt phase: show the answer, record "Not yet".
    function onTimeout() {
      if (phase !== "prompt") return;
      var card = pool[idx];
      showAnswerFields(card);
      phase = "timeout";
      commit(card, false);
      if (labelEl) labelEl.textContent = COPY.timesUp;
      showRating(false);
      toggleBtn.textContent = COPY.nextCard;
      setAttr(toggleBtn, "aria-label", COPY.nextCardAria);
      focusEl(toggleBtn);
    }

    function advance() {
      idx++;
      if (idx >= pool.length) {
        showResult();
      } else {
        showCard();
      }
    }

    function onToggle() {
      if (phase === "prompt") reveal();
      else if (phase === "timeout") advance();
    }

    function onTestKeydown(event) {
      if (resultOpen || phase === "done" || phase === "idle") return;
      if (!event || event.ctrlKey || event.metaKey || event.altKey) return;
      // No card shortcut acts behind the open settings dialog.
      if (settingsOpen()) return;
      var k = event.key;
      var target = event.target;
      var onOtherControl = !!(target && target !== toggleBtn && isTag(target, CONTROLS));
      if (k === " " || k === "Enter") {
        // A focused control (a rating button, Stop test, a picker, the
        // settings dialog) keeps its own key; a rating button's native click
        // still sits behind the lock.
        if (onOtherControl && !isTag(target, FORM_FIELDS) && event.repeat) {
          // A held key acts once: an auto-repeat never presses a button.
          event.preventDefault();
          return;
        }
        if (onOtherControl) return;
        event.preventDefault();
        // A held key acts once (no reveal of the next card from one press).
        if (event.repeat) return;
        // While rating, Space/Enter do NOTHING (a held key cannot rate).
        if (phase === "rating") return;
        onToggle();
        return;
      }
      if (phase !== "rating" || typeof k !== "string") return;
      // Never rate while the learner is typing into a form field.
      if (target && isTag(target, FORM_FIELDS)) return;
      var lower = k.toLowerCase();
      if (lower === "k" || k === "1") {
        event.preventDefault();
        rate(true);
      } else if (lower === "n" || k === "2") {
        event.preventDefault();
        rate(false);
      }
    }

    /* ----------------------------- results ------------------------------- */

    function clearList(el) {
      if (!el) return;
      while (el.firstChild) el.removeChild(el.firstChild);
    }

    // Build "{prompt} → {answer}" with the hint on a line under. DOM nodes +
    // textContent only (no innerHTML from data).
    function renderMissedList(cards) {
      clearList(resultListEl);
      if (!resultListEl || typeof document.createElement !== "function") return;
      for (var i = 0; i < cards.length; i++) {
        try {
          var c = cards[i];
          var li = document.createElement("li");
          li.className = "result-item";
          var main = document.createElement("span");
          main.className = "result-item-main";
          var parts = String(c.answer).split(" | ");
          main.appendChild(document.createTextNode(String(c.prompt) + " → " + parts[0]));
          for (var p = 1; p < parts.length; p++) {
            main.appendChild(document.createElement("br"));
            main.appendChild(document.createTextNode(parts[p]));
          }
          li.appendChild(main);
          if (c.hint) {
            var hint = document.createElement("span");
            hint.className = "result-item-hint";
            hint.textContent = c.hint;
            li.appendChild(hint);
          }
          resultListEl.appendChild(li);
        } catch (err) {
          console.warn("[engine] skipping a results row", err); // keep going
        }
      }
    }

    function showResult() {
      phase = "done";
      clearTimeout(timer);
      setHidden(barWrap, true);
      setHidden(progressEl, true);
      showRating(false);
      setHidden(studyControls, true);
      setHidden(stopBtn, true);

      var summary = (typeof G.summarize === "function")
        ? G.summarize(events)
        : { total: events.length, gotIt: 0, review: [], missed: [] };
      lastMissed = summary.review.slice();

      var P = window.LBProgress || null;
      var bestText = "";
      if (!isPractice && P && typeof P.recordTestResult === "function") {
        try {
          var r = P.recordTestResult(lessonId, summary.gotIt, pool.length);
          if (r.status === "new") bestText = COPY.bestNew;
          else if (r.status === "tie") bestText = COPY.bestTie;
          else if (r.best) bestText = bestLowerText(r.best.score, r.best.of);
        } catch (err) {
          console.warn("[engine] personal best failed; continuing", err);
        }
      }
      var counts = knownSummary(lesson);
      var lessonText = counts ? lessonKnownText(counts.known, counts.total) : "";
      var scoreText = knewText(summary.gotIt, summary.total);
      var persistent = !!(P && typeof P.isPersistent === "function" && P.isPersistent());

      if (!resultModal || !resultModal.classList ||
          typeof resultModal.classList.add !== "function") {
        // Defensive: no modal markup — show the score in the card region.
        numberEl.style.fontSize = "1.4rem";
        numberEl.textContent = scoreText;
        wordEl.style.fontSize = "1.0rem";
        wordEl.textContent = lessonText;
        wordEl.hidden = false;
        pronEl.hidden = true;
        return;
      }

      if (resultTitleEl) resultTitleEl.textContent = isPractice ? COPY.practiceTitle : COPY.testTitle;
      if (resultScoreEl) resultScoreEl.textContent = scoreText;
      if (resultBestEl) {
        resultBestEl.textContent = bestText;
        resultBestEl.hidden = (bestText === "");
      }
      if (resultLessonEl) resultLessonEl.textContent = lessonText;
      var anyMissed = summary.missed.length > 0;
      renderMissedList(summary.missed);
      setHidden(resultListHead, !anyMissed);
      if (resultListHead) resultListHead.textContent = COPY.listHeading;
      setHidden(resultListEl, !anyMissed);
      if (resultNoneEl) {
        resultNoneEl.textContent = isPractice ? COPY.noneMissedPractice : COPY.noneMissedTest;
        resultNoneEl.hidden = anyMissed;
      }
      setHidden(practiceBtn, !anyMissed);
      if (resultFooterEl) resultFooterEl.textContent = persistent ? COPY.footerSaved : COPY.footerNotSaved;
      if (resultAnnounceEl) {
        var said = scoreText + (bestText === COPY.bestNew ? " " + COPY.bestNew : "") +
          (lessonText ? " " + lessonText : "");
        resultAnnounceEl.textContent = said;
      }

      resultModal.classList.add("open");
      resultOpen = true;
      resultOpenedAt = nowMs();
      document.addEventListener("keydown", onResultKeydown, true);
      // Focus the dialog title, not a button, so a held Enter or a second
      // click from the last card cannot start a round before the score is read.
      focusEl(resultTitleEl || resultModal);
    }

    // The results buttons and backdrop ignore input for RATING_LOCK_MS after
    // the modal opens (a double-click on the last card lands nowhere). Esc
    // stays live. A device clock that jumps backwards does not keep it locked.
    function resultLocked() {
      var now = nowMs();
      return now < resultOpenedAt + RATING_LOCK_MS && now >= resultOpenedAt;
    }
    function unlocked(fn) {
      return function (event) {
        if (resultOpen && resultLocked()) return;
        fn(event);
      };
    }

    function closeResultModal() {
      if (resultModal && resultModal.classList &&
          typeof resultModal.classList.remove === "function") {
        resultModal.classList.remove("open");
      }
      if (resultOpen && typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", onResultKeydown, true);
      }
      resultOpen = false;
    }

    // Done / Close / Esc / backdrop -> back to study.
    function exitToStudy() {
      closeResultModal();
      endTest(lesson);
      if (exitCallback) {
        try { exitCallback(); } catch (err) { /* ignore */ }
      }
      // Focus leaves the closed dialog / hidden Stop test for the study card
      // button, so the next Space/Enter reveals the study card as usual. It
      // never lands on "Test me": a test starts only from a deliberate press.
      focusEl(toggleBtn);
    }

    function onResultKeydown(event) {
      if (!resultOpen) return;
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        exitToStudy();
        return;
      }
      if (event.key === "Tab" && resultModal && typeof resultModal.querySelectorAll === "function") {
        // Keep focus inside the dialog.
        var nodes = resultModal.querySelectorAll("button");
        var els = [];
        for (var i = 0; i < nodes.length; i++) if (!nodes[i].hidden) els.push(nodes[i]);
        if (!els.length) return;
        var first = els[0], last = els[els.length - 1];
        var active = document.activeElement;
        // Focus starts on the title (not in the button list): Shift+Tab from
        // there wraps to the last button instead of leaving the dialog.
        var inList = els.indexOf(active) !== -1;
        if (event.shiftKey && (active === first || !inList)) {
          event.preventDefault(); focusEl(last);
        } else if (!event.shiftKey && (active === last || !resultModal.contains(active))) {
          event.preventDefault(); focusEl(first);
        }
      }
    }

    function onBackdrop(event) {
      if (event && event.target === resultModal) exitToStudy();
    }

    /* Start a round: a full test (missed == null) or a practice round. */
    function beginRound(missed) {
      closeResultModal();
      isPractice = Array.isArray(missed);
      pool = isPractice
        ? (typeof G.buildRetryPool === "function" ? G.buildRetryPool(deck, missed) : [])
        : G.buildTestPool(deck, knownMapNow());
      if (!pool.length) {
        exitToStudy();
        return;
      }
      idx = 0;
      events = [];
      setTestChrome(true);
      showCard();
    }

    // Wire the controls (.onclick is idempotent across startTest).
    toggleBtn.onclick = onToggle;
    if (knewBtn) knewBtn.onclick = function () { rate(true); };
    if (notYetBtn) notYetBtn.onclick = function () { rate(false); };
    if (stopBtn) stopBtn.onclick = function () { exitToStudy(); };
    if (resultCloseX) resultCloseX.onclick = unlocked(exitToStudy);
    if (doneBtn) doneBtn.onclick = unlocked(exitToStudy);
    if (againBtn) againBtn.onclick = unlocked(function () { beginRound(null); });
    if (practiceBtn) practiceBtn.onclick = unlocked(function () { beginRound(lastMissed.slice()); });
    if (resultModal) resultModal.onclick = unlocked(onBackdrop);
    document.addEventListener("keydown", onTestKeydown);

    activeTestTeardown = function () {
      try { clearTimeout(timer); } catch (err) { /* ignore */ }
      phase = "idle";
      toggleBtn.onclick = null;
      if (knewBtn) knewBtn.onclick = null;
      if (notYetBtn) notYetBtn.onclick = null;
      if (stopBtn) stopBtn.onclick = null;
      if (resultCloseX) resultCloseX.onclick = null;
      if (doneBtn) doneBtn.onclick = null;
      if (againBtn) againBtn.onclick = null;
      if (practiceBtn) practiceBtn.onclick = null;
      if (resultModal) resultModal.onclick = null;
      if (typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", onTestKeydown);
      }
      closeResultModal();
    };

    beginRound(null);
  }

  /* Leave test mode and resume normal study. */
  function endTest(lesson) {
    stopTestSession();
    var resultModal = byId("resultModal");
    if (resultModal && resultModal.classList &&
        typeof resultModal.classList.remove === "function") {
      resultModal.classList.remove("open");
    }
    setTestChrome(false);
    var labelEl = byId("label");
    if (labelEl) labelEl.textContent = "";
    start(lesson);
  }

  window.LBEngine = {
    start: start,
    startTest: startTest,
    endTest: endTest,
    knownSummary: knownSummary,
    on: on,
    DEFAULTS: DEFAULTS,
    COPY: COPY,
    RATING_LOCK_MS: RATING_LOCK_MS,
    // Test seam: swap the wall clock used by the rating lock.
    _setClock: function (fn) {
      clock = (typeof fn === "function") ? fn : function () { return Date.now(); };
    }
  };
})();
