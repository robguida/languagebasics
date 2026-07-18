/* es / alphabet-consonants — Spanish Alphabet: Consonants (22 letters)
 *
 * LB-31 alphabet section. INVERSE of the number cards:
 *   prompt = the letter, answer = the phonetic SOUND, hint = 3 example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * Spanish forms + phonetics are owned by the Spanish linguistics dataset review
 * and applied VERBATIM here — engineers do not invent or alter them. Letters
 * with two context-dependent sounds (c, g, x) show both in the answer field.
 * Dialect: Latin American, seseo. */
window.LB_LESSON = {
  id: "es/alphabet-consonants",
  title: "Spanish Alphabet: Consonants",
  revealMs: 5000,
  cards: [
    { prompt: "b", answer: "B (soft between vowels)",           hint: "boca (Boh kah, mouth) / bueno (Bweh noh, good) / árbol (Ar bohl, tree)", audio: "" },
    { prompt: "c", answer: "S / K (S before e/i, else K)",      hint: "cinco (Seen koh, five) / cero (Seh roh, zero) / casa (Kah sah, house)", audio: "" },
    { prompt: "d", answer: "D (light \"th\" between vowels)",    hint: "dos (Dohs, two) / dedo (Deh doh, finger) / nada (Nah dah, nothing)", audio: "" },
    { prompt: "f", answer: "F",                                 hint: "flor (Flohr, flower) / café (Kah feh, coffee) / foto (Foh toh, photo)", audio: "" },
    { prompt: "g", answer: "G / H (H before e/i, else hard G)", hint: "gato (Gah toh, cat) / gente (Hen teh, people) / amigo (Ah mee goh, friend)", audio: "" },
    { prompt: "h", answer: "(silent)",                          hint: "hola (Oh lah, hello) / hombre (Ohm breh, man) / hoy (Oy, today)", audio: "" },
    { prompt: "j", answer: "H (throaty)",                       hint: "jamón (Hah mohn, ham) / rojo (Roh hoh, red) / caja (Kah hah, box)", audio: "" },
    { prompt: "k", answer: "K (rare / loanwords)",              hint: "kilo (Kee loh, kilo) / kiwi (Kee wee, kiwi) / koala (Koh ah lah, koala)", audio: "" },
    { prompt: "l", answer: "L",                                 hint: "luna (Loo nah, moon) / sol (Sohl, sun) / lápiz (Lah pees, pencil)", audio: "" },
    { prompt: "m", answer: "M",                                 hint: "mano (Mah noh, hand) / mesa (Meh sah, table) / amor (Ah mohr, love)", audio: "" },
    { prompt: "n", answer: "N",                                 hint: "pan (Pahn, bread) / noche (Noh cheh, night) / nada (Nah dah, nothing)", audio: "" },
    { prompt: "ñ", answer: "Ny (as in canYON)",                 hint: "niño (Nee nyoh, child) / año (Ah nyoh, year) / señor (Seh nyohr, sir)", audio: "" },
    { prompt: "p", answer: "P",                                 hint: "papa (Pah pah, potato) / sopa (Soh pah, soup) / pan (Pahn, bread)", audio: "" },
    { prompt: "q", answer: "K (always written \"qu\")",         hint: "queso (Keh soh, cheese) / quién (Kyen, who) / aquí (Ah kee, here)", audio: "" },
    { prompt: "r", answer: "R (soft tap; rolled at word start)", hint: "pero (Peh roh, but) / cara (Kah rah, face) / rojo (Rroh hoh, red)", audio: "" },
    { prompt: "s", answer: "S",                                 hint: "sol (Sohl, sun) / casa (Kah sah, house) / mesa (Meh sah, table)", audio: "" },
    { prompt: "t", answer: "T",                                 hint: "tres (Trehs, three) / gato (Gah toh, cat) / taza (Tah sah, cup)", audio: "" },
    { prompt: "v", answer: "B (same sound as b)",               hint: "vaca (Bah kah, cow) / vino (Bee noh, wine) / nuevo (Nweh boh, new)", audio: "" },
    { prompt: "w", answer: "W (rare / loanwords)",              hint: "wifi (Wee fee, wifi) / web (Web, web) / kiwi (Kee wee, kiwi)", audio: "" },
    { prompt: "x", answer: "Ks (H in \"México\")",              hint: "taxi (Tak see, taxi) / examen (Ek sah men, exam) / México (Meh hee koh, Mexico)", audio: "" },
    { prompt: "y", answer: "Y (alone = \"and\" = Ee)",          hint: "yo (Yoh, I) / playa (Plah yah, beach) / rey (Rey, king)", audio: "" },
    { prompt: "z", answer: "S (seseo)",                         hint: "zapato (Sah pah toh, shoe) / taza (Tah sah, cup) / luz (Loos, light)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/alphabet-consonants", title: "Spanish Alphabet: Consonants" });
