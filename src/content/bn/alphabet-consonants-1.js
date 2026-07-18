/* bn / alphabet-consonants-1 — Bengali Script: Consonants (Part 1)
 *
 * LB-33 alphabet (script) section. INVERSE of the number cards:
 *   prompt = the Bengali character, answer = its sound (Rob's plain-English-
 *   syllable notation), hint = 3 native-script example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * The three "hard" (velar / palatal / retroflex) rows: ক-ঙ, চ-ঞ, ট-ণ. Every
 * consonant carries the inherent vowel "ô" (/ɔ/, the "aw" in saw), so ক sounds
 * "Kô", not bare "k" — the answer shows "Kô (k)": how it sounds alone, then the
 * bare consonant value it contributes inside a word.
 *
 * Bengali forms + phonetics are owned by the Bengali linguistics dataset review
 * (Standard Bangladeshi Bengali) and applied VERBATIM here — engineers do not
 * invent or alter them. Scope: base consonant letters only (no conjuncts). */
window.LB_LESSON = {
  id: "bn/alphabet-consonants-1",
  title: "Consonants (Part 1)",
  revealMs: 5000,
  cards: [
    { prompt: "ক", answer: "Kô (k)",                  hint: "কলম (Koh lom, pen) / কাক (Kak, crow) / কথা (Koh tha, word/talk)", audio: "" },
    { prompt: "খ", answer: "Khô (kh)",                hint: "খাবার (Kha bar, food) / খবর (Kho bor, news) / খুশি (Khoo shi, happy)", audio: "" },
    { prompt: "গ", answer: "Gô (g)",                  hint: "গরু (Goh roo, cow) / গান (Gan, song) / গাছ (Gach, tree)", audio: "" },
    { prompt: "ঘ", answer: "Ghô (gh)",                hint: "ঘর (Ghor, room/house) / ঘড়ি (Gho ri, clock) / ঘুম (Ghoom, sleep)", audio: "" },
    { prompt: "ঙ", answer: "Ngô (ng, as in SING)",    hint: "রঙ (Rong, color) / বাঙালি (Bang gah li, Bengali person) / অঙ্ক (Ong ko, math)", audio: "" },
    { prompt: "চ", answer: "Chô (ch)",                hint: "চা (Cha, tea) / চাঁদ (Chad, moon) / চোখ (Chokh, eye)", audio: "" },
    { prompt: "ছ", answer: "Chhô (chh)",              hint: "ছবি (Cho bi, picture) / ছাতা (Cha ta, umbrella) / ছেলে (Cheh le, boy)", audio: "" },
    { prompt: "জ", answer: "Jô (j)",                  hint: "জল (Jol, water) / জামা (Ja ma, shirt) / জানালা (Ja na la, window)", audio: "" },
    { prompt: "ঝ", answer: "Jhô (jh)",                hint: "ঝড় (Jhor, storm) / ঝর্না (Jhor na, waterfall) / ঝাল (Jhal, spicy)", audio: "" },
    { prompt: "ঞ", answer: "Nyô (ny, only in clusters)", hint: "জ্ঞান (Gyan, knowledge) / মঞ্চ (Mon cho, stage) / পঞ্চ (Pon cho, five)", audio: "" },
    { prompt: "ট", answer: "Tô (hard T)",             hint: "টাকা (Ta ka, money) / টেবিল (Teh bil, table) / টুপি (Too pi, cap)", audio: "" },
    { prompt: "ঠ", answer: "Thô (hard Th)",           hint: "ঠোঁট (Thoat, lips) / ঠান্ডা (Than da, cold) / ঠিক (Thik, correct)", audio: "" },
    { prompt: "ড", answer: "Dô (hard D)",             hint: "ডাক (Dak, call/post) / ডিম (Dim, egg) / ডাক্তার (Dak tar, doctor)", audio: "" },
    { prompt: "ঢ", answer: "Dhô (hard Dh)",           hint: "ঢাকা (Dha ka, Dhaka) / ঢোল (Dhol, drum) / ঢেউ (Dheu, wave)", audio: "" },
    { prompt: "ণ", answer: "Nô (n, retroflex)",       hint: "রামায়ণ (Rah mah yon, Ramayana) / বর্ণ (Bor no, letter) / কারণ (Kah ron, reason)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/alphabet-consonants-1", title: "Consonants (Part 1)" });
