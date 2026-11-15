/* LB-37: tests for scripts/deploy/deploy.sh, run in bash with fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * Each "world" (test/helpers/deploy-world.js) is a temp folder with a local bare origin, a
 * clean checkout of it, a private settings file outside the checkout, and fake ssh / scp /
 * ssh-keyscan / ssh-keygen / curl / npm (test/fixtures/deploy-fakes/). The fake ssh runs the "server" command in a local folder.
 * Nothing contacts a real server or the network.
 *
 * Covered:
 *  - exit codes: --help 0; unknown argument, two modes, bad LB_OUTSIDE_TRIES 2; refusals 1;
 *  - settings: missing file; every problem listed; file inside the repo or inside any git
 *    working tree refused, and NOTHING created (the work folder does not appear);
 *  - work folder inside the repo or any git working tree refused, and NOT created;
 *  - commit id missing, short, upper case or not origin/main refused;
 *  - dirty tree (changed and untracked file) refused, listing both; also for --rollback;
 *  - a running kit that differs from the kit commit refused;
 *  - npm test or check:data failing refused; both always run, in the unpacked commit (never
 *    the checkout), with LB_TEST_TMP, TMP, TEMP and TMPDIR under the work folder;
 *  - the byte check lists every mismatch (and the dot-file) before refusing;
 *  - preflight.js from the kit commit runs, and its refusal stops the deploy;
 *  - after ANY refusal above, no ssh / scp / ssh-keyscan / curl call was made;
 *  - --preflight passes with zero server calls; --dry-run talks to the (fake) server but
 *    uploads no release.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./helpers/deploy-env.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

const { write, settingsText, makeWorld, assertRefused } = require("./helpers/deploy-world.js");

/* ------------------------------------------------------------ exit codes */

test("deploy.sh: --help exits 0; usage errors exit 2", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const help = w.run(["--help"]);
  assert.equal(help.code, 0, help.all);
  assert.match(help.out, /--preflight/);
  assert.match(help.out, /Exit codes: 0 ok, 1 refused or failed, 2 usage error/);
  for (const [args, extra, re] of [
    [["--bogus"], {}, /unknown argument --bogus/],
    [["--list", "--smoke"], {}, /one mode at a time/],
    [["--preflight"], { LB_OUTSIDE_TRIES: "0" }, /LB_OUTSIDE_TRIES must be a whole number/],
    [["--preflight"], { LB_OUTSIDE_WAIT: "x" }, /LB_OUTSIDE_WAIT must be a whole number/],
  ]) {
    const r = w.run(args, extra);
    assert.equal(r.code, 2, `${args.join(" ")}: exit ${r.code}\n${r.all}`);
    assert.match(r.err, re);
    assert.deepEqual(r.server, []);
  }
});

/* ------------------------------------------------------------ settings */

test("deploy.sh: a missing settings file is refused", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha, LB_DEPLOY_CONFIG: H.toBash(path.join(w.root, "conf", "nope.env")) });
  assertRefused(r, /settings file not found/);
  assert.ok(!fs.existsSync(w.work), "work folder not created");
});

test("deploy.sh: every settings problem is listed (unknown, empty, placeholder, twice, missing, bad shape)", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const s = Object.assign({}, w.settings, { LB_HOST: "", LB_SSH_USER: "<server login name>", LB_BOGUS: "1", LB_HOST_FPR: "nofpr" });
  delete s.LB_BOX_ROOT;
  w.writeSettings(s);
  fs.appendFileSync(w.conf, "LB_KEEP=3\nLB_KEEP=4\nnot a setting\n");
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assertRefused(r, /REFUSED at 'settings'/);
  for (const re of [/LB_HOST is empty/, /LB_SSH_USER still holds the example placeholder/, /unknown setting LB_BOGUS/,
    /LB_KEEP is set twice/, /not in KEY=value form/, /setting LB_BOX_ROOT is missing/, /LB_HOST_FPR is not an SSH fingerprint/]) {
    assert.match(r.err, re);
  }
  assert.ok(!fs.existsSync(w.work), "work folder not created");
});

