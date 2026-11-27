#!/usr/bin/env node
/* LanguageBasics lesson-data generator (LB-41).
 *
 * data/<code>.json is the ONE place lesson data is edited (one file per
 * language). This script turns those files into the plain <script> globals the
 * app loads, so the site keeps working on file:// with no fetch and no
 * deploy-time build:
 *
 *   src/content/<code>/<slug>.js     every live lesson   (window.LB_LESSON)
 *   parked/content/<code>/<slug>.js  every parked lesson (never deployed)
 *   src/content/languages.js         the manifest, live lessons only
 *
 * Commands:
 *   npm run build:data   write the files (only the ones that changed)
 *   npm run check:data   write nothing; exit 1 if any committed file differs,
 *                        is missing, or is stale
 *
 * Rules the output follows (so --check can hold it byte-for-byte):
 *   - a fixed 2-line GENERATED banner that holds no data text
 *   - the same key order the app has always used; rollup:false and
 *     recallPrompt appear only when set
 *   - every value written with JSON.stringify, one card per line; inside
 *     strings, "<", U+2028 and U+2029 are written as escapes (same value)
 *   - LF line endings, UTF-8 with no BOM, a newline at the end, no timestamps
 *     and no paths
 *   - card ids, notes and retired ids stay in the JSON; they are never written
 *     to src/
 *
 * Error handling: every data file and every card is checked, and checking goes
 * on after an error so one run lists them all, each with its file and place
 * (e.g. data/sq.json groups[2].lessons[4].cards[3].hint). If any data file
 * fails, NOTHING is written and the exit code is 1. A file at a generated path
 * that lacks the GENERATED banner is never overwritten (nothing is written).
 * Writes go to temp files first and are then renamed into place; a rename that
 * fails is reported, its temp removed, and the rest go on (exit 1). A stale .js
 * or leftover .tmp in an output folder is deleted only if it starts with the
 * GENERATED banner; any other stale file is reported and left alone.
 *
 * Node built-ins only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const FORMAT = "languagebasics-lessons";
const FORMAT_VERSION = 2;

// Strict on purpose: the lesson id (code + "/" + slug) is written into a
// <script src> by document.write in index.html, so only plain a-z0-9 may reach it.
const CODE_RE = /^[a-z][a-z0-9]{1,7}$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CARD_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*\.[0-9]{3,}$/;

const BANNER_LINE_1 = "/* GENERATED FILE - DO NOT EDIT. Built by scripts/build-data.js from data/*.json.";
const BANNER_LINE_2 = " * To change it, edit the JSON file and run: npm run build:data */";
const BANNER = BANNER_LINE_1 + "\n" + BANNER_LINE_2 + "\n";

// Output folders. Each one's language sub-folders are scanned for stale files.
const OUTPUT_ROOTS = ["src/content", "parked/content"];
const MANIFEST_FILE = "src/content/languages.js";

const KEYS = {
  top: ["format", "formatVersion", "language", "ip", "notes", "retiredCardIds", "groups"],
  language: ["code", "name", "order", "defaultLesson"],
  ip: ["status", "freeOnly", "notice", "ruling"],
  notice: ["full", "short"],
  ruling: ["id", "date"],
  group: ["label", "notes", "lessons"],
  lesson: ["slug", "parked", "label", "title", "revealMs", "rollup", "recallPrompt", "notes", "cards", "cardRefs"],
  card: ["id", "prompt", "answer", "hint", "audio", "note"],
};

/* ------------------------------------------------------------------ helpers */

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}

const BOM = String.fromCharCode(0xfeff);

/** Turn CRLF into LF and drop a leading BOM, so a Windows checkout compares equal. */
function normalize(text) {
  const s = String(text);
  return (s.startsWith(BOM) ? s.slice(1) : s).replace(/\r\n/g, "\n");
}

/** True when a file's text starts with the GENERATED banner (CRLF/BOM tolerant). */
function hasBanner(text) {
  return normalize(text).startsWith(BANNER_LINE_1 + "\n");
}

/* --------------------------------------------------------------- validation */

const IP_STATUSES = ["natural", "free", "owned", "licensed"];
const RULING_ID_RE = /^IP-[0-9]{4}$/;
const RULING_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Limits are counted in code points (not UTF-16 units), so a character outside
// the Basic Multilingual Plane counts once.
const LIMITS = { fullLines: 8, fullLine: 160, short: 200, note: 280 };

