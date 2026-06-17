/* sq / lesson-5 — Albanian Big Numbers (roots × multipliers 1–9)
 * Expanded from the original 8 root cards to the full 56-card set per
 * docs/alan-CD-dataset-review.md (APPROVED — FINAL, Rob 2026-06-17):
 *   6 roots (hundreds, thousands, millions, billions, trillions,
 *   quadrillions) × 9 multipliers = 54, PLUS the 2 kept standalone cards
 *   10,000 (dhjetë mijë) and 100,000 (njëqind mijë) = 56 total.
 * Prompts stay comma-formatted strings as before. Schema unchanged:
 * {prompt, answer, hint, audio}. */
window.LB_LESSON = {
  id: "sq/lesson-5",
  title: "Albanian Big Number Roots",
  revealMs: 5000,
  cards: [
    /* Hundreds 100–900 — …qind (one word) */
    { prompt: "100", answer: "njëqind",     hint: "Nyuh chind",    audio: "" },
    { prompt: "200", answer: "dyqind",       hint: "Doo chind",     audio: "" },
    { prompt: "300", answer: "treqind",      hint: "Trreh chind",   audio: "" },
    { prompt: "400", answer: "katërqind",   hint: "Kah ter chind", audio: "" },
    { prompt: "500", answer: "pesëqind",    hint: "Pes chind",     audio: "" },
    { prompt: "600", answer: "gjashtëqind", hint: "Jyosht chind",  audio: "" },
    { prompt: "700", answer: "shtatëqind",  hint: "Shtah t chind", audio: "" },
    { prompt: "800", answer: "tetëqind",    hint: "Teh t chind",   audio: "" },
    { prompt: "900", answer: "nëntëqind",  hint: "Nuhn t chind",  audio: "" },

    /* Thousands 1,000–9,000 — … mijë (two words) */
    { prompt: "1,000", answer: "një mijë",    hint: "Nyuh me yeh",    audio: "" },
    { prompt: "2,000", answer: "dy mijë",      hint: "Doo me yeh",     audio: "" },
    { prompt: "3,000", answer: "tre mijë",     hint: "Trreh me yeh",   audio: "" },
    { prompt: "4,000", answer: "katër mijë",  hint: "Kah ter me yeh", audio: "" },
    { prompt: "5,000", answer: "pesë mijë",   hint: "Pes me yeh",     audio: "" },
    { prompt: "6,000", answer: "gjashtë mijë",hint: "Jyosht me yeh",  audio: "" },
    { prompt: "7,000", answer: "shtatë mijë", hint: "Shtah t me yeh", audio: "" },
    { prompt: "8,000", answer: "tetë mijë",   hint: "Teh t me yeh",   audio: "" },
    { prompt: "9,000", answer: "nëntë mijë",  hint: "Nuhn t me yeh",  audio: "" },

    /* Millions 1M–9M — … milion (two words) */
    { prompt: "1,000,000", answer: "një milion",     hint: "Nyuh me le on",    audio: "" },
    { prompt: "2,000,000", answer: "dy milion",       hint: "Doo me le on",     audio: "" },
    { prompt: "3,000,000", answer: "tre milion",      hint: "Trreh me le on",   audio: "" },
    { prompt: "4,000,000", answer: "katër milion",   hint: "Kah ter me le on", audio: "" },
    { prompt: "5,000,000", answer: "pesë milion",    hint: "Pes me le on",     audio: "" },
    { prompt: "6,000,000", answer: "gjashtë milion", hint: "Jyosht me le on",  audio: "" },
    { prompt: "7,000,000", answer: "shtatë milion",  hint: "Shtah t me le on", audio: "" },
    { prompt: "8,000,000", answer: "tetë milion",    hint: "Teh t me le on",   audio: "" },
    { prompt: "9,000,000", answer: "nëntë milion",   hint: "Nuhn t me le on",  audio: "" },

    /* Billions 1B–9B — … miliard (two words) */
    { prompt: "1,000,000,000", answer: "një miliard",     hint: "Nyuh me le ard",    audio: "" },
    { prompt: "2,000,000,000", answer: "dy miliard",       hint: "Doo me le ard",     audio: "" },
    { prompt: "3,000,000,000", answer: "tre miliard",      hint: "Trreh me le ard",   audio: "" },
    { prompt: "4,000,000,000", answer: "katër miliard",   hint: "Kah ter me le ard", audio: "" },
    { prompt: "5,000,000,000", answer: "pesë miliard",    hint: "Pes me le ard",     audio: "" },
    { prompt: "6,000,000,000", answer: "gjashtë miliard", hint: "Jyosht me le ard",  audio: "" },
    { prompt: "7,000,000,000", answer: "shtatë miliard",  hint: "Shtah t me le ard", audio: "" },
    { prompt: "8,000,000,000", answer: "tetë miliard",    hint: "Teh t me le ard",   audio: "" },
    { prompt: "9,000,000,000", answer: "nëntë miliard",   hint: "Nuhn t me le ard",  audio: "" },

    /* Trillions 1T–9T — … trilion (two words) */
    { prompt: "1,000,000,000,000", answer: "një trilion",     hint: "Nyuh tre leon",    audio: "" },
    { prompt: "2,000,000,000,000", answer: "dy trilion",       hint: "Doo tre leon",     audio: "" },
    { prompt: "3,000,000,000,000", answer: "tre trilion",      hint: "Trreh tre leon",   audio: "" },
    { prompt: "4,000,000,000,000", answer: "katër trilion",   hint: "Kah ter tre leon", audio: "" },
    { prompt: "5,000,000,000,000", answer: "pesë trilion",    hint: "Pes tre leon",     audio: "" },
    { prompt: "6,000,000,000,000", answer: "gjashtë trilion", hint: "Jyosht tre leon",  audio: "" },
    { prompt: "7,000,000,000,000", answer: "shtatë trilion",  hint: "Shtah t tre leon", audio: "" },
    { prompt: "8,000,000,000,000", answer: "tetë trilion",    hint: "Teh t tre leon",   audio: "" },
    { prompt: "9,000,000,000,000", answer: "nëntë trilion",   hint: "Nuhn t tre leon",  audio: "" },

    /* Quadrillions 1Q–9Q — … kuadrilion (two words) */
    { prompt: "1,000,000,000,000,000", answer: "një kuadrilion",     hint: "Nyuh cwad drre le on",    audio: "" },
    { prompt: "2,000,000,000,000,000", answer: "dy kuadrilion",       hint: "Doo cwad drre le on",     audio: "" },
    { prompt: "3,000,000,000,000,000", answer: "tre kuadrilion",      hint: "Trreh cwad drre le on",   audio: "" },
    { prompt: "4,000,000,000,000,000", answer: "katër kuadrilion",   hint: "Kah ter cwad drre le on", audio: "" },
    { prompt: "5,000,000,000,000,000", answer: "pesë kuadrilion",    hint: "Pes cwad drre le on",     audio: "" },
    { prompt: "6,000,000,000,000,000", answer: "gjashtë kuadrilion", hint: "Jyosht cwad drre le on",  audio: "" },
    { prompt: "7,000,000,000,000,000", answer: "shtatë kuadrilion",  hint: "Shtah t cwad drre le on", audio: "" },
    { prompt: "8,000,000,000,000,000", answer: "tetë kuadrilion",    hint: "Teh t cwad drre le on",   audio: "" },
    { prompt: "9,000,000,000,000,000", answer: "nëntë kuadrilion",   hint: "Nuhn t cwad drre le on",  audio: "" },

    /* Standalone tens-of-thousands (KEPT per Rob, Gap 6 closed) */
    { prompt: "10,000",  answer: "dhjetë mijë",   hint: "They yet me yeh",  audio: "" },
    { prompt: "100,000", answer: "njëqind mijë",  hint: "Nyuh chind me yeh", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/lesson-5", title: "Albanian Big Number Roots" });