test("deploy.sh: a settings file inside the repo is refused and NOTHING is created", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const inRepo = path.join(w.checkout, "private", "deploy.env");
  write(inRepo, settingsText(w.settings));
  const before = fs.readdirSync(w.root).sort();
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha, LB_DEPLOY_CONFIG: H.toBash(inRepo) });
  assertRefused(r, /REFUSED at 'settings'/);
  assert.match(r.err, /the settings file is inside the repo/);
  assert.match(r.err, /inside a git working tree/);
  assert.ok(!fs.existsSync(w.work), "work folder not created");
  assert.deepEqual(fs.readdirSync(w.root).sort().filter((f) => f !== "calls.txt"), before.filter((f) => f !== "calls.txt"));
});

test("deploy.sh: a settings file inside another git working tree is refused", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const other = path.join(w.root, "other-repo");
  H.git(w.env, w.root, "init", "-q", other);
  const conf = path.join(other, "conf", "deploy.env");
  write(conf, settingsText(w.settings));
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha, LB_DEPLOY_CONFIG: H.toBash(conf) });
  assertRefused(r, /the settings file is inside a git working tree/);
  assert.ok(!fs.existsSync(w.work), "work folder not created");
});

/* ------------------------------------------------------------ work folder (the HIGH item) */

test("deploy.sh: a work folder inside the repo is refused and NOT created", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const inRepo = path.join(w.checkout, "out", "work");
  w.writeSettings(Object.assign({}, w.settings, { LB_WORK_DIR: H.toBash(inRepo) }));
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assertRefused(r, /REFUSED at 'work folder'/);
  assert.match(r.err, /the work folder \(LB_WORK_DIR\) is inside the repo/);
  assert.ok(!fs.existsSync(path.join(w.checkout, "out")), "nothing created inside the repo");
  assert.equal(w.git("status", "--porcelain", "--untracked-files=all"), "", "checkout still clean");
});

test("deploy.sh: a work folder that IS the repo root, or inside another git working tree, is refused and NOT created", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  w.writeSettings(Object.assign({}, w.settings, { LB_WORK_DIR: H.toBash(w.checkout) }));
  const r1 = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assertRefused(r1, /the work folder \(LB_WORK_DIR\) is inside the repo/);
  assert.deepEqual(fs.readdirSync(w.checkout).filter((f) => ["clone", "build", "known_hosts", "deploy-log.txt"].includes(f)), []);

  const other = path.join(w.root, "other-repo");
  H.git(w.env, w.root, "init", "-q", other);
  const wd = path.join(other, "deep", "work");
  w.writeSettings(Object.assign({}, w.settings, { LB_WORK_DIR: H.toBash(wd) }));
  const r2 = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assertRefused(r2, /the work folder \(LB_WORK_DIR\) is inside a git working tree/);
  assert.ok(!fs.existsSync(path.join(other, "deep")), "nothing created inside the other repo");
});

/* ------------------------------------------------------------ commit id */

test("deploy.sh: a missing commit id is refused in deploy, --dry-run and --preflight", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  for (const args of [[], ["--dry-run"], ["--preflight"]]) {
    const r = w.run(args);
    assertRefused(r, /set LB_EXPECT_SHA to the full 40-character id/);
  }
});

test("deploy.sh: a short or upper-case commit id is refused", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  for (const bad of [w.sha.slice(0, 12), w.sha.toUpperCase(), w.sha + "a"]) {
    for (const args of [[], ["--preflight"]]) {
      const r = w.run(args, { LB_EXPECT_SHA: bad });
      assertRefused(r, /LB_EXPECT_SHA must be the full 40-character lower-case commit id/);
    }
  }
  const r = w.run(["--list"], { LB_KIT_SHA: "abc" });
  assertRefused(r, /LB_KIT_SHA must be a full 40-character lower-case commit id/);
});

