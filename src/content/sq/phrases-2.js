/* sq / phrases-2 — Albanian Tosk Basics: Greetings L2 "Goodbye & First Contact"
 *
 * LB-20 phrases section. Dataset is the reviewed Tosk dataset (per the
 * project's linguistics review), applied
 * verbatim. Plain phrase cards: prompt = English meaning, answer = Albanian,
 * hint = phonetic. The "Welcome" and "Nice to meet you" PAIR cards use the
 * " | " answer stack (call | reply, both Albanian) with both phonetics on ONE
 * hint line joined by an EM-DASH — (never " | " or " / " inside a hint).
 *
 * ROLLUP SKIP: rollup:false on the LB_LESSONS entry (mirrors alphabet-all). */
window.LB_LESSON = {
  id: "sq/phrases-2",
  title: "Albanian Tosk Basics: Goodbye & First Contact",
  revealMs: 5000,
  rollup: false,
  recallPrompt: "Read the greeting, say the Albanian reply out loud, then reveal.",
  cards: [
    { prompt: "Good night",            answer: "Natën e mirë",  hint: "Nah tun eh meer",    audio: "" },
    { prompt: "Goodbye",               answer: "Mirupafshim",   hint: "Mee roo pahf sheem", audio: "" },
    { prompt: "Bye (casual)",          answer: "Çao",           hint: "Chow",               audio: "" },
    { prompt: "See you",               answer: "Shihemi",       hint: "Shee heh mee",       audio: "" },
    { prompt: "What's up? (casual)",   answer: "Ç'kemi?",       hint: "Ch keh mee",         audio: "" },
    { prompt: "See you tomorrow",      answer: "Shihemi nesër", hint: "Shee heh mee neh sur", audio: "" },
    { prompt: "Welcome",               answer: "Mirë se vini | Mirë se ju gjeta", hint: "Meer seh vee nee — Meer seh yoo gyeh tah", audio: "" },
    { prompt: "Nice to meet you",      answer: "Më vjen mirë | Edhe mua",         hint: "Muh vyen meer — Eh theh moo ah",           audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/phrases-2", title: "Albanian Tosk Basics: Goodbye & First Contact", rollup: false });
