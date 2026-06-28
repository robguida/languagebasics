/* sq / phrases-1 — Albanian Tosk Basics: Greetings L1 "Hello & Time of Day"
 *
 * LB-20 phrases section. Dataset is the reviewed Tosk dataset (per the
 * project's linguistics review), applied
 * verbatim. Plain phrase cards: prompt = English meaning, answer = Albanian,
 * hint = phonetic. The "How are you?" PAIR card uses the " | " answer stack
 * (call | reply, both Albanian) with both phonetics on ONE hint line joined by
 * an EM-DASH — (never " | " or " / " inside a hint).
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSONS entry so the phrases decks count
 * in neither numerator nor denominator of the "X of N lessons mastered" readout
 * (mirrors the alphabet-all rollup-skip pattern). */
window.LB_LESSON = {
  id: "sq/phrases-1",
  title: "Albanian Tosk Basics: Hello & Time of Day",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the greeting, say the Albanian reply out loud, then reveal.",
  cards: [
    { prompt: "Hello (formal)",      answer: "Përshëndetje", hint: "Pur shun det yeh",  audio: "" },
    { prompt: "Hi (casual)",         answer: "Tung",         hint: "Toong",             audio: "" },
    { prompt: "Hello (traditional)", answer: "Tungjatjeta",  hint: "Toon gyat yeh tah", audio: "" },
    { prompt: "Good morning",        answer: "Mirëmëngjes",  hint: "Mee ruh mun gyes",  audio: "" },
    { prompt: "Good afternoon",      answer: "Mirëdita",     hint: "Mee ruh dee tah",   audio: "" },
    { prompt: "Good evening",        answer: "Mirëmbrëma",   hint: "Mee ruh mbruh mah", audio: "" },
    { prompt: "How are you?",        answer: "Si je? | Mirë, faleminderit", hint: "See yeh — Meer, fah leh meen deh reet", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/phrases-1", title: "Albanian Tosk Basics: Hello & Time of Day", rollup: false });
