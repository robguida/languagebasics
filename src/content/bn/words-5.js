/* bn / words-5 — Bengali Basics: Help (Words)
 *
 * Bengali Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (bn/phrases-5). Applied VERBATIM from the Bengali linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = native
 * Bangla script | practical romanization stacked with " | ", hint = plain-
 * English phonetic. Standard Bangladeshi Bengali (Dhaka cholito). Bengali forms
 * are owned by the linguistics review, not invented here.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "bn/words-5",
  title: "Help: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Bengali out loud, then reveal.",
  cards: [
    { prompt: "question word (yes/no)", answer: "কি | ki",                     hint: "Kee",              audio: "" },
    { prompt: "you speak (formal)",     answer: "বলেন | bolen",                hint: "Boh len",          audio: "" },
    { prompt: "English",                answer: "ইংরেজি | ingreji",            hint: "Eeng reh jee",     audio: "" },
    { prompt: "not",                    answer: "না | na",                    hint: "Nah",              audio: "" },
    { prompt: "I speak",                answer: "বলি | boli",                 hint: "Boh lee",          audio: "" },
    { prompt: "Bengali (the language)", answer: "বাংলা | bangla",             hint: "Bahng la",         audio: "" },
    { prompt: "Help!",                  answer: "সাহায্য করুন! | shahajjo korun!", hint: "Shah haj jo koh roon", audio: "" },
    { prompt: "me",                     answer: "আমাকে | amake",              hint: "Ah mah keh",       audio: "" },
    { prompt: "is needed / I need",     answer: "দরকার | dorkar",             hint: "Dor kar",          audio: "" },
    { prompt: "a / one (person)",       answer: "একজন | ekjon",               hint: "Aek jon",          audio: "" },
    { prompt: "doctor",                 answer: "ডাক্তার | daktar",            hint: "Dahk tar",         audio: "" },
    { prompt: "I",                      answer: "আমি | ami",                  hint: "Ah mee",           audio: "" },
    { prompt: "name",                   answer: "নাম | nam",                  hint: "Nahm",             audio: "" },
    { prompt: "glad / happy",           answer: "খুশি | khushi",              hint: "Khoo shee",        audio: "" },
    { prompt: "acquaintance",           answer: "পরিচয় | porichoy",          hint: "Poh ree choy",     audio: "" },
    { prompt: "you / your (formal)",    answer: "আপনার | apnar",              hint: "Ahp nar",          audio: "" },
    { prompt: "I know",                 answer: "জানি | jani",                hint: "Jah nee",          audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/words-5", title: "Help: Words", rollup: false });