test("deploy.sh: a full commit id that is not origin/main is refused (deploy and --preflight)", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const wrong = w.sha.replace(/^./, (c) => (c === "0" ? "1" : "0"));
  for (const args of [[], ["--preflight"]]) {
    const r = w.run(args, { LB_EXPECT_SHA: wrong });
    assertRefused(r, /REFUSED at 'approved commit'/);
    assert.match(r.err, new RegExp(`origin/main is ${w.sha}, not the approved ${wrong}`));
    assert.ok(!r.calls.some((c) => c.startsWith("npm|")), "tests are not run for a wrong commit");
  }
});

/* ------------------------------------------------------------ clean tree and running kit */

test("deploy.sh: a dirty tree is refused, listing every change (deploy, --preflight, --rollback)", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  fs.appendFileSync(path.join(w.checkout, "src", "engine.js"), "// edit\n");
  write(path.join(w.checkout, "src", "new.js"), "x\n");
  for (const args of [[], ["--preflight"], ["--rollback"]]) {
    const r = w.run(args, { LB_EXPECT_SHA: w.sha });
    assertRefused(r, /REFUSED at 'commit id and clean tree' \(2 problem\(s\)\)/);
    assert.match(r.err, /uncommitted change: .*src\/engine\.js/);
    assert.match(r.err, /uncommitted change: .*src\/new\.js/);
  }
});

test("deploy.sh: a running kit that differs from the kit commit is refused", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  fs.appendFileSync(path.join(w.checkout, "scripts", "deploy", "expected-headers.txt"), "# local edit\n");
  w.git("commit", "-q", "-am", "local kit edit, not pushed");
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assertRefused(r, /REFUSED at 'running kit matches the kit commit'/);
  assert.match(r.err, /running scripts\/deploy\/expected-headers\.txt differs from commit/);
});

/* ------------------------------------------------------------ tests on the exact commit */

test("deploy.sh: failing npm test is refused; check:data still runs; both ran in the unpacked commit", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const r = w.run([], { LB_EXPECT_SHA: w.sha, FAKE_NPM_FAIL: "test", FAKE_NPM_RC: "7" });
  assertRefused(r, /REFUSED at 'tests and build checks'/);
  assert.match(r.err, /npm test failed on commit \S+ \(exit 7, log: /, "npm's real exit status is kept");
  assert.doesNotMatch(r.err, /check:data failed/);
  const npm = r.calls.filter((c) => c.startsWith("npm|"));
  assert.deepEqual(npm.map((c) => c.split("|")[2]), ["test", "run check:data"], "both commands ran");
  const runId = `[0-9]{8}T[0-9]{6}Z-${w.sha.slice(0, 12)}`;
  for (const c of npm) {
    const f = c.split("|");
    const cwd = f[1];
    assert.match(cwd, new RegExp(`${H.toBash(w.work).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/build/${runId}\\.tree$`, "i"), `ran in ${cwd}`);
    // temp folders for the test run go under the work folder, never the system temp folder
    for (const k of ["tmp=", "TMP=", "TEMP=", "TMPDIR="]) {
      const v = (f.find((x) => x.startsWith(k)) || "").slice(k.length).replace(/\\/g, "/");
      assert.match(v, new RegExp(`/work/build/${runId}\\.tmp$`, "i"), `${k}${v} is under the work folder`);
    }
  }
  assert.ok(!fs.readdirSync(path.join(w.work, "build")).some((d) => d.endsWith(".tmp")), "the test-run temp folder is removed");
  assert.ok(!fs.existsSync(path.join(w.box.kit, "incoming")), "nothing uploaded");
});

test("deploy.sh: failing check:data alone is refused", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha, FAKE_NPM_FAIL: "check" });
  assertRefused(r, /npm run check:data failed on commit/);
  assert.doesNotMatch(r.err, /npm test failed/);
});

/* ------------------------------------------------------------ build checks */

