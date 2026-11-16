/* LB-37: tests for the parts of scripts/deploy/deploy.sh that run AFTER the upload: the install on
 * the server, the outside checks, --verify and --rollback. Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * The suite builds one world (test/helpers/deploy-world.js) and walks it through several real
 * releases in order: the fake ssh runs the real server script (lb-release.sh) in a local folder
 * and the fake curl serves that folder, so the server's own smoke checks and rollbacks really run.
 * FAKE_SMOKE_FAIL / FAKE_SMOKE_FAIL_ID break the served index.html (smoke fails), FAKE_HEADERS
 * sends the kit's header baseline (outside checks pass), FAKE_SSH_RC changes a server answer.
 *
 * Covered:
 *  - a passing deploy end to end: upload, install, server smoke, outside checks; exit 0; the
 *    release is live and marked good on the server; logged on the laptop;
 *  - --verify passes with the right headers and fails (exit 1) without them, logged; it refuses
 *    when the live release is not the commit named;
 *  - --rollback: the server refuses (rc 1, nothing switched); the connection is lost (rc 255,
 *    state unknown); the rollback switched but the release live now fails smoke (rc 3 ->
 *    exit 3 naming the live release, logged); LB_EXPECT_CURRENT missing or malformed is refused;
 *  - --list and --smoke exit 0 or 1 only: a lost connection (255) is "server state unknown", any
 *    other server failure (a failed smoke, an exit 2) is exit 1 with the server's code named;
 *  (install outcomes: deploy-sh-install.test.js; outside-check failures: deploy-sh-outside.test.js)
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./helpers/deploy-env.js");
const { DECKS, HEADERS, assertRefused, builtId, suiteWorld, hasRow, localRows, outsideCalls } = require("./helpers/deploy-world.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

/* ------------------------------------------------------------ deploy, --verify, --rollback */

