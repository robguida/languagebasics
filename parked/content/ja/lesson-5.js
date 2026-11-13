/* ja / lesson-5 — Japanese Big Number Roots (roots × multipliers 1-9)
 * Applied VERBATIM from the Japanese linguistics dataset review.
 *   6 root families (hundreds, thousands, millions, billions, trillions,
 *   quadrillions) × 9 multipliers = 54, PLUS the 2 standalone myriad roots
 *   10,000 and 100,000 = 56 total.
 * MYRIAD grouping applied per the dataset: Japanese counts in powers of 10,000
 *   (万 man = 10^4, 億 oku = 10^8, 兆 chou = 10^12). So 1,000,000 = 百万 hyaku-man
 *   and 1,000,000,000 = 十億 juu-oku — NOT Western place-grouping. Irregulars kept
 *   as delivered (memorized rendaku/gemination): 300 = san-byaku, 600 = roppyaku,
 *   800 = happyaku, 3,000 = san-zen, 8,000 = hassen, 1T = icchou, 8T = hatchou,
 *   and the million/quadrillion rows inherit the same changes. 10,000 MUST keep
 *   its digit (一万 ichi-man), unlike bare sen (1,000). Answer stacks kanji | romaji
 *   via the engine's " | " separator; prompts stay comma-formatted strings,
 *   byte-identical to the reference deck. */
