/* LanguageBasics — language + lesson MANIFEST (LB-23).
 *
 * Vanilla JS, no build step, no fetch, file:// safe. Loaded as a plain <script>
 * global BEFORE the picker bootstrap in index.html and before engine.js.
 *
 * SINGLE SOURCE OF TRUTH for lesson wiring. Before LB-23 the same lesson list
 * lived in THREE hand-maintained spots in index.html — the <optgroup> markup,
 * the ALLOWED whitelist, and the LESSON_COUNTS map — plus a hidden FOURTH: the
 * "rollup:false" decks were only described in code comments. This manifest
 * consolidates all of it. Each lesson entry carries its picker group, display
 * label, card count, and an EXPLICIT rollup flag. index.html derives the
 * whitelist, default lesson, and per-lesson counts from here; manifest.js
 * renders the picker from here.
 *
 * SELF-REGISTRATION: each language pushes itself onto window.LB_LANGUAGES — the
 * SAME pattern the lesson data files use for window.LB_LESSONS. Adding a
 * language is a new content/<lang>/ tree plus one push here; no engine change,
 * and the language <select> appears automatically once a 2nd language registers.
 *
 * rollup: true  => the deck COUNTS toward the "X of N lessons mastered" rollup.
 * rollup: false => EXCLUDED from that rollup (non-number or already-counted
 *                  decks: the combined alphabet deck, every words deck, every
 *                  phrases deck). This MUST match the rollup flag each data file
 *                  puts on its window.LB_LESSONS push — the manifest-integrity
 *                  test cross-checks the two so they can never drift.
 *
 * Lesson IDs / ?lesson= values here are BYTE-IDENTICAL to the shipped ids:
 * localStorage mastery / Leitner / streak state is keyed on them, so they never
 * change during this refactor.
 */
