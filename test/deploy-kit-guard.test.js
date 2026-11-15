/* LB-37: public-repo guard for the deploy kit. This repo is public, so nothing under scripts/
 * may hold a server or computer detail.
 *
 * Run:  node --test
 *
 * 1. Every file under scripts/ passes the leak rules of scripts/deploy/preflight.js: no IP
 *    address (127.0.0.1 allowed), /home/ or /root/ path, key file name or path, private key
 *    text, SSH key body, host-key fingerprint, email, Windows user folder or drive path, or
 *    default server login name.
 * 2. The real private settings (LB_DEPLOY_CONFIG, or the default place outside the repo) are
 *    not inside the repo, and none of their values appears in any repo file. Skipped, with
 *    the reason, on a computer that has no settings file. Values are never printed.
 * 3. No person or agent name from a private word list (LB_LEAK_WORDS, or leak-words.txt next
 *    to the default settings file) appears under scripts/ or in the deploy test files. The
 *    list lives outside the repo so the names are never written here. Skipped, with the
 *    reason, when the list is missing.
 * 4. deploy.env.example holds placeholders only, and exactly the settings deploy.sh knows.
 * 5. .gitignore keeps the settings file and key files out of git, but not the kit itself
 *    (checked with git's own matcher in a temp repo).
 * 6. The kit is checked out with LF line endings, and deploy.sh passes preflight.js exactly
 *    the arguments preflight.js accepts.
 * Node built-ins (plus the git command for item 5).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const pf = require("../scripts/deploy/preflight.js");
const { REPO, KIT, gitAvailable, tempRoot, removeTree, cleanEnv } = require("./helpers/deploy-env.js");

const SCRIPTS = path.join(REPO, "scripts");
const PRIVATE_DIR = path.join(os.homedir(), ".config", "languagebasics");

function fromMsys(p) { return pf.fromMsys(p); }

/* Files a commit of this folder would hold: git ls-files in a checkout, else every file (an
 * unpacked commit has no .git and no ignored files). */
