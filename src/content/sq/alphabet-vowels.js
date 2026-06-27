/* sq / alphabet-vowels — Albanian Tosk Basics: Vowels (7 letters)
 *
 * LB-18 alphabet section. INVERSE of the number cards:
 *   prompt = the letter, answer = the phonetic SOUND, hint = 3 example words.
 * Each hint example is "word (phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * Albanian forms + phonetics are owned by the linguistics advisor and applied
 * VERBATIM here — engineers do not invent or alter them. */
window.LB_LESSON = {
  id: "sq/alphabet-vowels",
  title: "Albanian Tosk Basics: Vowels",
  revealMs: 5000,
  cards: [
    { prompt: "a", answer: "Ah",               hint: "ana (Ah nah, side) / baba (Bah bah, father) / mal (Mahl, mountain)", audio: "" },
    { prompt: "e", answer: "Eh",               hint: "det (Det, sea) / emër (Eh mur, name) / nesër (Neh sur, tomorrow)",   audio: "" },
    { prompt: "ë", answer: "Uh",               hint: "ëndërr (Un dur, dream) / ëmbël (Um bul, sweet) / zëri (Zuh ree, voice)", audio: "" },
    { prompt: "i", answer: "Ee",               hint: "mik (Meek, friend) / dritë (Dreet, light) / pi (Pee, drink)",        audio: "" },
    { prompt: "o", answer: "Oh",               hint: "dorë (Dohr, hand) / kokë (Kohk, head) / lot (Loht, tear)",           audio: "" },
    { prompt: "u", answer: "Oo (as in FOOD)",  hint: "unë (Oo nuh, I) / mund (Moond, can) / punë (Poon, work)",            audio: "" },
    { prompt: "y", answer: "Oo",               hint: "dy (Doo, two) / sy (Soo, eye) / yll (Ool, star)",                    audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/alphabet-vowels", title: "Albanian Tosk Basics: Vowels" });
