/* ja / words-5 — Japanese Basics: Help (Words)
 *
 * Japanese Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (ja/phrases-5). Applied VERBATIM from the Japanese linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = Japanese
 * script stacked over romaji via the engine's " | " separator, hint = plain-
 * English phonetic. Japanese forms are owned by the linguistics review.
 *
 * The urgent shout 助けて (tasukete, "Help!") is taught here as a single word so
 * a learner has the emergency form; the phrases deck keeps the calm stated-need
 * form 助けが必要です per the dataset review.
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSON object and the LB_LESSONS entry. */
window.LB_LESSON = {
  id: "ja/words-5",
  title: "Help: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Japanese out loud, then reveal.",
  cards: [
    { prompt: "question word (turns a sentence into a question)", answer: "か | ka",             hint: "Kah",              audio: "" },
    { prompt: "you (can) speak",                                  answer: "話せます | hanasemasu",  hint: "Hah nah seh mahss", audio: "" },
    { prompt: "English",                                          answer: "英語 | eigo",          hint: "Ay goh",           audio: "" },
    { prompt: "(can) not speak",                                  answer: "話せません | hanasemasen", hint: "Hah nah seh mah sen", audio: "" },
    { prompt: "I speak",                                          answer: "話します | hanashimasu",  hint: "Hah nah shee mahss", audio: "" },
    { prompt: "Japanese",                                         answer: "日本語 | nihongo",      hint: "Nee hohn goh",     audio: "" },
    { prompt: "Help!",                                            answer: "助けて | tasukete",     hint: "Tah soo keh teh",  audio: "" },
    { prompt: "me / I",                                           answer: "私 | watashi",         hint: "Wah tah shee",     audio: "" },
    { prompt: "necessary / needed",                               answer: "必要 | hitsuyō",       hint: "Heet soo yoh",     audio: "" },
    { prompt: "one",                                              answer: "一つ | hitotsu",       hint: "Hee toh tsoo",     audio: "" },
    { prompt: "doctor",                                           answer: "医者 | isha",          hint: "Ee shah",          audio: "" },
    { prompt: "I (as topic)",                                     answer: "私は | watashi wa",     hint: "Wah tah shee wah", audio: "" },
    { prompt: "am / is (to be, polite)",                          answer: "です | desu",          hint: "Dess",             audio: "" },
    { prompt: "regards / pleased",                                answer: "よろしく | yoroshiku",   hint: "Yoh roh shee koo", audio: "" },
    { prompt: "please (formal, go ahead)",                        answer: "どうぞ | dōzo",         hint: "Doh zoh",          audio: "" },
    { prompt: "you",                                              answer: "あなた | anata",        hint: "Ah nah tah",       audio: "" },
    { prompt: "I understand / I know",                            answer: "わかります | wakarimasu", hint: "Wah kah ree mahss", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/words-5", title: "Help: Words", rollup: false });
