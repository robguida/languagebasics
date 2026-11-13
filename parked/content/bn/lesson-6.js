/* bn / lesson-6 — Bengali Number Builder
 * Applied VERBATIM from the Bengali linguistics dataset review. Keeps the
 * 10-second reveal (revealMs: 10000). Each number is read in the South Asian
 * place-grouping (lakh / thousand / hundred / unit); the native form is stacked by
 * spoken place-group with " | " (rendered as stacked lines by the engine), and the
 * final line is the full romanization. The engine auto-shrinks long answers. */
window.LB_LESSON = {
  id: "bn/lesson-6",
  title: "Bengali Number Builder",
  revealMs: 10000,
  cards: [
    { prompt: "347",       answer: "তিনশ | সাতচল্লিশ | tin sho satchollish",                                              hint: "Teen shoh Shat chohl leesh", audio: "" },
    { prompt: "1,284",     answer: "এক হাজার | দুইশ | চুরাশি | ek hajar dui sho churashi",                                hint: "Aek hah jar Doo ee shoh Choo rah shee", audio: "" },
    { prompt: "12,568",    answer: "বারো হাজার | পাঁচশ | আটষট্টি | baro hajar pãch sho atshotti",                          hint: "Bah roh hah jar Pahnch shoh Aht shoht tee", audio: "" },
    { prompt: "105,300",   answer: "এক লাখ | পাঁচ হাজার | তিনশ | ek lakh pãch hajar tin sho",                             hint: "Aek lakh Pahnch hah jar Teen shoh", audio: "" },
    { prompt: "234,567",   answer: "দুই লাখ | চৌত্রিশ হাজার | পাঁচশ সাতষট্টি | dui lakh choutrish hajar pãch sho satshotti", hint: "Doo ee lakh Chow treesh hah jar Pahnch shoh Shat shoht tee", audio: "" },
    { prompt: "1,234,567", answer: "বারো লাখ | চৌত্রিশ হাজার | পাঁচশ সাতষট্টি | baro lakh choutrish hajar pãch sho satshotti", hint: "Bah roh lakh Chow treesh hah jar Pahnch shoh Shat shoht tee", audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/lesson-6", title: "Bengali Number Builder" });
