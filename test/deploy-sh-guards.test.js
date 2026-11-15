/* LB-37: tests for the fail-closed location checks of scripts/deploy/deploy.sh (work folder and
 * settings file) and the two opt-ins (LB_EXPECT_CURRENT for --rollback, LB_ALLOW_UNMERGED_KIT for
 * a kit commit that is not on origin/main). Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * Covered (every refusal: exit 1, the message, no server call, and NOTHING created):
 *  - work folder given as a network (UNC) path, forward or back slashes, also one that names the
 *    repo through the computer's own admin share;
 *  - work folder with . or .. parts (also a .. that would land inside the repo);
 *  - work folder through a junction (or link) into the repo, and the junction itself;
 *  - work folder under a folder with a broken .git file or an empty .git folder;
 *  - settings file with a second name (hard link), given as a network path, or a link (where the
 *    computer can make file links; skipped with the reason where it cannot);
 *  - --rollback without a well-formed LB_EXPECT_CURRENT;
 *  - a kit commit that is not on origin/main: refused without LB_ALLOW_UNMERGED_KIT=1; with it,
 *    allowed in --list with a WARNING and a log row; never allowed for a deploy or a rollback.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./helpers/deploy-env.js");
const { DECKS, makeWorld, assertRefused, localRows, write } = require("./helpers/deploy-world.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

/* The same folder through this computer's own network share: //localhost/c$/... (Windows) or
 * //localhost/... elsewhere. Forward or back slashes. */
function uncOf(p, back) {
  let u;
  if (H.WIN) {
    const r = path.resolve(p);
    u = `//localhost/${r[0].toLowerCase()}$${r.slice(2).replace(/\\/g, "/")}`;
  } else {
    u = `//localhost${p}`;
  }
  return back ? u.replace(/\//g, "\\") : u;
}

/* Every entry under root, relative, sorted (to prove a refused run created nothing). */
function listTree(root) {
  const out = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (r === "calls.txt" || r === "origin.git" || r === "seed" || r === "checkout/.git") continue;
      out.push(r);
      if (e.isDirectory() && !e.isSymbolicLink()) walk(path.join(d, e.name), r);
    }
  })(root, "");
  return out.sort();
}

test("deploy.sh: work folder location checks fail closed, and a refused run creates nothing", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const jn = path.join(w.root, "jn");
  fs.symlinkSync(w.checkout, jn, "junction");
  const broken = path.join(w.root, "plain");
  write(path.join(broken, ".git"), "gitdir: nowhere\n");
  const empty = path.join(w.root, "plain2");
  fs.mkdirSync(path.join(empty, ".git"), { recursive: true });

  const NET = /the work folder \(LB_WORK_DIR\) must be a full local path: no relative, drive-relative or network path/;
  const DOTS = /the work folder \(LB_WORK_DIR\) must not hold \. or \.\. parts/;
  const REPO = /the work folder \(LB_WORK_DIR\) is inside the repo/;
  const TREE = /the work folder \(LB_WORK_DIR\) is inside a git working tree/;
  const cases = [
    ["UNC, forward slashes", uncOf(path.join(w.root, "wk-unc")), NET, ["wk-unc"]],
    ["UNC, back slashes", uncOf(path.join(w.root, "wk-unc2"), true), NET, ["wk-unc2"]],
    ["UNC alias of a folder inside the repo", uncOf(path.join(w.checkout, "wk")), NET, ["checkout/wk"]],
    ["a .. part that lands inside the repo", `${H.toBash(w.root)}/nope/../checkout/wk`, DOTS, ["nope", "checkout/wk"]],
    ["a . part", `${H.toBash(w.root)}/new/./wk`, DOTS, ["new"]],
    ["through a junction into the repo", `${H.toBash(jn)}/wk`, REPO, ["checkout/wk"]],
    ["the junction into the repo itself", H.toBash(jn), REPO, ["checkout/clone", "checkout/build", "checkout/deploy-log.txt"]],
    ["under a broken .git file", `${H.toBash(broken)}/wk`, TREE, ["plain/wk"]],
    ["under an empty .git folder", `${H.toBash(empty)}/wk`, TREE, ["plain2/wk"]],
  ];
  const before = listTree(w.root);
  for (const [label, dir, re, notCreated] of cases) {
    w.writeSettings(Object.assign({}, w.settings, { LB_WORK_DIR: dir }));
    const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
    assert.equal(r.code, 1, `${label}: exit ${r.code}\n${r.all}`);
    assert.match(r.err, re, label);
    assert.deepEqual(r.server, [], `${label}: no server call`);
    assert.ok(!r.calls.some((c) => c.startsWith("npm|")), `${label}: no test run`);
    for (const n of notCreated) assert.ok(!fs.existsSync(path.join(w.root, n)), `${label}: ${n} was created`);
    assert.ok(!fs.existsSync(w.work), `${label}: the default work folder was created`);
    assert.deepEqual(listTree(w.root), before, `${label}: something was created`);
  }
  assert.equal(w.git("status", "--porcelain", "--untracked-files=all", "--ignored"), "", "checkout still clean, nothing ignored either");
});

