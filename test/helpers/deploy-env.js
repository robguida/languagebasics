/* Test helper (LB-37): run the deploy kit's bash scripts from node --test with fakes only.
 *
 * - findBash(): a bash 4+ with git, tar and coreutils. On Windows that is Git Bash (found from
 *   `git --exec-path`, or LB_TEST_BASH). The Windows "bash.exe" launcher for WSL is never used.
 *   No bash (or LB_TEST_BASH=none) = the caller skips its tests with the reason given here.
 * - tempRoot(): a fresh folder under LB_TEST_TMP (or the system temp folder). It must be outside
 *   any git working tree and its path must be plain characters (the kit refuses anything else).
 * - cleanEnv(): the current environment minus every LB_* variable, with git isolated from the
 *   user's own git settings and HOME pointed into the test folder, so no test can read real
 *   deploy settings or contact a real server.
 * - installFakes(): copies test/fixtures/deploy-fakes/ into a bin folder (ssh, scp, ssh-keyscan,
 *   ssh-keygen, curl, npm; on Windows also the ln/readlink junction shims). The fakes start bash
 *   directly (no "env" process in between), because a deploy test calls them hundreds of times.
 * - installOddShim(): puts test/fixtures/deploy-fakes/odd-shim in front of git, ln or stat, so a
 *   test can make that one command answer oddly (FAKE_GIT_ODD_*, FAKE_LN_FAIL_AT, FAKE_STAT_FAIL).
 * - runBash(): a hang guard of RUN_TIMEOUT_MS per run (10 minutes). It is not a speed check: under
 *   a full parallel "npm test" one deploy run can take minutes on a slow or busy computer.
 *
 * Node built-ins only.
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO = path.resolve(__dirname, "..", "..");
const KIT = path.join(REPO, "scripts", "deploy");
const FAKES = path.join(REPO, "test", "fixtures", "deploy-fakes");
const WIN = process.platform === "win32";
const PLAIN = /^[A-Za-z0-9._/:\\-]+$/;

/* C:\a\b -> /c/a/b on Windows (Git Bash form); unchanged elsewhere. */
function toBash(p) {
  if (!WIN) return p;
  const r = path.resolve(p).replace(/\\/g, "/");
  return /^[A-Za-z]:/.test(r) ? `/${r[0].toLowerCase()}${r.slice(2)}` : r;
}

function gitAvailable() {
  const r = spawnSync("git", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

let BASH_CACHE;
/* -> { bash } or { reason } */
function findBash() {
  if (BASH_CACHE) return BASH_CACHE;
  if (process.env.LB_TEST_BASH === "none") {
    BASH_CACHE = { reason: "bash tests turned off (LB_TEST_BASH=none)" };
    return BASH_CACHE;
  }
  const cands = [];
  if (process.env.LB_TEST_BASH) cands.push(process.env.LB_TEST_BASH);
  if (WIN) {
    const g = spawnSync("git", ["--exec-path"], { encoding: "utf8" });
    if (g.status === 0) {
      const root = path.resolve(g.stdout.trim(), "..", "..", "..");
      cands.push(path.join(root, "bin", "bash.exe"), path.join(root, "usr", "bin", "bash.exe"));
    }
    cands.push("C:\\Program Files\\Git\\bin\\bash.exe");
  } else {
    cands.push("bash");
  }
  const tried = [];
  for (const c of cands) {
    if (WIN && !fs.existsSync(c)) { tried.push(`${c}: not found`); continue; }
    const r = spawnSync(c, ["-c", 'echo "${BASH_VERSINFO[0]}|$(uname -s)|$(command -v git tar sha256sum awk sed find mktemp | wc -l)|$BASH"'],
      { encoding: "utf8", timeout: 20000 });
    if (r.status !== 0 || !r.stdout) { tried.push(`${c}: does not run`); continue; }
    const [ver, uname, tools, self] = r.stdout.trim().split("|");
    if (Number(ver) < 4) { tried.push(`${c}: bash ${ver} is older than 4`); continue; }
    if (WIN && !/MINGW|MSYS|CYGWIN/i.test(uname)) { tried.push(`${c}: not Git Bash (${uname})`); continue; }
    if (Number(tools) < 7) { tried.push(`${c}: git, tar or coreutils missing`); continue; }
    // self: this bash's own path as bash sees it (e.g. /usr/bin/bash), for the fakes' first line
    BASH_CACHE = { bash: c, self: /^\/[A-Za-z0-9._/-]+$/.test(self || "") ? self : "" };
    return BASH_CACHE;
  }
  BASH_CACHE = { reason: `no usable bash 4+ with git and coreutils (${tried.join("; ") || "none found"}); on Windows install Git for Windows or set LB_TEST_BASH` };
  return BASH_CACHE;
}

/* Is dir inside a git working tree? */
function inWorktree(dir) {
  const r = spawnSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() === "true";
}

/* -> { root } or { reason }. The caller removes root (removeTree). */
function tempRoot(prefix) {
  const base = process.env.LB_TEST_TMP || os.tmpdir();
  fs.mkdirSync(base, { recursive: true });
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(base, prefix || "lb37-")));
  if (!PLAIN.test(root)) {
    removeTree(root);
    return { reason: `temp folder ${root} has characters the deploy kit refuses; set LB_TEST_TMP to a plain path` };
  }
  if (inWorktree(root)) {
    removeTree(root);
    return { reason: `temp folder ${root} is inside a git working tree; set LB_TEST_TMP to a folder outside any repo` };
  }
  return { root };
}