describe("deploy.sh after the upload: deploy, --verify, --rollback", { skip: SKIP }, () => {
  const S = suiteWorld({ files: DECKS });
  let A = "", B = "", shaA = "";

  it("a passing deploy: upload, install, server smoke, outside checks; exit 0; logged on both sides", () => {
    const w = S.w;
    shaA = w.sha;
    const r = w.run([], { LB_EXPECT_SHA: shaA, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 0, r.all);
    A = builtId(r);
    assert.match(A, /^\d{8}T\d{6}Z-[0-9a-f]{12}$/, r.out);
    assert.equal(A.slice(-12), shaA.slice(0, 12));
    assert.match(r.out, /OUTSIDE OK: \d+ addresses current, \d+ private paths 404, headers match, languages: bn es ja sq/);
    assert.ok(r.out.includes(`LIVE: release ${A} of ${shaA} passes every outside check`), r.out);
    assert.ok(r.server.some((c) => c.startsWith("scp ") && c.endsWith(`/incoming/${A}.tar`)), "the release tar was uploaded");
    assert.ok(r.server.some((c) => new RegExp(` install \\S+/incoming/${A}\\.tar ${A} [0-9a-f]{64}$`).test(c)), "the server install ran");
    // the server smoke used the fake curl on the server's own address; the outside checks used the site address
    assert.ok(r.calls.some((c) => c.startsWith("curl http://127.0.0.1:80/languagebasics/")), "server smoke ran (fake curl)");
    for (const c of r.calls.filter((x) => x.startsWith("curl "))) {
      assert.match(c, /^curl (https:\/\/example\.invalid\/languagebasics\/|http:\/\/127\.0\.0\.1:80\/languagebasics)/, "no other address is fetched");
    }
    const out = outsideCalls(r).map((c) => c.slice("curl https://example.invalid/languagebasics/".length));
    for (const p of ["", "engine.js", "content/bn/words-1.js", "content/ja/alphabet-1.js", "privacy.html", "package.json",
      "CLAUDE.md", "deploys.log", "scripts/", "?lesson=es/lesson-1"]) {
      assert.ok(out.includes(p), `outside checks fetched /${p}`);
    }
    // server state
    assert.equal(w.boxLive(), A);
    hasRow(w.boxLog(), [undefined, "live", A]);
    hasRow(w.boxLog(), [undefined, "good", A, "smoke-pass"]);
    assert.deepEqual(fs.readdirSync(path.join(w.box.kit, "incoming")), [], "the uploaded tar is removed after the install");
    // laptop log
    const rows = localRows(w, "deploy");
    assert.ok(rows.some((t) => t.startsWith(`${A} sha=${shaA} kit=${shaA} manifest=`) && t.endsWith(" install rc=0")), rows.join("\n"));
    assert.ok(rows.includes(`${A} outside OK`), rows.join("\n"));
  });

  it("--verify passes with the right headers and fails (exit 1) without them; both are logged; nothing is switched", () => {
    const w = S.w;
    const ok = w.run(["--verify"], { FAKE_HEADERS: HEADERS });
    assert.equal(ok.code, 0, ok.all);
    assert.match(ok.out, /OUTSIDE OK: /);
    const bad = w.run(["--verify"]);
    assert.equal(bad.code, 1, bad.all);
    assert.ok(bad.err.includes(`OUTSIDE FAIL for release ${A} (`), bad.err);
    assert.match(bad.err, /headers of \/: cache-control is '', want 'no-cache'/);
    assert.match(bad.err, /headers of \/content\/languages\.js: x-frame-options is '', want 'DENY'/);
    for (const r of [ok, bad]) assert.ok(!r.server.some((c) => / (install|rollback) /.test(c)), "verify never installs or rolls back");
    assert.equal(w.boxLive(), A);
    const rows = localRows(w, "verify");
    assert.deepEqual(rows.slice(-2), [`${A} rc=0`, `${A} rc=1`]);
  });

  it("a second release; --verify naming the older commit is refused", () => {
    const w = S.w;
    const shaB = w.commit("B");
    const r = w.run([], { LB_EXPECT_SHA: shaB, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 0, r.all);
    B = builtId(r);
    assert.equal(w.boxLive(), B);
    const v = w.run(["--verify"], { LB_EXPECT_SHA: shaA, FAKE_HEADERS: HEADERS });
    assert.equal(v.code, 1, v.all);
    assert.ok(v.err.includes(`REFUSED: live release is ${B}, not commit ${shaA}`), v.err);
    assert.equal(outsideCalls(v).length, 0, "no outside check for the wrong release");
  });

  it("--rollback without LB_EXPECT_CURRENT, or with a malformed one, is refused before the server is contacted", () => {
    const w = S.w;
    for (const extra of [{}, { LB_EXPECT_CURRENT: "" }, { LB_EXPECT_CURRENT: B.slice(0, -1) }, { LB_EXPECT_CURRENT: B.toUpperCase() }, { LB_EXPECT_CURRENT: "current" }]) {
      const r = w.run(["--rollback"], extra);
      assertRefused(r, /set LB_EXPECT_CURRENT to the live release id shown by --list; a rollback only moves away from the release you name/);
    }
    assert.equal(w.boxLive(), B);
  });

  it("--rollback naming a release that is not live: the server refuses, nothing is switched (exit 1, logged)", () => {
    const w = S.w;
    const r = w.run(["--rollback"], { LB_EXPECT_CURRENT: A, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 1, r.all);
    assert.ok(r.err.includes(`current is ${B}, not ${A}; nothing changed`), r.err);
    assert.match(r.err, /the server refused the rollback or it failed before switching \(rc=1\); nothing was switched/);
    assert.equal(w.boxLive(), B);
    assert.equal(localRows(w, "rollback").pop(), `rollback from ${A} rc=1`);
  });

  it("--rollback when the connection is lost (rc 255): exit 1, state unknown, never 'nothing was switched'", () => {
    const w = S.w;
    const r = w.run(["--rollback"], { LB_EXPECT_CURRENT: B, FAKE_SSH_RC: "rollback=255" });
    assert.equal(r.code, 1, r.all);
    assert.match(r.err, /the connection to the server was lost during the rollback; the server state is unknown; run --list now/);
    assert.doesNotMatch(r.err, /nothing was switched/);
    assert.equal(w.boxLive(), B);
    assert.equal(localRows(w, "rollback").pop(), `rollback from ${B} rc=255`);
  });

  it("--rollback that switches to a release that fails smoke (rc 3): exit 3, names the live release, logged", () => {
    const w = S.w;
    const r = w.run(["--rollback"], { LB_EXPECT_CURRENT: B, FAKE_SMOKE_FAIL_ID: A, FAKE_HEADERS: HEADERS });
    assert.equal(r.code, 3, r.all);
    assert.ok(r.out.includes(`SWITCHED BUT SMOKE FAILS: ${A} is live now`), "the server's own message");
    assert.ok(r.err.includes(`SWITCHED, BUT SMOKE FAILS: the rollback switched the live release away from ${B}, which is now marked bad.`), r.err);
    assert.ok(r.err.includes(`live now: ${A}. It FAILS the server smoke checks. Check the server now.`), r.err);
    assert.equal(w.boxLive(), A);
    hasRow(w.boxLog(), [undefined, "bad", B, "rolled-back: manual"]);
    hasRow(w.boxLog(), [undefined, "live", A, `rollback from ${B}`]);
    const rows = localRows(w, "rollback");
    assert.deepEqual(rows.slice(-2), [`rollback from ${B} rc=3`,
      `live now ${A}, smoke FAIL: the rollback switched the live release away from ${B}, which is now marked bad.`]);
    assert.equal(outsideCalls(r).length, 0, "no outside checks after a failed smoke");
  });

  it("--list and --smoke exit 0 or 1 only: a lost connection (255) says the state is unknown; a failed check says so", () => {
    const w = S.w;
    const live = w.boxLive();
    for (const mode of ["list", "smoke"]) {
      const ok = w.run([`--${mode}`]);
      assert.equal(ok.code, 0, ok.all);
      assert.ok(ok.server.some((c) => new RegExp(` ${mode}$`).test(c)), `the ${mode} ran on the server`);

      const lost = w.run([`--${mode}`], { FAKE_SSH_RC: `${mode}=255` });
      assert.equal(lost.code, 1, lost.all);
      assert.ok(lost.err.includes(`FAILED: the connection to the server was lost during --${mode}; the server state is unknown; run --${mode} again`), lost.err);

      const odd = w.run([`--${mode}`], { FAKE_SSH_RC: `${mode}=2` });
      assert.equal(odd.code, 1, `a server exit 2 is not passed on as a usage error: ${odd.all}`);
      assert.ok(odd.err.includes(`FAILED: --${mode} failed on the server (rc=2); see the output above`), odd.err);
    }
    const bad = w.run(["--smoke"], { FAKE_SMOKE_FAIL: "1" });
    assert.equal(bad.code, 1, bad.all);
    assert.match(bad.out, /smoke FAIL/);
    assert.ok(bad.err.includes("FAILED: --smoke failed on the server (rc=1); see the output above"), bad.err);
    assert.equal(w.boxLive(), live, "--list and --smoke never switch anything");
  });
});
