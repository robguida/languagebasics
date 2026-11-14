# LanguageBasics — project orientation (CLAUDE.md)

Read this first to orient on the codebase: what it is, the stack, layout, conventions, how to test, how to deploy, and the rules that matter.

---

## What it is

LanguageBasics is a hobby **language flashcard web app**. RandBMedia-owned (Rob's own product surface).

- **Live at:** `https://bengusa.pro/languagebasics/` (on bengusa.pro's Lightsail box). For the old address, see "Old host" under Deploy.
- **4 languages:** Albanian (`sq`, Tosk), Spanish (`es`), Japanese (`ja`), Bengali (`bn`). Each has number lessons, an Alphabet / script section, and Words + Phrases decks.
- **Live number lessons (each language, 108 cards):**
  1. Lesson 1 — Numbers 0–10 (11 cards)
  2. Lesson 2 — Numbers 11–19 (9 cards)
  3. Lesson 3 — Tens 20–90 (8 cards)
  4. Lesson 4 — Numbers 20–99 compounds (80 cards)
- **Parked (LB-34), not live:** Lesson 5 — Big Number Roots (56 cards) and Lesson 6 — Number Builder (6 cards, `revealMs` 10000), in all 4 languages. Their files sit in `parked/content/<lang>/` (see "Parked lessons").
- A flashcard shows a prompt, you say it out loud, a timer runs, then the answer + pronunciation reveal.

---

## Stack

- **Vanilla JavaScript. No deploy-time build. No framework. No runtime dependencies.**
- Lesson data lives in **`data/<code>.json`** (one file per language). The lesson files under `src/content/` and `parked/content/` and `src/content/languages.js` are **generated** from it by `npm run build:data` and **committed**, so a deploy just uploads `src/` as before (LB-41).
- Served as **static files**. Works on `file://` (double-click `index.html` and it runs) and over HTTP identically.
- No backend, no server-side rendering, no fetch — lesson data loads as plain `<script>` globals.

---

## File layout

Served files live under **`src/`** — only `src/` reaches the live site (see Deploy).

```
src/
  index.html              # the single shell: lesson picker + card UI + bootstrap
  privacy.html            # LB-39: static privacy note (no script), linked from the study and test screens, the results dialog and Settings
  features.js             # LB-34 feature flags (window.LB_FEATURES) — loads first
  engine.js               # shared flashcard engine (window.LBEngine)
  manifest.js             # picker / whitelist / count helpers over the manifest
  settings.js, prefs.js, store.js     # settings modal + localStorage prefs
  game.js                 # score-mode test logic (pure, no DOM)
  progress.js             # LB-36: per-card ratings, "N of M known", personal best
  streak.js               # calm streak
  counter.js              # LB-36: page counter (ships dark, see "Page counter")
  hint.js                 # hint rotation
  styles.css              # all styling
  content/                # GENERATED from data/*.json — do not hand-edit
    languages.js          # GENERATED manifest: every language + live lesson (id, count, rollup)
    sq/ es/ ja/ bn/       # GENERATED per-language lesson files (window.LB_LESSON):
                          #   lesson-1..4, alphabet-*, words-1..5, phrases-1..5
data/                     # LB-41: lesson data, one JSON file per language — edit HERE. NOT served
  sq.json es.json ja.json bn.json
scripts/                  # dev tools, NOT served
  build-data.js           # data/*.json -> src/content + parked/content (build:data / check:data)
  convert-js-to-json.js   # LB-41 one-off: old .js -> JSON + --verify proof (deleted in LB-42)
parked/                   # LB-34 parked lessons — GENERATED, NOT served, never deploys
  content/<lang>/lesson-5.js, lesson-6.js
test/                     # node --test suite (NOT served)
  schema.test.js          # per-lesson schema + card-count checks (incl. parked)
  build-data.test.js      # LB-41: generated files match the JSON; validator rules
  lb34-testing-flag.test.js  # testing flag + parked-lesson checks
  ...                     # engine, manifest, game, progress, streak, counter,
                          # test-mode, score-integration, etc.
  helpers/load-lesson.js  # vm sandbox loader (src/content or parked/content)
docs/                     # concept/source files, NOT served (see Docs)
package.json              # name, test / build:data / check:data scripts — no deps
```

### Score mode (LB-36) — built and ON

- One switch: `src/features.js`, `window.LB_FEATURES = { testing: true }` (shipped ON).
- **How it works for the learner:**
  1. A **"Test me"** button starts a test (10 cards, or the whole lesson if smaller). Cards not yet known come first.
  2. **Revealing a card never scores.** Only the learner's own rating counts: **"I knew it"** or **"Not yet"**. The rating buttons ignore clicks for 500 ms after the reveal.
  3. If the timer runs out, the card counts as **"Not yet"**.
  4. The results screen lists the missed cards and offers **"Practice these again"**. A practice round never counts toward the personal best.
  5. Each lesson shows **"N of M known"** near the picker (a card is known when its last rating was "I knew it"). The **personal best** shows on the results screen only.
  6. A **calm streak** is marked on the first manual reveal or rating of a day, never on page load.
- **Storage:** browser `localStorage` only. Data lives in three keys: `languagebasics.prefs`, `languagebasics.progress`, `languagebasics.streak`. At start-up the store also writes and then removes one test key, `languagebasics.__probe__`, to check that storage works; it holds no data. ⛔ Never read, write or delete any `lb.*` key — bengusa.pro shares browser storage across its apps.
- **Retired in LB-36:** `mastery.js`, `leitner.js`, the quiz-count setting, speed levels, the overall rollup and the Test mode switch.
- **To turn testing off:** change `testing: true` to `testing: false` in `src/features.js`. The testing markup (tagged `data-feature="testing"`) is then removed from the page, and nothing is recorded. Saved progress stays and comes back when it is turned on again.

### Page counter (LB-36) — built, ships DARK

- `src/counter.js` counts page views with GoatCounter, using one plain image request. No cookies.
- It is **off**: `GOATCOUNTER_CODE` is empty, so it sends nothing.
- It only ever sends the lesson page name and, for visitors from another site, that site's name. Never the query string.
- **To turn it on later, all of these are needed:**
  1. The site code set in `GOATCOUNTER_CODE` (one line).
  2. The page's image rules (CSP `img-src` for `/languagebasics/`) updated to allow the GoatCounter host.
  3. A Referrer-Policy header set.
  4. The privacy page updated: add the line saying visits are counted, and remove "It is never sent to us or anyone else." (it stops being true). `test/lb39-privacy.test.js` guards this pairing and fails until both are done.
  5. The owner's go.
- This repo is public. Never write account names, emails, server paths, addresses or keys here.

### Parked lessons (LB-34)

- Number lessons 5 and 6 (all 4 languages) are marked `"parked": true` in `data/<code>.json` (kept in their group, so they come back in the same place). The build writes them to `parked/content/<lang>/`, outside `src/`, so they never deploy. They are left out of `content/languages.js`, so they are not in the picker, the `?lesson=` whitelist or the "N of M known" counts.
- The tests still run the full schema checks on them, so they stay valid.
- **To bring one back:**
  1. Set `"parked": false` on the lesson in `data/<code>.json`.
  2. Run `npm run build:data` (it moves the file to `src/content/<lang>/` and adds its row, with its count, to `languages.js`).
  3. Until LB-42 makes the tests read the data, also do the test edits below. In `test/schema.test.js`, `PARKED` is built by a **loop** over the four languages. Add a **literal row** for the lesson to `EXPECTED`, and change the loop so it stops generating that lesson.
  4. Update the tests that expect it parked: `test/count-parity.test.js` (lesson total, 72), `test/manifest.test.js` (lessons per group, lesson total 72, and the "ids byte-identical" test, whose locked id list must now include the lesson), `test/notation-audit.test.js` (parked file list) and `test/lb34-testing-flag.test.js` (parked-lesson checks).

### How a lesson loads (no fetch, file:// safe)

`index.html` reads `?lesson=sq/lesson-N` from the URL, validates it against a whitelist, then `document.write`s a `<script src="content/sq/lesson-N.js">` so the data loads **synchronously** before `engine.js` runs. The dropdown just rewrites `?lesson=` and reloads. One shell, one data file, zero server.

### Adding a language

`sq` is the Albanian namespace. A new language is **one new file, `data/<code>.json`**, then `npm run build:data` — **no engine change and no edit to `index.html`**. The build writes its lesson files and its entry in `src/content/languages.js`; the picker, the `?lesson=` whitelist, the default lesson and the card counts all come from that file. `language.order` sets where it sits in the language list. The engine is language-agnostic.

Until LB-42 makes the tests read the data, also update the tests that count languages and lessons:
- `test/manifest.test.js` — language count (4), lessons per group, lesson total (72), the language option list, and the "ids byte-identical" id list.
- `test/count-parity.test.js` — lesson total (72).
- `test/schema.test.js` — add the language's rows to `EXPECTED`, and add the language to the `PARKED` loop if it has parked lessons.
- `test/lb34-testing-flag.test.js` — the `LANGS` list.

---

## Card-data schema

**Edits happen in `data/<code>.json`, never in the generated `.js` files.** One JSON file per language:

```json
{ "format": "languagebasics-lessons", "formatVersion": 1,
  "language": { "code": "sq", "name": "Albanian", "order": 1, "defaultLesson": "lesson-1" },
  "notes": [], "retiredCardIds": [],
  "groups": [ { "label": "Numbers", "notes": [], "lessons": [
    { "slug": "lesson-1", "label": "Lesson 1 — 0–10", "title": "Albanian Tosk Numbers: 0–10",
      "revealMs": 5000, "rollup": true, "notes": ["..."],
      "cards": [ { "id": "lesson-1.001", "prompt": 0, "answer": "zero", "hint": "Zeh rō" } ] } ] } ] }
```

- Lesson id = `code/slug`; the output file is `<slug>.js`. The picker count is the number of cards.
- `code` must match `^[a-z][a-z0-9]{1,7}$` and equal the file name; `slug` must match `^[a-z0-9]+(-[a-z0-9]+)*$` and be unique in the file. They are strict because the lesson id is written into a script tag. Unknown keys fail (catches typos).
- `order` is a unique positive number and sets the language order. `defaultLesson` must be a live (not parked) lesson. `rollup` is required (true/false). `revealMs`, `recallPrompt`, `parked` and `notes` are optional.
- Each lesson has exactly one of `cards` or `cardRefs`. The combined alphabet decks (`alphabet-all`) use `cardRefs`: a list of card ids from the other alphabet decks, so their cards are never copied.
- **Card `id`** (JSON only, never written to `src/`): `<slug>.<NNN>`, NNN = the card's place when the data was converted, padded to 3 digits. It is never taken from the card text and is frozen: rewording or moving a card keeps its id. A new card gets the highest NNN used for that slug (counting retired ids) + 1. A deleted card's id goes into `retiredCardIds` and is never reused.
- `notes` hold the comments that used to sit in the `.js` files. They are never written to `src/`.
- After editing, run `npm run build:data`. If any data file has an error, the build lists every error with its file and place and writes nothing.

Each generated lesson file assigns one global and pushes one registry entry:

```js
window.LB_LESSON = {
  id: "sq/lesson-1",                 // string, matches the ?lesson= value
  title: "Albanian Tosk Numbers: 0–10",
  revealMs: 5000,                    // optional; engine default 5000 (lesson 6 = 10000)
  // recallPrompt: "...",            // reserved: accepted, never read or shown today
  cards: [
    { prompt: 0, answer: "zero", hint: "Zeh rō", audio: "" },
    // ...
  ]
};
(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: "sq/lesson-1", title: "..." });
```

**Card fields** (engine normalizes/validates each):

| Field    | Type          | Required | Notes |
|----------|---------------|----------|-------|
| `prompt` | string\|number | yes      | the number shown first |
| `answer` | string         | yes      | the target-language word(s); `" \| "` splits into stacked lines |
| `hint`   | string         | optional* | pronunciation (plain-English syllables) |
| `audio`  | string         | optional  | reserved future slot; currently `""`. May be left out of the JSON (written as `""`) |
| `id`     | string         | yes (JSON only) | stable card id; never written to the `.js` files |
| `recallPrompt` | string   | optional  | reserved: the engine accepts it but never shows it today |

\* The engine treats `hint`/`audio` as optional, but the **current dataset fills `hint` on every card** and the schema test enforces non-empty hints app-wide (including the parked lessons).

**Multi-part answers:** `sq/lesson-2` and every Japanese (`ja`) and Bengali (`bn`) numbers, words and phrases deck use `" | "` as a line separator, as do the parked lesson 6 in all 4 languages and the parked `ja`/`bn` lesson 5; the engine renders it as `<br>`. The engine also auto-shrinks the font for long prompts (big numbers) and long answers so they fit the card.

---

## How to test

```bash
npm test          # runs: node --test  (Node built-in runner, no deps)
npm run check:data   # the generated files match data/*.json (writes nothing)
npm run build:data   # regenerate after editing data/ — then commit the JSON AND the generated files
```

- **Run `npm run build:data` after every edit in `data/`.** `npm test` includes the same check (`test/build-data.test.js`), so a stale generated file fails the tests.

- Tests live in `test/` and load the real `src/` files (engine + lesson data) inside a `node:vm` sandbox with a minimal `window`/DOM shim — Node built-ins only (`node:test`, `node:assert`, `node:fs`, `node:vm`, `node:path`).
- Coverage: per-lesson schema + exact card counts, the reveal/next toggle state machine, loop-resilience (one bad card is skipped, never aborts the deck), score mode (ratings, the 500 ms lock, results, practice rounds, personal best), progress, streak, prefs, store and the page counter.
- **Card counts:** the cards in `data/<code>.json` are the truth; `npm run build:data` writes each lesson's `count` into `languages.js`. Until LB-42, the tests still keep their own copy in `EXPECTED` (live lessons) and `PARKED` (parked lessons 5 and 6) in `test/schema.test.js`. If you change a lesson's card count, edit the JSON, rebuild, **and** update that map, or the tests fail.

---

## How to deploy

**Only the contents of `src/` ship to the live site.** `data/`, `scripts/`, `parked/`, `test/`, `docs/` and `package.json` never ship.

Before upload, run `npm test` and `npm run check:data` on the **exact** commit being deployed. Both must pass.

Live address: `https://bengusa.pro/languagebasics/`.

How a deploy works:
1. Pull `main` into a local checkout.
2. Upload the **contents of `src/`** to the Lightsail box as a new dated release folder. The app has its own folder there, outside bengusa.pro's own release folder, so bengusa.pro deploys never touch it.
3. A `current` link points at the live release. **Rollback = point `current` back at the previous release folder.**
4. After upload, the deploy checks the files from outside. If a check fails, it rolls back on its own.

The deploy script is not kept in the repo yet. Moving it into `./scripts` is tracked as follow-up ticket LB-37. Every deploy needs the owner's go.

No backend, no server-side build. Static files only.

**Old host (as of 2026-11-13):** `languagebasics.robguida.com` still exists but is not where releases go, and it currently fails with an untrusted-certificate error.

### Hosting

- **RandBMedia AWS Lightsail** — Lightsail instance + Lightsail-managed networking/DNS. **NOT standard AWS** (no EC2/ALB/Route53 here). A Lightsail LB looks like standard AWS from outside (`awselb`, `awsdns`, ACM cert) — it is still Lightsail. Manage infra in the Lightsail console.
- A CDN sits in front of bengusa.pro. It does not pass `?lesson=` to the server. That is fine: the browser reads `?lesson=` itself. Files are served with `Cache-Control: no-cache`.

---

## Conventions

### Branch / PR flow
- Branch off **`development`**. One ticket → one branch. Branch name prefixed with the ticket (e.g. `LB-9-...` or `issue-...`).
- `main` = production. Ticket PRs go to `development`. A release PR then goes `development` → `main`.
- **`development` must never be deleted** (it is protected). Delete a ticket branch only after its PR shows Merged.

### Language correctness (Albanian)
- Phonetics use **Rob's own plain-English-syllable notation** (e.g. `Nyuh`, `Jyosht`), **Tosk dialect only**.
- The Albanian-language truth (spellings, forms, pronunciations) is **owned by the linguistics advisor**. Engineers **apply** the dataset — they do **not** invent or alter Albanian forms. Dataset changes flow from the linguistics review, not from code.
- The linguist (any language) edits **`data/<code>.json`**; then `npm run build:data` writes the app files.

### Loop resilience
- Per-item loops (e.g. the engine's deck builder) **skip a bad item and continue** — one malformed card never aborts the deck. New/modified loops follow continue-on-error; see `loop-resilience.test.js`.

### User-facing copy
- Lead with the answer. Short sentences, scannable structure.

---

## Docs folder

`docs/` holds **concept/source material, not served to the site**:
- `Albanian.md` — language/source notes.
- the Albanian dataset review notes (gitignored, reference only).
- `ConceptFiles/` — the original standalone lesson HTML files the app was ported from.

These are reference/history. They never deploy.

---

## Status — personalize/gamify features (all built)

All **client-side** (browser `localStorage`; no accounts, no backend, no pricing — personal use):
- A **settings modal**, opened from a hamburger menu — live.
- A **per-lesson reveal timer** (1–20s, default 5s) — live.
- **Score mode** ("Test me", self-rated, "N of M known", personal best, calm streak) — built and ON (LB-36). See "Score mode".
- **Page counter** — built, ships dark (LB-36). See "Page counter".