window.LB_LESSON = {
  id: "ja/lesson-5",
  title: "Japanese Big Number Roots",
  revealMs: 5000,
  cards: [
    /* Hundreds — 百 hyaku */
    { prompt: "100", answer: "百 | hyaku",       hint: "Hyah koo",         audio: "" },
    { prompt: "200", answer: "二百 | ni-hyaku",  hint: "Nee hyah koo",     audio: "" },
    { prompt: "300", answer: "三百 | san-byaku", hint: "Sahn byah koo",    audio: "" },
    { prompt: "400", answer: "四百 | yon-hyaku", hint: "Yohn hyah koo",    audio: "" },
    { prompt: "500", answer: "五百 | go-hyaku",  hint: "Goh hyah koo",     audio: "" },
    { prompt: "600", answer: "六百 | roppyaku",  hint: "Rohp pyah koo",    audio: "" },
    { prompt: "700", answer: "七百 | nana-hyaku", hint: "Nah nah hyah koo", audio: "" },
    { prompt: "800", answer: "八百 | happyaku",  hint: "Hahp pyah koo",    audio: "" },
    { prompt: "900", answer: "九百 | kyuu-hyaku", hint: "Kyoo hyah koo",   audio: "" },

    /* Thousands — 千 sen */
    { prompt: "1,000", answer: "千 | sen",       hint: "Sen",          audio: "" },
    { prompt: "2,000", answer: "二千 | ni-sen",  hint: "Nee sen",      audio: "" },
    { prompt: "3,000", answer: "三千 | san-zen", hint: "Sahn zen",     audio: "" },
    { prompt: "4,000", answer: "四千 | yon-sen", hint: "Yohn sen",     audio: "" },
    { prompt: "5,000", answer: "五千 | go-sen",  hint: "Goh sen",      audio: "" },
    { prompt: "6,000", answer: "六千 | roku-sen", hint: "Roh koo sen", audio: "" },
    { prompt: "7,000", answer: "七千 | nana-sen", hint: "Nah nah sen", audio: "" },
    { prompt: "8,000", answer: "八千 | hassen",  hint: "Hahs sen",     audio: "" },
    { prompt: "9,000", answer: "九千 | kyuu-sen", hint: "Kyoo sen",    audio: "" },

    /* Millions — 百万 hyaku-man (100 × 10^4) */
    { prompt: "1,000,000", answer: "百万 | hyaku-man",       hint: "Hyah koo mahn",         audio: "" },
    { prompt: "2,000,000", answer: "二百万 | ni-hyaku-man",  hint: "Nee hyah koo mahn",     audio: "" },
    { prompt: "3,000,000", answer: "三百万 | san-byaku-man", hint: "Sahn byah koo mahn",    audio: "" },
    { prompt: "4,000,000", answer: "四百万 | yon-hyaku-man", hint: "Yohn hyah koo mahn",    audio: "" },
    { prompt: "5,000,000", answer: "五百万 | go-hyaku-man",  hint: "Goh hyah koo mahn",     audio: "" },
    { prompt: "6,000,000", answer: "六百万 | roppyaku-man",  hint: "Rohp pyah koo mahn",    audio: "" },
    { prompt: "7,000,000", answer: "七百万 | nana-hyaku-man", hint: "Nah nah hyah koo mahn", audio: "" },
    { prompt: "8,000,000", answer: "八百万 | happyaku-man",  hint: "Hahp pyah koo mahn",    audio: "" },
    { prompt: "9,000,000", answer: "九百万 | kyuu-hyaku-man", hint: "Kyoo hyah koo mahn",   audio: "" },

    /* Billions — 十億 juu-oku (10 × 10^8) */
    { prompt: "1,000,000,000", answer: "十億 | juu-oku",       hint: "Joo oh koo",           audio: "" },
    { prompt: "2,000,000,000", answer: "二十億 | ni-juu-oku",  hint: "Nee joo oh koo",       audio: "" },
    { prompt: "3,000,000,000", answer: "三十億 | san-juu-oku", hint: "Sahn joo oh koo",      audio: "" },
    { prompt: "4,000,000,000", answer: "四十億 | yon-juu-oku", hint: "Yohn joo oh koo",      audio: "" },
    { prompt: "5,000,000,000", answer: "五十億 | go-juu-oku",  hint: "Goh joo oh koo",       audio: "" },
    { prompt: "6,000,000,000", answer: "六十億 | roku-juu-oku", hint: "Roh koo joo oh koo",  audio: "" },
    { prompt: "7,000,000,000", answer: "七十億 | nana-juu-oku", hint: "Nah nah joo oh koo",  audio: "" },
    { prompt: "8,000,000,000", answer: "八十億 | hachi-juu-oku", hint: "Hah chee joo oh koo", audio: "" },
    { prompt: "9,000,000,000", answer: "九十億 | kyuu-juu-oku", hint: "Kyoo joo oh koo",     audio: "" },

    /* Trillions — 兆 chou (10^12) */
    { prompt: "1 trillion", answer: "一兆 | icchou",     hint: "Eet choh",      audio: "" },
    { prompt: "2 trillion", answer: "二兆 | ni-chou",    hint: "Nee choh",      audio: "" },
    { prompt: "3 trillion", answer: "三兆 | san-chou",   hint: "Sahn choh",     audio: "" },
    { prompt: "4 trillion", answer: "四兆 | yon-chou",   hint: "Yohn choh",     audio: "" },
    { prompt: "5 trillion", answer: "五兆 | go-chou",    hint: "Goh choh",      audio: "" },
    { prompt: "6 trillion", answer: "六兆 | roku-chou",  hint: "Roh koo choh",  audio: "" },
    { prompt: "7 trillion", answer: "七兆 | nana-chou",  hint: "Nah nah choh",  audio: "" },
    { prompt: "8 trillion", answer: "八兆 | hatchou",    hint: "Haht choh",     audio: "" },
    { prompt: "9 trillion", answer: "九兆 | kyuu-chou",  hint: "Kyoo choh",     audio: "" },

    /* Quadrillions — 千兆 sen-chou (1,000 × 10^12 = 10^15) */
    { prompt: "1 quadrillion", answer: "千兆 | sen-chou",       hint: "Sen choh",          audio: "" },
    { prompt: "2 quadrillion", answer: "二千兆 | ni-sen-chou",  hint: "Nee sen choh",      audio: "" },
    { prompt: "3 quadrillion", answer: "三千兆 | san-zen-chou", hint: "Sahn zen choh",     audio: "" },
    { prompt: "4 quadrillion", answer: "四千兆 | yon-sen-chou", hint: "Yohn sen choh",     audio: "" },
    { prompt: "5 quadrillion", answer: "五千兆 | go-sen-chou",  hint: "Goh sen choh",      audio: "" },
    { prompt: "6 quadrillion", answer: "六千兆 | roku-sen-chou", hint: "Roh koo sen choh", audio: "" },
    { prompt: "7 quadrillion", answer: "七千兆 | nana-sen-chou", hint: "Nah nah sen choh", audio: "" },
    { prompt: "8 quadrillion", answer: "八千兆 | hassen-chou",  hint: "Hahs sen choh",     audio: "" },
    { prompt: "9 quadrillion", answer: "九千兆 | kyuu-sen-chou", hint: "Kyoo sen choh",    audio: "" },

    /* The two lone myriad roots */
    { prompt: "10,000",  answer: "一万 | ichi-man", hint: "Ee chee mahn", audio: "" },
    { prompt: "100,000", answer: "十万 | juu-man",  hint: "Joo mahn",     audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "ja/lesson-5", title: "Japanese Big Number Roots" });
