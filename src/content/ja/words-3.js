/* ja / words-3 — Japanese Basics: Courtesy (Words)
 *
 * Japanese Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (ja/phrases-3). Applied VERBATIM from the Japanese linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = Japanese
 * script stacked over romaji via the engine's " | " separator, hint = plain-
 * English phonetic. Japanese forms are owned by the linguistics review.
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSON object and the LB_LESSONS entry. */
window.LB_LESSON = {
  id: "ja/words-3",
  title: "Courtesy: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Japanese out loud, then reveal.",
  cards: [
    { prompt: "yes",                           answer: "はい | hai",                 hint: "Hah ee",                 audio: "" },
    { prompt: "no",                            answer: "いいえ | iie",               hint: "Ee eh",                  audio: "" },
    { prompt: "you",                           answer: "あなた | anata",             hint: "Ah nah tah",             audio: "" },
    { prompt: "please (request)",              answer: "お願いします | onegaishimasu", hint: "Oh neh gah ee shee mahss", audio: "" },
    { prompt: "Thank you",                     answer: "ありがとう | arigatō",        hint: "Ah ree gah toh",         audio: "" },
    { prompt: "why",                           answer: "なぜ | naze",                hint: "Nah zeh",                audio: "" },
    { prompt: "me / I",                        answer: "私 | watashi",               hint: "Wah tah shee",           audio: "" },
    { prompt: "forgive / sorry",               answer: "ごめんなさい | gomennasai",    hint: "Goh men nah sah ee",     audio: "" },
    { prompt: "not (polite negative ending)",  answer: "ません | masen",             hint: "Mah sen",                audio: "" },
    { prompt: "I understand",                  answer: "わかります | wakarimasu",      hint: "Wah kah ree mahss",      audio: "" },
    { prompt: "Excuse me",                     answer: "すみません | sumimasen",       hint: "Soo mee mah sen",        audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/words-3", title: "Courtesy: Words", rollup: false });
