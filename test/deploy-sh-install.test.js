/* LB-37: tests for what scripts/deploy/deploy.sh does with each answer of the server's install
 * (lb-release.sh install), and a working manual rollback. Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * The suite builds one world (test/helpers/deploy-world.js) and walks it through several real
 * releases in order: the fake ssh runs the real server script in a local folder and the fake
 * curl serves that folder, so the server's own smoke checks and automatic rollbacks really run.
 *
 * Covered:
 *  - the first-ever release fails smoke with nothing to go back to (rc 3 -> exit 3 naming it
 *    live); it is marked bad on the server, so a later rollback never goes back to it;
 *  - a new release fails smoke and the old one passes (rc 1 -> exit 1, "not live", names the
 *    live release); both fail (rc 3 -> exit 3 naming the release live now); the switch back
 *    fails (rc 4 -> exit 3, "could not switch back"); each logged on the laptop;
 *  - a manual rollback that works: exit 0 after the outside checks pass.
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const H = require("./helpers/deploy-env.js");
const { DECKS, HEADERS, builtId, suiteWorld, hasRow, localRows, outsideCalls } = require("./helpers/deploy-world.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

/* ------------------------------------------------------------ install outcomes */

describe("deploy.sh after the upload: what the server's install answers", { skip: SKIP }, () => {
  const S = suiteWorld({ files: DECKS });
  let A = "", B = "", E = "";

  it("the first-ever release fails smoke with nothing to go back to (rc 3): exit 3, named live, marked bad on the server", () => {
    const w = S.w;
    const r = w.run([], { LB_EXPECT_SHA: w.sha, FAKE_HEADERS: HEADERS, FAKE_SMOKE_FAIL: "1" });
    assert.equal(r.code, 3, r.all);
    A = builtId(r);
    assert.match(r.out, /SMOKE FAILS, NO GOOD RELEASE TO GO BACK TO/);
    assert.ok(r.err.includes(`SWITCHED, BUT SMOKE FAILS: release ${A} went live and failed the server smoke checks, and the server's automatic rollback had no good release to go back to; release ${A} is marked bad.`), r.err);
    assert.ok(r.err.includes(`live now: ${A}. It FAILS the server smoke checks.`), r.err);
    assert.equal(w.boxLive(), A);
    hasRow(w.boxLog(), [undefined, "bad", A, "smoke-failed"], "the first-ever release that failed smoke is marked bad");
    const rows = localRows(w, "deploy");
    assert.ok(rows.some((t) => t.startsWith(`${A} sha=${w.sha} `) && t.endsWith(" install rc=3")), rows.join("\n"));
    assert.equal(rows[rows.length - 1].startsWith(`live now ${A}, smoke FAIL: release ${A} went live`), true, rows.join("\n"));
    assert.equal(outsideCalls(r).length, 0, "no outside checks after a failed smoke");
  });

  it("a later rollback never goes back to that bad first release (nothing is switched)", () => {
    const w = S.w;
    const sha = w.commit("B");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 0, r.all);
    B = builtId(r);
    const rb = w.run(["--rollback"], { LB_EXPECT_CURRENT: B, FAKE_HEADERS: HEADERS });
    assert.equal(rb.code, 1, rb.all);
    assert.match(rb.err, /no good release to roll back to; nothing changed/);
    assert.match(rb.err, /nothing was switched/);
    assert.equal(w.boxLive(), B);
  });

  it("a new release fails smoke and the old one passes (rc 1): exit 1, not live, names the live release", () => {
    const w = S.w;
    const sha = w.commit("C");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SMOKE_FAIL_ID: sha.slice(0, 12) });
    assert.equal(r.code, 1, r.all);
    const C = builtId(r);
    assert.ok(r.err.includes(`install failed on the server (rc=1); release ${C} is not live; live now: ${B}`), r.err);
    assert.equal(w.boxLive(), B);
    hasRow(w.boxLog(), [undefined, "bad", C, "smoke-failed"]);
    hasRow(w.boxLog(), [undefined, "live", B, `auto-rollback from ${C}`]);
    assert.ok(localRows(w, "deploy").some((t) => t.startsWith(`${C} sha=${sha} `) && t.endsWith(" install rc=1")));
  });

  it("a new release fails smoke and so does the old one after the switch back (rc 3): exit 3, names the live release", () => {
    const w = S.w;
    const sha = w.commit("D");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SMOKE_FAIL: "1" });
    assert.equal(r.code, 3, r.all);
    const D = builtId(r);
    assert.ok(r.out.includes(`SWITCHED BUT SMOKE FAILS: ${B} is live now`), r.out);
    assert.ok(r.err.includes(`SWITCHED, BUT SMOKE FAILS: release ${D} went live and failed the server smoke checks`), r.err);
    assert.ok(r.err.includes(`live now: ${B}. It FAILS the server smoke checks.`), r.err);
    assert.equal(w.boxLive(), B);
    assert.equal(localRows(w, "deploy").pop().startsWith(`live now ${B}, smoke FAIL: release ${D} went live`), true);
  });

  it("the server could not switch back (rc 4): exit 3, 'could not switch back', names the release still live", () => {
    const w = S.w;
    const sha = w.commit("E");
    // run:4 = the real install runs (the new release goes live), then the server answers 4
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SSH_RC: "install=run:4" });
    assert.equal(r.code, 3, r.all);
    E = builtId(r);
    assert.ok(r.err.includes(`SWITCHED, BUT SMOKE FAILS: release ${E} went live and failed the server smoke checks, and the server's automatic rollback could not switch back; release ${E} is marked bad.`), r.err);
    assert.ok(r.err.includes(`live now: ${E}.`), r.err);
    assert.equal(w.boxLive(), E);
    const rows = localRows(w, "deploy");
    assert.ok(rows.some((t) => t.startsWith(`${E} sha=${sha} `) && t.endsWith(" install rc=4")), rows.join("\n"));
    assert.equal(rows[rows.length - 1].startsWith(`live now ${E}, smoke FAIL: release ${E} went live`), true, rows.join("\n"));
    assert.equal(outsideCalls(r).length, 0, "no outside checks after rc 4");
  });

  it("a manual rollback that works: the last good release comes back and passes the outside checks (exit 0)", () => {
    const w = S.w;
    const r = w.run(["--rollback"], { LB_EXPECT_CURRENT: E, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 0, r.all);
    assert.ok(r.out.includes(`ROLLED BACK ${E} -> ${B} (${E} marked bad)`), r.out);
    assert.match(r.out, /OUTSIDE OK: /);
    assert.equal(w.boxLive(), B);
    assert.equal(localRows(w, "rollback").pop(), `rollback from ${E} rc=0`);
    assert.notEqual(A, B);
  });
});
