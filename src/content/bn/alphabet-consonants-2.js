/* bn / alphabet-consonants-2 — Bengali Script: Consonants (Part 2)
 *
 * LB-33 alphabet (script) section. INVERSE of the number cards:
 *   prompt = the Bengali character, answer = its sound (Rob's plain-English-
 *   syllable notation), hint = 3 native-script example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * The "soft" dental + labial rows plus the semivowels, sibilants, and h:
 * ত-ন, প-ম, য র ল, শ ষ স, হ. Every consonant carries the inherent vowel "ô"
 * (/ɔ/, the "aw" in saw), so the answer shows "Tô (soft t)": how it sounds
 * alone, then the bare consonant value it contributes inside a word. In the
 * Bangladeshi standard শ / ষ / স all say "sh" (স also "s" inside clusters).
 *
 * Bengali forms + phonetics are owned by the Bengali linguistics dataset review
 * (Standard Bangladeshi Bengali) and applied VERBATIM here — engineers do not
 * invent or alter them. Scope: base consonant letters only (no conjuncts). */
window.LB_LESSON = {
  id: "bn/alphabet-consonants-2",
  title: "Consonants (Part 2)",
  revealMs: 5000,
  cards: [
    { prompt: "ত", answer: "Tô (soft t)",              hint: "তারা (Ta ra, star/they) / তিন (Teen, three) / তুমি (Too mi, you)", audio: "" },
    { prompt: "থ", answer: "Thô (soft th)",            hint: "থালা (Tha la, plate) / থামা (Tha ma, stop) / থাকা (Tha ka, to stay)", audio: "" },
    { prompt: "দ", answer: "Dô (soft d)",              hint: "দিন (Deen, day) / দরজা (Dor ja, door) / দুধ (Doodh, milk)", audio: "" },
    { prompt: "ধ", answer: "Dhô (soft dh)",            hint: "ধান (Dhan, paddy rice) / ধরা (Dho ra, to catch) / ধোঁয়া (Dhoã, smoke)", audio: "" },
    { prompt: "ন", answer: "Nô (n)",                   hint: "নাম (Nam, name) / নদী (Noh dee, river) / নতুন (Noh toon, new)", audio: "" },
    { prompt: "প", answer: "Pô (p)",                   hint: "পানি (Pah ni, water) / পা (Pa, foot) / পাখি (Pah khi, bird)", audio: "" },
    { prompt: "ফ", answer: "Phô (ph / f)",             hint: "ফল (Phol, fruit) / ফুল (Phool, flower) / ফোন (Phone, phone)", audio: "" },
    { prompt: "ব", answer: "Bô (b)",                   hint: "বই (Boi, book) / বাবা (Ba ba, father) / বাড়ি (Ba ri, home)", audio: "" },
    { prompt: "ভ", answer: "Bhô (bh)",                 hint: "ভাত (Bhat, cooked rice) / ভাই (Bhai, brother) / ভালো (Bha lo, good)", audio: "" },
    { prompt: "ম", answer: "Mô (m)",                   hint: "মা (Ma, mother) / মাছ (Mach, fish) / মানুষ (Ma noosh, person)", audio: "" },
    { prompt: "য", answer: "Jô (j)",                   hint: "যদি (Joh di, if) / যাওয়া (Ja oh a, to go) / যুদ্ধ (Jood dho, war)", audio: "" },
    { prompt: "র", answer: "Rô (r)",                   hint: "রাত (Rat, night) / রাজা (Ra ja, king) / রাস্তা (Rash ta, road)", audio: "" },
    { prompt: "ল", answer: "Lô (l)",                   hint: "লাল (Lal, red) / লেবু (Leh boo, lemon) / লম্বা (Lom ba, tall)", audio: "" },
    { prompt: "শ", answer: "Shô (sh)",                 hint: "শহর (Shoh hor, city) / শাড়ি (Sha ri, sari) / শীত (Sheet, winter)", audio: "" },
    { prompt: "ষ", answer: "Shô (sh, retroflex)",      hint: "ষাঁড় (Shar, bull) / ভাষা (Bha sha, language) / মানুষ (Ma noosh, person)", audio: "" },
    { prompt: "স", answer: "Shô (sh; \"s\" in clusters)", hint: "সকাল (Shoh kal, morning) / সাত (Shat, seven) / স্কুল (Skool, school)", audio: "" },
    { prompt: "হ", answer: "Hô (h)",                   hint: "হাত (Hat, hand) / হাতি (Ha ti, elephant) / হলুদ (Ho lood, yellow)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/alphabet-consonants-2", title: "Consonants (Part 2)" });
