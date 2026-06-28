/* sq / words-5 — Albanian Tosk Basics: Help (Words)
 *
 * LB-21 words batch. Single-word building blocks for the matching phrases deck
 * (sq/phrases-5). Dataset is the reviewed Tosk dataset (per the project's
 * linguistics review), applied verbatim. prompt = English gloss, answer =
 * Albanian word, hint = plain-English phonetic. No pair/stack cards.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "sq/words-5",
  title: "Help: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Albanian out loud, then reveal.",
  cards: [
    { prompt: "question word", answer: "a",        hint: "Ah",          audio: "" },
    { prompt: "you speak",     answer: "flisni",   hint: "Flees nee",   audio: "" },
    { prompt: "English",       answer: "anglisht", hint: "Ahn gleesht", audio: "" },
    { prompt: "not",           answer: "nuk",      hint: "Nook",        audio: "" },
    { prompt: "I speak",       answer: "flas",     hint: "Flahs",       audio: "" },
    { prompt: "Albanian",      answer: "shqip",    hint: "Shcheep",     audio: "" },
    { prompt: "Help!",         answer: "Ndihmë",   hint: "Ndeeh muh",   audio: "" },
    { prompt: "me",            answer: "më",       hint: "Muh",         audio: "" },
    { prompt: "is needed",     answer: "duhet",    hint: "Doo het",     audio: "" },
    { prompt: "a/one",         answer: "një",      hint: "Nyu",         audio: "" },
    { prompt: "doctor",        answer: "mjek",     hint: "Myek",        audio: "" },
    { prompt: "I",            answer: "unë",       hint: "Oo nuh",      audio: "" },
    { prompt: "am called",     answer: "quhem",    hint: "Choo hem",    audio: "" },
    { prompt: "I'm glad",      answer: "gëzohem",  hint: "Guh zoh hem", audio: "" },
    { prompt: "that",          answer: "që",       hint: "Chuh",        audio: "" },
    { prompt: "you",           answer: "ju",       hint: "Yoo",         audio: "" },
    { prompt: "I know",        answer: "njoh",     hint: "Nyoh",        audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/words-5", title: "Help: Words", rollup: false });
