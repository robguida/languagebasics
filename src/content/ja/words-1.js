/* ja / words-1 — Japanese Basics: Hello (Words)
 *
 * Japanese Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (ja/phrases-1). Applied VERBATIM from the Japanese linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = Japanese
 * script stacked over romaji via the engine's " | " separator, hint = plain-
 * English phonetic. Japanese forms are owned by the linguistics review, not
 * invented here.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "ja/words-1",
  title: "Hello: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Japanese out loud, then reveal.",
  cards: [
    { prompt: "Hello",                   answer: "こんにちは | konnichiwa", hint: "Kohn nee chee wah", audio: "" },
    { prompt: "Hi",                      answer: "やあ | yaa",             hint: "Yaah",              audio: "" },
    { prompt: "Hello (traditional)",     answer: "ごきげんよう | gokigenyō", hint: "Goh kee gen yoh",   audio: "" },
    { prompt: "good / well",             answer: "元気 | genki",           hint: "Gen kee",           audio: "" },
    { prompt: "morning",                 answer: "おはよう | ohayō",        hint: "Oh hah yoh",        audio: "" },
    { prompt: "day / afternoon",         answer: "こんにち | konnichi",     hint: "Kohn nee chee",     audio: "" },
    { prompt: "evening",                 answer: "こんばん | konban",       hint: "Kohn bahn",         audio: "" },
    { prompt: "how",                     answer: "どう | dō",              hint: "Doh",               audio: "" },
    { prompt: "you are (to be, polite)", answer: "です | desu",            hint: "Dess",              audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/words-1", title: "Hello: Words", rollup: false });
