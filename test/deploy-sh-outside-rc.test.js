/* LB-37: tests for scripts/deploy/deploy.sh when the server REFUSES the automatic rollback after a
 * failed outside check (rc 1). deploy.sh reads the live release before it says what is live.
 * Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * The suite builds one world (test/helpers/deploy-world.js): release A goes live and passes, then
 * each new release passes the server smoke but fails the outside checks (no header baseline is
 * sent), and FAKE_SSH_RC changes the server's rollback answer.
 *
 * Covered, each with exit code, message, live release and the laptop log row:
 *  - rollback=1, nothing moved: "nothing was switched: release X is still live";
 *  - rollback=run:1, the rollback really switched to A, then the answer was 1: names A as live,
 *    "not X (something else switched it)", never "still live";
 *  - rollback=1 and the live release cannot be read: "cannot be read now; release X may still be
 *    live", never "nothing was switched".
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { DECKS, HEADERS, builtId, suiteWorld, localRows } = require("./helpers/deploy-world.js");
const H = require("./helpers/deploy-env.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

describe("deploy.sh: the server refuses the automatic rollback (rc 1)", { skip: SKIP }, () => {
  const S = suiteWorld({ files: DECKS });
  let A = "";

  /* A new release that fails the outside checks, with this server rollback answer. */
  function failing(label, rule) {
    const w = S.w;
    const sha = w.commit(label);
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_SSH_RC: rule });
    assert.equal(r.code, 1, r.all);
    const id = builtId(r);
    assert.ok(r.err.includes(`OUTSIDE FAIL for release ${id} (`), r.err);
    assert.ok(r.server.some((c) => c.endsWith(` rollback ${id} outside-check-failed`)), "the automatic rollback was asked for");
    assert.equal(localRows(w, "deploy").pop(), `${id} outside FAIL, auto-rollback rc=1`);
    assert.doesNotMatch(r.err, /was rolled back$/m);
    return { r, id };
  }

  it("release A goes live and passes", () => {
    const w = S.w;
    const r = w.run([], { LB_EXPECT_SHA: w.sha, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 0, r.all);
    A = builtId(r);
    assert.equal(w.boxLive(), A);
  });

  it("rollback=1, nothing moved: exit 1, 'nothing was switched: release X is still live'", () => {
    const { r, id } = failing("refused", "rollback=1");
    assert.ok(r.err.includes(`FAILED: AUTOMATIC ROLLBACK REFUSED by the server (rc=1), nothing was switched: release ${id} is still live and fails the outside checks. Check the server now.`), r.err);
    assert.equal(S.w.boxLive(), id);
    A = id;
  });

  it("rollback=run:1, the rollback really switched: exit 1, names the release live now, never 'still live'", () => {
    const prev = A;
    const { r, id } = failing("moved", "rollback=run:1");
    assert.ok(r.err.includes(`FAILED: AUTOMATIC ROLLBACK REFUSED by the server (rc=1): release ${prev} is live now, not ${id} (something else switched it); release ${id} fails the outside checks. Run --list and --verify now.`), r.err);
    assert.doesNotMatch(r.err, /still live|nothing was switched/);
    assert.equal(S.w.boxLive(), prev);
  });

  it("rollback=1 and the live release cannot be read: exit 1, 'cannot be read now', the release may still be live", () => {
    const { r, id } = failing("unreadable", "rollback=1 manifest=1");
    assert.ok(r.err.includes(`FAILED: AUTOMATIC ROLLBACK REFUSED by the server (rc=1), and the live release cannot be read now; release ${id} may still be live and fails the outside checks. Run --list now.`), r.err);
    assert.doesNotMatch(r.err, /nothing was switched/);
    assert.equal(S.w.boxLive(), id);
  });
});
