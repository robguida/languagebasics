/* es / alphabet-digraphs — Spanish Alphabet: Digraphs (3 two-letter sounds)
 *
 * LB-31 alphabet section. INVERSE of the number cards:
 *   prompt = the letter, answer = the phonetic SOUND, hint = 3 example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * ch / ll / rr are two-letter combos that make one sound. RAE dropped ch/ll as
 * separate alphabet letters in 2010, but a beginner must learn them as sounds.
 *
 * Spanish forms + phonetics are owned by the Spanish linguistics dataset review
 * and applied VERBATIM here — engineers do not invent or alter them.
 * Dialect: Latin American, seseo (ll = "Y", yeísmo). */
window.LB_LESSON = {
  id: "es/alphabet-digraphs",
  title: "Spanish Alphabet: Digraphs",
  revealMs: 5000,
  cards: [
    { prompt: "ch", answer: "Ch (as in CHair)",       hint: "chico (Chee koh, boy) / leche (Leh cheh, milk) / coche (Koh cheh, car)", audio: "" },
    { prompt: "ll", answer: "Y (as in YES)",          hint: "llave (Yah veh, key) / calle (Kah yeh, street) / pollo (Poh yoh, chicken)", audio: "" },
    { prompt: "rr", answer: "Rr (strong rolled trill)", hint: "perro (Peh rroh, dog) / carro (Kah rroh, car) / tierra (Tyeh rrah, land)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/alphabet-digraphs", title: "Spanish Alphabet: Digraphs" });