/* Text guard for text that is written raw into a generated file's comments
 * (the notice) or kept as data (a card note). It refuses, rather than escapes,
 * because a comment has no escape form. Refused: every control character
 * (Cc, which includes TAB, CR and LF), format characters (Cf: the bidi controls,
 * zero-width characters, BOM), lone surrogates (Cs), unassigned code points
 * (Cn), the line and paragraph separators (Zl, Zp), "*" followed by "/" and "<".
 * Cf also holds ZWJ and ZWNJ. They are refused HERE ONLY (notice and note text,
 * written into comments). Scripts that need them (Bengali) keep them in titles,
 * answers and hints, which this guard does not touch. Do not widen the guard to
 * those fields without a ticket. */
const TEXT_REFUSED = /[\p{Cc}\p{Cf}\p{Cs}\p{Cn}\p{Zl}\p{Zp}]|\*\/|</u;
const PRIVATE_USE = /\p{Co}/u;

const cpLength = (s) => [...s].length;

/** Check one piece of guarded text. Type is checked first. Returns the problem
 *  text, or null when the text is fine. */
function textProblem(v, min, max, noPrivateUse) {
  if (typeof v !== "string") return "must be a string";
  if (typeof v.isWellFormed === "function" && !v.isWellFormed()) return "holds a lone surrogate (broken text)";
  if (v.normalize("NFC") !== v) return "is not in Unicode NFC form (normalize it first)";
  const m = TEXT_REFUSED.exec(v);
  if (m) {
    const ch = m[0];
    const shown = ch.length === 1 ? "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0") : JSON.stringify(ch);
    return "holds a refused character or sequence (" + shown + "): control, format, unassigned, line separator, \"*/\" and \"<\" are not allowed";
  }
  if (noPrivateUse && PRIVATE_USE.test(v)) return "holds a Private Use character";
  const n = cpLength(v);
  if (n < min) return "must be at least " + min + " character" + (min === 1 ? "" : "s");
  if (n > max) return "is " + n + " characters long; the limit is " + max;
  return null;
}