(function () {
  "use strict";

  window.LB_LANGUAGES = window.LB_LANGUAGES || [];

  window.LB_LANGUAGES.push({
    code: "sq",
    name: "Albanian",
    // Default lesson when no (valid) ?lesson= is present.
    defaultLesson: "sq/lesson-1",
    groups: [
      {
        label: "Numbers",
        lessons: [
          { id: "sq/lesson-1", label: "Lesson 1 — 0–10", count: 11, rollup: true },
          { id: "sq/lesson-2", label: "Lesson 2 — 11–19", count: 9, rollup: true },
          { id: "sq/lesson-3", label: "Lesson 3 — Tens 20–90", count: 8, rollup: true },
          { id: "sq/lesson-4", label: "Lesson 4 — 20–99 compounds", count: 80, rollup: true },
          { id: "sq/lesson-5", label: "Lesson 5 — Big Number Roots", count: 56, rollup: true },
          { id: "sq/lesson-6", label: "Lesson 6 — Number Builder", count: 6, rollup: true }
        ]
      },
      {
        label: "Alphabet",
        lessons: [
          { id: "sq/alphabet-vowels", label: "Lesson 1 — Vowels", count: 7, rollup: true },
          { id: "sq/alphabet-consonants", label: "Lesson 2 — Consonants", count: 20, rollup: true },
          { id: "sq/alphabet-digraphs", label: "Lesson 3 — Digraphs", count: 9, rollup: true },
          // Combined 36-letter deck: already counted via the 3 group decks, so
          // it is rollup-excluded (would otherwise double-count the denominator).
          { id: "sq/alphabet-all", label: "Lesson 4 — Full set (36)", count: 36, rollup: false }
        ]
      },
      {
        // Each topic's single-word deck (words-N) is interleaved BEFORE its
        // phrase deck (phrases-N). Per-group "Lesson N" labels restart at 1 and
        // are DISPLAY-ONLY; the ids are the shipped values, unchanged.
        label: "Words & Phrases",
        lessons: [
          { id: "sq/words-1", label: "Lesson 1 — Hello: Words", count: 9, rollup: false },
          { id: "sq/phrases-1", label: "Lesson 2 — Hello: Phrases", count: 7, rollup: false },
          { id: "sq/words-2", label: "Lesson 3 — Goodbye: Words", count: 12, rollup: false },
          { id: "sq/phrases-2", label: "Lesson 4 — Goodbye: Phrases", count: 8, rollup: false },
          { id: "sq/words-3", label: "Lesson 5 — Courtesy: Words", count: 11, rollup: false },
          { id: "sq/phrases-3", label: "Lesson 6 — Courtesy: Phrases", count: 6, rollup: false },
          { id: "sq/words-4", label: "Lesson 7 — Out & About: Words", count: 13, rollup: false },
          { id: "sq/phrases-4", label: "Lesson 8 — Out & About: Phrases", count: 5, rollup: false },
          { id: "sq/words-5", label: "Lesson 9 — Help: Words", count: 17, rollup: false },
          { id: "sq/phrases-5", label: "Lesson 10 — Help: Phrases", count: 6, rollup: false }
        ]
      }
    ]
  });

  // LB-25: Spanish (es) — the 2nd language. A full 6-lesson number deck applied
  // verbatim from the Spanish linguistics dataset review. Same number RANGES and
  // card counts as the Albanian number decks (11/9/8/80/56/6), all rollup:true.
  // Registering a 2nd language auto-reveals the language <select>
  // (shouldShowLanguageDropdown flips true at 2 languages). No engine change.
  window.LB_LANGUAGES.push({
    code: "es",
    name: "Spanish",
    // Default lesson when no (valid) ?lesson= is present for this language.
    defaultLesson: "es/lesson-1",
    groups: [
      {
        label: "Numbers",
        lessons: [
          { id: "es/lesson-1", label: "Lesson 1 — 0–10", count: 11, rollup: true },
          { id: "es/lesson-2", label: "Lesson 2 — 11–19", count: 9, rollup: true },
          { id: "es/lesson-3", label: "Lesson 3 — Tens 20–90", count: 8, rollup: true },
          { id: "es/lesson-4", label: "Lesson 4 — 20–99 compounds", count: 80, rollup: true },
          { id: "es/lesson-5", label: "Lesson 5 — Big Number Roots", count: 56, rollup: true },
          { id: "es/lesson-6", label: "Lesson 6 — Number Builder", count: 6, rollup: true }
        ]
      },
      {
        // LB-31: Spanish Alphabet — mirrors the sq Alphabet group. The 3 discrete
        // decks (vowels/consonants/digraphs) are rollup:true and ADD to the es
        // per-language mastery denominator (6 numbers -> 9). The combined 30-letter
        // "Full set" deck is rollup:false — already counted via the 3 group decks,
        // so counting it would double-count the denominator.
        label: "Alphabet",
        lessons: [
          { id: "es/alphabet-vowels", label: "Lesson 1 — Vowels", count: 5, rollup: true },
          { id: "es/alphabet-consonants", label: "Lesson 2 — Consonants", count: 22, rollup: true },
          { id: "es/alphabet-digraphs", label: "Lesson 3 — Digraphs", count: 3, rollup: true },
          { id: "es/alphabet-all", label: "Lesson 4 — Full set (30)", count: 30, rollup: false }
        ]
      },
      {
        // LB-29: Spanish Words & Phrases — mirrors the sq/ja group. Each topic's
        // single-word deck (words-N) is interleaved BEFORE its phrase deck
        // (phrases-N). Per-group "Lesson N" labels restart at 1 and are
        // DISPLAY-ONLY; the ids are the shipped values. All rollup:false.
        // Help: Words is the dataset's 17 minus one dropped silent-punctuation
        // card = 16 (a say-it-aloud card can't be a spoken-less ¿ ¡ mark).
        label: "Words & Phrases",
        lessons: [
          { id: "es/words-1", label: "Lesson 1 — Hello: Words", count: 11, rollup: false },
          { id: "es/phrases-1", label: "Lesson 2 — Hello: Phrases", count: 7, rollup: false },
          { id: "es/words-2", label: "Lesson 3 — Goodbye: Words", count: 13, rollup: false },
          { id: "es/phrases-2", label: "Lesson 4 — Goodbye: Phrases", count: 8, rollup: false },
          { id: "es/words-3", label: "Lesson 5 — Courtesy: Words", count: 12, rollup: false },
          { id: "es/phrases-3", label: "Lesson 6 — Courtesy: Phrases", count: 6, rollup: false },
          { id: "es/words-4", label: "Lesson 7 — Out & About: Words", count: 14, rollup: false },
          { id: "es/phrases-4", label: "Lesson 8 — Out & About: Phrases", count: 5, rollup: false },
          { id: "es/words-5", label: "Lesson 9 — Help: Words", count: 16, rollup: false },
          { id: "es/phrases-5", label: "Lesson 10 — Help: Phrases", count: 6, rollup: false }
        ]
      }
    ]
  });

  // LB-24: Japanese (ja) — the 3rd language. A full 6-lesson number deck applied
  // verbatim from the Japanese linguistics dataset review. Sino-Japanese (on'yomi)
  // counting; big numbers grouped by MYRIAD (万/億/兆), not Western thousands. Same
  // number RANGES and card counts as the sq/es number decks (11/9/8/80/56/6), all
  // rollup:true. No engine change.
  window.LB_LANGUAGES.push({
    code: "ja",
    name: "Japanese",
    // Default lesson when no (valid) ?lesson= is present for this language.
    defaultLesson: "ja/lesson-1",
    groups: [
      {
        label: "Numbers",
        lessons: [
          { id: "ja/lesson-1", label: "Lesson 1 — 0–10", count: 11, rollup: true },
          { id: "ja/lesson-2", label: "Lesson 2 — 11–19", count: 9, rollup: true },
          { id: "ja/lesson-3", label: "Lesson 3 — Tens 20–90", count: 8, rollup: true },
          { id: "ja/lesson-4", label: "Lesson 4 — 20–99 compounds", count: 80, rollup: true },
          { id: "ja/lesson-5", label: "Lesson 5 — Big Number Roots", count: 56, rollup: true },
          { id: "ja/lesson-6", label: "Lesson 6 — Number Builder", count: 6, rollup: true }
        ]
      },
      {
        // LB-28: Japanese Words & Phrases — mirrors the sq group. Each topic's
        // single-word deck (words-N) is interleaved BEFORE its phrase deck
        // (phrases-N). Per-group "Lesson N" labels restart at 1 and are
        // DISPLAY-ONLY; the ids are the shipped values. All rollup:false.
        label: "Words & Phrases",
        lessons: [
          { id: "ja/words-1", label: "Lesson 1 — Hello: Words", count: 9, rollup: false },
          { id: "ja/phrases-1", label: "Lesson 2 — Hello: Phrases", count: 7, rollup: false },
          { id: "ja/words-2", label: "Lesson 3 — Goodbye: Words", count: 12, rollup: false },
          { id: "ja/phrases-2", label: "Lesson 4 — Goodbye: Phrases", count: 8, rollup: false },
          { id: "ja/words-3", label: "Lesson 5 — Courtesy: Words", count: 11, rollup: false },
          { id: "ja/phrases-3", label: "Lesson 6 — Courtesy: Phrases", count: 6, rollup: false },
          { id: "ja/words-4", label: "Lesson 7 — Out & About: Words", count: 13, rollup: false },
          { id: "ja/phrases-4", label: "Lesson 8 — Out & About: Phrases", count: 5, rollup: false },
          { id: "ja/words-5", label: "Lesson 9 — Help: Words", count: 17, rollup: false },
          { id: "ja/phrases-5", label: "Lesson 10 — Help: Phrases", count: 6, rollup: false }
        ]
      }
    ]
  });

  // LB-26: Bengali (bn) — the 4th language. A full 6-lesson number deck applied
  // verbatim from the Bengali linguistics dataset review. Standard Bangladeshi
  // Bengali; ANSWER stacks native Bangla script | romanization via " | "; big
  // numbers use the authentic South Asian lakh/koti system (no Western "million").
  // 1–99 are all irregular hand-authored words. Same number RANGES and card counts
  // as the sq/es/ja number decks (11/9/8/80/56/6), all rollup:true. No engine change.
  window.LB_LANGUAGES.push({
    code: "bn",
    name: "Bengali",
    // Default lesson when no (valid) ?lesson= is present for this language.
    defaultLesson: "bn/lesson-1",
    groups: [
      {
        label: "Numbers",
        lessons: [
          { id: "bn/lesson-1", label: "Lesson 1 — 0–10", count: 11, rollup: true },
          { id: "bn/lesson-2", label: "Lesson 2 — 11–19", count: 9, rollup: true },
          { id: "bn/lesson-3", label: "Lesson 3 — Tens 20–90", count: 8, rollup: true },
          { id: "bn/lesson-4", label: "Lesson 4 — 20–99 compounds", count: 80, rollup: true },
          { id: "bn/lesson-5", label: "Lesson 5 — Big Number Roots", count: 56, rollup: true },
          { id: "bn/lesson-6", label: "Lesson 6 — Number Builder", count: 6, rollup: true }
        ]
      },
      {
        // LB-30: Bengali Words & Phrases — mirrors the sq/es/ja group. Each
        // topic's single-word deck (words-N) is interleaved BEFORE its phrase
        // deck (phrases-N). Per-group "Lesson N" labels restart at 1 and are
        // DISPLAY-ONLY; the ids are the shipped values. All rollup:false. ANSWER
        // stacks native Bangla script | romanization via " | " (apni register,
        // Standard Bangladeshi Bengali). Last language of the phrases phase.
        label: "Words & Phrases",
        lessons: [
          { id: "bn/words-1", label: "Lesson 1 — Hello: Words", count: 9, rollup: false },
          { id: "bn/phrases-1", label: "Lesson 2 — Hello: Phrases", count: 7, rollup: false },
          { id: "bn/words-2", label: "Lesson 3 — Goodbye: Words", count: 12, rollup: false },
          { id: "bn/phrases-2", label: "Lesson 4 — Goodbye: Phrases", count: 8, rollup: false },
          { id: "bn/words-3", label: "Lesson 5 — Courtesy: Words", count: 11, rollup: false },
          { id: "bn/phrases-3", label: "Lesson 6 — Courtesy: Phrases", count: 6, rollup: false },
          { id: "bn/words-4", label: "Lesson 7 — Out & About: Words", count: 13, rollup: false },
          { id: "bn/phrases-4", label: "Lesson 8 — Out & About: Phrases", count: 5, rollup: false },
          { id: "bn/words-5", label: "Lesson 9 — Help: Words", count: 17, rollup: false },
          { id: "bn/phrases-5", label: "Lesson 10 — Help: Phrases", count: 6, rollup: false }
        ]
      }
    ]
  });
})();
