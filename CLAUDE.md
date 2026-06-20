# LanguageBasics — project orientation (CLAUDE.md)

Read this first to orient on the codebase: what it is, the stack, layout, conventions, how to test, how to deploy, and the rules that matter.

---

## What it is

LanguageBasics is a hobby **Albanian-numbers flashcard web app**. RandBMedia-owned (Rob's own product surface).

- **Live at:** `languagebasics.robguida.com`
- **6 lessons, ~170 cards** covering Albanian numbers:
  1. Lesson 1 — Numbers 0–10 (11 cards)
  2. Lesson 2 — Numbers 11–19 (9 cards)
  3. Lesson 3 — Tens 20–90 (8 cards)
  4. Lesson 4 — Numbers 20–99 compounds (80 cards)
  5. Lesson 5 — Big Number Roots (56 cards)
  6. Lesson 6 — Number Builder / built compounds (6 cards)
- A flashcard shows a number, you say it out loud, a timer runs, then the Albanian word + pronunciation reveal.

---

## Stack

- **Vanilla JavaScript. No build step. No framework. No runtime dependencies.**
- Served as **static files**. Works on `file://` (double-click `index.html` and it runs) and over HTTP identically.
- No backend, no server-side rendering, no fetch — lesson data loads as plain `<script>` globals.

---

## File layout

Served files live under **`src/`** — only `src/` reaches the live site (see Deploy).

```
src/
  index.html              # the single shell: lesson picker + card UI + bootstrap
  engine.js               # shared flashcard engine (window.LBEngine)
  styles.css              # all styling (unified from the original 6 standalone files)
  content/
    sq/                   # sq = Albanian language namespace
      lesson-1.js ... lesson-6.js   # per-lesson card data (window.LB_LESSON)
test/                     # node --test suite (NOT served)
  schema.test.js          # per-lesson schema + card-count checks
  button-toggle.test.js   # reveal/next toggle state-machine
  loop-resilience.test.js # bad-card-skip regression on the engine
  helpers/load-lesson.js  # vm sandbox loader for lesson data files
docs/                     # concept/source files, NOT served (see Docs)
package.json              # name, test script — no deps
```

### How a lesson loads (no fetch, file:// safe)

`index.html` reads `?lesson=sq/lesson-N` from the URL, validates it against a whitelist, then `document.write`s a `<script src="content/sq/lesson-N.js">` so the data loads **synchronously** before `engine.js` runs. The dropdown just rewrites `?lesson=` and reloads. One shell, one data file, zero server.

### Adding a language

`sq` is the Albanian namespace. A new language is new data files under `content/<lang>/` plus picker/whitelist entries in `index.html` — **no engine change**. The engine is language-agnostic.

---

## Card-data schema

Each lesson file assigns one global and pushes one registry entry:

```js
window.LB_LESSON = {
  id: "sq/lesson-1",                 // string, matches the ?lesson= value
  title: "Albanian Tosk Numbers: 0–10",
  revealMs: 5000,                    // optional; engine default 5000 (lesson 6 = 10000)
  // recallPrompt: "...",            // optional lesson-level override of the recall copy
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
| `answer` | string         | yes      | Albanian word(s); `" \| "` splits into stacked lines |
| `hint`   | string         | optional* | pronunciation (plain-English syllables) |
| `audio`  | string         | optional  | reserved future slot; currently `""` |
| `recallPrompt` | string   | optional  | per-card override of the recall copy |

\* The engine treats `hint`/`audio` as optional, but the **current dataset fills `hint` on every card** and the schema test enforces non-empty hints app-wide (including lesson 6).

**Multi-part answers:** lessons 2 and 6 use `" | "` as a line separator; the engine renders it as `<br>`. The engine also auto-shrinks the font for long prompts (big numbers) and long answers so they fit the card.

---

## How to test

```bash
npm test          # runs: node --test  (Node built-in runner, no deps)
```

- Tests live in `test/` and load the real `src/` files (engine + lesson data) inside a `node:vm` sandbox with a minimal `window`/DOM shim — Node built-ins only (`node:test`, `node:assert`, `node:fs`, `node:vm`, `node:path`).
- Coverage: per-lesson schema + exact card counts, the reveal/next toggle state machine, and loop-resilience (one bad card is skipped, never aborts the deck).
- **Card-count source of truth** is `EXPECTED` in `test/schema.test.js`. If you change a lesson's card count, update that map or the test fails.

---

## How to deploy

**Only the contents of `src/` ship to the live site.** Nothing else (`package.json`, `test/`, `docs/`) reaches the docroot.

Deploy flow:
1. Pull `main` into a local checkout.
2. `rsync` the **contents of `src/`** to the Lightsail docroot:
   `/home/bitnami/htdocs/languagebasics.robguida.com/public_html/` over SSH (`.pem` key).
3. `npm install` on the server for parity — a no-op (no deps).

No backend, no server-side build. Static files only.

### Hosting

- **RandBMedia AWS Lightsail** — Lightsail instance + Lightsail-managed networking/DNS. **NOT standard AWS** (no EC2/ALB/Route53 here). A Lightsail LB looks like standard AWS from outside (`awselb`, `awsdns`, ACM cert) — it is still Lightsail. Manage infra in the Lightsail console.

---

## Conventions

### Branch / PR flow
- Branch off **`development`**. One ticket → one branch. Branch name prefixed with the ticket (e.g. `LB-9-...` or `issue-...`).
- `main` = production. PRs merge to `development`, then promote to `main`.

### Language correctness (Albanian)
- Phonetics use **Rob's own plain-English-syllable notation** (e.g. `Nyuh`, `Jyosht`), **Tosk dialect only**.
- The Albanian-language truth (spellings, forms, pronunciations) is **owned by the linguistics advisor**. Engineers **apply** the dataset — they do **not** invent or alter Albanian forms. Dataset changes flow from the linguistics review, not from code.

### Loop resilience
- Per-item loops (e.g. the engine's deck builder) **skip a bad item and continue** — one malformed card never aborts the deck. New/modified loops follow continue-on-error; see `loop-resilience.test.js`.

### Owner accessibility convention
- Rob (project owner) has **ADHD + dyslexia**. Any user-facing copy and any response/summary should **lead with the answer** and **stay concise** — short sentences, scannable structure, no preamble. Treat this as a real project convention.

---

## Docs folder

`docs/` holds **concept/source material, not served to the site**:
- `Albanian.md` — language/source notes.
- `alan-CD-dataset-review.md` — dataset review notes.
- `ConceptFiles/` — the original standalone lesson HTML files the app was ported from.

These are reference/history. They never deploy.

---

## In progress (brief)

A **personalize/gamify batch** is planned/underway, all **client-side** (browser `localStorage`; no accounts, no backend, no pricing — personal use):
- A **settings modal**, opened from a hamburger menu.
- A **per-lesson reveal timer** (1–20s, default 5s).
- A card-order toggle: **Random ↔ Leitner**.
- A **self-rated game/test mode**.
