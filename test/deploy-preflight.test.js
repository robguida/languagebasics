/* LB-37: tests for scripts/deploy/preflight.js, the last local check before the deploy kit
 * contacts the server.
 *
 * Run:  node --test
 *
 * 1. Arguments: --help is 0, a usage error is 2 (unknown, missing, doubled, no value).
 * 2. A good release passes (exit 0).
 * 3. Refusals (exit 1), each listing EVERY problem before refusing:
 *    a short or upper-case commit id; tree, build or manifest inside the checkout;
 *    build files that differ from, are missing from, or are extra to the tested tree;
 *    manifest lines that are malformed, doubled, wrong, missing or unlisted;
 *    dot-files, links and files that must never ship; no index.html / engine.js;
 *    private details (address, key text, key path, home folder, email ...) under the
 *    commit's scripts/ or in the build.
 * 4. The leak rules catch each kind of sample, allow 127.0.0.1, and do not match their
 *    own source text.
 * Uses small temp folders (removed after). Node built-ins only; no bash, no network.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const pf = require("../scripts/deploy/preflight.js");
const { tempRoot, removeTree } = require("./helpers/deploy-env.js");

const SHA = "0123456789abcdef0123456789abcdef01234567";

/* Samples are built from pieces so this file holds no real-looking private detail. */
const SAMPLES = {
  ipv4: "203.0.113." + "9",
  home: "/ho" + "me/someone/x",
  "root-home": "/roo" + "t/.config",
  "key-file": "~/.s" + "sh/deploy",
  "private-key": "-----BEGIN OPENSSH PRIV" + "ATE KEY-----",
  "ssh-public-key": "ssh-ed2551" + "9 AAAA" + "C3NzaC1lZDI1NTE5AAAAIFakeFakeFake",
  fingerprint: "SHA25" + "6:" + "Q".repeat(43),
  email: "someone" + "@" + "example.com",
  "windows-user": "C:" + "\\Users\\someone\\x",
  "windows-path": "W:" + "\\keys",
  "login-user": "ec2-" + "user",
};

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function manifestFor(build) {
  const files = pf.walk(build).files.filter((f) => f !== pf.MANIFEST_NAME).sort();
  return files.map((f) => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(build, f))).digest("hex")}  ${f}`).join("\n") + "\n";
}

/* A good release: tree/src + tree/scripts, build = copy of tree/src + manifest, repo elsewhere. */
function makeRelease(t) {
  const tr = tempRoot("lb37pf-");
  if (tr.reason) throw new Error(tr.reason);
  t.after(() => removeTree(tr.root));
  const root = tr.root;
  const tree = path.join(root, "work", "build", "x.tree");
  const build = path.join(root, "work", "build", "x");
  const repo = path.join(root, "checkout");
  const files = {
    "index.html": "<!doctype html><title>t</title>\n",
    "engine.js": "window.LBEngine = {};\n",
    "privacy.html": "<p>contact: " + "owner" + "@" + "example.com</p>\n",
    "content/languages.js": "window.LB_LANGUAGES = [];\n",
    "content/sq/lesson-1.js": "window.LB_LESSON = {};\n",
  };
  for (const [f, s] of Object.entries(files)) {
    write(path.join(tree, "src", f), s);
    write(path.join(build, f), s);
  }
  write(path.join(tree, "scripts", "deploy", "deploy.sh"), "#!/usr/bin/env bash\necho ok 127.0.0.1\n");
  write(path.join(tree, "package.json"), "{}\n");
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  const manifest = path.join(build, pf.MANIFEST_NAME);
  fs.writeFileSync(manifest, manifestFor(build));
  return { root, tree, build, repo, manifest, argv: () => ["--sha", SHA, "--tree", tree, "--build", build, "--manifest", manifest, "--repo", repo] };
}

function runPf(argv) {
  const out = [];
  const err = [];
  const code = pf.run(argv, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join("\n"), err: err.join("\n"), problems: err.filter((l) => l.startsWith("  - ")) };
}

/* ------------------------------------------------------------ arguments */

test("preflight: --help exits 0 and shows the usage", () => {
  const r = runPf(["--help"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /usage: node preflight\.js --sha/);
});

test("preflight: usage errors exit 2 (unknown, missing, doubled, no value)", () => {
  const cases = [
    [["--sha", SHA, "--bogus", "x"], /unknown argument --bogus/],
    [["--sha", SHA], /missing --tree, --build, --manifest, --repo/],
    [["--sha", SHA, "--sha", SHA], /--sha given twice/],
    [["--sha"], /--sha needs a value/],
    [["--sha", "--tree", "x"], /--sha needs a value/],
    [["stray"], /unknown argument stray/],
  ];
  for (const [argv, re] of cases) {
    const r = runPf(argv);
    assert.equal(r.code, 2, `argv ${argv.join(" ")}`);
    assert.match(r.err, re);
  }
});

test("preflight: Git Bash /c/... paths become C:/... on Windows only", () => {
  if (process.platform === "win32") assert.equal(pf.fromMsys("/c/Users/x"), "C:/Users/x");
  else assert.equal(pf.fromMsys("/c/Users/x"), "/c/Users/x");
  assert.equal(pf.fromMsys("/tmp/x"), "/tmp/x");
});

/* ------------------------------------------------------------ pass */

test("preflight: a good release passes with exit 0 (an email on the privacy page is allowed)", (t) => {
  const rel = makeRelease(t);
  const r = runPf(rel.argv());
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /preflight: PASS for 0123456789abcdef/);
});

/* ------------------------------------------------------------ refusals */

test("preflight: a short, upper-case or missing-hex commit id is refused (exit 1)", (t) => {
  const rel = makeRelease(t);
  for (const bad of ["0123456789ab", SHA.toUpperCase(), SHA + "0", "g".repeat(40)]) {
    const argv = rel.argv();
    argv[1] = bad;
    const r = runPf(argv);
    assert.equal(r.code, 1, `sha ${bad}`);
    assert.match(r.err, /--sha must be the full 40-character lower-case commit id/);
    assert.match(r.err, /nothing was sent to the server/);
  }
});

test("preflight: tree, build and manifest inside the checkout are all refused, in one run", (t) => {
  const rel = makeRelease(t);
  const argv = rel.argv();
  argv[argv.indexOf("--repo") + 1] = rel.root; // the checkout now contains the work folder
  const r = runPf(argv);
  assert.equal(r.code, 1);
  for (const f of ["tree", "build", "manifest"]) assert.match(r.err, new RegExp(`--${f} is inside the checkout`));
  assert.equal(r.problems.length, 3, r.err);
});

test("preflight: missing folders and a manifest in the wrong place are refused", (t) => {
  const rel = makeRelease(t);
  const other = path.join(rel.root, "elsewhere", pf.MANIFEST_NAME);
  write(other, fs.readFileSync(rel.manifest, "utf8"));
  const r = runPf(["--sha", SHA, "--tree", path.join(rel.root, "nope"), "--build", rel.build, "--manifest", other, "--repo", rel.repo]);
  assert.equal(r.code, 1);
  assert.match(r.err, /--tree is not a folder/);
  assert.match(r.err, /--manifest must be \.manifest\.sha256 at the top of --build/);
});

test("preflight: build vs tested tree lists EVERY difference, missing and extra file, then refuses", (t) => {
  const rel = makeRelease(t);
  fs.writeFileSync(path.join(rel.build, "engine.js"), "changed\n");
  fs.writeFileSync(path.join(rel.build, "content", "languages.js"), "changed too\n");
  fs.rmSync(path.join(rel.build, "content", "sq", "lesson-1.js"));
  write(path.join(rel.build, "extra.js"), "x\n");
  fs.writeFileSync(rel.manifest, manifestFor(rel.build)); // manifest itself is consistent
  const r = runPf(rel.argv());
  assert.equal(r.code, 1);
  assert.match(r.err, /build differs from the tested tree: engine\.js/);
  assert.match(r.err, /build differs from the tested tree: content\/languages\.js/);
  assert.match(r.err, /missing from build: content\/sq\/lesson-1\.js/);
  assert.match(r.err, /in build but not in the tested tree: extra\.js/);
  assert.equal(r.problems.length, 4, r.err);
  assert.match(r.err, /REFUSED \(4 problem\(s\)\)/);
});

test("preflight: manifest problems are all listed (bad line, doubled, wrong hash, not in build, unlisted, unsafe path)", (t) => {
  const rel = makeRelease(t);
  const lines = manifestFor(rel.build).trim().split("\n");
  const byPath = Object.fromEntries(lines.map((l) => [l.slice(66), l]));
  const wrong = "0".repeat(64) + "  engine.js";
  const out = [
    byPath["index.html"],
    byPath["index.html"],               // doubled
    wrong,                              // wrong hash
    "not a manifest line",              // malformed
    "a".repeat(64) + "  gone.js",       // not in the build
    "b".repeat(64) + "  ../escape.js",  // unsafe path
    byPath["privacy.html"],
    byPath["content/sq/lesson-1.js"],
    // content/languages.js left out -> unlisted
  ];
  fs.writeFileSync(rel.manifest, out.join("\n") + "\n");
  const r = runPf(rel.argv());
  assert.equal(r.code, 1);
  assert.match(r.err, /manifest lists index\.html twice/);
  assert.match(r.err, /manifest hash is wrong for engine\.js/);
  assert.match(r.err, /manifest line 4 is not "<sha256>  <path>"/);
  assert.match(r.err, /manifest lists gone\.js, which is not in the build/);
  assert.match(r.err, /manifest line 6: unsafe path \.\.\/escape\.js/);
  assert.match(r.err, /manifest does not list content\/languages\.js/);
  assert.equal(r.problems.length, 6, r.err);
});

test("preflight: an empty manifest is refused", (t) => {
  const rel = makeRelease(t);
  fs.writeFileSync(rel.manifest, "");
  const r = runPf(rel.argv());
  assert.equal(r.code, 1);
  assert.match(r.err, /manifest is empty/);
});

test("preflight: dot-files, never-ship files and missing index.html/engine.js are all listed", (t) => {
  const rel = makeRelease(t);
  const extra = { ".env": "X=1\n", "content/.hidden.js": "x\n", "package.json": "{}\n", "content/a.test.js": "x\n", "deploy.env": "X=1\n", "server.log": "x\n" };
  for (const [f, s] of Object.entries(extra)) {
    write(path.join(rel.tree, "src", f), s);
    write(path.join(rel.build, f), s);
  }
  for (const f of ["index.html", "engine.js"]) {
    fs.rmSync(path.join(rel.tree, "src", f));
    fs.rmSync(path.join(rel.build, f));
  }
  fs.writeFileSync(rel.manifest, manifestFor(rel.build));
  const r = runPf(rel.argv());
  assert.equal(r.code, 1);
  assert.match(r.err, /dot-file in build: \.env/);
  assert.match(r.err, /dot-file in build: content\/\.hidden\.js/);
  assert.match(r.err, /must never ship: package\.json/);
  assert.match(r.err, /must never ship: content\/a\.test\.js/);
  assert.match(r.err, /must never ship: deploy\.env/);
  assert.match(r.err, /must never ship: server\.log/);
  assert.match(r.err, /build has no index\.html/);
  assert.match(r.err, /build has no engine\.js/);
});

test("preflight: a link inside the build is refused", (t) => {
  const rel = makeRelease(t);
  try {
    fs.symlinkSync(path.join(rel.build, "content"), path.join(rel.build, "linked"), "junction");
  } catch (e) {
    t.skip(`this computer cannot make a directory link (${e.code})`);
    return;
  }
  const r = runPf(rel.argv());
  assert.equal(r.code, 1);
  assert.match(r.err, /link or special file in build: linked/);
});

test("preflight: private details under the commit's scripts/ are all listed with file and line", (t) => {
  const rel = makeRelease(t);
  write(path.join(rel.tree, "scripts", "deploy", "notes.txt"), `line one\nserver ${SAMPLES.ipv4}\nmail ${SAMPLES.email}\n`);
  write(path.join(rel.tree, "scripts", "other.sh"), `key=${SAMPLES["key-file"]}\n`);
  const r = runPf(rel.argv());
  assert.equal(r.code, 1);
  assert.match(r.err, /scripts\/deploy\/notes\.txt line 2 holds an IPv4 address \(ipv4\)/);
  assert.match(r.err, /scripts\/deploy\/notes\.txt line 3 holds an email address \(email\)/);
  assert.match(r.err, /scripts\/other\.sh line 1 holds a key file name or path \(key-file\)/);
  assert.equal(r.problems.length, 3, r.err);
  assert.ok(!r.err.includes(SAMPLES.ipv4), "the matched text itself is never printed");
});

test("preflight: private key text in the build is refused", (t) => {
  const rel = makeRelease(t);
  for (const dir of [path.join(rel.tree, "src"), rel.build]) write(path.join(dir, "content", "k.js"), `// ${SAMPLES["private-key"]}\n`);
  fs.writeFileSync(rel.manifest, manifestFor(rel.build));
  const r = runPf(rel.argv());
  assert.equal(r.code, 1);
  assert.match(r.err, /build: content\/k\.js line 1 holds private key text/);
});

