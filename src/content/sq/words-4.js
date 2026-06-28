/* sq / words-4 — Albanian Tosk Basics: Out & About (Words)
 *
 * LB-21 words batch. Single-word building blocks for the matching phrases deck
 * (sq/phrases-4). Dataset is the reviewed Tosk dataset (per the project's
 * linguistics review), applied verbatim. prompt = English gloss, answer =
 * Albanian word, hint = plain-English phonetic. No pair/stack cards.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "sq/words-4",
  title: "Out & About: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Albanian out loud, then reveal.",
  cards: [
    { prompt: "how much",     answer: "sa",      hint: "Sah",        audio: "" },
    { prompt: "costs",        answer: "kushton", hint: "Koosh tohn", audio: "" },
    { prompt: "a/one",        answer: "një",     hint: "Nyu",        audio: "" },
    { prompt: "coffee",       answer: "kafe",    hint: "Kah feh",    audio: "" },
    { prompt: "water",        answer: "ujë",     hint: "Oo yuh",     audio: "" },
    { prompt: "the bill",     answer: "Faturën", hint: "Fah too run", audio: "" },
    { prompt: "where",        answer: "ku",      hint: "Koo",        audio: "" },
    { prompt: "is",           answer: "është",   hint: "Usht",       audio: "" },
    { prompt: "the bathroom", answer: "banja",   hint: "Bahn yah",   audio: "" },
    { prompt: "left",         answer: "Majtas",  hint: "Mai tahs",   audio: "" },
    { prompt: "right",        answer: "Djathtas", hint: "Dyahth tahs", audio: "" },
    { prompt: "here",         answer: "Këtu",    hint: "Kuh too",    audio: "" },
    { prompt: "stop",         answer: "Ndalo",   hint: "Ndah loh",   audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/words-4", title: "Out & About: Words", rollup: false });
