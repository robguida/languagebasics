/* bn / words-2 — Bengali Basics: Goodbye (Words)
 *
 * Bengali Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (bn/phrases-2). Applied VERBATIM from the Bengali linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = native
 * Bangla script | practical romanization stacked with " | ", hint = plain-
 * English phonetic. Standard Bangladeshi Bengali (Dhaka cholito). Bengali forms
 * are owned by the linguistics review, not invented here.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "bn/words-2",
  title: "Goodbye: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Bengali out loud, then reveal.",
  cards: [
    { prompt: "night",                  answer: "রাত | rat",                hint: "Raht",                    audio: "" },
    { prompt: "and",                    answer: "আর | ar",                  hint: "Ar",                      audio: "" },
    { prompt: "good",                   answer: "ভালো | bhalo",             hint: "Bhah lo",                 audio: "" },
    { prompt: "Goodbye",                answer: "আল্লাহ হাফেজ | allah hafez", hint: "Al lah hah fez",         audio: "" },
    { prompt: "Bye (casual)",           answer: "বাই | bai",                hint: "Bye",                     audio: "" },
    { prompt: "See you",                answer: "দেখা হবে | dekha hobe",     hint: "Deh kha hoh beh",        audio: "" },
    { prompt: "What's up",              answer: "কী খবর | ki khobor",       hint: "Kee khoh bor",            audio: "" },
    { prompt: "tomorrow",               answer: "আগামীকাল | agamikal",      hint: "Ah gah mee kal",          audio: "" },
    { prompt: "welcome",                answer: "স্বাগতম | shagotom",       hint: "Shah goh tom",            audio: "" },
    { prompt: "you come (formal)",      answer: "আসেন | ashen",             hint: "Ah shen",                 audio: "" },
    { prompt: "me",                     answer: "আমাকে | amake",            hint: "Ah mah keh",              audio: "" },
    { prompt: "acquaintance / meeting", answer: "পরিচয় | porichoy",        hint: "Poh ree choy",            audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/words-2", title: "Goodbye: Words", rollup: false });