function removeTree(root) {
  if (!root || process.env.LB_TEST_KEEP) return;
  const b = findBash();
  if (b.bash) spawnSync(b.bash, ["-c", 'chmod -R u+w "$0" 2>/dev/null; true', toBash(root)], { timeout: 60000 });
  try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* best effort */ }
}

/* Environment for every spawned git / bash: no LB_* from the caller, no user git config. */
function cleanEnv(root) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^LB_/i.test(k) || /^FAKE_/i.test(k)) continue;
    if (/^GIT_/i.test(k)) continue;
    env[k] = v;
  }
  const home = path.join(root, "home");
  fs.mkdirSync(home, { recursive: true });
  const gcfg = path.join(root, "home", "gitconfig");
  if (!fs.existsSync(gcfg)) fs.writeFileSync(gcfg, "");
  Object.assign(env, {
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: gcfg,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    GIT_TERMINAL_PROMPT: "0",
  });
  return env;
}

function git(env, cwd, ...args) {
  const r = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/* A fake's text: LF line endings, and "#!/usr/bin/env bash" replaced by the found bash's own path
 * when it has plain characters (one process less per call; on Windows each process is slow). */
function fakeText(file) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const self = findBash().self;
  return self ? text.replace(/^#!\/usr\/bin\/env bash\n/, `#!${self}\n`) : text;
}

/* Copy the fakes into <root>/bin (LF line endings, executable). Returns the bin folder. */
function installFakes(root) {
  const bin = path.join(root, "bin");
  const shims = path.join(root, "shims");
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(shims, { recursive: true });
  for (const name of ["ssh", "scp", "ssh-keyscan", "ssh-keygen", "curl", "npm"]) {
    fs.writeFileSync(path.join(bin, name), fakeText(path.join(FAKES, name)), { mode: 0o755 });
  }
  if (WIN) {
    for (const name of ["ln", "readlink"]) {
      fs.writeFileSync(path.join(shims, name), fakeText(path.join(FAKES, `${name}-windows`)), { mode: 0o755 });
    }
  }
  return { bin, shims };
}

/* Put the odd-shim fake in front of one command (git, ln or stat) in a shims folder. A shim already
 * there (the Windows ln junction shim) moves to <name>.next and still does the real work. */
function installOddShim(shims, name) {
  const p = path.join(shims, name);
  if (fs.existsSync(p)) fs.renameSync(p, `${p}.next`);
  fs.writeFileSync(p, fakeText(path.join(FAKES, "odd-shim")), { mode: 0o755 });
}

/* Hang guard per run. A full parallel "npm test" ran single deploy runs past the old 180 s on a busy
 * laptop; 10 minutes leaves a wide margin and still stops a run that truly hangs. */
const RUN_TIMEOUT_MS = 600000;

/* Run a bash script (or a -c command when opts.command is set) with the shims first on PATH. */
function runBash(script, args, opts) {
  const b = findBash();
  if (!b.bash) throw new Error(b.reason);
  const env = Object.assign({}, opts.env, { LBT_SHIMS: toBash(opts.shims) });
  const argv = opts.command
    ? ["-c", `PATH="$LBT_SHIMS:$PATH"; ${opts.command}`, "lbtest", ...(args || [])]
    : ["-c", 'PATH="$LBT_SHIMS:$PATH"; exec bash "$0" "$@"', toBash(script), ...(args || [])];
  const r = spawnSync(b.bash, argv, { cwd: opts.cwd, env, encoding: "utf8", timeout: opts.timeout || RUN_TIMEOUT_MS });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "", all: (r.stdout || "") + (r.stderr || ""), error: r.error };
}

/* Lines of the fake-call log, or [] when nothing was called. */
function readCalls(file) {
  try { return fs.readFileSync(file, "utf8").split("\n").filter(Boolean); } catch { return []; }
}

/* Calls that would have reached the server or the network. */
function serverCalls(lines) {
  return lines.filter((l) => /^(ssh|scp|ssh-keyscan|ssh-keygen|curl) /.test(l));
}

module.exports = { REPO, KIT, FAKES, WIN, RUN_TIMEOUT_MS, toBash, gitAvailable, findBash, inWorktree, tempRoot, removeTree, cleanEnv, git,
  installFakes, installOddShim, runBash, readCalls, serverCalls };
