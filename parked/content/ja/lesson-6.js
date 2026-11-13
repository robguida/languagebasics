/* ja / lesson-6 — Japanese Number Builder
 * Applied VERBATIM from the Japanese linguistics dataset review. Keeps the
 * 10-second reveal (revealMs: 10000). The answer stacks with the engine's " | "
 * separator: line 1 = full kanji, then ONE romaji line per MYRIAD group. Japanese
 * chunks by 万/億/兆, so the split lands on the myriad boundary (10,000) — this
 * differs from the thousand-based split other decks use, and that difference is
 * the point of teaching Japanese grouping. Hint = full pronunciation, one string. */
window.LB_LESSON = {
  id: "ja/lesson-6",
  title: "Japanese Number Builder",
  revealMs: 10000,
  cards: [
    { prompt: "347",       answer: "三百四十七 | sanbyaku yonjuu nana",                          hint: "Sahn byah koo Yohn joo Nah nah", audio: "" },
    { prompt: "1,284",     answer: "千二百八十四 | sen nihyaku hachijuu yon",                     hint: "Sen Nee hyah koo Hah chee joo Yohn", audio: "" },
    { prompt: "12,568",    answer: "一万二千五百六十八 | ichiman | nisen gohyaku rokujuu hachi",  hint: "Ee chee mahn Nee sen Goh hyah koo Roh koo joo Hah chee", audio: "" },
    { prompt: "105,300",   answer: "十万五千三百 | juuman | gosen sanbyaku",                       hint: "Joo mahn Goh sen Sahn byah koo", audio: "" },
    { prompt: "234,567",   answer: "二十三万四千五百六十七 | nijuusan-man | yonsen gohyaku rokujuu nana", hint: "Nee joo sahn mahn Yohn sen Goh hyah koo Roh koo joo Nah nah", audio: "" },
    { prompt: "1,234,567", answer: "百二十三万四千五百六十七 | hyaku-nijuusan-man | yonsen gohyaku rokujuu nana", hint: "Hyah koo nee joo sahn mahn Yohn sen Goh hyah koo Roh koo joo Nah nah", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/lesson-6", title: "Japanese Number Builder" });
