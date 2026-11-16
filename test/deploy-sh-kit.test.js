/* LB-37: tests for scripts/deploy/deploy.sh's checks on the kit itself (the folder deploy.sh runs
 * from, and the kit commit), and for the dry run's server check. Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * Covered (every refusal: exit 1, the message, no server call):
 *  - the kit run from a copy in an ignored folder of the checkout (kit-local/) is refused before
 *    anything is read or created, even when the copy is byte-for-byte the kit commit;
 *  - an extra file in the running kit (an ignored scripts/deploy/*.env) is refused in --list and
 *    --preflight;
 *  - a kit commit without scripts/deploy/preflight.js is refused in --list and --preflight, before
 *    the tests run;
 *  - --dry-run: the server check (lb-release.sh list) answering 1 or 255 fails the dry run
 *    (exit 1, never "every check passed"), each logged with its rc; rc 0 passes, logged.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./helpers/deploy-env.js");
const { makeWorld, assertRefused, localRows, write } = require("./helpers/deploy-world.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

/* The repo's own ignore rules for the kit (kit-local/, settings files in scripts/deploy). */
const IGNORE = { ".gitignore": "kit-local/\nscripts/deploy/*.env\n!scripts/deploy/deploy.env.example\n" };

test("deploy.sh: the kit run from a copy in an ignored folder of the checkout is refused, even an exact copy", { skip: SKIP }, (t) => {
  const w = makeWorld(t, { files: IGNORE });
  const copy = path.join(w.checkout, "kit-local");
  fs.cpSync(path.join(w.checkout, "scripts", "deploy"), copy, { recursive: true });
  assert.equal(w.git("status", "--porcelain", "--untracked-files=all"), "", "the copy is ignored, so the tree is clean");
  for (const args of [["--list"], ["--preflight"]]) {
    const r = w.runFrom(path.join(copy, "deploy.sh"), args, { LB_EXPECT_SHA: w.sha });
    assertRefused(r, /REFUSED: run the kit as scripts\/deploy\/deploy\.sh of the checkout itself, not from a copy/);
    assert.deepEqual(r.calls, [], `${args}: nothing ran (no npm, no server)`);
    assert.ok(!fs.existsSync(w.work), `${args}: work folder not created`);
  }
  // control: the same run from the kit folder itself passes
  const ok = w.run(["--list"]);
  assert.equal(ok.code, 0, ok.all);
});

test("deploy.sh: an extra (ignored) file in the running kit is refused in --list and --preflight", { skip: SKIP }, (t) => {
  const w = makeWorld(t, { files: IGNORE });
  write(path.join(w.checkout, "scripts", "deploy", "local.env"), "X=1\n");
  assert.equal(w.git("status", "--porcelain", "--untracked-files=all"), "", "the extra file is ignored, so the tree is clean");
  for (const args of [["--list"], ["--preflight"]]) {
    const r = w.run(args, { LB_EXPECT_SHA: w.sha });
    assertRefused(r, /REFUSED at 'running kit matches the kit commit' \(1 problem\(s\)\)/);
    assert.ok(r.err.includes(`running kit has scripts/deploy/local.env, which is not in commit ${w.sha}`), r.err);
    assert.ok(!r.calls.some((c) => c.startsWith("npm|")), `${args}: no test run`);
  }
});

test("deploy.sh: a kit commit without scripts/deploy/preflight.js is refused in --list and --preflight", { skip: SKIP }, (t) => {
  const w = makeWorld(t, { files: { "scripts/deploy/preflight.js": null } });
  assert.ok(!fs.existsSync(path.join(w.checkout, "scripts", "deploy", "preflight.js")), "the fixture commit has no preflight.js");
  for (const args of [["--list"], ["--preflight"]]) {
    const r = w.run(args, { LB_EXPECT_SHA: w.sha });
    assertRefused(r, /REFUSED at 'running kit matches the kit commit' \(1 problem\(s\)\)/);
    assert.ok(r.err.includes(`commit ${w.sha} has no scripts/deploy/preflight.js`), r.err);
    assert.ok(!r.calls.some((c) => c.startsWith("npm|")), `${args}: no test run`);
  }
});

test("deploy.sh: --dry-run fails when the server check answers 1 or 255, passes on 0; each logged with its rc", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const cases = [
    ["list=1", /FAILED: dry run: the server checks failed \(rc=1\); no release was uploaded; see the output above/, 1],
    ["list=255", /FAILED: dry run: the connection to the server was lost during the server checks; no release was uploaded; run --list/, 255],
  ];
  for (const [rule, re, rc] of cases) {
    const r = w.run(["--dry-run"], { LB_EXPECT_SHA: w.sha, FAKE_SSH_RC: rule });
    assert.equal(r.code, 1, `${rule}: exit ${r.code}\n${r.all}`);
    assert.match(r.err, re, rule);
    assert.doesNotMatch(r.all, /every check passed/, rule);
    assert.ok(r.server.some((c) => /^ssh .* list$/.test(c)), `${rule}: the server check ran`);
    assert.deepEqual(fs.readdirSync(path.join(w.box.kit, "incoming")), [], `${rule}: no release uploaded`);
    const row = localRows(w, "dry").pop();
    assert.ok(row.startsWith(`${row.split(" ")[0]} sha=${w.sha} kit=${w.sha} manifest=`) && row.endsWith(` DRY RUN list rc=${rc}`), row);
  }
  const ok = w.run(["--dry-run"], { LB_EXPECT_SHA: w.sha });
  assert.equal(ok.code, 0, ok.all);
  assert.match(ok.out, /dry run: every check passed; no release was uploaded/);
  assert.ok(localRows(w, "dry").pop().endsWith(" DRY RUN list rc=0"));
  assert.ok(!fs.existsSync(path.join(w.box.root, "releases")), "no release installed");
});
