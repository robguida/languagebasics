/* bn / phrases-1 — Bengali Basics: Hello & Time of Day
 *
 * Bengali Words & Phrases section. Applied VERBATIM from the Bengali linguistics
 * dataset review (dataset of record). Plain phrase cards: prompt = English
 * meaning, answer = native Bangla script | practical romanization stacked with
 * " | ", hint = plain-English phonetic. Standard Bangladeshi Bengali (apni
 * register). Bengali forms are owned by the linguistics review, not invented
 * here.
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSON object and the LB_LESSONS entry so
 * the phrases decks count in neither numerator nor denominator of the "X of N
 * lessons mastered" readout (mirrors the alphabet-all rollup-skip pattern). */
window.LB_LESSON = {
  id: "bn/phrases-1",
  title: "Bengali Basics: Hello & Time of Day",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Bengali out loud, then reveal.",
  cards: [
    { prompt: "Hello (formal)",      answer: "আসসালামু আলাইকুম | assalamu alaikum", hint: "Ahs sah lah moo ah lai koom", audio: "" },
    { prompt: "Hi (casual)",         answer: "সালাম | salam",                       hint: "Sah lahm",                    audio: "" },
    { prompt: "Hello (traditional)", answer: "নমস্কার | nomoshkar",                  hint: "Noh mosh kar",                audio: "" },
    { prompt: "Good morning",        answer: "শুভ সকাল | shubho sokal",              hint: "Shoo bho shoh kal",           audio: "" },
    { prompt: "Good afternoon",      answer: "শুভ দুপুর | shubho dupur",             hint: "Shoo bho doo poor",           audio: "" },
    { prompt: "Good evening",        answer: "শুভ সন্ধ্যা | shubho shondha",         hint: "Shoo bho shon dha",           audio: "" },
    { prompt: "How are you?",        answer: "কেমন আছেন? | kemon achhen?",           hint: "Keh mon ah chen",             audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/phrases-1", title: "Bengali Basics: Hello & Time of Day", rollup: false });
