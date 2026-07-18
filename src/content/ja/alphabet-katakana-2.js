/* ja / alphabet-katakana-2 — Japanese Kana: Katakana (Part 2)
 *
 * LB-32 alphabet (kana) section. INVERSE of the number cards:
 *   prompt = the kana character, answer = the phonetic SOUND (Rob's
 *   plain-English-syllable notation), hint = 3 example words.
 * Each hint example is "word (Phonetic, gloss)"; examples are separated by
 * " / " (the LBHint delimiter — NOT the answer field's " | " line separator).
 * The engine rotates which single example shows across repeated views.
 *
 * Part 2 = the base gojuon H + M + Y + R + W rows + ン (21 kana). Example words
 * are real katakana loanwords. ヲ is effectively obsolete (an authored note-style
 * hint, kept for gojuon completeness); ン carries the moraic "n" note.
 *
 * Japanese forms + phonetics are owned by the Japanese linguistics dataset
 * review and applied VERBATIM here — engineers do not invent or alter them.
 * Scope: base gojuon only (no dakuten / handakuten / yoon). */
window.LB_LESSON = {
  id: "ja/alphabet-katakana-2",
  title: "Katakana (Part 2)",
  revealMs: 5000,
  cards: [
    { prompt: "ハ", answer: "Hah",     hint: "ハンバーガー (Hahn bah gah, hamburger) / ハム (Hah moo, ham) / ハート (Hah toh, heart)", audio: "" },
    { prompt: "ヒ", answer: "Hee",     hint: "コーヒー (Koh hee, coffee) / ヒーター (Hee tah, heater) / ヒント (Heen toh, hint)", audio: "" },
    { prompt: "フ", answer: "Foo",     hint: "フォーク (Foh koo, fork) / フルーツ (Foo roo tsoo, fruit) / ナイフ (Nah ee foo, knife)", audio: "" },
    { prompt: "ヘ", answer: "Heh",     hint: "ヘルメット (Heh roo meht toh, helmet) / ヘア (Heh ah, hair) / ヘリコプター (Heh ree koh poo tah, helicopter)", audio: "" },
    { prompt: "ホ", answer: "Hoh",     hint: "ホテル (Hoh teh roo, hotel) / ホーム (Hoh moo, platform) / スマホ (Soo mah hoh, smartphone)", audio: "" },
    { prompt: "マ", answer: "Mah",     hint: "トマト (Toh mah toh, tomato) / マスク (Mah soo koo, mask) / マイク (Mah ee koo, microphone)", audio: "" },
    { prompt: "ミ", answer: "Mee",     hint: "ミルク (Mee roo koo, milk) / ミス (Mee soo, mistake) / ビタミン (Bee tah meen, vitamin)", audio: "" },
    { prompt: "ム", answer: "Moo",     hint: "ゲーム (Geh moo, game) / ガム (Gah moo, gum) / ホーム (Hoh moo, platform)", audio: "" },
    { prompt: "メ", answer: "Meh",     hint: "メニュー (Meh nyoo, menu) / メール (Meh roo, email) / カメラ (Kah meh rah, camera)", audio: "" },
    { prompt: "モ", answer: "Moh",     hint: "メモ (Meh moh, memo) / モデル (Moh deh roo, model) / リモコン (Ree moh kohn, remote)", audio: "" },
    { prompt: "ヤ", answer: "Yah",     hint: "タイヤ (Tah ee yah, tire) / ダイヤ (Dah ee yah, diamond) / イヤホン (Ee yah hohn, earphone)", audio: "" },
    { prompt: "ユ", answer: "Yoo",     hint: "ユニフォーム (Yoo nee foh moo, uniform) / メニュー (Meh nyoo, menu) / ユーモア (Yoo moh ah, humor)", audio: "" },
    { prompt: "ヨ", answer: "Yoh",     hint: "ヨーグルト (Yoh goo roo toh, yogurt) / ヨガ (Yoh gah, yoga) / ヨーロッパ (Yoh rohp pah, Europe)", audio: "" },
    { prompt: "ラ", answer: "Rah",     hint: "ラジオ (Rah jee oh, radio) / カメラ (Kah meh rah, camera) / サラダ (Sah rah dah, salad)", audio: "" },
    { prompt: "リ", answer: "Ree",     hint: "リボン (Ree bohn, ribbon) / アメリカ (Ah meh ree kah, America) / カロリー (Kah roh ree, calorie)", audio: "" },
    { prompt: "ル", answer: "Roo",     hint: "ホテル (Hoh teh roo, hotel) / ビール (Bee roo, beer) / テーブル (Teh boo roo, table)", audio: "" },
    { prompt: "レ", answer: "Reh",     hint: "レストラン (Reh soo toh rahn, restaurant) / レモン (Reh mohn, lemon) / カレー (Kah reh, curry)", audio: "" },
    { prompt: "ロ", answer: "Roh",     hint: "メロン (Meh rohn, melon) / ロボット (Roh boht toh, robot) / プロ (Poo roh, pro)", audio: "" },
    { prompt: "ワ", answer: "Wah",     hint: "ワイン (Wah een, wine) / ワイシャツ (Wah ee shah tsoo, dress shirt) / ハワイ (Hah wah ee, Hawaii)", audio: "" },
    { prompt: "ヲ", answer: "Oh (wo)", hint: "Rarely used in modern Japanese — same sound as オ (\"Oh\"). Appears only in stylized or archaic text; the everyday object-particle \"wo\" is written in hiragana を, not ヲ. Kept here for gojuon completeness.", audio: "" },
    { prompt: "ン", answer: "N",       hint: "パン (Pahn, bread) / ペン (Pehn, pen) / ボタン (Boh tahn, button) — the moraic \"n\", never starts a word", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/alphabet-katakana-2", title: "Katakana (Part 2)" });
