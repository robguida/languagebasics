/* LanguageBasics settings modal (LB-9).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * Wires the hamburger button + the static settings modal that already lives in
 * index.html (hidden by default, shown by toggling the `.open` class — NEVER
 * document.write; that would wipe the page). Provides:
 *   - open/close with the .open class toggle
 *   - keyboard accessibility: focus moves in on open, focus trap while open,
 *     Esc closes, focus returns to the hamburger on close
 *   - the per-lesson reveal-timer control (1-20s, default 5s) -> LBPrefs
 *     (LB-36: the only setting; card order and quiz count were retired)
 *
 * This module never touches the engine's live card flow. The timer override is
 * read by the engine at start() via LBPrefs; a changed value applies on the
 * next deck/card build (i.e. next reload / lesson switch), which matches the
 * "per-lesson, read at build" contract.
 */
(function () {
  "use strict";

  // Read the active lesson id the same way index.html resolves it, so the modal
  // configures the lesson currently on screen. Falls back to the default.
  function currentLessonId() {
    try {
      if (window.LB_LESSON && window.LB_LESSON.id) return window.LB_LESSON.id;
      var m = /[?&]lesson=([^&]+)/.exec(window.location.search);
      if (m) return decodeURIComponent(m[1]);
    } catch (err) { /* fall through */ }
    return "sq/lesson-1";
  }

  function init() {
    var hamburger = document.getElementById("settingsBtn");
    var modal = document.getElementById("settingsModal");
    var closeBtn = document.getElementById("settingsClose");
    var timerInput = document.getElementById("revealSeconds");
    var timerValue = document.getElementById("revealSecondsValue");

    // If the static modal markup is absent for any reason, degrade silently
    // rather than throw — the flashcards still work without settings.
    if (!hamburger || !modal) {
      return;
    }

    var prefs = window.LBPrefs || null;
    var lessonId = currentLessonId();
    var lastFocused = null;

    // ----- seed the controls from stored prefs (or defaults) -----
    function seedControls() {
      var defaults = (prefs && prefs.DEFAULTS) || { revealMs: 5000 };

      var ms = (prefs && prefs.getRevealMs) ? prefs.getRevealMs(lessonId) : null;
      var seconds = Math.round((ms != null ? ms : defaults.revealMs) / 1000);
      if (prefs && prefs.clampSeconds) seconds = prefs.clampSeconds(seconds);

      if (timerInput) timerInput.value = String(seconds);
      if (timerValue) timerValue.textContent = String(seconds);
    }

    // ----- persistence wiring -----
    function persistTimer() {
      if (!timerInput) return;
      var seconds = (prefs && prefs.clampSeconds)
        ? prefs.clampSeconds(timerInput.value)
        : Math.round(Number(timerInput.value) || 5);
      // Reflect the (possibly clamped) value back to the UI.
      timerInput.value = String(seconds);
      if (timerValue) timerValue.textContent = String(seconds);
      if (prefs && prefs.setRevealMs) prefs.setRevealMs(lessonId, seconds * 1000);
    }

    if (timerInput) {
      // input -> live value readout; change -> persist (covers slider + number)
      timerInput.addEventListener("input", function () {
        if (timerValue) timerValue.textContent = String(timerInput.value);
      });
      timerInput.addEventListener("change", persistTimer);
    }

    // ----- focus trap -----
    var FOCUSABLE = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
    ].join(",");

    function focusableEls() {
      var nodes = modal.querySelectorAll(FOCUSABLE);
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        // Skip elements that are not actually visible/operable.
        if (el.offsetParent !== null || el === document.activeElement) out.push(el);
      }
      return out;
    }

    function trap(event) {
      if (event.key !== "Tab") return;
      var els = focusableEls();
      if (!els.length) {
        event.preventDefault();
        return;
      }
      var first = els[0];
      var last = els[els.length - 1];
      var active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !modal.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modal.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    function onKeydown(event) {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        close();
        return;
      }
      trap(event);
    }

    // ----- open / close -----
    function isOpen() {
      return modal.classList.contains("open");
    }

    function open() {
      if (isOpen()) return;
      lastFocused = document.activeElement;
      seedControls();
      modal.classList.add("open");
      hamburger.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", onKeydown, true);
      // Move focus into the dialog (first focusable, else the dialog itself).
      var els = focusableEls();
      if (els.length) {
        els[0].focus();
      } else if (typeof modal.focus === "function") {
        modal.focus();
      }
    }

    function close() {
      if (!isOpen()) return;
      modal.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onKeydown, true);
      // Return focus to the hamburger that opened the dialog.
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      } else if (typeof hamburger.focus === "function") {
        hamburger.focus();
      }
    }

    hamburger.addEventListener("click", function () {
      if (isOpen()) close(); else open();
    });
    if (closeBtn) closeBtn.addEventListener("click", close);

    // Click on the backdrop (the modal element itself, outside the dialog panel)
    // closes — a common, expected affordance.
    modal.addEventListener("click", function (event) {
      if (event.target === modal) close();
    });

    // Expose a tiny surface for tests / future tickets.
    window.LBSettings = { open: open, close: close, isOpen: isOpen };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
