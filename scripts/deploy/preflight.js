#!/usr/bin/env node
/* preflight.js - last local check before deploy.sh contacts the server (LB-37).
 *
 * deploy.sh runs it from the kit commit, after its own checks and before any key, ssh or scp step:
 *
 *   node preflight.js --sha <40-hex> --tree <dir> --build <dir> --manifest <file> --repo <dir>
 *
 *   --sha       the approved commit id (full 40 characters, lower case)
 *   --tree      the full tree of that commit, unpacked by deploy.sh (npm test ran here)
 *   --build     the release folder: src/ of that commit, plus .manifest.sha256
 *   --manifest  the release manifest (lines "<sha256>  <path>")
 *   --repo      the developer's checkout; nothing above may sit inside it
 *
 * Checks (every problem is listed, then it refuses):
 *   1. the commit id is a full id; the folders exist and none sits inside the checkout;
 *   2. the build holds exactly the files of the tested tree's src/, byte for byte;
 *   3. the manifest lists every build file once, with the right hash, and nothing else;
 *   4. no dot-files (except the manifest), no links, no files that must never ship;
 *   5. index.html and engine.js are present;
 *   6. nothing under the commit's scripts/ or in the build holds private server or computer
 *      details (address, home folder, key path or key text, host-key fingerprint, email,
 *      Windows user folder, default server login name).
 *
 * Node built-ins only. Exit codes: 0 pass, 1 refused, 2 usage error.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PROG = "preflight";

/* Leak rules. Each pattern is written so that its own source text does not match it
 * (this file is scanned by the same rules). */
const LEAK_RULES = [
  { id: "ipv4", what: "an IPv4 address", re: /(?<![0-9.])(?:\d{1,3}\.){3}\d{1,3}(?![0-9.])/g,
    allow: (m) => m === "127.0.0.1" || m === "0.0.0.0" },
  { id: "home", what: "a server home-folder path", re: /\/hom[e]\//g },
  { id: "root-home", what: "a server root-user folder path", re: /(?<![A-Za-z0-9_.-])\/roo[t]\//g },
  { id: "key-file", what: "a key file name or path", re: /\.(?:pe[m]|ppk)\b|\bid_(?:rs[a]|ed2551[9]|ecds[a]|ds[a])\b|\.ss[h][\\/]/gi },
  { id: "private-key", what: "private key text", re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVAT[E] KEY-----/g },
  { id: "ssh-public-key", what: "an SSH key body", re: /\b(?:ssh-ed2551[9]|ssh-rs[a]|ecdsa-sha2-nistp\d+) AAAA[A-Za-z0-9+/]{20,}/g },
  { id: "fingerprint", what: "a host-key fingerprint", re: /\bSHA25[6]:[A-Za-z0-9+/]{43}(?![A-Za-z0-9+/])|\bMD[5]:(?:[0-9a-f]{2}:){15}[0-9a-f]{2}\b|(?<![0-9a-f:])(?:[0-9a-f]{2}:){15}[0-9a-f]{2}(?![0-9a-f:])/g },
  { id: "email", what: "an email address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g },
  { id: "windows-user", what: "a Windows user folder", re: /\b[A-Za-z]:[\\/]+User[s][\\/]|(?<![A-Za-z0-9_.-])\/[a-z]\/User[s]\//gi },
  { id: "windows-path", what: "a Windows drive path", re: /(?<![A-Za-z0-9])[A-Za-z]:\\{1,2}[A-Za-z0-9_$]/g },
  { id: "login-user", what: "a default server login name", re: /\b(?:ec2-us[e]r|bitnam[i]|ubunt[u]@|cento[s]@)/gi },
];

/* Scan one text. Returns [{ rule, what, line }] (the matched text is never returned). */
function scanText(text, rules) {
  const hits = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const r of rules || LEAK_RULES) {
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(lines[i])) !== null) {
        if (m[0] === "") { r.re.lastIndex++; continue; }
        if (r.allow && r.allow(m[0])) continue;
        hits.push({ rule: r.id, what: r.what, line: i + 1 });
        break;
      }
    }
  }
  return hits;
}

/* Every file under dir, as forward-slash paths relative to dir. Links are reported, not followed.
 * Continues past unreadable entries (they are listed in problems). */
function walk(dir, problems) {
  const out = [];
  const links = [];
  const stack = [""];
  while (stack.length) {
    const rel = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch (e) {
      if (problems) problems.push(`cannot read folder ${rel || "."} (${e.code || e.message})`);
      continue;
    }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) links.push(r);
      else if (e.isDirectory()) stack.push(r);
      else if (e.isFile()) out.push(r);
      else links.push(r);
    }
  }
  return { files: out.sort(), links: links.sort() };
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function isBinary(buf) {
  return buf.subarray(0, 8000).includes(0);
}

