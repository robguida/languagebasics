/* Test helper: load a content/<lang>/<file> data file (or the manifest) in an
 * isolated sandbox.
 *
 * The lesson data files assign to window.LB_LESSON and push onto
 * window.LB_LESSONS. The manifest (content/languages.js) pushes onto
 * window.LB_LANGUAGES, and manifest.js assigns window.LBManifest. They are all
 * plain <script src> globals — no module exports, no DOM access. We run each
 * file inside a fresh vm context with a minimal `window` shim so we can capture
 * what it set, with zero npm dependencies (Node built-ins only: node:fs,
 * node:path, node:vm).
 *
 * LB-23: the lesson loader is language-parameterized — loadLesson(file, lang)
 * resolves under src/content/<lang> (default "sq"), so EXPECTED in the schema
 * test can be keyed by language namespace and a second language's data files
 * load through the same helper with no change.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC_DIR = path.resolve(__dirname, "..", "..", "src");
const CONTENT_ROOT = path.resolve(SRC_DIR, "content");
const PARKED_ROOT = path.resolve(SRC_DIR, "..", "parked", "content");

/** Absolute path to a language's content directory (default "sq"). */
function contentDir(lang) {
  return path.join(CONTENT_ROOT, lang || "sq");
}

/** LB-34: absolute path to a language's PARKED content dir (repo-root
 *  parked/content/<lang>, never deployed). */
function parkedDir(lang) {
  return path.join(PARKED_ROOT, lang || "sq");
}

/**
 * Load one lesson data file in isolation. opts.parked loads from parked/ instead.
 * @param {string} file e.g. "lesson-1.js"
 * @param {string} [lang="sq"] language namespace under src/content/
 * @returns {{ lesson: object, lessonsIndex: Array<{id:string,title:string}> }}
 */
function loadLesson(file, lang, opts) {
  const dir = (opts && opts.parked) ? parkedDir(lang) : contentDir(lang);
  const full = path.join(dir, file);
  const code = fs.readFileSync(full, "utf8");

  // Fresh window shim per load so LB_LESSONS does not leak between files.
  const windowShim = { LB_LESSONS: [] };
  const sandbox = { window: windowShim, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: full });

  return {
    lesson: windowShim.LB_LESSON,
    lessonsIndex: windowShim.LB_LESSONS,
  };
}

/**
 * Load the LB-23 manifest (content/languages.js) + its pure helper module
 * (src/manifest.js) into one fresh sandbox, exactly as index.html loads them
 * (languages.js first, then manifest.js). Returns the live registry + helpers.
 * @returns {{ languages: Array, LBManifest: object }}
 */
function loadManifest() {
  const windowShim = {};
  const sandbox = { window: windowShim, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(CONTENT_ROOT, "languages.js"), "utf8"),
    sandbox,
    { filename: path.join(CONTENT_ROOT, "languages.js") }
  );
  vm.runInContext(
    fs.readFileSync(path.join(SRC_DIR, "manifest.js"), "utf8"),
    sandbox,
    { filename: path.join(SRC_DIR, "manifest.js") }
  );
  return {
    languages: windowShim.LB_LANGUAGES || [],
    LBManifest: windowShim.LBManifest,
  };
}

module.exports = {
  loadLesson,
  loadManifest,
  contentDir,
  parkedDir,
  CONTENT_ROOT,
  PARKED_ROOT,
  // Back-compat: the default (sq) content dir, as several tests import today.
  CONTENT_DIR: contentDir("sq"),
};