/** True for a real calendar date written YYYY-MM-DD. */
function isRealDate(s) {
  if (!RULING_DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Check the ip block. Every error names its place and checking goes on.
 *  Returns the clean ip model, or null when the block cannot be used. */
function checkIp(ip, err, unknownKeys) {
  if (ip === undefined) { err("ip", "is required: every language states its status (real languages: { \"status\": \"natural\" })"); return null; }
  if (!isObject(ip)) { err("ip", "must be an object"); return null; }
  unknownKeys(ip, KEYS.ip, "ip");
  if (!IP_STATUSES.includes(ip.status)) { err("ip.status", "must be one of " + IP_STATUSES.join(", ")); return null; }
  const status = ip.status;

  if (status === "natural") {
    for (const k of KEYS.ip) {
      if (k !== "status" && ip[k] !== undefined) err("ip." + k, "is not allowed when status is natural (a natural language needs no notice or ruling)");
    }
    return { status };
  }

  // free / owned / licensed: freeOnly, notice and ruling are all required.
  const strict = status === "owned" || status === "licensed";
  let ok = true;
  const bad = (place, msg) => { err(place, msg); ok = false; };

  if (typeof ip.freeOnly !== "boolean") bad("ip.freeOnly", "must be true or false");
  else if (strict && ip.freeOnly !== true) bad("ip.freeOnly", "must be true when status is " + status);

  let full = [];
  let short = "";
  if (!isObject(ip.notice)) {
    bad("ip.notice", "is required and must be an object with full and short");
  } else {
    unknownKeys(ip.notice, KEYS.notice, "ip.notice");
    if (!Array.isArray(ip.notice.full)) {
      bad("ip.notice.full", "must be an array of lines");
    } else {
      if (strict && ip.notice.full.length === 0) bad("ip.notice.full", "needs at least one line when status is " + status);
      if (ip.notice.full.length > LIMITS.fullLines) bad("ip.notice.full", "has " + ip.notice.full.length + " lines; the limit is " + LIMITS.fullLines);
      ip.notice.full.forEach((line, i) => {
        const place = "ip.notice.full[" + i + "]";
        const p = textProblem(line, 1, LIMITS.fullLine, true);
        if (p) bad(place, p);
        else if (line.trim() === "") bad(place, "is a blank line");
        else full.push(line);
      });
    }
    if (typeof ip.notice.short !== "string") {
      bad("ip.notice.short", "must be a string");
    } else if (ip.notice.short === "" && !strict) {
      short = "";
    } else {
      const p = textProblem(ip.notice.short, 1, LIMITS.short, true);
      if (p) bad("ip.notice.short", p); else short = ip.notice.short;
    }
  }

  let ruling = null;
  if (!isObject(ip.ruling)) {
    bad("ip.ruling", "is required and must be an object with id and date");
  } else {
    unknownKeys(ip.ruling, KEYS.ruling, "ip.ruling");
    if (typeof ip.ruling.id !== "string" || !RULING_ID_RE.test(ip.ruling.id)) bad("ip.ruling.id", "must look like IP-0001 (IP- and four digits)");
    if (typeof ip.ruling.date !== "string" || !isRealDate(ip.ruling.date)) bad("ip.ruling.date", "must be a real calendar date written YYYY-MM-DD");
    if (ok) ruling = { id: ip.ruling.id, date: ip.ruling.date };
  }

  if (!ok) return null;
  return { status, freeOnly: ip.freeOnly, notice: { full, short }, ruling };
}

/**
 * Check one parsed data file and build its clean model.
 * @param {string} where  e.g. "data/sq.json"
 * @param {string} fileCode the code taken from the file name
 * @param {*} doc the parsed JSON
 * @returns {{ errors: string[], model: object|null }}
 */
function validateLanguage(where, fileCode, doc) {
  const errors = [];
  const err = (place, msg) => errors.push(`${where}${place ? " " + place : ""}: ${msg}`);

  function unknownKeys(obj, allowed, place) {
    for (const k of Object.keys(obj)) {
      if (!allowed.includes(k)) err(place ? `${place}.${k}` : k, "unknown key (allowed: " + allowed.join(", ") + ")");
    }
  }

  function checkNotes(v, place) {
    if (v === undefined) return;
    if (!Array.isArray(v)) { err(place, "must be an array of strings"); return; }
    v.forEach((n, i) => { if (typeof n !== "string") err(`${place}[${i}]`, "must be a string"); });
  }

  if (!isObject(doc)) {
    err("", "top level must be a JSON object");
    return { errors, model: null };
  }
  unknownKeys(doc, KEYS.top, "");

  if (doc.format !== FORMAT) err("format", `must be "${FORMAT}"`);
  if (doc.formatVersion === 1) {
    err("formatVersion", "1 is no longer accepted: this build reads format 2. Add an \"ip\" block (real languages: { \"status\": \"natural\" }) and set formatVersion to 2");
  } else if (doc.formatVersion !== FORMAT_VERSION) {
    err("formatVersion", `must be ${FORMAT_VERSION}`);
  }
  checkNotes(doc.notes, "notes");

  // language header
  const lang = doc.language;
  let code = null;
  if (!isObject(lang)) {
    err("language", "must be an object with code, name, order, defaultLesson");
  } else {
    unknownKeys(lang, KEYS.language, "language");
    if (typeof lang.code !== "string" || !CODE_RE.test(lang.code)) {
      err("language.code", "must match " + CODE_RE + " (lower-case a-z0-9, 2-8 characters)");
    } else if (lang.code !== fileCode) {
      err("language.code", `"${lang.code}" must equal the file name ("${fileCode}")`);
    } else {
      code = lang.code;
    }
    if (!isNonEmptyString(lang.name)) err("language.name", "must be a non-empty string");
    if (!isPositiveInt(lang.order)) err("language.order", "must be a positive whole number");
    if (typeof lang.defaultLesson !== "string") err("language.defaultLesson", "must be the slug of a live lesson");
  }

  // ip block (who may use this language's text, and what notice it carries)
  const ip = checkIp(doc.ip, err, unknownKeys);

  // retired ids
  const retired = new Set();
  if (doc.retiredCardIds !== undefined) {
    if (!Array.isArray(doc.retiredCardIds)) {
      err("retiredCardIds", "must be an array of card ids");
    } else {
      doc.retiredCardIds.forEach((id, i) => {
        if (typeof id !== "string" || !CARD_ID_RE.test(id)) err(`retiredCardIds[${i}]`, "must be a card id like lesson-1.001");
        else if (retired.has(id)) err(`retiredCardIds[${i}]`, `"${id}" is listed twice`);
        else retired.add(id);
      });
    }
  }

  // groups, lessons, cards
  const groups = [];
  const slugs = new Map(); // slug -> place
  const cardIds = new Map(); // id -> { place, card }
  const pendingRefs = []; // resolved after every card id is known

  if (!Array.isArray(doc.groups) || doc.groups.length === 0) {
    err("groups", "must be a non-empty array");
  } else {
    doc.groups.forEach((g, gi) => {
      const gp = `groups[${gi}]`;
      if (!isObject(g)) { err(gp, "must be an object"); return; }
      unknownKeys(g, KEYS.group, gp);
      if (!isNonEmptyString(g.label)) err(`${gp}.label`, "must be a non-empty string");
      checkNotes(g.notes, `${gp}.notes`);
      const group = { label: g.label, lessons: [] };
      groups.push(group);

      if (!Array.isArray(g.lessons) || g.lessons.length === 0) {
        err(`${gp}.lessons`, "must be a non-empty array");
        return;
      }
      g.lessons.forEach((l, li) => {
        const lp = `${gp}.lessons[${li}]`;
        if (!isObject(l)) { err(lp, "must be an object"); return; }
        unknownKeys(l, KEYS.lesson, lp);

        if (typeof l.slug !== "string" || !SLUG_RE.test(l.slug)) {
          err(`${lp}.slug`, "must match " + SLUG_RE + " (lower-case a-z0-9 words joined by -)");
        } else if (slugs.has(l.slug)) {
          err(`${lp}.slug`, `"${l.slug}" is already used at ${slugs.get(l.slug)}`);
        } else {
          slugs.set(l.slug, lp);
        }
        if (l.parked !== undefined && typeof l.parked !== "boolean") err(`${lp}.parked`, "must be true or false");
        if (!isNonEmptyString(l.label)) err(`${lp}.label`, "must be a non-empty string");
        if (!isNonEmptyString(l.title)) err(`${lp}.title`, "must be a non-empty string");
        if (l.revealMs !== undefined && !isPositiveInt(l.revealMs)) err(`${lp}.revealMs`, "must be a positive whole number of milliseconds");
        if (typeof l.rollup !== "boolean") err(`${lp}.rollup`, "must be true or false");
        if (l.recallPrompt !== undefined && typeof l.recallPrompt !== "string") err(`${lp}.recallPrompt`, "must be a string");
        checkNotes(l.notes, `${lp}.notes`);

        const lesson = {
          slug: l.slug,
          parked: l.parked === true,
          label: l.label,
          title: l.title,
          revealMs: l.revealMs,
          rollup: l.rollup,
          recallPrompt: l.recallPrompt,
          cards: [],
        };
        group.lessons.push(lesson);

        const hasCards = l.cards !== undefined;
        const hasRefs = l.cardRefs !== undefined;
        if (hasCards === hasRefs) {
          err(lp, "must have exactly one of cards or cardRefs");
          return;
        }

        if (hasCards) {
          if (!Array.isArray(l.cards) || l.cards.length === 0) { err(`${lp}.cards`, "must be a non-empty array"); return; }
          l.cards.forEach((c, ci) => {
            const cp = `${lp}.cards[${ci}]`;
            if (!isObject(c)) { err(cp, "must be an object"); return; }
            unknownKeys(c, KEYS.card, cp);
            let ok = true;
            if (typeof c.id !== "string" || !CARD_ID_RE.test(c.id)) {
              err(`${cp}.id`, "must be a card id like lesson-1.001 (never taken from the card text)"); ok = false;
            } else if (cardIds.has(c.id)) {
              err(`${cp}.id`, `"${c.id}" is already used at ${cardIds.get(c.id).place}`); ok = false;
            } else if (retired.has(c.id)) {
              err(`${cp}.id`, `"${c.id}" is in retiredCardIds and must never be reused`); ok = false;
            }
            const promptOk = (typeof c.prompt === "string" && c.prompt.length > 0) ||
              (typeof c.prompt === "number" && Number.isFinite(c.prompt));
            if (!promptOk) { err(`${cp}.prompt`, "must be a non-empty string or a number"); ok = false; }
            if (!isNonEmptyString(c.answer)) { err(`${cp}.answer`, "must be a non-empty string"); ok = false; }
            if (typeof c.hint !== "string") { err(`${cp}.hint`, "must be a string"); ok = false; }
            if (c.audio !== undefined && typeof c.audio !== "string") { err(`${cp}.audio`, "must be a string"); ok = false; }
            // note: data only. Checked here, kept on the model, never written to src/.
            if (c.note !== undefined) {
              const np = textProblem(c.note, 1, LIMITS.note, false);
              if (np) { err(`${cp}.note`, np); ok = false; }
            }
            const card = { prompt: c.prompt, answer: c.answer, hint: c.hint, audio: c.audio === undefined ? "" : c.audio };
            if (typeof c.note === "string" && ok) card.note = c.note;
            if (typeof c.id === "string" && !cardIds.has(c.id)) cardIds.set(c.id, { place: cp, card });
            if (ok) lesson.cards.push(card);
          });
        } else {
          if (!Array.isArray(l.cardRefs) || l.cardRefs.length === 0) { err(`${lp}.cardRefs`, "must be a non-empty array of card ids"); return; }
          const seen = new Set();
          l.cardRefs.forEach((ref, ri) => {
            const rp = `${lp}.cardRefs[${ri}]`;
            if (typeof ref !== "string" || !CARD_ID_RE.test(ref)) { err(rp, "must be a card id like alphabet-vowels.001"); return; }
            if (seen.has(ref)) { err(rp, `"${ref}" is listed twice`); return; }
            seen.add(ref);
            pendingRefs.push({ lesson, index: ri, ref, place: rp });
          });
          lesson.cards = new Array(l.cardRefs.length);
          lesson.isRefDeck = true;
        }
      });
    });
  }

  // Resolve references now that every card id is known. Refs point at real
  // cards only (a cardRefs deck cannot be the target).
  for (const p of pendingRefs) {
    const hit = cardIds.get(p.ref);
    if (!hit) err(p.place, `"${p.ref}" is not the id of any card in this file`);
    else p.lesson.cards[p.index] = hit.card;
  }
  for (const g of groups) {
    for (const l of g.lessons) {
      if (l.isRefDeck) { l.cards = l.cards.filter(Boolean); delete l.isRefDeck; }
    }
  }

  // defaultLesson must name a live lesson.
  if (isObject(lang) && typeof lang.defaultLesson === "string") {
    const target = groups.flatMap((g) => g.lessons).find((l) => l.slug === lang.defaultLesson);
    if (!target) err("language.defaultLesson", `"${lang.defaultLesson}" is not the slug of any lesson in this file`);
    else if (target.parked) err("language.defaultLesson", `"${lang.defaultLesson}" is parked; it must be a live lesson`);
  }

  if (errors.length) return { errors, model: null };
  return {
    errors,
    model: {
      code,
      name: lang.name,
      order: lang.order,
      defaultLesson: lang.defaultLesson,
      ip,
      groups,
    },
  };
}

/* ---------------------------------------------------------------- rendering */

/* Every value is written with JSON.stringify, which is a valid JS literal. On
 * top of that, three characters inside strings are written as \u escapes:
 * "<" (so "</script>" can never close a script tag if a generated file is ever
 * inlined into HTML) and the line/paragraph separators U+2028 and U+2029 (raw
 * line terminators in older JS engines). The value read back is the same. No
 * shipped string holds any of them today, so this changes no committed byte. */
const UNSAFE_IN_SCRIPT = new RegExp("[<" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

function S(value) {
  return JSON.stringify(value).replace(UNSAFE_IN_SCRIPT,
    (ch) => "\\" + "u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

function renderLesson(code, lesson) {
  const id = code + "/" + lesson.slug;
  const lines = [BANNER_LINE_1, BANNER_LINE_2, "window.LB_LESSON = {"];
  lines.push(`  id: ${S(id)},`);
  lines.push(`  title: ${S(lesson.title)},`);
  if (lesson.revealMs !== undefined) lines.push(`  revealMs: ${S(lesson.revealMs)},`);
  if (lesson.rollup === false) lines.push("  rollup: false,");
  if (lesson.recallPrompt !== undefined) lines.push(`  recallPrompt: ${S(lesson.recallPrompt)},`);
  lines.push("  cards: [");
  lesson.cards.forEach((c, i) => {
    const comma = i < lesson.cards.length - 1 ? "," : "";
    lines.push(`    { prompt: ${S(c.prompt)}, answer: ${S(c.answer)}, hint: ${S(c.hint)}, audio: ${S(c.audio)} }${comma}`);
  });
  lines.push("  ]");
  lines.push("};");
  const rollup = lesson.rollup === false ? ", rollup: false" : "";
  lines.push(`(window.LB_LESSONS = window.LB_LESSONS || []).push({ id: ${S(id)}, title: ${S(lesson.title)}${rollup} });`);
  return lines.join("\n") + "\n";
}

function renderManifest(models) {
  const lines = [BANNER_LINE_1, BANNER_LINE_2, "(function () {", '  "use strict";', "",
    "  window.LB_LANGUAGES = window.LB_LANGUAGES || [];"];
  for (const m of models) {
    lines.push("");
    lines.push("  window.LB_LANGUAGES.push({");
    lines.push(`    code: ${S(m.code)},`);
    lines.push(`    name: ${S(m.name)},`);
    lines.push(`    defaultLesson: ${S(m.code + "/" + m.defaultLesson)},`);
    lines.push("    groups: [");
    const liveGroups = m.groups
      .map((g) => ({ label: g.label, lessons: g.lessons.filter((l) => !l.parked) }))
      .filter((g) => g.lessons.length > 0);
    liveGroups.forEach((g, gi) => {
      lines.push("      {");
      lines.push(`        label: ${S(g.label)},`);
      lines.push("        lessons: [");
      g.lessons.forEach((l, li) => {
        const comma = li < g.lessons.length - 1 ? "," : "";
        lines.push(`          { id: ${S(m.code + "/" + l.slug)}, label: ${S(l.label)}, count: ${S(l.cards.length)}, rollup: ${S(l.rollup)} }${comma}`);
      });
      lines.push("        ]");
      lines.push("      }" + (gi < liveGroups.length - 1 ? "," : ""));
    });
    lines.push("    ]");
    lines.push("  });");
  }
  lines.push("})();");
  return lines.join("\n") + "\n";
}

/* --------------------------------------------------------------- generation */

/**
 * Read every data/*.json file. A file that cannot be read is returned with a
 * readError so it counts as failed instead of stopping the run.
 * @returns {Array<{name: string, text?: string, readError?: string}>}
 */
function readSources(dataDir, fsImpl) {
  const f = fsImpl || fs;
  const names = f.readdirSync(dataDir).filter((n) => n.endsWith(".json")).sort();
  return names.map((name) => {
    try {
      return { name, text: f.readFileSync(path.join(dataDir, name), "utf8") };
    } catch (e) {
      return { name, readError: e.message };
    }
  });
}

/**
 * Pure core, part 1: parse and check data file texts. The tests read the data
 * through this same function, so they see exactly what the build sees.
 * @param {Array<{name: string, text?: string, readError?: string}>} sources
 * @returns {{ models: object[], succeeded: number, failed: number, errors: string[] }}
 *   models are the languages that passed, sorted by language.order.
 */
function parseSources(sources) {
  const errors = [];
  const results = []; // { name, where, model|null }

  for (const src of sources) {
    const where = "data/" + src.name;
    if (src.readError) {
      errors.push(`${where}: cannot read file (${src.readError})`);
      results.push({ name: src.name, where, model: null });
      continue;
    }
    const fileCode = src.name.replace(/\.json$/, "");
    if (!CODE_RE.test(fileCode)) {
      errors.push(`${where}: the file name must be <language code>.json, with a code matching ${CODE_RE}`);
      results.push({ name: src.name, where, model: null });
      continue;
    }
    let doc;
    try {
      doc = JSON.parse(normalize(src.text));
    } catch (e) {
      errors.push(`${where}: not valid JSON (${e.message})`);
      results.push({ name: src.name, where, model: null });
      continue;
    }
    const v = validateLanguage(where, fileCode, doc);
    errors.push(...v.errors);
    results.push({ name: src.name, where, model: v.model });
  }

  // Cross-file rule: each language's order is unique (it sets the dropdown order
  // and the default language). Every file in a clash fails.
  const byOrder = new Map();
  for (const r of results) {
    if (!r.model) continue;
    if (!byOrder.has(r.model.order)) byOrder.set(r.model.order, []);
    byOrder.get(r.model.order).push(r);
  }
  for (const [order, list] of byOrder) {
    if (list.length < 2) continue;
    const names = list.map((r) => r.where).join(", ");
    for (const r of list) {
      errors.push(`${r.where} language.order: ${order} is used by more than one file (${names})`);
      r.model = null;
    }
  }

  const good = results.filter((r) => r.model);
  const failed = results.length - good.length;
  const models = good.map((r) => r.model).sort((a, b) => a.order - b.order);
  if (results.length === 0) errors.push("data/: no *.json data files found");
  return { models, succeeded: good.length, failed, errors };
}

/**
 * Pure core, part 2: turn data file texts into output files.
 * @param {Array<{name: string, text?: string, readError?: string}>} sources
 * @returns {{ files: Object<string,string>, succeeded: number, failed: number, errors: string[] }}
 *   files maps a repo-relative path (forward slashes) to its full text.
 */
function generateFromSources(sources) {
  const { models, succeeded, failed, errors } = parseSources(sources);
  const files = {};
  for (const m of models) {
    for (const g of m.groups) {
      for (const l of g.lessons) {
        const base = l.parked ? "parked/content" : "src/content";
        files[`${base}/${m.code}/${l.slug}.js`] = renderLesson(m.code, l);
      }
    }
  }
  if (failed === 0 && models.length > 0) files[MANIFEST_FILE] = renderManifest(models);

  return { files, succeeded, failed, errors };
}

/** Read data/*.json from disk and generate. */
function generate(dataDir, fsImpl) {
  return generateFromSources(readSources(dataDir || DATA_DIR, fsImpl));
}

/** Read data/*.json from disk and parse (no output files). */
function parse(dataDir, fsImpl) {
  return parseSources(readSources(dataDir || DATA_DIR, fsImpl));
}

/* ------------------------------------------------------- comparing / writing */

/** A file the output folders may hold: a lesson .js, or a leftover temp file. */
function isOutputName(name) {
  return name.endsWith(".js") || name.endsWith(".tmp");
}

/** Every .js and .tmp file in the output folders (each root and its sub-folders).
 *  A .tmp is never generated, so it always shows up as stale. */
function listOutputFiles(root, f) {
  const out = [];
  for (const rel of OUTPUT_ROOTS) {
    const dir = path.join(root, rel);
    if (!f.existsSync(dir)) continue;
    for (const ent of f.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isFile() && isOutputName(ent.name)) out.push(`${rel}/${ent.name}`);
      if (ent.isDirectory()) {
        for (const sub of f.readdirSync(path.join(dir, ent.name), { withFileTypes: true })) {
          if (sub.isFile() && isOutputName(sub.name)) out.push(`${rel}/${ent.name}/${sub.name}`);
        }
      }
    }
  }
  return out.sort();
}

function readIfExists(f, full) {
  if (!f.existsSync(full)) return null;
  return f.readFileSync(full, "utf8");
}

/**
 * Compare generated files with the ones on disk. Writes nothing.
 * @returns {{ differs: string[], missing: string[], stale: string[] }}
 */
function check(files, root, fsImpl) {
  const f = fsImpl || fs;
  const r = root || ROOT;
  const differs = [];
  const missing = [];
  for (const rel of Object.keys(files).sort()) {
    const now = readIfExists(f, path.join(r, rel));
    if (now === null) missing.push(rel);
    else if (normalize(now) !== files[rel]) differs.push(rel);
  }
  const stale = listOutputFiles(r, f).filter((rel) => !Object.prototype.hasOwnProperty.call(files, rel));
  return { differs, missing, stale };
}

/**
 * Write the generated files. Unchanged files are left alone.
 *   1. A file already at a generated path that does NOT carry the banner is
 *      never replaced: the whole write is refused (thrown), nothing changes.
 *   2. All changed files go to temp files first; if any temp write fails, the
 *      temps are removed, the originals are untouched, and the error is thrown.
 *   3. Every temp is renamed into place. A rename that fails is reported, its
 *      temp is removed, and the rest still go on (errors + failed list it).
 *   4. Stale .js / .tmp files are deleted only if they carry the banner; a
 *      delete that fails is reported and the rest still go on.
 * @returns {{ written: string[], failed: string[], unchanged: string[],
 *   deleted: string[], keptStale: string[], errors: string[] }}
 */
function write(files, root, fsImpl) {
  const f = fsImpl || fs;
  const r = root || ROOT;
  const { differs, missing, stale } = check(files, r, f);
  const changed = [...missing, ...differs].sort();
  const unchanged = Object.keys(files).filter((rel) => !changed.includes(rel)).sort();

  // 1. Never overwrite a file this script did not write. Every one is checked
  //    (one unreadable file does not stop the rest) before anything is touched.
  const refused = [];
  for (const rel of differs) {
    try {
      if (!hasBanner(f.readFileSync(path.join(r, rel), "utf8"))) refused.push(rel);
    } catch (e) {
      refused.push(`${rel} (${e.message})`);
    }
  }
  if (refused.length) {
    throw new Error("nothing was changed: these files sit where generated files go but have no GENERATED banner, " +
      `so they are not overwritten: ${refused.join(", ")}. Move or delete them by hand, then run npm run build:data again`);
  }

  // 2. Temp files first.
  const temps = [];
  try {
    for (const rel of changed) {
      const full = path.join(r, rel);
      f.mkdirSync(path.dirname(full), { recursive: true });
      const tmp = `${full}.${process.pid}.tmp`;
      f.writeFileSync(tmp, files[rel], "utf8");
      temps.push({ rel, tmp, full });
    }
  } catch (e) {
    for (const t of temps) {
      try { f.unlinkSync(t.tmp); } catch (_) { /* already gone */ }
    }
    throw new Error(`could not write a temp file, nothing was changed (${e.message})`);
  }

  // 3. Rename into place. Continue on error: one locked file must not leave
  //    the remaining temps behind or the remaining files unreplaced.
  const errors = [];
  const written = [];
  const failed = [];
  for (const t of temps) {
    try {
      f.renameSync(t.tmp, t.full);
      written.push(t.rel);
    } catch (e) {
      failed.push(t.rel);
      errors.push(`could not replace ${t.rel} (${e.message}); it was left as it was`);
      try {
        f.unlinkSync(t.tmp);
      } catch (e2) {
        errors.push(`could not remove the temp file for ${t.rel} (${e2.message}); delete it by hand`);
      }
    }
  }

  // 4. Stale files. Continue on error.
  const deleted = [];
  const keptStale = [];
  for (const rel of stale) {
    const full = path.join(r, rel);
    try {
      if (hasBanner(f.readFileSync(full, "utf8"))) {
        f.unlinkSync(full);
        deleted.push(rel);
      } else {
        keptStale.push(rel);
      }
    } catch (e) {
      errors.push(`could not delete the stale file ${rel} (${e.message})`);
    }
  }
  return { written, failed, unchanged, deleted, keptStale, errors };
}

/* --------------------------------------------------------------------- CLI */

/**
 * @param {string[]} argv arguments after the script name
 * @param {object} [deps] injectable parts (tests pass fakes)
 * @returns {number} exit code
 */
function main(argv, deps) {
  const d = Object.assign({
    root: ROOT,
    dataDir: DATA_DIR,
    readSources: (dir) => readSources(dir),
    check: (files, root) => check(files, root),
    write: (files, root) => write(files, root),
    log: (s) => process.stdout.write(s + "\n"),
    error: (s) => process.stderr.write(s + "\n"),
  }, deps || {});

  const args = argv || [];
  const unknown = args.filter((a) => a !== "--check");
  if (unknown.length) {
    d.error(`Unknown option: ${unknown.join(" ")}\nUsage: node scripts/build-data.js [--check]`);
    return 2;
  }
  const checkOnly = args.includes("--check");

  let sources;
  try {
    sources = d.readSources(d.dataDir);
  } catch (e) {
    d.error(`Cannot read the data folder (${e.message}). Nothing was written.`);
    return 1;
  }
  const result = generateFromSources(sources);
  d.log(`Data files: ${result.succeeded} succeeded, ${result.failed} failed.`);
  if (result.errors.length || result.failed > 0 || result.succeeded === 0) {
    for (const e of result.errors) d.error("  ERROR " + e);
    d.error("Nothing was written.");
    return 1;
  }

  if (checkOnly) {
    let c;
    try {
      c = d.check(result.files, d.root);
    } catch (e) {
      d.error(`  ERROR could not compare the generated files (${e.message})`);
      d.error("check:data FAILED.");
      return 1;
    }
    const total = Object.keys(result.files).length;
    for (const rel of c.differs) d.error("  DIFFERS " + rel);
    for (const rel of c.missing) d.error("  MISSING " + rel);
    for (const rel of c.stale) d.error("  STALE   " + rel);
    if (c.differs.length || c.missing.length || c.stale.length) {
      d.error(`check:data FAILED: ${c.differs.length} differ, ${c.missing.length} missing, ${c.stale.length} stale. Run: npm run build:data`);
      return 1;
    }
    d.log(`check:data OK: all ${total} generated files match data/*.json.`);
    return 0;
  }

  let w;
  try {
    w = d.write(result.files, d.root);
  } catch (e) {
    d.error("  ERROR " + e.message);
    return 1;
  }
  d.log(`build:data: ${w.written.length} written, ${w.unchanged.length} unchanged, ${w.deleted.length} stale deleted.`);
  for (const rel of w.written) d.log("  wrote   " + rel);
  for (const rel of w.deleted) d.log("  deleted " + rel);
  let code = 0;
  const writeErrors = w.errors || [];
  if (writeErrors.length) {
    for (const e of writeErrors) d.error("  ERROR " + e);
    const failedCount = (w.failed || []).length;
    // The count only means something when a replace failed; a failed stale
    // delete alone leaves every changed file replaced.
    if (failedCount > 0) {
      d.error(`Replaced ${w.written.length} of ${w.written.length + failedCount} changed files.`);
    }
    d.error("Fix the cause, then run: npm run build:data again");
    code = 1;
  }
  if (w.keptStale.length) {
    for (const rel of w.keptStale) d.error("  STALE (not generated, left alone) " + rel);
    d.error("Some stale files are not generated files, so they were not deleted. Move or delete them by hand.");
    code = 1;
  }
  return code;
}

module.exports = {
  generate,
  generateFromSources,
  parse,
  parseSources,
  readSources,
  validateLanguage,
  renderLesson,
  renderManifest,
  check,
  write,
  main,
  normalize,
  BANNER,
  CODE_RE,
  SLUG_RE,
  CARD_ID_RE,
  ROOT,
  DATA_DIR,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