/* inside(child, parent): child is parent or under it (case-insensitive on Windows). */
function inside(child, parent) {
  const norm = (p) => {
    let r = path.resolve(p);
    if (process.platform === "win32") r = r.toLowerCase();
    return r.replace(/[\\/]+$/, "");
  };
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(p + path.sep);
}

/* Paths deploy.sh passes from Git Bash may arrive as /c/...; turn them into C:/... on Windows. */
function fromMsys(p) {
  if (process.platform === "win32" && /^\/[A-Za-z]\//.test(p)) return `${p[1].toUpperCase()}:${p.slice(2)}`;
  return p;
}

const FLAGS = ["sha", "tree", "build", "manifest", "repo"];

/* parseArgs(argv) -> { opts } or { usage: "message" } */
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") return { help: true };
    const m = /^--([a-z]+)$/.exec(a);
    if (!m || !FLAGS.includes(m[1])) return { usage: `unknown argument ${a}` };
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) return { usage: `--${m[1]} needs a value` };
    if (Object.prototype.hasOwnProperty.call(opts, m[1])) return { usage: `--${m[1]} given twice` };
    opts[m[1]] = argv[++i];
  }
  const missing = FLAGS.filter((f) => !opts[f]);
  if (missing.length) return { usage: `missing ${missing.map((f) => "--" + f).join(", ")}` };
  for (const f of FLAGS) if (f !== "sha") opts[f] = fromMsys(opts[f]);
  return { opts };
}

/* Files and folders that must never be in a release (any depth unless noted). */
const NEVER_SHIP_TOP = new Set(["package.json", "package-lock.json", "CLAUDE.md", "node_modules", "scripts", "test", "parked", "data", "docs"]);
const NEVER_SHIP_ANY = [/\.test\.js$/i, /(^|\/)deploy\.env$/i, /\.env$/i, /\.(?:pe[m]|key|ppk)$/i, /(^|\/)known_hosts$/i, /\.log$/i, /(^|\/)deploy-log\.txt$/i];
const REQUIRED_IN_BUILD = ["index.html", "engine.js"];
const MANIFEST_NAME = ".manifest.sha256";

/* checkPaths(opts) -> problems[]  (check 1) */
function checkPaths(opts) {
  const problems = [];
  if (!/^[0-9a-f]{40}$/.test(opts.sha)) problems.push("--sha must be the full 40-character lower-case commit id");
  const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  if (!isDir(opts.repo)) problems.push("--repo is not a folder");
  if (!isDir(opts.tree)) problems.push("--tree is not a folder");
  else if (!isDir(path.join(opts.tree, "src"))) problems.push("--tree has no src/ folder");
  if (!isDir(opts.build)) problems.push("--build is not a folder");
  if (!isFile(opts.manifest)) problems.push("--manifest is not a file");
  else if (path.resolve(path.dirname(opts.manifest)) !== path.resolve(opts.build) || path.basename(opts.manifest) !== MANIFEST_NAME)
    problems.push(`--manifest must be ${MANIFEST_NAME} at the top of --build`);
  for (const f of ["tree", "build", "manifest"]) {
    if (isDir(opts.repo) && inside(opts[f], opts.repo))
      problems.push(`--${f} is inside the checkout (--repo); build files must never be written in the repo`);
  }
  return problems;
}

/* checkBuild(treeSrc, build) -> problems[]  (checks 2, 4, 5). Lists every problem. */
function checkBuild(treeSrc, build) {
  const problems = [];
  const t = walk(treeSrc, problems);
  const b = walk(build, problems);
  for (const l of b.links) problems.push(`link or special file in build: ${l}`);
  for (const l of t.links) problems.push(`link or special file in the tested tree's src: ${l}`);
  const bset = new Set(b.files.filter((f) => f !== MANIFEST_NAME));
  const tset = new Set(t.files);
  for (const f of t.files) {
    if (!bset.has(f)) { problems.push(`missing from build: ${f}`); continue; }
    try {
      if (!fs.readFileSync(path.join(treeSrc, f)).equals(fs.readFileSync(path.join(build, f))))
        problems.push(`build differs from the tested tree: ${f}`);
    } catch (e) {
      problems.push(`cannot read ${f} (${e.code || e.message})`);
    }
  }
  for (const f of bset) if (!tset.has(f)) problems.push(`in build but not in the tested tree: ${f}`);
  for (const f of b.files) {
    if (f === MANIFEST_NAME) continue;
    const parts = f.split("/");
    if (parts.some((p) => p.startsWith("."))) problems.push(`dot-file in build: ${f}`);
    if (NEVER_SHIP_TOP.has(parts[0])) problems.push(`must never ship: ${f}`);
    else if (NEVER_SHIP_ANY.some((re) => re.test(f))) problems.push(`must never ship: ${f}`);
  }
  for (const f of REQUIRED_IN_BUILD) if (!bset.has(f)) problems.push(`build has no ${f}`);
  return problems;
}

