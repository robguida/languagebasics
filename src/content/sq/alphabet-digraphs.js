/* sq / alphabet-digraphs — Albanian Tosk Basics: Digraphs (9 two-letter sounds)
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
  id: "sq/alphabet-digraphs",
  title: "Albanian Tosk Basics: Digraphs",
  revealMs: 5000,
  cards: [
    { prompt: "dh", answer: "Th (as in THIS)",      hint: "dhjetë (They it, ten) / dhomë (Thohm, room) / dhi (Thee, goat)",        audio: "" },
    { prompt: "gj", answer: "Gy (as in arGUe)",     hint: "gjashtë (Gyosht, six) / gjak (Gyahk, blood) / gjuhë (Gyooh, language)", audio: "" },
    { prompt: "ll", answer: "L (dark, as in BALL)", hint: "yll (Ool, star) / mollë (Mohl, apple) / pyll (Pool, forest)",           audio: "" },
    { prompt: "nj", answer: "Ny (as in caNYon)",    hint: "një (Nyu, one) / njeri (Nyeh ree, person) / njoh (Nyoh, know)",         audio: "" },
    { prompt: "rr", answer: "R (rolled / trilled)", hint: "rrugë (Rroog, street) / burrë (Boor, man) / arrë (Ahr, walnut)",        audio: "" },
    { prompt: "sh", answer: "Sh (as in SHoe)",      hint: "shtatë (Shtah t, seven) / shtëpi (Shtuh pee, house) / shi (Shee, rain)", audio: "" },
    { prompt: "th", answer: "Th (as in THIN)",      hint: "thikë (Theek, knife) / thatë (Thaht, dry) / thua (Thoo ah, nail)",      audio: "" },
    { prompt: "xh", answer: "J (as in JUMP)",       hint: "xham (Jahm, glass) / xhep (Jep, pocket) / xhaketë (Jah ket, jacket)",   audio: "" },
    { prompt: "zh", answer: "Zh (as in viSion)",    hint: "zhurmë (Zhoorm, noise) / zhytje (Zhoot yeh, diving) / vazhdoj (Vazh doy, continue)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/alphabet-digraphs", title: "Albanian Tosk Basics: Digraphs" });
