/* Test helper: load a content/sq/lesson-N.js data file in an isolated sandbox.
 *
 * The lesson data files assign to window.LB_LESSON and push onto
 * window.LB_LESSONS. They are plain <script src> globals — no module exports,
 * no DOM access. We run each file inside a fresh vm context with a minimal
 * `window` shim so we can capture what it set, with zero npm dependencies
 * (Node built-ins only: node:fs, node:path, node:vm).
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CONTENT_DIR = path.resolve(__dirname, "..", "..", "content", "sq");

/**
 * Load one lesson data file in isolation.
 * @param {string} file e.g. "lesson-1.js"
 * @returns {{ lesson: object, lessonsIndex: Array<{id:string,title:string}> }}
 */
function loadLesson(file) {
  const full = path.join(CONTENT_DIR, file);
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

module.exports = { loadLesson, CONTENT_DIR };
