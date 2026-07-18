/* ja / alphabet-hiragana-2 — Japanese Kana: Hiragana (Part 2)
 *
 * LB-32 alphabet (kana) section. INVERSE of the number cards:
 *   prompt = the kana character, answer = the phonetic SOUND (Rob's
 *   plain-English-syllable notation), hint = 3 example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * Part 2 = the base gojuon H + M + Y + R + W rows + ん (21 kana). Example words
 * are written in hiragana, matching the script being learned. を and ん carry
 * authored note-style hints (object-marker particle; the moraic "n").
 *
 * Japanese forms + phonetics are owned by the Japanese linguistics dataset
 * review and applied VERBATIM here — engineers do not invent or alter them.
 * Scope: base gojuon only (no dakuten / handakuten / yoon). */
window.LB_LESSON = {
  id: "ja/alphabet-hiragana-2",
  title: "Hiragana (Part 2)",
  revealMs: 5000,
  cards: [
    { prompt: "は", answer: "Hah",     hint: "はな (Hah nah, flower) / はし (Hah shee, bridge) / はは (Hah hah, mother)", audio: "" },
    { prompt: "ひ", answer: "Hee",     hint: "ひと (Hee toh, person) / ひ (Hee, fire) / ひる (Hee roo, noon)", audio: "" },
    { prompt: "ふ", answer: "Foo",     hint: "ふね (Foo neh, boat) / ふゆ (Foo yoo, winter) / ふろ (Foo roh, bath)", audio: "" },
    { prompt: "へ", answer: "Heh",     hint: "へや (Heh yah, room) / へび (Heh bee, snake) / へた (Heh tah, unskilled)", audio: "" },
    { prompt: "ほ", answer: "Hoh",     hint: "ほし (Hoh shee, star) / ほん (Hohn, book) / ほね (Hoh neh, bone)", audio: "" },
    { prompt: "ま", answer: "Mah",     hint: "まど (Mah doh, window) / まち (Mah chee, town) / あたま (Ah tah mah, head)", audio: "" },
    { prompt: "み", answer: "Mee",     hint: "みず (Mee zoo, water) / みみ (Mee mee, ear) / みち (Mee chee, road)", audio: "" },
    { prompt: "む", answer: "Moo",     hint: "むし (Moo shee, insect) / むら (Moo rah, village) / むすめ (Moo soo meh, daughter)", audio: "" },
    { prompt: "め", answer: "Meh",     hint: "め (Meh, eye) / あめ (Ah meh, rain) / ゆめ (Yoo meh, dream)", audio: "" },
    { prompt: "も", answer: "Moh",     hint: "もり (Moh ree, forest) / もの (Moh noh, thing) / くも (Koo moh, cloud)", audio: "" },
    { prompt: "や", answer: "Yah",     hint: "やま (Yah mah, mountain) / やさい (Yah sah ee, vegetable) / へや (Heh yah, room)", audio: "" },
    { prompt: "ゆ", answer: "Yoo",     hint: "ゆき (Yoo kee, snow) / ゆび (Yoo bee, finger) / ふゆ (Foo yoo, winter)", audio: "" },
    { prompt: "よ", answer: "Yoh",     hint: "よる (Yoh roo, night) / よん (Yohn, four) / ひよこ (Hee yoh koh, chick)", audio: "" },
    { prompt: "ら", answer: "Rah",     hint: "さくら (Sah koo rah, cherry blossom) / そら (Soh rah, sky) / ばら (Bah rah, rose)", audio: "" },
    { prompt: "り", answer: "Ree",     hint: "とり (Toh ree, bird) / りす (Ree soo, squirrel) / くすり (Koo soo ree, medicine)", audio: "" },
    { prompt: "る", answer: "Roo",     hint: "くるま (Koo roo mah, car) / はる (Hah roo, spring) / よる (Yoh roo, night)", audio: "" },
    { prompt: "れ", answer: "Reh",     hint: "れい (Ray, zero) / はれ (Hah reh, clear weather) / これ (Koh reh, this)", audio: "" },
    { prompt: "ろ", answer: "Roh",     hint: "ろく (Roh koo, six) / しろ (Shee roh, white) / ふろ (Foo roh, bath)", audio: "" },
    { prompt: "わ", answer: "Wah",     hint: "わたし (Wah tah shee, I, me) / かわ (Kah wah, river) / にわ (Nee wah, garden)", audio: "" },
    { prompt: "を", answer: "Oh (wo)", hint: "ほんをよむ (Hohn oh yoh moo, read a book) / みずをのむ (Mee zoo oh noh moo, drink water) / てをあらう (Teh oh ah rah oo, wash hands) — object-marker particle, said \"Oh\"", audio: "" },
    { prompt: "ん", answer: "N",       hint: "ほん (Hohn, book) / みかん (Mee kahn, mandarin orange) / でんわ (Den wah, telephone) — the moraic \"n\", never starts a word", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/alphabet-hiragana-2", title: "Hiragana (Part 2)" });
