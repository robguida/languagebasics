/* bn / words-3 — Bengali Basics: Courtesy (Words)
 *
 * Bengali Words & Phrases section. Single-word building blocks for the matching
 * phrases deck (bn/phrases-3). Applied VERBATIM from the Bengali linguistics
 * dataset review (dataset of record). prompt = English gloss, answer = native
 * Bangla script | practical romanization stacked with " | ", hint = plain-
 * English phonetic. Standard Bangladeshi Bengali (Dhaka cholito). Bengali forms
 * are owned by the linguistics review, not invented here.
 *
 * ROLLUP SKIP: rollup:false on BOTH the LB_LESSON object and the LB_LESSONS
 * entry so the words decks count in neither numerator nor denominator of the
 * "X of N lessons mastered" readout (mirrors the phrases/alphabet rollup-skip). */
window.LB_LESSON = {
  id: "bn/words-3",
  title: "Courtesy: Words",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Bengali out loud, then reveal.",
  cards: [
    { prompt: "yes",                        answer: "হ্যাঁ | hyã",            hint: "Hyahn",         audio: "" },
    { prompt: "no",                         answer: "না | na",                hint: "Nah",           audio: "" },
    { prompt: "you (formal)",               answer: "আপনি | apni",            hint: "Ahp nee",       audio: "" },
    { prompt: "please",                     answer: "দয়া করে | doya kore",     hint: "Doh ya koh reh", audio: "" },
    { prompt: "Thank you",                  answer: "ধন্যবাদ | dhonnobad",     hint: "Dhohn noh bad", audio: "" },
    { prompt: "no problem",                 answer: "সমস্যা নেই | shomoshsha nei", hint: "Shoh mosh sha nay", audio: "" },
    { prompt: "why",                        answer: "কেন | keno",             hint: "Keh no",        audio: "" },
    { prompt: "I / me",                     answer: "আমি | ami",              hint: "Ah mee",        audio: "" },
    { prompt: "forgive / pardon (formal)",  answer: "মাফ করবেন | maf korben",  hint: "Maf kor ben",   audio: "" },
    { prompt: "sorry",                      answer: "দুঃখিত | dukkhito",       hint: "Doo khee to",   audio: "" },
    { prompt: "I understand",               answer: "বুঝি | bujhi",           hint: "Boo jhee",      audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/words-3", title: "Courtesy: Words", rollup: false });
