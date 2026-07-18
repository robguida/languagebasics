/* es / words-1 — Spanish Basics: Hello (Words)
 *
 * Spanish Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (es/phrases-1). Applied VERBATIM from the Spanish linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = Spanish
 * (Latin script, correct tildes / ¿ ¡), hint = plain-English phonetic. Spanish
 * forms are owned by the linguistics review, not invented here.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "es/words-1",
  title: "Hello: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Spanish out loud, then reveal.",
  cards: [
    { prompt: "Hello",                          answer: "Hola",     hint: "Oh lah",       audio: "" },
    { prompt: "Hi (casual, any time of day)",   answer: "Buenas",   hint: "Bweh nahs",    audio: "" },
    { prompt: "Hello (traditional / courteous)", answer: "Buen día", hint: "Bwehn dee ah", audio: "" },
    { prompt: "good (masc.)",                   answer: "bueno",    hint: "Bweh noh",     audio: "" },
    { prompt: "good (fem.)",                    answer: "buena",    hint: "Bweh nah",     audio: "" },
    { prompt: "morning",                        answer: "mañana",   hint: "Mah nyah nah", audio: "" },
    { prompt: "day",                            answer: "día",      hint: "Dee ah",       audio: "" },
    { prompt: "afternoon / evening",            answer: "tarde",    hint: "Tar deh",      audio: "" },
    { prompt: "night",                          answer: "noche",    hint: "Noh cheh",     audio: "" },
    { prompt: "how",                            answer: "cómo",     hint: "Koh moh",      audio: "" },
    { prompt: "you are (informal)",             answer: "estás",    hint: "Ehs tahs",     audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/words-1", title: "Hello: Words", rollup: false });