/* checkManifest(build, manifestFile) -> problems[]  (check 3). Lists every problem. */
function checkManifest(build, manifestFile) {
  const problems = [];
  let text;
  try { text = fs.readFileSync(manifestFile, "utf8"); } catch (e) { return [`cannot read the manifest (${e.code || e.message})`]; }
  const listed = new Map();
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) problems.push("manifest is empty");
  lines.forEach((line, i) => {
    const m = /^([0-9a-f]{64})  (\S(?:.*\S)?)$/.exec(line);
    if (!m) { problems.push(`manifest line ${i + 1} is not "<sha256>  <path>"`); return; }
    const p = m[2];
    if (p.startsWith("/") || p.split("/").some((s) => s === ".." || s === "." || s === "")) {
      problems.push(`manifest line ${i + 1}: unsafe path ${p}`); return;
    }
    if (listed.has(p)) { problems.push(`manifest lists ${p} twice`); return; }
    listed.set(p, m[1]);
  });
  const { files } = walk(build, problems);
  const actual = new Set(files.filter((f) => f !== MANIFEST_NAME));
  if (listed.has(MANIFEST_NAME)) problems.push("manifest lists itself");
  for (const [p, h] of listed) {
    if (p === MANIFEST_NAME) continue;
    if (!actual.has(p)) { problems.push(`manifest lists ${p}, which is not in the build`); continue; }
    try {
      if (sha256(fs.readFileSync(path.join(build, p))) !== h) problems.push(`manifest hash is wrong for ${p}`);
    } catch (e) {
      problems.push(`cannot read ${p} (${e.code || e.message})`);
    }
  }
  for (const f of actual) if (!listed.has(f)) problems.push(`manifest does not list ${f}`);
  return problems;
}

/* scanFolder(dir, label, rules) -> problems[]  (check 6). Text files only; every hit listed. */
function scanFolder(dir, label, rules) {
  const problems = [];
  let st;
  try { st = fs.statSync(dir); } catch { return problems; }
  if (!st.isDirectory()) return problems;
  const { files } = walk(dir, problems);
  for (const f of files) {
    let buf;
    try { buf = fs.readFileSync(path.join(dir, f)); } catch (e) { problems.push(`cannot read ${label}${f} (${e.code || e.message})`); continue; }
    if (isBinary(buf)) continue;
    for (const h of scanText(buf.toString("utf8"), rules)) problems.push(`${label}${f} line ${h.line} holds ${h.what} (${h.rule})`);
  }
  return problems;
}

/* run(argv, io) -> exit code. io = { out(line), err(line) } */
function run(argv, io) {
  const out = (io && io.out) || ((s) => process.stdout.write(s + "\n"));
  const err = (io && io.err) || ((s) => process.stderr.write(s + "\n"));
  const a = parseArgs(argv);
  if (a.help) {
    out("usage: node preflight.js --sha <40-hex> --tree <dir> --build <dir> --manifest <file> --repo <dir>");
    return 0;
  }
  if (a.usage) { err(`${PROG}: ${a.usage}`); err(`${PROG}: try --help`); return 2; }
  const o = a.opts;
  const problems = checkPaths(o);
  if (problems.length === 0) {
    problems.push(...checkBuild(path.join(o.tree, "src"), o.build));
    problems.push(...checkManifest(o.build, o.manifest));
    problems.push(...scanFolder(path.join(o.tree, "scripts"), "scripts/"));
    problems.push(...scanFolder(o.build, "build: ", LEAK_RULES.filter((r) => r.id !== "email")));
  }
  if (problems.length) {
    err(`${PROG}: REFUSED (${problems.length} problem(s)); nothing was sent to the server:`);
    for (const p of problems) err(`  - ${p}`);
    return 1;
  }
  out(`${PROG}: PASS for ${o.sha}: build matches the tested tree, manifest complete, no private details found`);
  return 0;
}

module.exports = { LEAK_RULES, scanText, scanFolder, walk, inside, fromMsys, parseArgs, checkPaths, checkBuild, checkManifest, run, MANIFEST_NAME };

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}
