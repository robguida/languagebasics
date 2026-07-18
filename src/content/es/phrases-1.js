/* es / phrases-1 — Spanish Basics: Hello & Time of Day
 *
 * Spanish Words & Phrases section. Applied VERBATIM from the Spanish linguistics
 * dataset review (dataset of record). Plain phrase cards: prompt = English
 * meaning, answer = Spanish (Latin script, correct tildes / ¿ ¡), hint = plain-
 * English phonetic. Spanish forms are owned by the linguistics review, not
 * invented here.
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSON object and the LB_LESSONS entry so
 * the phrases decks count in neither numerator nor denominator of the "X of N
 * lessons mastered" readout (mirrors the alphabet-all rollup-skip pattern). */
window.LB_LESSON = {
  id: "es/phrases-1",
  title: "Spanish Basics: Hello & Time of Day",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Spanish out loud, then reveal.",
  cards: [
    { prompt: "Hello (formal)",      answer: "Hola",          hint: "Oh lah",             audio: "" },
    { prompt: "Hi (casual)",         answer: "Buenas",        hint: "Bweh nahs",          audio: "" },
    { prompt: "Hello (traditional)", answer: "Buen día",      hint: "Bwehn dee ah",       audio: "" },
    { prompt: "Good morning",        answer: "Buenos días",   hint: "Bweh nohs dee ahs",  audio: "" },
    { prompt: "Good afternoon",      answer: "Buenas tardes",  hint: "Bweh nahs tar dehs", audio: "" },
    { prompt: "Good evening",        answer: "Buenas noches",  hint: "Bweh nahs noh chehs", audio: "" },
    { prompt: "How are you?",        answer: "¿Cómo estás?",  hint: "Koh moh ehs tahs",   audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/phrases-1", title: "Spanish Basics: Hello & Time of Day", rollup: false });
