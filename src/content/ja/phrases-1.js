/* ja / phrases-1 — Japanese Basics: Hello & Time of Day
 *
 * Japanese Words & Phrases section. Applied VERBATIM from the Japanese
 * linguistics dataset review (dataset of record). Plain phrase cards: prompt =
 * English meaning, answer = Japanese script stacked over romaji via the engine's
 * " | " separator, hint = plain-English phonetic. Japanese forms are owned by
 * the linguistics review, not invented here.
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSON object and the LB_LESSONS entry so
 * the phrases decks count in neither numerator nor denominator of the "X of N
 * lessons mastered" readout (mirrors the alphabet-all rollup-skip pattern). */
window.LB_LESSON = {
  id: "ja/phrases-1",
  title: "Japanese Basics: Hello & Time of Day",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Japanese out loud, then reveal.",
  cards: [
    { prompt: "Hello (formal)",      answer: "こんにちは | konnichiwa",              hint: "Kohn nee chee wah",           audio: "" },
    { prompt: "Hi (casual)",         answer: "やあ | yaa",                          hint: "Yaah",                        audio: "" },
    { prompt: "Hello (traditional)", answer: "ごきげんよう | gokigenyō",              hint: "Goh kee gen yoh",             audio: "" },
    { prompt: "Good morning",        answer: "おはようございます | ohayō gozaimasu",    hint: "Oh hah yoh goh zah ee mahss", audio: "" },
    { prompt: "Good afternoon",      answer: "こんにちは | konnichiwa",              hint: "Kohn nee chee wah",           audio: "" },
    { prompt: "Good evening",        answer: "こんばんは | konbanwa",                hint: "Kohn bahn wah",               audio: "" },
    { prompt: "How are you?",        answer: "お元気ですか | ogenki desu ka",         hint: "Oh gen kee dess kah",         audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/phrases-1", title: "Japanese Basics: Hello & Time of Day", rollup: false });