function repoFiles() {
  if (fs.existsSync(path.join(REPO, ".git"))) {
    const r = spawnSync("git", ["-C", REPO, "ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8" });
    if (r.status === 0) return r.stdout.split("\0").filter(Boolean).filter((f) => fs.existsSync(path.join(REPO, f)));
  }
  return pf.walk(REPO).files.filter((f) => !/^(\.git|node_modules|\.idea)\//.test(f));
}

function readText(file) {
  const buf = fs.readFileSync(file);
  return buf.subarray(0, 8000).includes(0) ? null : buf.toString("utf8");
}

/* ------------------------------------------------------------ 1. leak rules */

test("guard: nothing under scripts/ holds an address, key, fingerprint, email, home or user path", () => {
  const problems = pf.scanFolder(SCRIPTS, "scripts/");
  assert.deepEqual(problems, [], "private details found:\n" + problems.join("\n"));
});

test("guard: the scan really reads every kit file (a planted sample in a copy is caught)", (t) => {
  const tr = tempRoot("lb37g-");
  if (tr.reason) throw new Error(tr.reason);
  t.after(() => removeTree(tr.root));
  const copy = path.join(tr.root, "scripts");
  fs.cpSync(SCRIPTS, copy, { recursive: true });
  const kitFiles = pf.walk(path.join(copy, "deploy")).files;
  assert.ok(kitFiles.length >= 6, `kit has only ${kitFiles.length} files`);
  for (const f of kitFiles) fs.appendFileSync(path.join(copy, "deploy", f), "\nx " + "198.51.100." + "4" + "\n");
  const hits = pf.scanFolder(copy, "scripts/").filter((p) => /\(ipv4\)$/.test(p));
  assert.equal(hits.length, kitFiles.length, hits.join("\n"));
});

/* ------------------------------------------------------------ 2. real private values */

function settingsFile() {
  return process.env.LB_DEPLOY_CONFIG ? path.resolve(fromMsys(process.env.LB_DEPLOY_CONFIG)) : path.join(PRIVATE_DIR, "deploy.env");
}

test("guard: no value from the private deploy settings appears in any repo file", (t) => {
  const conf = settingsFile();
  if (!fs.existsSync(conf)) {
    t.skip("no private deploy settings on this computer (LB_DEPLOY_CONFIG or ~/.config/languagebasics/deploy.env)");
    return;
  }
  assert.ok(!pf.inside(conf, REPO), "the private settings file is inside the repo");
  const values = [];
  for (const line of fs.readFileSync(conf, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!m) continue;
    let v = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (v.length < 4 || /^[0-9]+$/.test(v)) continue;
    const forms = new Set([v, v.replace(/\\/g, "/"), v.replace(/\//g, "\\")]);
    const m2 = /^([A-Za-z]):[\\/](.*)$/.exec(v);
    if (m2) forms.add(`/${m2[1].toLowerCase()}/${m2[2].replace(/\\/g, "/")}`);
    const ms = /^\/([a-z])\/(.*)$/.exec(v);
    if (ms) forms.add(`${ms[1].toUpperCase()}:/${ms[2]}`);
    values.push({ key: m[1], forms: [...forms].map((f) => f.toLowerCase()) });
  }
  assert.ok(values.length > 0, "the settings file has no values");
  const found = [];
  for (const f of repoFiles()) {
    const text = readText(path.join(REPO, f));
    if (text === null) continue;
    const low = text.toLowerCase();
    for (const v of values) if (v.forms.some((x) => low.includes(x))) found.push(`the value of ${v.key} is in ${f}`);
  }
  assert.deepEqual(found, [], found.join("\n"));
});

/* ------------------------------------------------------------ 3. names */

test("guard: no person or agent name from the private word list is under scripts/ or in the deploy tests", (t) => {
  const list = process.env.LB_LEAK_WORDS ? path.resolve(fromMsys(process.env.LB_LEAK_WORDS)) : path.join(PRIVATE_DIR, "leak-words.txt");
  if (!fs.existsSync(list)) {
    t.skip("no private word list on this computer (LB_LEAK_WORDS or ~/.config/languagebasics/leak-words.txt)");
    return;
  }
  assert.ok(!pf.inside(list, REPO), "the private word list is inside the repo");
  const words = [];
  fs.readFileSync(list, "utf8").split(/\r?\n/).forEach((w, i) => {
    w = w.trim();
    if (w && !w.startsWith("#")) words.push({ n: i + 1, re: new RegExp(`(?<![A-Za-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ +/g, "[\\s_-]*")}(?![A-Za-z0-9])`, "i") });
  });
  assert.ok(words.length > 0, "the word list is empty");
  const files = [
    ...pf.walk(SCRIPTS).files.map((f) => path.join("scripts", f)),
    ...pf.walk(path.join(REPO, "test")).files.map((f) => path.join("test", f))
      .filter((f) => /deploy|lb-release/.test(f.replace(/\\/g, "/"))),
  ];
  const found = [];
  for (const f of files) {
    const text = readText(path.join(REPO, f));
    if (text === null) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      for (const w of words) if (w.re.test(line)) found.push(`word list line ${w.n} is in ${f.replace(/\\/g, "/")} line ${i + 1}`);
    });
  }
  assert.deepEqual(found, [], found.join("\n"));
});

/* ------------------------------------------------------------ 4. example file */

function bashArray(src, name) {
  const m = new RegExp(`^${name}=\\(([^)]*)\\)`, "m").exec(src);
  assert.ok(m, `${name} not found in deploy.sh`);
  return m[1].trim().split(/\s+/);
}

test("guard: deploy.env.example holds placeholders only, for exactly the settings deploy.sh knows", () => {
  const ex = fs.readFileSync(path.join(KIT, "deploy.env.example"), "utf8");
  const sh = fs.readFileSync(path.join(KIT, "deploy.sh"), "utf8");
  const required = bashArray(sh, "REQUIRED_KEYS");
  const optional = bashArray(sh, "OPTIONAL_KEYS");
  const set = [];
  const commented = [];
  ex.split(/\r?\n/).forEach((line, i) => {
    const s = line.trim();
    if (!s) return;
    const live = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(s);
    const off = /^#\s*([A-Z][A-Z0-9_]*)=(\S.*)$/.exec(s);
    const m = live || off;
    if (!m) { assert.ok(s.startsWith("#"), `line ${i + 1} is neither a comment nor KEY=<placeholder>`); return; }
    const value = m[2].replace(/\s+\(default[^)]*\)\s*$/, "").trim();
    assert.match(value, /^<[^<>]+>$/, `line ${i + 1}: ${m[1]} is not a <placeholder>`);
    (live ? set : commented).push(m[1]);
  });
  assert.deepEqual([...set].sort(), [...required].sort(), "every required setting is in the example, set to a placeholder");
  assert.deepEqual([...commented].sort(), [...optional].sort(), "every optional setting is in the example, commented out");
});

/* ------------------------------------------------------------ 5. .gitignore */

test("guard: .gitignore keeps settings, keys and work files out of git, but not the kit", (t) => {
  if (!gitAvailable()) { t.skip("git is not installed"); return; }
  const tr = tempRoot("lb37gi-");
  if (tr.reason) throw new Error(tr.reason);
  t.after(() => removeTree(tr.root));
  const dir = path.join(tr.root, "repo");
  fs.mkdirSync(dir);
  fs.copyFileSync(path.join(REPO, ".gitignore"), path.join(dir, ".gitignore"));
  const env = cleanEnv(tr.root);
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: dir, env }).status, 0);
  const ignored = (p) => spawnSync("git", ["check-ignore", "-q", "--no-index", p], { cwd: dir, env }).status === 0;
  const mustIgnore = ["deploy.env", "scripts/deploy/deploy.env", "conf/deploy.env", "scripts/deploy/prod.env",
    "box.local.env", "server.pem", "scripts/deploy/server.pem", "id.key", "known_hosts", "deploy-log.txt",
    "clone-main/x", "kit-local/x", "build/x", "clone/x", "scripts/build/x", "scripts/clone/x"];
  const mustKeep = ["scripts/deploy/deploy.env.example", "scripts/deploy/deploy.sh", "scripts/deploy/lb-release.sh",
    "scripts/deploy/preflight.js", "scripts/deploy/README.md", "scripts/deploy/expected-headers.txt",
    "scripts/deploy/.gitattributes", "scripts/build-data.js", "src/index.html"];
  const wrongIgnored = mustKeep.filter(ignored);
  const notIgnored = mustIgnore.filter((p) => !ignored(p));
  assert.deepEqual(notIgnored, [], "should be ignored: " + notIgnored.join(", "));
  assert.deepEqual(wrongIgnored, [], "must not be ignored: " + wrongIgnored.join(", "));
});

/* ------------------------------------------------------------ 6. kit contract */

test("guard: the kit is checked out with LF line endings", () => {
  const ga = fs.readFileSync(path.join(KIT, ".gitattributes"), "utf8");
  assert.match(ga, /^\*\s+text\s+eol=lf\s*$/m);
});

test("guard: deploy.sh hands preflight.js exactly the arguments it accepts", () => {
  const sh = fs.readFileSync(path.join(KIT, "deploy.sh"), "utf8");
  const line = sh.split(/\r?\n/).find((l) => l.includes("preflight.js\" --sha"));
  assert.ok(line, "deploy.sh does not call preflight.js");
  const flags = [...line.matchAll(/--([a-z]+) /g)].map((m) => m[1]);
  assert.deepEqual(flags, ["sha", "tree", "build", "manifest", "repo"]);
  assert.ok(pf.parseArgs(flags.flatMap((f) => [`--${f}`, "x"])).opts, "preflight.js accepts that argument list");
});
