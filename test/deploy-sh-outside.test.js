/* LB-37: tests for scripts/deploy/deploy.sh when the outside checks (through the CDN) fail after a
 * release went live: every kind of failure rolls the release back automatically. Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * The suite builds one world (test/helpers/deploy-world.js): release A goes live and passes,
 * then each new release passes the server smoke but fails one outside check. The fake curl
 * makes the failure: a header baseline file with a header missing or a cookie added
 * (FAKE_HEADERS), changed bytes for one file (FAKE_CORRUPT), or a private path answered 200
 * (FAKE_SERVE).
 *
 * Covered, each with exit code, message, live release and log rows:
 *  - a missing header, a Set-Cookie, a wrong file hash, a 404-list path served: OUTSIDE FAIL
 *    names the problem, the release is rolled back automatically to A (server marks it bad),
 *    exit 1 "failed the outside checks and was rolled back";
 *  - the automatic rollback switched to a release that fails smoke (rc 3): exit 3 naming the
 *    release live now;
 *  - the connection is lost during the automatic rollback (rc 255): exit 1, the new release may
 *    still be live.
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./helpers/deploy-env.js");
const { DECKS, HEADERS, builtId, suiteWorld, hasRow, localRows, write } = require("./helpers/deploy-world.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

const BASELINE = fs.readFileSync(path.join(H.KIT, "expected-headers.txt"), "utf8").replace(/\r\n/g, "\n");

describe("deploy.sh: a failed outside check rolls the new release back", { skip: SKIP }, () => {
  const S = suiteWorld({ files: DECKS });
  let A = "";

  /* A header file for the fake curl, in the world's folder. */
  function headerFile(name, text) {
    const f = path.join(S.w.root, name);
    write(f, text);
    return H.toBash(f);
  }

  it("release A goes live and passes the outside checks", () => {
    const w = S.w;
    const r = w.run([], { LB_EXPECT_SHA: w.sha, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 0, r.all);
    A = builtId(r);
    assert.equal(w.boxLive(), A);
    assert.match(BASELINE, /^X-Frame-Options: DENY$/m, "the baseline holds the header the first case removes");
    assert.match(BASELINE, /^!Set-Cookie$/m, "the baseline forbids cookies");
  });

  const cases = [
    ["a missing header", () => ({ FAKE_HEADERS: headerFile("no-xfo.txt", BASELINE.replace(/^X-Frame-Options: DENY\n/m, "")) }),
      /headers of \/: x-frame-options is '', want 'DENY'/],
    ["a Set-Cookie header", () => ({ FAKE_HEADERS: headerFile("cookie.txt", BASELINE + "Set-Cookie: sid=1\n") }),
      /headers of \/privacy\.html: set-cookie must not be sent/],
    ["a file with the wrong hash", () => ({ FAKE_HEADERS: HEADERS, FAKE_CORRUPT: "engine.js" }),
      /file engine\.js: HTTP 200, hash [0-9a-f]{64} \(want 200 and the release hash\)/],
    ["a 404-list path served", () => ({ FAKE_HEADERS: HEADERS, FAKE_SERVE: "package.json" }),
      /package\.json: HTTP 200 \(want 404\)/],
  ];
  for (const [label, extra, re] of cases) {
    it(`${label}: OUTSIDE FAIL names it, automatic rollback to the last good release, exit 1, logged`, () => {
      const w = S.w;
      const env = extra();
      const sha = w.commit(label);
      const r = w.run([], Object.assign({ LB_EXPECT_SHA: sha }, env));
      assert.equal(r.code, 1, r.all);
      const id = builtId(r);
      assert.ok(id.endsWith(sha.slice(0, 12)), r.out);
      assert.ok(r.err.includes(`OUTSIDE FAIL for release ${id} (`), r.err);
      assert.match(r.err, re);
      assert.match(r.err, /outside checks failed; rolling back automatically/);
      assert.ok(r.err.includes(`FAILED: release ${id} failed the outside checks and was rolled back`), r.err);
      assert.ok(r.server.some((c) => c.endsWith(` rollback ${id} outside-check-failed`)), "the server rollback names the new release");
      assert.equal(w.boxLive(), A, "the last good release is live again");
      hasRow(w.boxLog(), [undefined, "bad", id, "rolled-back: outside-check-failed"]);
      hasRow(w.boxLog(), [undefined, "live", A, `rollback from ${id}`]);
      const rows = localRows(w, "deploy");
      assert.ok(rows.some((t) => t.startsWith(`${id} sha=${sha} `) && t.endsWith(" install rc=0")), rows.join("\n"));
      assert.equal(rows[rows.length - 1], `${id} outside FAIL, auto-rollback rc=0`);
    });
  }

  it("the automatic rollback switches to a release that fails smoke (rc 3): exit 3, names the release live now", () => {
    const w = S.w;
    const sha = w.commit("F");
    // no FAKE_HEADERS: the outside checks fail; FAKE_SMOKE_FAIL_ID: A fails smoke once it is live again
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_SMOKE_FAIL_ID: A });
    assert.equal(r.code, 3, r.all);
    const F = builtId(r);
    assert.ok(r.err.includes(`OUTSIDE FAIL for release ${F} (`), r.err);
    assert.ok(r.err.includes(`SWITCHED, BUT SMOKE FAILS: the automatic rollback after failed outside checks switched the live release away from ${F}, which is now marked bad.`), r.err);
    assert.ok(r.err.includes(`live now: ${A}. It FAILS the server smoke checks. Check the server now.`), r.err);
    assert.doesNotMatch(r.err, /was rolled back$/m);
    assert.equal(w.boxLive(), A);
    hasRow(w.boxLog(), [undefined, "bad", F, "rolled-back: outside-check-failed"]);
    const rows = localRows(w, "deploy");
    assert.deepEqual(rows.slice(-2), [`${F} outside FAIL, auto-rollback rc=3`,
      `live now ${A}, smoke FAIL: the automatic rollback after failed outside checks switched the live release away from ${F}, which is now marked bad.`]);
  });

  it("the connection is lost during the automatic rollback (rc 255): exit 1, the new release may still be live", () => {
    const w = S.w;
    const sha = w.commit("G");
    const r = w.run([], { LB_EXPECT_SHA: sha, FAKE_SSH_RC: "rollback=255" });
    assert.equal(r.code, 1, r.all);
    const G = builtId(r);
    assert.ok(r.err.includes(`the connection to the server was lost during the automatic rollback; release ${G} may still be live; run --list now`), r.err);
    assert.doesNotMatch(r.err, /nothing was switched/);
    assert.equal(w.boxLive(), G);
    assert.equal(localRows(w, "deploy").pop(), `${G} outside FAIL, auto-rollback rc=255`);
  });
});
