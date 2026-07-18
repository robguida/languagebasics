/* bn / alphabet-vowels — Bengali Script: Vowels (স্বরবর্ণ)
 *
 * LB-33 alphabet (script) section. INVERSE of the number cards:
 *   prompt = the Bengali character, answer = its sound (Rob's plain-English-
 *   syllable notation), hint = 3 native-script example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * The 11 independent vowels — every consonant's pronunciation references these.
 *
 * Bengali forms + phonetics are owned by the Bengali linguistics dataset review
 * (Standard Bangladeshi Bengali) and applied VERBATIM here — engineers do not
 * invent or alter them. Scope: base independent vowels only (no vowel signs). */
window.LB_LESSON = {
  id: "bn/alphabet-vowels",
  title: "Vowels (স্বরবর্ণ)",
  revealMs: 5000,
  cards: [
    { prompt: "অ", answer: "Ô (aw)",             hint: "অজগর (Oj gor, python) / অসুখ (Oh shookh, illness) / অনেক (Oh nek, a lot)", audio: "" },
    { prompt: "আ", answer: "Aah (as in FATHER)", hint: "আম (Aam, mango) / আকাশ (Ah kash, sky) / আলো (Ah lo, light)", audio: "" },
    { prompt: "ই", answer: "Ee",                 hint: "ইলিশ (Ee lish, hilsa fish) / ইট (Eet, brick) / ইচ্ছা (Eech cha, wish)", audio: "" },
    { prompt: "ঈ", answer: "Ee (long)",          hint: "ঈদ (Eed, Eid) / ঈগল (Ee gol, eagle) / ঈর্ষা (Eer sha, envy)", audio: "" },
    { prompt: "উ", answer: "Oo (as in FOOD)",    hint: "উট (Oot, camel) / উকিল (Oo kil, lawyer) / উপর (Oo por, above)", audio: "" },
    { prompt: "ঊ", answer: "Oo (long)",          hint: "ঊষা (Oo sha, dawn) / ঊরু (Oo roo, thigh) / ঊন (Oon, minus/less)", audio: "" },
    { prompt: "ঋ", answer: "Ree",                hint: "ঋতু (Ree too, season) / ঋণ (Reen, debt) / ঋষি (Ree shi, sage)", audio: "" },
    { prompt: "এ", answer: "Eh",                 hint: "এক (Aek, one) / এখন (Eh khon, now) / এবং (Eh bong, and)", audio: "" },
    { prompt: "ঐ", answer: "Oi",                 hint: "ঐ (Oi, that) / ঐক্য (Oik ko, unity) / ঐতিহ্য (Oi tij jho, heritage)", audio: "" },
    { prompt: "ও", answer: "Oh",                 hint: "ওষুধ (Oh shoodh, medicine) / ওজন (Oh jon, weight) / ওপর (Oh por, on/above)", audio: "" },
    { prompt: "ঔ", answer: "Ow (oh-oo)",         hint: "ঔষধ (Ow shodh, medicine) / ঔপন্যাসিক (Ow pon nah shik, novelist) / ঔদার্য (Ow dar jo, generosity)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/alphabet-vowels", title: "Vowels (স্বরবর্ণ)" });