test("deploy.sh: a settings file with a second name (hard link) or given as a network path is refused", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const second = path.join(w.root, "conf", "second-name.env");
  fs.linkSync(w.conf, second);
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assertRefused(r, /REFUSED at 'settings'/);
  assert.match(r.err, /the settings file has more than one name \(a hard link\)/);
  assert.ok(!fs.existsSync(w.work), "work folder not created");
  fs.rmSync(second);

  for (const back of [false, true]) {
    const u = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha, LB_DEPLOY_CONFIG: uncOf(w.conf, back) });
    assertRefused(u, /the settings file path \(LB_DEPLOY_CONFIG\) must be a full local path: no relative, drive-relative or network path/);
    assert.ok(!fs.existsSync(w.work), "work folder not created");
  }
  // control: the same file with one name passes the settings gate
  const ok = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha });
  assert.equal(ok.code, 0, ok.all);
});

test("deploy.sh: a settings file that is a link is refused", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const link = path.join(w.root, "conf", "link.env");
  try {
    fs.symlinkSync(w.conf, link, "file");
  } catch (e) {
    t.skip(`this computer cannot make file links for this account (${e.code}); the check runs where it can`);
    return;
  }
  const r = w.run(["--preflight"], { LB_EXPECT_SHA: w.sha, LB_DEPLOY_CONFIG: H.toBash(link) });
  assertRefused(r, /the settings file is a link; use a plain file outside any repo/);
  assert.ok(!fs.existsSync(w.work), "work folder not created");
});

test("deploy.sh: --rollback needs a well-formed LB_EXPECT_CURRENT before the clone or the server", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  for (const v of [undefined, "", "20261115T101010Z-abc", "20261115T101010Z-ABCDEF012345", "current", "20261115T101010Z-abcdef012345 x"]) {
    const r = w.run(["--rollback"], v === undefined ? {} : { LB_EXPECT_CURRENT: v });
    assertRefused(r, /set LB_EXPECT_CURRENT to the live release id shown by --list; a rollback only moves away from the release you name/);
    assert.ok(!fs.existsSync(path.join(w.work, "clone")), "no clone was made");
  }
});

test("deploy.sh: a kit commit not on origin/main needs LB_ALLOW_UNMERGED_KIT=1, and never for a deploy or a rollback", { skip: SKIP }, (t) => {
  const w = makeWorld(t, { files: DECKS });
  w.git("checkout", "-q", "-b", "kit-try");
  fs.appendFileSync(path.join(w.checkout, "scripts", "deploy", "expected-headers.txt"), "# try\n");
  w.git("commit", "-q", "-am", "kit try");
  w.git("push", "-q", "origin", "kit-try");
  const k = w.git("rev-parse", "HEAD");

  for (const mode of [["--list"], ["--smoke"], ["--verify"]]) {
    const r = w.run(mode, { LB_KIT_SHA: k });
    assertRefused(r, /REFUSED at 'approved commit'/);
    assert.ok(r.err.includes(`kit commit ${k} is not on origin/main; to run kit code that is not merged yet, set LB_ALLOW_UNMERGED_KIT=1`), r.err);
  }
  const notOne = w.run(["--list"], { LB_KIT_SHA: k, LB_ALLOW_UNMERGED_KIT: "yes" });
  assertRefused(notOne, /set LB_ALLOW_UNMERGED_KIT=1/);

  const ok = w.run(["--list"], { LB_KIT_SHA: k, LB_ALLOW_UNMERGED_KIT: "1" });
  assert.equal(ok.code, 0, ok.all);
  assert.ok(ok.err.includes(`WARNING: kit commit ${k} is NOT on origin/main (LB_ALLOW_UNMERGED_KIT=1)`), ok.err);
  assert.ok(ok.server.some((c) => / list$/.test(c)), "the list ran");
  assert.deepEqual(localRows(w, "list"), [`unmerged kit ${k} allowed`]);

  const dep = w.run([], { LB_EXPECT_SHA: w.sha, LB_KIT_SHA: k, LB_ALLOW_UNMERGED_KIT: "1" });
  assertRefused(dep, /a deploy or rollback uses reviewed, merged kit code only/);
  const rb = w.run(["--rollback"], { LB_KIT_SHA: k, LB_ALLOW_UNMERGED_KIT: "1", LB_EXPECT_CURRENT: "20261115T101010Z-abcdef012345" });
  assertRefused(rb, /a deploy or rollback uses reviewed, merged kit code only/);
  assert.ok(!fs.existsSync(path.join(w.box.root, "releases")), "nothing was installed");
});
