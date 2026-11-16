/* LB-37: tests for what scripts/deploy/deploy.sh says when the server's install answer is lost or
 * does not fit what is live (the connection drops, the live release cannot be read, or the release
 * reported as failed is live after all). Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * The suite builds one world (test/helpers/deploy-world.js) and walks it through several real
 * releases in order. FAKE_SSH_RC changes a server answer: "install=255" = the install never ran and
 * the connection was lost; "install=run:<rc>" = the install really ran, then the answer was <rc>;
 * "manifest=1" = the live release cannot be read afterwards.
 *
 * Covered, each with exit code, message and the laptop log row:
 *  - install rc 255, the install never ran or ran fully: exit 1, "connection ... lost during the
 *    install; the server state is unknown (release X may be live)", never "nothing was switched"
 *    and never "is not live";
 *  - install rc 1 while the new release is live after all: exit 1, "but release X is live";
 *  - install rc 1 and the live release cannot be read: exit 1, "cannot be read now";
 *  - install rc 3 and the live release cannot be read: exit 3, the combined wording, "live now:
 *    (cannot read it from the server)";
 *  - the real switch back fails on the server (an ln shim fails on the second call, so
 *    lb-release.sh really exits 4): exit 3, "could not switch back", the new release is live.
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const H = require("./helpers/deploy-env.js");
const { DECKS, HEADERS, builtId, suiteWorld, localRows, outsideCalls } = require("./helpers/deploy-world.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

describe("deploy.sh after the upload: a lost or odd install answer", { skip: SKIP }, () => {
  const S = suiteWorld({ files: DECKS });
  let A = "";

  /* The install row of the laptop log for release id, ending in rc. */
  function installRow(w, id, sha, rc) {
    const rows = localRows(w, "deploy");
    assert.ok(rows.some((t) => t.startsWith(`${id} sha=${sha} kit=`) && t.endsWith(` install rc=${rc}`)), rows.join("\n"));
  }
  /* None of the sure-sounding messages that only fit rc 1. */
  function notSure(r) {
    assert.doesNotMatch(r.err, /nothing was switched/);
    assert.doesNotMatch(r.err, /is not live/);
  }

  it("release A goes live and passes", () => {
    const w = S.w;
    const r = w.run([], { LB_EXPECT_SHA: w.sha, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 0, r.all);
    A = builtId(r);
    assert.equal(w.boxLive(), A);
  });

  it("install rc 255, the install never ran: exit 1, state unknown, the release may be live; A is still live", () => {
    const w = S.w;
    const sha = w.commit("lost-before");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SSH_RC: "install=255" });
    assert.equal(r.code, 1, r.all);
    const id = builtId(r);
    assert.ok(r.err.includes(`FAILED: the connection to the server was lost during the install; the server state is unknown (release ${id} may be live); run --list now`), r.err);
    notSure(r);
    assert.equal(w.boxLive(), A);
    installRow(w, id, sha, 255);
    assert.equal(outsideCalls(r).length, 0, "no outside checks after a lost connection");
  });

  it("install rc 255 after the install really ran: the same message; the new release is in fact live", () => {
    const w = S.w;
    const sha = w.commit("lost-after");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SSH_RC: "install=run:255" });
    assert.equal(r.code, 1, r.all);
    const id = builtId(r);
    assert.ok(r.err.includes(`the connection to the server was lost during the install; the server state is unknown (release ${id} may be live); run --list now`), r.err);
    notSure(r);
    assert.equal(w.boxLive(), id, "the switch happened, which is why the message must not say otherwise");
    installRow(w, id, sha, 255);
    A = id;
  });

  it("install rc 1 while the new release is live after all: exit 1, 'but release X is live'", () => {
    const w = S.w;
    const sha = w.commit("rc1-live");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SSH_RC: "install=run:1" });
    assert.equal(r.code, 1, r.all);
    const id = builtId(r);
    assert.ok(r.err.includes(`FAILED: install failed on the server (rc=1), but release ${id} is live; run --list and --smoke now`), r.err);
    notSure(r);
    assert.equal(w.boxLive(), id);
    installRow(w, id, sha, 1);
    A = id;
  });

  it("install rc 1 and the live release cannot be read: exit 1, 'cannot be read now'", () => {
    const w = S.w;
    const sha = w.commit("rc1-unreadable");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SSH_RC: "install=1 manifest=1" });
    assert.equal(r.code, 1, r.all);
    const id = builtId(r);
    assert.ok(r.err.includes("FAILED: install failed on the server (rc=1) and the live release cannot be read now; run --list now"), r.err);
    notSure(r);
    assert.equal(w.boxLive(), A);
    installRow(w, id, sha, 1);
  });

  it("install rc 3 and the live release cannot be read: exit 3, the combined wording, live now unreadable", () => {
    const w = S.w;
    const sha = w.commit("rc3-unreadable");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SSH_RC: "install=3 manifest=1" });
    assert.equal(r.code, 3, r.all);
    const id = builtId(r);
    assert.ok(r.err.includes(`SWITCHED, BUT SMOKE FAILS: release ${id} went live and failed the server smoke checks, and the server's automatic rollback either had no good release to go back to or switched back to one that also fails them; release ${id} is marked bad.`), r.err);
    assert.ok(r.err.includes("live now: (cannot read it from the server). It FAILS the server smoke checks."), r.err);
    installRow(w, id, sha, 3);
    assert.ok(localRows(w, "deploy").pop().startsWith("live now (cannot read it from the server), smoke FAIL: "));
  });

  it("the real switch back fails on the server (lb-release.sh exits 4): exit 3, 'could not switch back', the new release is live", () => {
    const w = S.w;
    H.installOddShim(w.shims, "ln");
    const sha = w.commit("real-4");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_HEADERS: HEADERS, FAKE_SMOKE_FAIL_ID: sha.slice(0, 12),
      FAKE_LN_FAIL_AT: "2", FAKE_LN_COUNT: H.toBash(path.join(w.root, "ln-count")) });
    assert.equal(r.code, 3, r.all);
    const id = builtId(r);
    assert.ok(r.out.includes(`AUTO-ROLLBACK FAILED: could not switch back to ${A}; ${id} is still live`), r.out);
    assert.ok(r.err.includes(`SWITCHED, BUT SMOKE FAILS: release ${id} went live and failed the server smoke checks, and the server's automatic rollback could not switch back; release ${id} is marked bad.`), r.err);
    assert.ok(r.err.includes(`live now: ${id}.`), r.err);
    assert.equal(w.boxLive(), id);
    installRow(w, id, sha, 4);
    assert.equal(outsideCalls(r).length, 0, "no outside checks after rc 4");
  });
});
