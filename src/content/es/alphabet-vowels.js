/* es / alphabet-vowels — Spanish Alphabet: Vowels (5 letters)
 *
 * LB-31 alphabet section. INVERSE of the number cards:
 *   prompt = the letter, answer = the phonetic SOUND, hint = 3 example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * Spanish forms + phonetics are owned by the Spanish linguistics dataset review
 * and applied VERBATIM here — engineers do not invent or alter them.
 * Dialect: Latin American, seseo. */
window.LB_LESSON = {
  id: "es/alphabet-vowels",
  title: "Spanish Alphabet: Vowels",
  revealMs: 5000,
  cards: [
    { prompt: "a", answer: "Ah",              hint: "casa (Kah sah, house) / gato (Gah toh, cat) / mano (Mah noh, hand)", audio: "" },
    { prompt: "e", answer: "Eh",              hint: "mesa (Meh sah, table) / leche (Leh cheh, milk) / verde (Ber deh, green)", audio: "" },
    { prompt: "i", answer: "Ee",              hint: "sí (See, yes) / vino (Bee noh, wine) / libro (Lee broh, book)", audio: "" },
    { prompt: "o", answer: "Oh",              hint: "sol (Sohl, sun) / ojo (Oh hoh, eye) / boca (Boh kah, mouth)", audio: "" },
    { prompt: "u", answer: "Oo (as in FOOD)", hint: "uno (Oo noh, one) / luna (Loo nah, moon) / mundo (Moon doh, world)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/alphabet-vowels", title: "Spanish Alphabet: Vowels" });
