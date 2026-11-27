# LanguageBasics — requirements (plain English)

Last updated: 2026-11-27 (LB-45). Update this file whenever a requirement changes.
This file describes what is true on the current branch. For code layout and commands, see `CLAUDE.md`.

## 1. What the app is
1. A free flashcard web app for learning the basics of a language.
2. A card shows a prompt. You say the answer out loud. A timer runs. Then the answer and its pronunciation appear.
3. It is static files only. No accounts, no backend, no pricing. It works when opened straight from disk or over the web.

## 2. Languages and lessons
1. Four languages: Albanian (Tosk), Spanish, Japanese, Bengali.
2. Each language has number lessons, an alphabet or script section, and Words and Phrases decks.
3. The number lessons, in every language:
   1. Lesson 1: 0–10 (11 cards).
   2. Lesson 2: 11–19 (9 cards).
   3. Lesson 3: tens, 20–90 (8 cards).
   4. Lesson 4: 20–99 compounds (80 cards).
   5. Lesson 5, Big Number Roots: 56 cards in Albanian, Spanish and Japanese; 64 in Bengali. Reveal time 5 seconds.
   6. Lesson 6, Number Builder: 20 compound cards (for example 101, 1,500, 44,444, 2,500,000), in value order. Reveal time 10 seconds.
4. Lesson 5 covers 100–900, 1,000–9,000, 10,000, 100,000, 1M–9M, billions, trillions and quadrillions. Bengali adds 200,000–900,000, because Bengali counts in lakh.
5. Nothing is parked now. A lesson can still be parked (hidden from learners and never deployed) and brought back later.

## 3. Number prompts
1. Every language shows numbers the same way: Western comma strings, such as "1,250,000".
2. The prompt text is how saved progress finds a card. It is frozen once shipped. Never reword it.
3. On a phone, a big number shrinks to fit the card on one line. It is never split in the middle.
4. Bengali teaches lakh in the answer.
5. Japanese answers use one script line and one reading line for each 万 group.
6. An answer has at most four lines.
7. The prompts in one lesson must all be different.

## 4. Score mode ("Test me")
1. A test is 10 cards, or the whole lesson if it is smaller. Cards not yet known come first.
2. Showing the answer never scores. Only the learner's own rating counts: "I knew it" or "Not yet".
3. The rating buttons ignore clicks for half a second after the answer appears.
4. If the timer runs out, the card counts as "Not yet".
5. The results screen lists missed cards and offers "Practice these again". A practice round never counts toward the personal best.
6. Each lesson shows "N of M known". The personal best shows on the results screen only.
7. A calm streak is marked on the first manual reveal or rating of a day, never on page load.
8. One switch turns score mode off. Saved progress stays and returns when it is turned back on.

## 5. Settings
1. A settings menu opens from a hamburger button.
2. The reveal timer is set per lesson, from 1 to 20 seconds. The default is 5.

## 6. Privacy
1. Progress, settings and streak are saved in the browser only. Nothing is sent anywhere.
2. A plain privacy page is linked from the study screen, the test screen, the results dialog and Settings.
3. The page counter is built but off. Turning it on needs the site code, updated page rules, a referrer header, a changed privacy page and the owner's go.
4. The app never reads, writes or deletes browser storage keys that belong to other apps on the same site.

## 7. Lesson data format
1. Each language is one JSON file in `data/`. This is the only place lesson content is edited.
2. A build step writes the files the browser loads. The build and the tests must both pass before a deploy.
3. Every card has a stable id that never changes, even when the card is reworded or moved. A deleted card's id is retired and never reused.
4. A language needs no code change and no test change to be added. One new JSON file is enough.
5. Lesson ids that have shipped cannot be removed, renamed or reordered.
6. Language content is owned by the language review. Engineers apply it and do not change it.

## 8. Deploy
1. Only the `src/` folder is served.
2. Every deploy needs the owner's go, naming that release.
3. A failed check rolls the release back on its own. A rollback can also be run by hand.

## 9. Not done yet / known gaps
1. Bengali stacked answer lines sit tight together. Left as is by the owner's choice.
2. The timer slider shows 5 seconds on Lesson 6, which really runs 10 seconds. Left as is by the owner's choice.
3. A very long answer can push the buttons down on a small phone. Left as is by the owner's choice.
4. Progress is saved by prompt text, not by card id. Saving by card id is planned and must land before any Words or Phrases deck that could repeat a prompt.
5. More made-up languages are planned.
