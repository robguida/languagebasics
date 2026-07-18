/* bn / lesson-5 — Bengali Big Number Roots (roots × multipliers 1-9)
 * Applied VERBATIM from the Bengali linguistics dataset review.
 *   6 root families (hundreds, thousands, "millions", "billions", "trillions",
 *   "quadrillions") × 9 multipliers = 54, PLUS the 2 standalone roots 10,000 and
 *   100,000 = 56 total.
 * AUTHENTIC South Asian lakh/koti grouping applied per the dataset: sho = 100,
 *   hajar = 1,000, lakh = 100,000 (10^5), koti = 10,000,000 (10^7). Bengali has NO
 *   single "million" word, so 10^6 = দশ লাখ (dosh lakh, 10 lakh); 10^9 = একশ কোটি
 *   (eksho koti, 100 koti); 10^12 = এক লাখ কোটি (ek lakh koti); 10^15 = দশ কোটি কোটি
 *   (dosh koti koti). Answer stacks native Bangla script | romanization via the
 *   engine's " | " separator; prompts stay comma-formatted strings, byte-identical
 *   to the reference deck. */
window.LB_LESSON = {
  id: "bn/lesson-5",
  title: "Bengali Big Number Roots",
  revealMs: 5000,
  cards: [
    /* Hundreds 100–900 — শ sho */
    { prompt: "100", answer: "একশ | eksho",     hint: "Aek shoh",   audio: "" },
    { prompt: "200", answer: "দুইশ | dui sho",   hint: "Doo ee shoh", audio: "" },
    { prompt: "300", answer: "তিনশ | tin sho",   hint: "Teen shoh",  audio: "" },
    { prompt: "400", answer: "চারশ | char sho",  hint: "Char shoh",  audio: "" },
    { prompt: "500", answer: "পাঁচশ | pãch sho",  hint: "Pahnch shoh", audio: "" },
    { prompt: "600", answer: "ছয়শ | chhoy sho",  hint: "Choy shoh",  audio: "" },
    { prompt: "700", answer: "সাতশ | sat sho",   hint: "Shat shoh",  audio: "" },
    { prompt: "800", answer: "আটশ | at sho",     hint: "Aht shoh",   audio: "" },
    { prompt: "900", answer: "নয়শ | noy sho",    hint: "Noy shoh",   audio: "" },

    /* Thousands 1,000–9,000 — হাজার hajar */
    { prompt: "1,000", answer: "এক হাজার | ek hajar",    hint: "Aek hah jar",    audio: "" },
    { prompt: "2,000", answer: "দুই হাজার | dui hajar",   hint: "Doo ee hah jar", audio: "" },
    { prompt: "3,000", answer: "তিন হাজার | tin hajar",   hint: "Teen hah jar",   audio: "" },
    { prompt: "4,000", answer: "চার হাজার | char hajar",  hint: "Char hah jar",   audio: "" },
    { prompt: "5,000", answer: "পাঁচ হাজার | pãch hajar",  hint: "Pahnch hah jar", audio: "" },
    { prompt: "6,000", answer: "ছয় হাজার | chhoy hajar",  hint: "Choy hah jar",   audio: "" },
    { prompt: "7,000", answer: "সাত হাজার | sat hajar",   hint: "Shat hah jar",   audio: "" },
    { prompt: "8,000", answer: "আট হাজার | at hajar",     hint: "Aht hah jar",    audio: "" },
    { prompt: "9,000", answer: "নয় হাজার | noy hajar",    hint: "Noy hah jar",    audio: "" },

    /* "Millions" 1M–9M (10^6) — expressed as লাখ lakh (1M = 10 lakh) */
    { prompt: "1,000,000", answer: "দশ লাখ | dosh lakh",       hint: "Dohsh lakh",      audio: "" },
    { prompt: "2,000,000", answer: "বিশ লাখ | bish lakh",       hint: "Beesh lakh",      audio: "" },
    { prompt: "3,000,000", answer: "ত্রিশ লাখ | trish lakh",     hint: "Treesh lakh",     audio: "" },
    { prompt: "4,000,000", answer: "চল্লিশ লাখ | chollish lakh",  hint: "Chohl leesh lakh", audio: "" },
    { prompt: "5,000,000", answer: "পঞ্চাশ লাখ | ponchash lakh",  hint: "Pohn chash lakh", audio: "" },
    { prompt: "6,000,000", answer: "ষাট লাখ | shat lakh",       hint: "Shaht lakh",      audio: "" },
    { prompt: "7,000,000", answer: "সত্তর লাখ | shottor lakh",    hint: "Shoht tor lakh",  audio: "" },
    { prompt: "8,000,000", answer: "আশি লাখ | ashi lakh",       hint: "Ah shee lakh",    audio: "" },
    { prompt: "9,000,000", answer: "নব্বই লাখ | nobboi lakh",     hint: "Nob boy lakh",    audio: "" },

    /* "Billions" 1B–9B (10^9) — expressed as কোটি koti (10^9 = 100 koti) */
    { prompt: "1,000,000,000", answer: "একশ কোটি | eksho koti",     hint: "Aek shoh koh tee",   audio: "" },
    { prompt: "2,000,000,000", answer: "দুইশ কোটি | dui sho koti",   hint: "Doo ee shoh koh tee", audio: "" },
    { prompt: "3,000,000,000", answer: "তিনশ কোটি | tin sho koti",   hint: "Teen shoh koh tee",  audio: "" },
    { prompt: "4,000,000,000", answer: "চারশ কোটি | char sho koti",  hint: "Char shoh koh tee",  audio: "" },
    { prompt: "5,000,000,000", answer: "পাঁচশ কোটি | pãch sho koti",  hint: "Pahnch shoh koh tee", audio: "" },
    { prompt: "6,000,000,000", answer: "ছয়শ কোটি | chhoy sho koti",  hint: "Choy shoh koh tee",  audio: "" },
    { prompt: "7,000,000,000", answer: "সাতশ কোটি | sat sho koti",   hint: "Shat shoh koh tee",  audio: "" },
    { prompt: "8,000,000,000", answer: "আটশ কোটি | at sho koti",     hint: "Aht shoh koh tee",   audio: "" },
    { prompt: "9,000,000,000", answer: "নয়শ কোটি | noy sho koti",    hint: "Noy shoh koh tee",   audio: "" },

    /* "Trillions" 1T–9T (10^12) — expressed as লাখ কোটি lakh koti (10^12 = 1 lakh koti) */
    { prompt: "1 trillion", answer: "এক লাখ কোটি | ek lakh koti",    hint: "Aek lakh koh tee",   audio: "" },
    { prompt: "2 trillion", answer: "দুই লাখ কোটি | dui lakh koti",   hint: "Doo ee lakh koh tee", audio: "" },
    { prompt: "3 trillion", answer: "তিন লাখ কোটি | tin lakh koti",   hint: "Teen lakh koh tee",  audio: "" },
    { prompt: "4 trillion", answer: "চার লাখ কোটি | char lakh koti",  hint: "Char lakh koh tee",  audio: "" },
    { prompt: "5 trillion", answer: "পাঁচ লাখ কোটি | pãch lakh koti",  hint: "Pahnch lakh koh tee", audio: "" },
    { prompt: "6 trillion", answer: "ছয় লাখ কোটি | chhoy lakh koti",  hint: "Choy lakh koh tee",  audio: "" },
    { prompt: "7 trillion", answer: "সাত লাখ কোটি | sat lakh koti",   hint: "Shat lakh koh tee",  audio: "" },
    { prompt: "8 trillion", answer: "আট লাখ কোটি | at lakh koti",     hint: "Aht lakh koh tee",   audio: "" },
    { prompt: "9 trillion", answer: "নয় লাখ কোটি | noy lakh koti",    hint: "Noy lakh koh tee",   audio: "" },

    /* "Quadrillions" 1Q–9Q (10^15) — expressed as কোটি কোটি koti koti (10^15 = 10 koti-koti) */
    { prompt: "1 quadrillion", answer: "দশ কোটি কোটি | dosh koti koti",     hint: "Dohsh koh tee koh tee",   audio: "" },
    { prompt: "2 quadrillion", answer: "বিশ কোটি কোটি | bish koti koti",     hint: "Beesh koh tee koh tee",   audio: "" },
    { prompt: "3 quadrillion", answer: "ত্রিশ কোটি কোটি | trish koti koti",   hint: "Treesh koh tee koh tee",  audio: "" },
    { prompt: "4 quadrillion", answer: "চল্লিশ কোটি কোটি | chollish koti koti", hint: "Chohl leesh koh tee koh tee", audio: "" },
    { prompt: "5 quadrillion", answer: "পঞ্চাশ কোটি কোটি | ponchash koti koti", hint: "Pohn chash koh tee koh tee", audio: "" },
    { prompt: "6 quadrillion", answer: "ষাট কোটি কোটি | shat koti koti",     hint: "Shaht koh tee koh tee",   audio: "" },
    { prompt: "7 quadrillion", answer: "সত্তর কোটি কোটি | shottor koti koti",  hint: "Shoht tor koh tee koh tee", audio: "" },
    { prompt: "8 quadrillion", answer: "আশি কোটি কোটি | ashi koti koti",     hint: "Ah shee koh tee koh tee", audio: "" },
    { prompt: "9 quadrillion", answer: "নব্বই কোটি কোটি | nobboi koti koti",   hint: "Nob boy koh tee koh tee", audio: "" },

    /* The two standalone roots */
    { prompt: "10,000",  answer: "দশ হাজার | dosh hajar", hint: "Dohsh hah jar", audio: "" },
    { prompt: "100,000", answer: "এক লাখ | ek lakh",      hint: "Aek lakh",      audio: "" }
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "bn/lesson-5", title: "Bengali Big Number Roots" });
