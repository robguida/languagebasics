/* es / lesson-6 — Spanish Number Builder
 * Applied VERBATIM from the Spanish linguistics dataset review. Keeps the
 * 10-second reveal (revealMs: 10000) and the multi-part answers joined with
 * " | " (rendered as stacked lines by the engine), grouped by scale block.
 * Grammar as delivered: ciento (not cien) inside 105,300; un millón (apocope of
 * uno) in 1,234,567; irregular quinientos (500) in 12,568 / 234,567 / 1,234,567. */
window.LB_LESSON = {
  id: "es/lesson-6",
  title: "Spanish Number Builder",
  revealMs: 10000,
  cards: [
    { prompt: "347",       answer: "trescientos cuarenta y siete",                                                     hint: "Trehs see en tohs Kwah ren tah ee See eh teh", audio: "" },
    { prompt: "1,284",     answer: "mil | doscientos ochenta y cuatro",                                                hint: "Meel Dohs see en tohs Oh chen tah ee Kwah troh", audio: "" },
    { prompt: "12,568",    answer: "doce mil | quinientos sesenta y ocho",                                             hint: "Doh seh meel Kee nyen tohs Seh sen tah ee Oh choh", audio: "" },
    { prompt: "105,300",   answer: "ciento cinco mil | trescientos",                                                   hint: "See en toh Seen koh meel Trehs see en tohs", audio: "" },
    { prompt: "234,567",   answer: "doscientos treinta y cuatro mil | quinientos sesenta y siete",                     hint: "Dohs see en tohs Treyn tah ee Kwah troh meel Kee nyen tohs Seh sen tah ee See eh teh", audio: "" },
    { prompt: "1,234,567", answer: "un millón | doscientos treinta y cuatro mil | quinientos sesenta y siete",        hint: "Oon mee Yohn Dohs see en tohs Treyn tah ee Kwah troh meel Kee nyen tohs Seh sen tah ee See eh teh", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/lesson-6", title: "Spanish Number Builder" });