test("deploy.sh: the byte check lists EVERY mismatching file and the dot-file, then refuses", { skip: SKIP }, (t) => {
  // src/.gitattributes makes git archive write CRLF while the blobs hold LF: every .js differs.
  const w = makeWorld(t, { files: { "src/.gitattributes": "*.js text eol=crlf\n" } });
  const r = w.run([], { LB_EXPECT_SHA: w.sha });
  assertRefused(r, /REFUSED at 'tests and build checks'/);
  const js = ["src/engine.js", "src/content/languages.js", "src/content/sq/lesson-1.js"];
  for (const f of js) assert.match(r.err, new RegExp(`byte mismatch: ${f.replace(/\./g, "\\.")}`));
  assert.match(r.err, /dot-file in src: \.gitattributes/);
  assert.doesNotMatch(r.err, /byte mismatch: src\/index\.html/);
  assert.match(r.err, /\(4 problem\(s\)\)/);
});

test("deploy.sh: preflight.js from the kit commit runs, and its refusal stops the deploy", { skip: SKIP }, (t) => {
  const w = makeWorld(t, { files: { "scripts/notes.txt": "mail " + "someone" + "@" + "example.com\n" } });
  const r = w.run([], { LB_EXPECT_SHA: w.sha });
  assertRefused(r, /REFUSED at 'preflight\.js'/);
  assert.match(r.err, /preflight: REFUSED/);
  assert.match(r.err, /scripts\/notes\.txt line 1 holds an email address/);
  assert.ok(!fs.existsSync(path.join(w.box.kit, "incoming")), "nothing uploaded");
});

/* ------------------------------------------------------------ passing runs */

test("deploy.sh: --preflight passes every local check and never contacts the server", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /preflight: PASS for /);
  assert.match(r.out, /PREFLIGHT PASS for .*The server was not contacted/);
  assert.deepEqual(r.server, []);
  assert.equal(r.calls.filter((c) => c.startsWith("npm|")).length, 2);
  assert.ok(!fs.existsSync(w.box.kit), "the server folder was never touched");
  assert.ok(fs.existsSync(path.join(w.work, "deploy-log.txt")), "work files go to the work folder");
  assert.equal(w.git("status", "--porcelain", "--untracked-files=all"), "", "checkout still clean");
});

test("deploy.sh: --dry-run pins the host key and talks to the server, but uploads no release", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const r = w.run(["--dry-run"], { LB_EXPECT_SHA: w.sha });
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /dry run: every check passed; no release was uploaded/);
  assert.ok(r.server.some((c) => c.startsWith("ssh-keyscan ")), "host key scanned");
  assert.ok(r.server.some((c) => c.startsWith("ssh ") && / list$/.test(c)), "server list ran");
  const scps = r.server.filter((c) => c.startsWith("scp "));
  assert.equal(scps.length, 1, scps.join("\n"));
  assert.match(scps[0], /lb-release\.sh -> .*\/lb-release-[0-9a-f]{16}\.sh$/, "only the server script was sent");
  assert.deepEqual(fs.readdirSync(path.join(w.box.kit, "incoming")), [], "no release uploaded");
  assert.ok(!fs.existsSync(path.join(w.box.root, "releases")), "no release installed");
  const rows = fs.readFileSync(path.join(w.work, "deploy-log.txt"), "utf8").split("\n").filter((l) => l.split("\t")[1] === "dry");
  assert.match(rows[rows.length - 1], / DRY RUN list rc=0$/, "the dry run logs the server check's rc");
});

test("deploy.sh: a wrong host key stops before any upload", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const r = w.run(["--dry-run"], { LB_EXPECT_SHA: w.sha, FAKE_FPR: "SHA256:otherfingerprint" });
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /server host key does not match the pinned fingerprint/);
  assert.deepEqual(r.server.filter((c) => /^(ssh|scp) /.test(c)), [], "no ssh or scp after a host-key mismatch");
});
