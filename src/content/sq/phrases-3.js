/* sq / phrases-3 — Albanian Tosk Basics: Phrases L1 "Courtesy Basics"
 *
 * LB-20 phrases section. Dataset is the reviewed Tosk dataset (per the
 * project's linguistics review), applied
 * verbatim. Plain phrase cards: prompt = English meaning, answer = Albanian,
 * hint = phonetic. The "Yes / No" card uses the " | " answer stack with both
 * phonetics on ONE hint line joined by an EM-DASH — (never " | " or " / "
 * inside a hint; the " / " in the PROMPT is fine — only hints trigger rotation).
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSONS entry (mirrors alphabet-all). */
window.LB_LESSON = {
  id: "sq/phrases-3",
  title: "Albanian Tosk Basics: Courtesy Basics",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the meaning, say the Albanian out loud, then reveal.",
  cards: [
    { prompt: "Yes / No",             answer: "Po | Jo",      hint: "Poh — Yoh",            audio: "" },
    { prompt: "Please",               answer: "Ju lutem",     hint: "Yoo loo tem",          audio: "" },
    { prompt: "Thank you",            answer: "Faleminderit",  hint: "Fah leh meen deh reet", audio: "" },
    { prompt: "You're welcome",       answer: "S'ka përse",   hint: "Skah pur seh",         audio: "" },
    { prompt: "Excuse me / Sorry",    answer: "Më falni",     hint: "Muh fahl nee",         audio: "" },
    { prompt: "I don't understand",   answer: "Nuk kuptoj",   hint: "Nook koop toy",        audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/phrases-3", title: "Albanian Tosk Basics: Courtesy Basics", rollup: false });
