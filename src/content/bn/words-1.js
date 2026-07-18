/* bn / words-1 — Bengali Basics: Hello (Words)
 *
 * Bengali Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (bn/phrases-1). Applied VERBATIM from the Bengali linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = native
 * Bangla script | practical romanization stacked with " | ", hint = plain-
 * English phonetic. Standard Bangladeshi Bengali (Dhaka cholito). Bengali forms
 * are owned by the linguistics review, not invented here.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "bn/words-1",
  title: "Hello: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Bengali out loud, then reveal.",
  cards: [
    { prompt: "Hello (greeting)",       answer: "আসসালামু আলাইকুম | assalamu alaikum", hint: "Ahs sah lah moo ah lai koom", audio: "" },
    { prompt: "Hi (short greeting)",    answer: "সালাম | salam",                       hint: "Sah lahm",                    audio: "" },
    { prompt: "Hello (traditional)",    answer: "নমস্কার | nomoshkar",                  hint: "Noh mosh kar",                audio: "" },
    { prompt: "good / auspicious",      answer: "শুভ | shubho",                         hint: "Shoo bho",                    audio: "" },
    { prompt: "morning",                answer: "সকাল | sokal",                         hint: "Shoh kal",                    audio: "" },
    { prompt: "noon / afternoon",       answer: "দুপুর | dupur",                        hint: "Doo poor",                    audio: "" },
    { prompt: "evening",                answer: "সন্ধ্যা | shondha",                    hint: "Shon dha",                    audio: "" },
    { prompt: "how",                    answer: "কেমন | kemon",                         hint: "Keh mon",                     audio: "" },
    { prompt: "you are (formal)",       answer: "আছেন | achhen",                        hint: "Ah chen",                     audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/words-1", title: "Hello: Words", rollup: false });
