/* sq / words-1 — Albanian Tosk Basics: Hello (Words)
 *
 * LB-21 words batch. Single-word building blocks for the matching phrases deck
 * (sq/phrases-1). Dataset is the reviewed Tosk dataset (per the project's
 * linguistics review), applied verbatim. prompt = English gloss, answer =
 * Albanian word, hint = plain-English phonetic. No pair/stack cards.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "sq/words-1",
  title: "Hello: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Albanian out loud, then reveal.",
  cards: [
    { prompt: "Hello",               answer: "Përshëndetje", hint: "Pur shun det yeh",  audio: "" },
    { prompt: "Hi",                  answer: "Tung",         hint: "Toong",             audio: "" },
    { prompt: "Hello (traditional)", answer: "Tungjatjeta",  hint: "Toon gyat yeh tah", audio: "" },
    { prompt: "good",                answer: "mirë",         hint: "Meer",              audio: "" },
    { prompt: "morning",             answer: "mëngjes",      hint: "Mun gyes",          audio: "" },
    { prompt: "day",                 answer: "dita",         hint: "Dee tah",           audio: "" },
    { prompt: "evening",             answer: "mbrëma",       hint: "Mbruh mah",         audio: "" },
    { prompt: "how",                 answer: "si",           hint: "See",               audio: "" },
    { prompt: "you are",             answer: "je",           hint: "Yeh",               audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/words-1", title: "Hello: Words", rollup: false });
