/* sq / words-2 — Albanian Tosk Basics: Goodbye (Words)
 *
 * LB-21 words batch. Single-word building blocks for the matching phrases deck
 * (sq/phrases-2). Dataset is the reviewed Tosk dataset (per the project's
 * linguistics review), applied verbatim. prompt = English gloss, answer =
 * Albanian word, hint = plain-English phonetic. No pair/stack cards.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "sq/words-2",
  title: "Goodbye: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Albanian out loud, then reveal.",
  cards: [
    { prompt: "night",     answer: "natën",       hint: "Nah tun",            audio: "" },
    { prompt: "and",       answer: "e",           hint: "eh",                 audio: "" },
    { prompt: "good",      answer: "mirë",        hint: "Meer",               audio: "" },
    { prompt: "Goodbye",   answer: "Mirupafshim", hint: "Mee roo pahf sheem", audio: "" },
    { prompt: "Bye",       answer: "Çao",         hint: "Chow",               audio: "" },
    { prompt: "See you",   answer: "Shihemi",     hint: "Shee heh mee",       audio: "" },
    { prompt: "What's up", answer: "Ç'kemi",      hint: "Ch keh mee",         audio: "" },
    { prompt: "tomorrow",  answer: "nesër",       hint: "Neh sur",            audio: "" },
    { prompt: "that",      answer: "se",          hint: "Seh",                audio: "" },
    { prompt: "you come",  answer: "vini",        hint: "Vee nee",            audio: "" },
    { prompt: "me",        answer: "më",          hint: "Muh",                audio: "" },
    { prompt: "comes",     answer: "vjen",        hint: "Vyen",               audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/words-2", title: "Goodbye: Words", rollup: false });
