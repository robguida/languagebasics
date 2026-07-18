/* ja / alphabet-hiragana-1 — Japanese Kana: Hiragana (Part 1)
 *
 * LB-32 alphabet (kana) section. INVERSE of the number cards:
 *   prompt = the kana character, answer = the phonetic SOUND (Rob's
 *   plain-English-syllable notation), hint = 3 example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * Part 1 = the base gojuon Vowels + K + S + T + N rows (25 kana). Example words
 * are written in hiragana, matching the script being learned.
 *
 * Japanese forms + phonetics are owned by the Japanese linguistics dataset
 * review and applied VERBATIM here — engineers do not invent or alter them.
 * Scope: base gojuon only (no dakuten / handakuten / yoon). */
window.LB_LESSON = {
  id: "ja/alphabet-hiragana-1",
  title: "Hiragana (Part 1)",
  revealMs: 5000,
  cards: [
    { prompt: "あ", answer: "Ah",   hint: "あさ (Ah sah, morning) / あめ (Ah meh, rain) / あい (Ah ee, love)", audio: "" },
    { prompt: "い", answer: "Ee",   hint: "いぬ (Ee noo, dog) / いえ (Ee eh, house) / いち (Ee chee, one)", audio: "" },
    { prompt: "う", answer: "Oo",   hint: "うみ (Oo mee, sea) / うし (Oo shee, cow) / うた (Oo tah, song)", audio: "" },
    { prompt: "え", answer: "Eh",   hint: "えき (Eh kee, station) / えん (Ehn, yen) / えほん (Eh hohn, picture book)", audio: "" },
    { prompt: "お", answer: "Oh",   hint: "おかね (Oh kah neh, money) / おちゃ (Oh chah, tea) / おと (Oh toh, sound)", audio: "" },
    { prompt: "か", answer: "Kah",  hint: "かさ (Kah sah, umbrella) / かわ (Kah wah, river) / かお (Kah oh, face)", audio: "" },
    { prompt: "き", answer: "Kee",  hint: "き (Kee, tree) / きって (Keet teh, stamp) / きく (Kee koo, to listen)", audio: "" },
    { prompt: "く", answer: "Koo",  hint: "くつ (Koo tsoo, shoes) / くち (Koo chee, mouth) / くも (Koo moh, cloud)", audio: "" },
    { prompt: "け", answer: "Keh",  hint: "けむり (Keh moo ree, smoke) / けさ (Keh sah, this morning) / いけ (Ee keh, pond)", audio: "" },
    { prompt: "こ", answer: "Koh",  hint: "こども (Koh doh moh, child) / ここ (Koh koh, here) / こえ (Koh eh, voice)", audio: "" },
    { prompt: "さ", answer: "Sah",  hint: "さかな (Sah kah nah, fish) / さくら (Sah koo rah, cherry blossom) / さる (Sah roo, monkey)", audio: "" },
    { prompt: "し", answer: "Shee", hint: "しま (Shee mah, island) / しろ (Shee roh, white) / あし (Ah shee, foot)", audio: "" },
    { prompt: "す", answer: "Soo",  hint: "すし (Soo shee, sushi) / すいか (Soo ee kah, watermelon) / すず (Soo zoo, bell)", audio: "" },
    { prompt: "せ", answer: "Seh",  hint: "せかい (Seh kah ee, world) / せなか (Seh nah kah, back) / みせ (Mee seh, shop)", audio: "" },
    { prompt: "そ", answer: "Soh",  hint: "そら (Soh rah, sky) / そと (Soh toh, outside) / みそ (Mee soh, miso)", audio: "" },
    { prompt: "た", answer: "Tah",  hint: "たまご (Tah mah goh, egg) / たけ (Tah keh, bamboo) / はた (Hah tah, flag)", audio: "" },
    { prompt: "ち", answer: "Chee", hint: "ちち (Chee chee, father) / ちず (Chee zoo, map) / くち (Koo chee, mouth)", audio: "" },
    { prompt: "つ", answer: "Tsoo", hint: "つき (Tsoo kee, moon) / つくえ (Tsoo koo eh, desk) / なつ (Nah tsoo, summer)", audio: "" },
    { prompt: "て", answer: "Teh",  hint: "て (Teh, hand) / てがみ (Teh gah mee, letter) / てら (Teh rah, temple)", audio: "" },
    { prompt: "と", answer: "Toh",  hint: "とり (Toh ree, bird) / とけい (Toh keh, clock) / ひと (Hee toh, person)", audio: "" },
    { prompt: "な", answer: "Nah",  hint: "なつ (Nah tsoo, summer) / なまえ (Nah mah eh, name) / はな (Hah nah, flower)", audio: "" },
    { prompt: "に", answer: "Nee",  hint: "にく (Nee koo, meat) / にわ (Nee wah, garden) / かに (Kah nee, crab)", audio: "" },
    { prompt: "ぬ", answer: "Noo",  hint: "いぬ (Ee noo, dog) / ぬの (Noo noh, cloth) / ぬま (Noo mah, swamp)", audio: "" },
    { prompt: "ね", answer: "Neh",  hint: "ねこ (Neh koh, cat) / おかね (Oh kah neh, money) / むね (Moo neh, chest)", audio: "" },
    { prompt: "の", answer: "Noh",  hint: "のり (Noh ree, seaweed) / きのこ (Kee noh koh, mushroom) / もの (Moh noh, thing)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/alphabet-hiragana-1", title: "Hiragana (Part 1)" });
