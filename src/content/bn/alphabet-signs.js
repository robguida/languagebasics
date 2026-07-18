/* bn / alphabet-signs — Bengali Script: Extra Letters & Signs
 *
 * LB-33 alphabet (script) section. INVERSE of the number cards:
 *   prompt = the Bengali character, answer = its sound (Rob's plain-English-
 *   syllable notation), hint = 3 native-script example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * The reading-critical extras that finish the traditional 50: ড় ঢ় য় (real
 * consonants met in everyday words) + ৎ ং ঃ ঁ (the four special signs).
 *
 * Bengali forms + phonetics are owned by the Bengali linguistics dataset review
 * (Standard Bangladeshi Bengali) and applied VERBATIM here — engineers do not
 * invent or alter them. Scope: extra letters + special signs (no conjuncts). */
window.LB_LESSON = {
  id: "bn/alphabet-signs",
  title: "Extra Letters & Signs",
  revealMs: 5000,
  cards: [
    { prompt: "ড়", answer: "Rô (hard r, tongue-flap)",   hint: "বড় (Bo ro, big) / পড়া (Po ra, to study) / নড়া (No ra, to move)", audio: "" },
    { prompt: "ঢ়", answer: "Rhô (hard rh, rare)",         hint: "আষাঢ় (Ah shar, month of Ashar) / গাঢ় (Ga rho, deep/dark) / দৃঢ় (Dree rho, firm)", audio: "" },
    { prompt: "য়", answer: "Yô (y glide)",                hint: "নয় (Noy, nine, is-not) / হয় (Hoy, becomes) / সময় (Shoh moy, time)", audio: "" },
    { prompt: "ৎ", answer: "T (khanda-ta, final t)",     hint: "হঠাৎ (Ho that, suddenly) / উৎসব (Oot shob, festival) / জগৎ (Joh got, world)", audio: "" },
    { prompt: "ং", answer: "Ng (anusvar, nasal)",        hint: "বাংলা (Bang la, Bengali) / রং (Rong, color) / বাংলাদেশ (Bang la desh, Bangladesh)", audio: "" },
    { prompt: "ঃ", answer: "H (visarga, light breath)",  hint: "দুঃখ (Dook kho, sorrow) / অতঃপর (Oh toh por, thereafter) / প্রাতঃ (Pra to, morning-formal)", audio: "" },
    { prompt: "ঁ", answer: "N (chandrabindu, nasalize)", hint: "চাঁদ (Chad, moon) / হাঁস (Hash, duck) / পাঁচ (Pahnch, five)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/alphabet-signs", title: "Extra Letters & Signs" });
