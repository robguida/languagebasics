/* bn / words-4 — Bengali Basics: Out & About (Words)
 *
 * Bengali Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (bn/phrases-4). Applied VERBATIM from the Bengali linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = native
 * Bangla script | practical romanization stacked with " | ", hint = plain-
 * English phonetic. Standard Bangladeshi Bengali (Dhaka cholito). Bengali forms
 * are owned by the linguistics review, not invented here.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "bn/words-4",
  title: "Out & About: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Bengali out loud, then reveal.",
  cards: [
    { prompt: "how much",        answer: "কত | koto",          hint: "Koh to",    audio: "" },
    { prompt: "price / costs",   answer: "দাম | dam",          hint: "Dahm",      audio: "" },
    { prompt: "a / one",         answer: "একটা | ekta",        hint: "Aek ta",    audio: "" },
    { prompt: "coffee",          answer: "কফি | kofi",         hint: "Koh fee",   audio: "" },
    { prompt: "water",           answer: "পানি | pani",        hint: "Pah nee",   audio: "" },
    { prompt: "the bill",        answer: "বিল | bil",          hint: "Beel",      audio: "" },
    { prompt: "where",           answer: "কোথায় | kothay",     hint: "Koh thai",  audio: "" },
    { prompt: "is / (there) is", answer: "আছে | achhe",        hint: "Ah cheh",   audio: "" },
    { prompt: "the bathroom",    answer: "বাথরুম | bathroom",   hint: "Bath room", audio: "" },
    { prompt: "left",            answer: "বাম | bam",          hint: "Bahm",      audio: "" },
    { prompt: "right",           answer: "ডান | dan",          hint: "Dahn",      audio: "" },
    { prompt: "here",            answer: "এখানে | ekhane",     hint: "Eh kha neh", audio: "" },
    { prompt: "stop (formal)",   answer: "থামুন | thamun",     hint: "Thah moon", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/words-4", title: "Out & About: Words", rollup: false });
