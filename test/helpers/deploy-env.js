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
 *   a full parallel "npm test" one deploy run can take minutes on a slow or busy computer. On a
 *   timeout it stops the run's whole process tree, not only the top bash (guardMain below).
 * - readArgs(): reads the FAKE_ARGS log, where the fake ssh, scp, curl and the tar shim write
 *   their full argument lists.
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

/* The hang guard itself, run as a small separate node process (node -e) around each bash run.
 * spawnSync's own timeout stops only the top bash: its children (deploy.sh's fake ssh / curl, the
 * server script) kept running and writing into the test's calls file and server folder, so the
 * next step failed for the wrong reason. This guard starts bash and, on timeout, stops the WHOLE
 * process tree:
 *  - Windows (Git Bash): the top bash leads its own bash process group, and every child it starts
 *    (also after an exec) stays in that group, so the guard runs `kill -9 -- -<group>` in a fresh
 *    bash. taskkill /T /F then also stops what is still linked to the top process. (taskkill alone
 *    is not enough: Git Bash children are not always linked to their Windows parent.)
 *  - elsewhere: bash is started as its own process group, which gets SIGKILL.
 * On Windows the top bash first writes its bash pid and group into a small file (LBT_IDS, under
 * LB_TEST_TMP or the system temp folder; removed after the run) for the guard to read.
 * bash writes straight into the caller's stdout / stderr; the guard reports the result as one JSON
 * line on the caller's fourth pipe (its fd 3). Its settings come in LBT_GUARD (JSON), not argv. */
function guardMain() {
  const { spawn, spawnSync: sync } = require("node:child_process");
  const fsg = require("node:fs");
  const WINDOWS = process.platform === "win32";
  const g = JSON.parse(process.env.LBT_GUARD);
  delete process.env.LBT_GUARD;
  const child = spawn(g.bash, g.argv, { cwd: g.cwd, env: process.env, stdio: "inherit", detached: !WINDOWS, windowsHide: true });
  let timedOut = false;
  const killTree = () => {
    if (WINDOWS) {
      let ids = "";
      try { ids = fsg.readFileSync(g.ids, "utf8"); } catch { /* bash wrote nothing yet */ }
      const m = /^(\d+) (\d+)$/m.exec(ids);
      // Only a group the top bash leads (group = its own pid), never a wider one.
      if (m && m[1] === m[2]) sync(g.bash, ["-c", 'kill -9 -- "-$1" 2>/dev/null; true', "lbtguard", m[2]], { stdio: "ignore", windowsHide: true, timeout: 60000 });
      const tk = require("node:path").join(process.env.SystemRoot || process.env.windir || "C:\\Windows", "System32", "taskkill.exe");
      sync(tk, ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true, timeout: 60000 });
    } else {
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
    }
    try { child.kill("SIGKILL"); } catch { /* already gone */ }
  };
  const timer = setTimeout(() => { timedOut = true; killTree(); }, g.ms);
  const report = (o) => { clearTimeout(timer); try { fsg.writeSync(3, JSON.stringify(o) + "\n"); } catch { /* caller gone */ } process.exit(0); };
  child.on("error", (e) => report({ code: null, signal: null, timedOut, spawnError: String(e && e.message) }));
  child.on("exit", (code, signal) => {
    // A run that ended on its own may still have left children behind (e.g. a background job);
    // elsewhere than Windows that costs nothing to clean up, so its process group is stopped too.
    if (!timedOut && !WINDOWS) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* none left */ } }
    report({ code, signal, timedOut });
  });
}
const GUARD_SRC = `(${guardMain.toString()})()`;
let RUNS = 0;

/* Run a bash script (or a -c command when opts.command is set) with the shims first on PATH.
 * -> { code, out, err, all, error, timedOut }. On a timeout code is null, timedOut is true and
 * error says the whole process tree was stopped. */
function runBash(script, args, opts) {
  const b = findBash();
  if (!b.bash) throw new Error(b.reason);
  const env = Object.assign({}, opts.env, { LBT_SHIMS: toBash(opts.shims) });
  // Windows: first write this bash's pid and process group for the hang guard (see guardMain).
  const idFile = WIN ? path.join(process.env.LB_TEST_TMP || os.tmpdir(), `lbt-guard-${process.pid}-${++RUNS}.txt`) : "";
  if (WIN) env.LBT_IDS = toBash(idFile);
  const ids = WIN ? '{ read -r _lbt_g < "/proc/$$/pgid"; echo "$$ ${_lbt_g:-}" > "$LBT_IDS"; } 2>/dev/null; unset _lbt_g LBT_IDS; ' : "";
  const argv = opts.command
    ? ["-c", `${ids}PATH="$LBT_SHIMS:$PATH"; ${opts.command}`, "lbtest", ...(args || [])]
    : ["-c", `${ids}PATH="$LBT_SHIMS:$PATH"; exec bash "$0" "$@"`, toBash(script), ...(args || [])];
  const ms = opts.timeout || RUN_TIMEOUT_MS;
  const genv = Object.assign({}, env, { LBT_GUARD: JSON.stringify({ bash: b.bash, argv, cwd: opts.cwd, ms, ids: idFile }) });
  // A file left by an earlier, killed test process (same pid, same run number) must never be read
  // as this run's ids: remove it before bash starts, so the guard only sees what this bash wrote.
  if (WIN) fs.rmSync(idFile, { force: true });
  // Backstop: if the guard itself hangs, spawnSync stops it a minute after the guard should have.
  const r = spawnSync(process.execPath, ["-e", GUARD_SRC], {
    cwd: opts.cwd, env: genv, encoding: "utf8", stdio: ["pipe", "pipe", "pipe", "pipe"], timeout: ms + 60000, windowsHide: true,
  });
  if (WIN) { try { fs.rmSync(idFile, { force: true }); } catch { /* best effort */ } }
  let g = null;
  try { g = JSON.parse(String((r.output && r.output[3]) || "").trim().split("\n").pop()); } catch { g = null; }
  const out = r.stdout || "", err = r.stderr || "";
  let error = r.error;
  if (g && g.timedOut) error = Object.assign(new Error(`bash run timed out after ${ms} ms; its whole process tree was stopped`), { code: "ETIMEDOUT" });
  else if (g && g.spawnError) error = new Error(`bash did not start: ${g.spawnError}`);
  else if (!g && !error) error = new Error(`the hang guard gave no result (exit ${r.status}): ${err.slice(-500)}`);
  const code = g && !g.timedOut ? g.code : null;
  return { code, out, err, all: out + err, error, timedOut: !!(g ? g.timedOut : r.error && r.error.code === "ETIMEDOUT") };
}

/* The FAKE_ARGS log: one entry per call, [name, ...arguments] with the fakes' escapes undone. */
function readArgs(file) {
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  const unescape = (s) => s.replace(/\\([\\tn])/g, (m, c) => (c === "t" ? "\t" : c === "n" ? "\n" : "\\"));
  return text.split("\n").filter(Boolean).map((l) => l.split("\t").map(unescape));
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
  installFakes, installOddShim, runBash, readCalls, readArgs, serverCalls };
