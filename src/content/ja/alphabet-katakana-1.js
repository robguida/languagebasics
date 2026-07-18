/* ja / alphabet-katakana-1 — Japanese Kana: Katakana (Part 1)
 *
 * LB-32 alphabet (kana) section. INVERSE of the number cards:
 *   prompt = the kana character, answer = the phonetic SOUND (Rob's
 *   plain-English-syllable notation), hint = 3 example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * Part 1 = the base gojuon Vowels + K + S + T + N rows (25 kana). Example words
 * are real katakana loanwords — where you actually meet each kana.
 *
 * Japanese forms + phonetics are owned by the Japanese linguistics dataset
 * review and applied VERBATIM here — engineers do not invent or alter them.
 * Scope: base gojuon only (no dakuten / handakuten / yoon). */
window.LB_LESSON = {
  id: "ja/alphabet-katakana-1",
  title: "Katakana (Part 1)",
  revealMs: 5000,
  cards: [
    { prompt: "ア", answer: "Ah",   hint: "アイス (Ah ee soo, ice cream) / アメリカ (Ah meh ree kah, America) / アニメ (Ah nee meh, anime)", audio: "" },
    { prompt: "イ", answer: "Ee",   hint: "イタリア (Ee tah ree ah, Italy) / インク (Een koo, ink) / イエス (Ee eh soo, yes)", audio: "" },
    { prompt: "ウ", answer: "Oo",   hint: "ウール (Oo roo, wool) / ウーロン (Oo rohn, oolong tea) / ウエスト (Oo eh soo toh, waist)", audio: "" },
    { prompt: "エ", answer: "Eh",   hint: "エアコン (Eh ah kohn, air conditioner) / エンジン (Ehn jeen, engine) / エレベーター (Eh reh beh tah, elevator)", audio: "" },
    { prompt: "オ", answer: "Oh",   hint: "オレンジ (Oh ren jee, orange) / オイル (Oh ee roo, oil) / オーブン (Oh boon, oven)", audio: "" },
    { prompt: "カ", answer: "Kah",  hint: "カメラ (Kah meh rah, camera) / カード (Kah doh, card) / カフェ (Kah feh, café)", audio: "" },
    { prompt: "キ", answer: "Kee",  hint: "キー (Kee, key) / キロ (Kee roh, kilo) / スキー (Soo kee, ski)", audio: "" },
    { prompt: "ク", answer: "Koo",  hint: "クラス (Koo rah soo, class) / クッキー (Kook kee, cookie) / インク (Een koo, ink)", audio: "" },
    { prompt: "ケ", answer: "Keh",  hint: "ケーキ (Keh kee, cake) / ケース (Keh soo, case) / ケチャップ (Keh chah ppoo, ketchup)", audio: "" },
    { prompt: "コ", answer: "Koh",  hint: "コーヒー (Koh hee, coffee) / コート (Koh toh, coat) / チョコ (Choh koh, chocolate)", audio: "" },
    { prompt: "サ", answer: "Sah",  hint: "サラダ (Sah rah dah, salad) / サッカー (Sahk kah, soccer) / サイズ (Sah ee zoo, size)", audio: "" },
    { prompt: "シ", answer: "Shee", hint: "シャツ (Shah tsoo, shirt) / タクシー (Tah koo shee, taxi) / シーツ (Shee tsoo, sheet)", audio: "" },
    { prompt: "ス", answer: "Soo",  hint: "スープ (Soo poo, soup) / スキー (Soo kee, ski) / バス (Bah soo, bus)", audio: "" },
    { prompt: "セ", answer: "Seh",  hint: "セーター (Seh tah, sweater) / セット (Seht toh, set) / センチ (Sen chee, centimeter)", audio: "" },
    { prompt: "ソ", answer: "Soh",  hint: "ソファ (Soh fah, sofa) / ソース (Soh soo, sauce) / ソーセージ (Soh seh jee, sausage)", audio: "" },
    { prompt: "タ", answer: "Tah",  hint: "タクシー (Tah koo shee, taxi) / タオル (Tah oh roo, towel) / ギター (Gee tah, guitar)", audio: "" },
    { prompt: "チ", answer: "Chee", hint: "チーズ (Chee zoo, cheese) / チケット (Chee keht toh, ticket) / チョコ (Choh koh, chocolate)", audio: "" },
    { prompt: "ツ", answer: "Tsoo", hint: "ツアー (Tsoo ah, tour) / スーツ (Soo tsoo, suit) / シャツ (Shah tsoo, shirt)", audio: "" },
    { prompt: "テ", answer: "Teh",  hint: "テレビ (Teh reh bee, TV) / テスト (Teh soo toh, test) / ホテル (Hoh teh roo, hotel)", audio: "" },
    { prompt: "ト", answer: "Toh",  hint: "トマト (Toh mah toh, tomato) / トイレ (Toh ee reh, toilet) / ノート (Noh toh, notebook)", audio: "" },
    { prompt: "ナ", answer: "Nah",  hint: "バナナ (Bah nah nah, banana) / ナイフ (Nah ee foo, knife) / カナダ (Kah nah dah, Canada)", audio: "" },
    { prompt: "ニ", answer: "Nee",  hint: "テニス (Teh nee soo, tennis) / モニター (Moh nee tah, monitor) / ニュース (Nyoo soo, news)", audio: "" },
    { prompt: "ヌ", answer: "Noo",  hint: "ヌードル (Noo doh roo, noodle) / カヌー (Kah noo, canoe) / ヌガー (Noo gah, nougat)", audio: "" },
    { prompt: "ネ", answer: "Neh",  hint: "ネクタイ (Neh koo tah ee, necktie) / ネット (Neht toh, net) / エネルギー (Eh neh roo gee, energy)", audio: "" },
    { prompt: "ノ", answer: "Noh",  hint: "ノート (Noh toh, notebook) / ピアノ (Pee ah noh, piano) / カジノ (Kah jee noh, casino)", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/alphabet-katakana-1", title: "Katakana (Part 1)" });
