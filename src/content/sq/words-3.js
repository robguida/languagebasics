/* sq / words-3 — Albanian Tosk Basics: Courtesy (Words)
 *
 * LB-21 words batch. Single-word building blocks for the matching phrases deck
 * (sq/phrases-3). Dataset is the reviewed Tosk dataset (per the project's
 * linguistics review), applied verbatim. prompt = English gloss, answer =
 * Albanian word, hint = plain-English phonetic. No pair/stack cards.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "sq/words-3",
  title: "Courtesy: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Albanian out loud, then reveal.",
  cards: [
    { prompt: "yes",            answer: "Po",           hint: "Poh",                 audio: "" },
    { prompt: "no",             answer: "Jo",           hint: "Yoh",                 audio: "" },
    { prompt: "you",            answer: "ju",           hint: "Yoo",                 audio: "" },
    { prompt: "please (I beg)", answer: "lutem",        hint: "Loo tem",             audio: "" },
    { prompt: "Thank you",      answer: "Faleminderit", hint: "Fah leh meen deh reet", audio: "" },
    { prompt: "there isn't",    answer: "s'ka",         hint: "Skah",                audio: "" },
    { prompt: "what for",       answer: "përse",        hint: "Pur seh",             audio: "" },
    { prompt: "me",             answer: "më",           hint: "Muh",                 audio: "" },
    { prompt: "forgive",        answer: "falni",        hint: "Fahl nee",            audio: "" },
    { prompt: "not",            answer: "nuk",          hint: "Nook",                audio: "" },
    { prompt: "I understand",   answer: "kuptoj",       hint: "Koop toy",            audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/words-3", title: "Courtesy: Words", rollup: false });
