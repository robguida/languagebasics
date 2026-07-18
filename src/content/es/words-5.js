/* es / words-5 — Spanish Basics: Help (Words)
 *
 * Spanish Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (es/phrases-5). Applied VERBATIM from the Spanish linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = Spanish
 * (Latin script, correct tildes / ¿ ¡), hint = plain-English phonetic. Spanish
 * forms are owned by the linguistics review, not invented here.
 *
 * DROPPED CARD: the dataset's inverted-punctuation card (¿…? / ¡…!, hinted "no
 * spoken word") is intentionally omitted — a say-it-aloud flashcard should not be
 * a silent punctuation mark. Every other card is applied verbatim; this deck is
 * the dataset's 17 minus that one card = 16.
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSON object and the LB_LESSONS entry. */
window.LB_LESSON = {
  id: "es/words-5",
  title: "Help: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Spanish out loud, then reveal.",
  cards: [
    { prompt: "you speak (informal)",          answer: "hablas",     hint: "Ah blahs",     audio: "" },
    { prompt: "you speak (formal)",            answer: "habla",      hint: "Ah blah",      audio: "" },
    { prompt: "I speak",                       answer: "hablo",      hint: "Ah bloh",      audio: "" },
    { prompt: "English",                       answer: "inglés",     hint: "Een glehs",    audio: "" },
    { prompt: "Spanish",                       answer: "español",    hint: "Ehs pah nyol", audio: "" },
    { prompt: "not / no",                      answer: "no",         hint: "Noh",          audio: "" },
    { prompt: "Help!",                         answer: "¡Ayuda!",    hint: "Ah yoo dah",   audio: "" },
    { prompt: "I need",                        answer: "necesito",   hint: "Neh seh see toh", audio: "" },
    { prompt: "a / one (masc.)",               answer: "un",         hint: "Oon",          audio: "" },
    { prompt: "doctor",                        answer: "médico",     hint: "Meh dee koh",  audio: "" },
    { prompt: "I",                             answer: "yo",         hint: "Yoh",          audio: "" },
    { prompt: "my name is (I call myself)",    answer: "me llamo",   hint: "Meh yah moh",  audio: "" },
    { prompt: "pleased / delighted (masc.)",   answer: "encantado",  hint: "En kahn tah doh", audio: "" },
    { prompt: "you (informal)",                answer: "tú",         hint: "Too",          audio: "" },
    { prompt: "you (formal)",                  answer: "usted",      hint: "Oos tehd",     audio: "" },
    { prompt: "I know",                        answer: "sé",         hint: "Seh",          audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/words-5", title: "Help: Words", rollup: false });
