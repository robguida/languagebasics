/* ja / phrases-5 — Japanese Basics: Help & Connecting
 *
 * Japanese Words & Phrases section. Applied VERBATIM from the Japanese
 * linguistics dataset review (dataset of record). Plain phrase cards: prompt =
 * English meaning, answer = Japanese script stacked over romaji via the engine's
 * " | " separator, hint = plain-English phonetic. Japanese forms are owned by
 * the linguistics review.
 *
 * "I need help" is the calm stated-need form 助けが必要です per the dataset
 * review; the urgent shout 助けて (tasukete) is taught as a single word in the
 * matching words deck (ja/words-5).
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSON object and the LB_LESSONS entry. */
window.LB_LESSON = {
  id: "ja/phrases-5",
  title: "Japanese Basics: Help & Connecting",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Japanese out loud, then reveal.",
  cards: [
    { prompt: "Do you speak English?",         answer: "英語を話せますか | eigo o hanasemasu ka",          hint: "Ay goh oh hah nah seh mahss kah",          audio: "" },
    { prompt: "I don't speak Japanese",        answer: "日本語を話せません | nihongo o hanasemasen",        hint: "Nee hohn goh oh hah nah seh mah sen",      audio: "" },
    { prompt: "I need help",                   answer: "助けが必要です | tasuke ga hitsuyō desu",          hint: "Tah soo keh gah heet soo yoh dess",        audio: "" },
    { prompt: "I need a doctor",               answer: "医者が必要です | isha ga hitsuyō desu",            hint: "Ee shah gah heet soo yoh dess",            audio: "" },
    { prompt: "My name is…",                   answer: "私は…です | watashi wa … desu",                   hint: "Wah tah shee wah … dess",                  audio: "" },
    { prompt: "Pleased to meet you (formal)",  answer: "どうぞよろしくお願いします | dōzo yoroshiku onegaishimasu", hint: "Doh zoh yoh roh shee koo oh neh gah ee shee mahss", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/phrases-5", title: "Japanese Basics: Help & Connecting", rollup: false });
