/* es / lesson-5 — Spanish Big Number Roots (roots × multipliers 1-9)
 * Applied VERBATIM from the Spanish linguistics dataset review.
 *   6 root families (hundreds, thousands, millions, billions, trillions,
 *   quadrillions) × 9 multipliers = 54, PLUS the 2 standalone cards 10,000 and
 *   100,000 = 56 total.
 * Long-scale convention applied per the dataset: 10^9 (English "billion") =
 *   "mil millones"; 10^12 (English "trillion") = "billón"; 10^15 (English
 *   "quadrillion") = "mil billones". Irregular hundreds kept as delivered:
 *   quinientos (500), setecientos (700), novecientos (900). Accents preserved
 *   (millón, billón; plurals drop the accent: millones, billones). Prompts stay
 *   comma-formatted strings, byte-identical to the reference deck. */
window.LB_LESSON = {
  id: "es/lesson-5",
  title: "Spanish Big Number Roots",
  revealMs: 5000,
  cards: [
    /* Hundreds 100–900 */
    { prompt: "100", answer: "cien",          hint: "See en",            audio: "" },
    { prompt: "200", answer: "doscientos",    hint: "Dohs see en tohs",  audio: "" },
    { prompt: "300", answer: "trescientos",   hint: "Trehs see en tohs", audio: "" },
    { prompt: "400", answer: "cuatrocientos", hint: "Kwah troh see en tohs", audio: "" },
    { prompt: "500", answer: "quinientos",    hint: "Kee nyen tohs",     audio: "" },
    { prompt: "600", answer: "seiscientos",   hint: "Seys see en tohs",  audio: "" },
    { prompt: "700", answer: "setecientos",   hint: "Seh teh see en tohs", audio: "" },
    { prompt: "800", answer: "ochocientos",   hint: "Oh choh see en tohs", audio: "" },
    { prompt: "900", answer: "novecientos",   hint: "Noh veh see en tohs", audio: "" },

    /* Thousands 1,000–9,000 */
    { prompt: "1,000", answer: "mil",         hint: "Meel",            audio: "" },
    { prompt: "2,000", answer: "dos mil",     hint: "Dohs meel",       audio: "" },
    { prompt: "3,000", answer: "tres mil",    hint: "Trehs meel",      audio: "" },
    { prompt: "4,000", answer: "cuatro mil",  hint: "Kwah troh meel",  audio: "" },
    { prompt: "5,000", answer: "cinco mil",   hint: "Seen koh meel",   audio: "" },
    { prompt: "6,000", answer: "seis mil",    hint: "Seys meel",       audio: "" },
    { prompt: "7,000", answer: "siete mil",   hint: "See eh teh meel", audio: "" },
    { prompt: "8,000", answer: "ocho mil",    hint: "Oh choh meel",    audio: "" },
    { prompt: "9,000", answer: "nueve mil",   hint: "Nweh veh meel",   audio: "" },

    /* Millions 1M–9M (10^6) */
    { prompt: "1,000,000", answer: "un millón",      hint: "Oon mee Yohn",         audio: "" },
    { prompt: "2,000,000", answer: "dos millones",   hint: "Dohs mee Yoh nehs",    audio: "" },
    { prompt: "3,000,000", answer: "tres millones",  hint: "Trehs mee Yoh nehs",   audio: "" },
    { prompt: "4,000,000", answer: "cuatro millones", hint: "Kwah troh mee Yoh nehs", audio: "" },
    { prompt: "5,000,000", answer: "cinco millones", hint: "Seen koh mee Yoh nehs", audio: "" },
    { prompt: "6,000,000", answer: "seis millones",  hint: "Seys mee Yoh nehs",    audio: "" },
    { prompt: "7,000,000", answer: "siete millones", hint: "See eh teh mee Yoh nehs", audio: "" },
    { prompt: "8,000,000", answer: "ocho millones",  hint: "Oh choh mee Yoh nehs", audio: "" },
    { prompt: "9,000,000", answer: "nueve millones", hint: "Nweh veh mee Yoh nehs", audio: "" },

    /* Billions 1B–9B (10^9 = mil millones) */
    { prompt: "1,000,000,000", answer: "mil millones",        hint: "Meel mee Yoh nehs",         audio: "" },
    { prompt: "2,000,000,000", answer: "dos mil millones",    hint: "Dohs meel mee Yoh nehs",    audio: "" },
    { prompt: "3,000,000,000", answer: "tres mil millones",   hint: "Trehs meel mee Yoh nehs",   audio: "" },
    { prompt: "4,000,000,000", answer: "cuatro mil millones", hint: "Kwah troh meel mee Yoh nehs", audio: "" },
    { prompt: "5,000,000,000", answer: "cinco mil millones",  hint: "Seen koh meel mee Yoh nehs", audio: "" },
    { prompt: "6,000,000,000", answer: "seis mil millones",   hint: "Seys meel mee Yoh nehs",    audio: "" },
    { prompt: "7,000,000,000", answer: "siete mil millones",  hint: "See eh teh meel mee Yoh nehs", audio: "" },
    { prompt: "8,000,000,000", answer: "ocho mil millones",   hint: "Oh choh meel mee Yoh nehs", audio: "" },
    { prompt: "9,000,000,000", answer: "nueve mil millones",  hint: "Nweh veh meel mee Yoh nehs", audio: "" },

    /* Trillions 1T–9T (10^12 = billón) */
    { prompt: "1 trillion", answer: "un billón",      hint: "Oon bee Yohn",         audio: "" },
    { prompt: "2 trillion", answer: "dos billones",   hint: "Dohs bee Yoh nehs",    audio: "" },
    { prompt: "3 trillion", answer: "tres billones",  hint: "Trehs bee Yoh nehs",   audio: "" },
    { prompt: "4 trillion", answer: "cuatro billones", hint: "Kwah troh bee Yoh nehs", audio: "" },
    { prompt: "5 trillion", answer: "cinco billones", hint: "Seen koh bee Yoh nehs", audio: "" },
    { prompt: "6 trillion", answer: "seis billones",  hint: "Seys bee Yoh nehs",    audio: "" },
    { prompt: "7 trillion", answer: "siete billones", hint: "See eh teh bee Yoh nehs", audio: "" },
    { prompt: "8 trillion", answer: "ocho billones",  hint: "Oh choh bee Yoh nehs", audio: "" },
    { prompt: "9 trillion", answer: "nueve billones", hint: "Nweh veh bee Yoh nehs", audio: "" },

    /* Quadrillions 1Q–9Q (10^15 = mil billones) */
    { prompt: "1 quadrillion", answer: "mil billones",        hint: "Meel bee Yoh nehs",         audio: "" },
    { prompt: "2 quadrillion", answer: "dos mil billones",    hint: "Dohs meel bee Yoh nehs",    audio: "" },
    { prompt: "3 quadrillion", answer: "tres mil billones",   hint: "Trehs meel bee Yoh nehs",   audio: "" },
    { prompt: "4 quadrillion", answer: "cuatro mil billones", hint: "Kwah troh meel bee Yoh nehs", audio: "" },
    { prompt: "5 quadrillion", answer: "cinco mil billones",  hint: "Seen koh meel bee Yoh nehs", audio: "" },
    { prompt: "6 quadrillion", answer: "seis mil billones",   hint: "Seys meel bee Yoh nehs",    audio: "" },
    { prompt: "7 quadrillion", answer: "siete mil billones",  hint: "See eh teh meel bee Yoh nehs", audio: "" },
    { prompt: "8 quadrillion", answer: "ocho mil billones",   hint: "Oh choh meel bee Yoh nehs", audio: "" },
    { prompt: "9 quadrillion", answer: "nueve mil billones",  hint: "Nweh veh meel bee Yoh nehs", audio: "" },

    /* Standalone tens-of-thousands */
    { prompt: "10,000",  answer: "diez mil",  hint: "Dee es meel",  audio: "" },
    { prompt: "100,000", answer: "cien mil",  hint: "See en meel",  audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "es/lesson-5", title: "Spanish Big Number Roots" });
