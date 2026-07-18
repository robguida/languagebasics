/* bn / phrases-3 — Bengali Basics: Courtesy Basics
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
  id: "bn/phrases-3",
  title: "Bengali Basics: Courtesy Basics",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Bengali out loud, then reveal.",
  cards: [
    { prompt: "Please",             answer: "দয়া করে | doya kore",           hint: "Doh ya koh reh",  audio: "" },
    { prompt: "Thank you",          answer: "ধন্যবাদ | dhonnobad",            hint: "Dhohn noh bad",   audio: "" },
    { prompt: "You're welcome",     answer: "কোনো ব্যাপার না | kono bæpar na", hint: "Koh no ba par na", audio: "" },
    { prompt: "Excuse me",          answer: "শুনুন | shunun",                 hint: "Shoo noon",       audio: "" },
    { prompt: "I am sorry",         answer: "আমি দুঃখিত | ami dukkhito",       hint: "Ah mee doo khee to", audio: "" },
    { prompt: "I don't understand", answer: "আমি বুঝি না | ami bujhi na",      hint: "Ah mee boo jhee na", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/phrases-3", title: "Bengali Basics: Courtesy Basics", rollup: false });