/* ------------------------------------------------------------ leak rules */

test("preflight leak rules: each kind of sample is caught", () => {
  for (const [id, s] of Object.entries(SAMPLES)) {
    const hits = pf.scanText(`x ${s} y`).map((h) => h.rule);
    assert.ok(hits.includes(id), `${id} not caught (got ${hits.join(",") || "nothing"})`);
  }
  assert.ok(pf.scanText("/c/Us" + "ers/someone/x").some((h) => h.rule === "windows-user"));
  assert.ok(pf.scanText("ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89").some((h) => h.rule === "fingerprint"));
  assert.ok(pf.scanText("id_" + "rsa").some((h) => h.rule === "key-file"));
  assert.ok(pf.scanText("deploy.p" + "em").some((h) => h.rule === "key-file"));
});

test("preflight leak rules: 127.0.0.1, placeholders, regexes and ordinary script text are allowed", () => {
  const ok = [
    "LB_BASE default http://127.0.0.1:80",
    "LB_HOST=<server public address>",
    "LB_HOST_FPR=<server ED25519 host key fingerprint, SHA256:...>",
    "chk_re LB_HOST_FPR '^SHA256:[A-Za-z0-9+/=]+$'",
    '"${CFG[LB_SSH_USER]}@${CFG[LB_HOST]}:$BOXSCRIPT"',
    "https://bengusa.pro/languagebasics/",
    "version 1.2.3",
    "cd \"$ROOT/current\"",
  ];
  for (const s of ok) assert.deepEqual(pf.scanText(s), [], s);
});

test("preflight leak rules: preflight.js does not match its own rules", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "deploy", "preflight.js"), "utf8");
  assert.deepEqual(pf.scanText(src), []);
});
