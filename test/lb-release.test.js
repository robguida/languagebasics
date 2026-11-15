/* LB-37: tests for scripts/deploy/lb-release.sh (the server side of the deploy kit), run
 * locally in bash on a temp "server" folder with a fake curl. No network.
 *
 * Run:  node --test        (needs bash 4+; on Windows, Git Bash. Without it these tests are
 *                           skipped and the skip reason is printed.)
 *
 * On Windows the `current` link is a directory junction (test-only ln/readlink shims in
 * test/fixtures/deploy-fakes/), because a normal account cannot make symbolic links there.
 *
 * Covered (the rollback bug fix):
 *  - rollback picks the newest release that is not current, not bad and still on disk;
 *  - the release a rollback leaves is marked bad, so a second rollback is refused when no
 *    good release is left (nothing changes);
 *  - older log lines ("rollback from X", "auto-rollback from X") mark X bad;
 *  - a rollback naming the wrong current release changes nothing;
 *  - a release that fails smoke is marked bad, the old one comes back, and no later
 *    rollback picks the bad one;
 *  - pruning never removes the current release or the rollback target, counts good
 *    releases only, and keeps the newest bad one;
 *  - usage and settings errors.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const H = require("./helpers/deploy-env.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? false : BASH.reason;

const id = (n) => `20261115T0${n}0000Z-${"a".repeat(11)}${n}`;

const RELEASE_FILES = ["index.html", "engine.js", "styles.css", "content/languages.js",
  "content/sq/lesson-1.js", "content/es/lesson-1.js", "content/ja/lesson-1.js", "content/bn/lesson-1.js"];

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/* Write a full release (files + manifest) into dir. Returns the manifest sha256. */
function fillRelease(dir, tag) {
  for (const f of RELEASE_FILES) write(path.join(dir, f), `${f} of ${tag}\n`);
  const lines = [...RELEASE_FILES].sort().map((f) => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex")}  ${f}`);
  const man = lines.join("\n") + "\n";
  write(path.join(dir, ".manifest.sha256"), man);
  return crypto.createHash("sha256").update(man).digest("hex");
}

function makeServer(t) {
  const tr = H.tempRoot("lb37r-");
  if (tr.reason) throw new Error(tr.reason);
  const root = tr.root;
  t.after(() => H.removeTree(root));
  const env = H.cleanEnv(root);
  const { bin, shims } = H.installFakes(root);
  const lbroot = path.join(root, "box", "root");
  const rel = path.join(lbroot, "releases");
  const route = path.join(root, "box", "route.conf");
  fs.mkdirSync(rel, { recursive: true });
  write(route, "# route\n");
  const script = path.join(root, "box", "lb-release.sh");
  write(script, fs.readFileSync(path.join(H.KIT, "lb-release.sh"), "utf8").replace(/\r\n/g, "\n"));
  const calls = path.join(root, "calls.txt");
  const benv = Object.assign({}, env, {
    LB_ROOT: H.toBash(lbroot),
    LB_ROUTE_FILE: H.toBash(route),
    LB_CURL: H.toBash(path.join(bin, "curl")),
    FAKE_ROOT: H.toBash(lbroot),
    FAKE_CALLS: H.toBash(calls),
  });
  const s = {
    root, lbroot, rel,
    add(n) { fillRelease(path.join(rel, id(n)), id(n)); },
    log(...rows) {
      fs.appendFileSync(path.join(lbroot, "deploys.log"), rows.map(([kind, n, note]) => `2026-11-15T00:00:00Z\t${kind}\t${id(n)}\t${note || ""}\n`).join(""));
    },
    logText() { try { return fs.readFileSync(path.join(lbroot, "deploys.log"), "utf8"); } catch { return ""; } },
    point(n) {
      const r = H.runBash(null, [H.toBash(lbroot), id(n)], {
        command: 'cd "$1" && ln -sfn "releases/$2" .current.new && mv -Tf .current.new current', env: benv, shims,
      });
      assert.equal(r.code, 0, r.all);
    },
    run(args, extra) {
      return H.runBash(script, args, { env: Object.assign({}, benv, extra || {}), shims, cwd: root });
    },
    /* -> { current, previous, status: { id: status } } from `list` */
    list() {
      const r = s.run(["list"]);
      assert.equal(r.code, 0, r.all);
      const m = /current: (\S*)\s+previous: (\S*)/.exec(r.out);
      assert.ok(m, r.out);
      const status = {};
      for (const line of r.out.split("\n")) {
        const x = /^ {2}(\S+) {2}(.+)$/.exec(line);
        if (x) status[x[1]] = x[2];
      }
      return { current: m[1], previous: m[2], status };
    },
    /* Pack a release as the deploy kit would and return [tarPath, manifestSha]. */
    pack(n) {
      const stage = path.join(root, "stage", id(n));
      const msha = fillRelease(stage, id(n));
      const tar = path.join(root, "box", "kit", "incoming", `${id(n)}.tar`);
      fs.mkdirSync(path.dirname(tar), { recursive: true });
      const r = H.runBash(null, [H.toBash(stage), H.toBash(tar)], { command: 'cd "$1" && tar -cf "$2" .manifest.sha256 *', env: benv, shims });
      assert.equal(r.code, 0, r.all);
      return [H.toBash(tar), msha, tar];
    },
  };
  return s;
}

/* Three good releases, live in order: 1, 2, 3 (current). */
function threeGood(s) {
  for (const n of [1, 2, 3]) s.add(n);
  s.log(["live", 1, "from=none"], ["good", 1, "smoke-pass"], ["live", 2, `from=${id(1)}`], ["good", 2, "smoke-pass"],
    ["live", 3, `from=${id(2)}`], ["good", 3, "smoke-pass"]);
  s.point(3);
}

/* ------------------------------------------------------------ rollback */

test("lb-release: rollback goes to the newest good release and marks the one it leaves bad", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  threeGood(s);
  assert.equal(s.list().previous, id(2));
  const r = s.run(["rollback"]);
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, new RegExp(`ROLLED BACK ${id(3)} -> ${id(2)}`));
  assert.match(r.out, /smoke PASS/);
  const l = s.list();
  assert.equal(l.current, id(2));
  assert.equal(l.status[id(3)], "bad");
  assert.equal(l.previous, id(1), "the next rollback would skip the bad release");
  assert.match(s.logText(), new RegExp(`\\tbad\\t${id(3)}\\trolled-back: manual`));
});

test("lb-release: a rollback whose target fails smoke exits 3 and says the switch happened and what is live", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  threeGood(s);
  const r = s.run(["rollback"], { FAKE_SMOKE_FAIL: "1" });
  assert.equal(r.code, 3, r.all);
  assert.match(r.out, new RegExp(`ROLLED BACK ${id(3)} -> ${id(2)}`));
  assert.match(r.out, new RegExp(`SWITCHED BUT SMOKE FAILS: ${id(2)} is live now`));
  const l = s.list();
  assert.equal(l.current, id(2), "current did move");
  assert.equal(l.status[id(3)], "bad", "the release left is marked bad");
});

test("lb-release: rollback skips releases marked bad and releases no longer on disk", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  for (const n of [1, 2, 3, 4]) s.add(n);
  s.log(["live", 1], ["good", 1], ["live", 2], ["good", 2], ["live", 3], ["good", 3], ["bad", 3, "rolled-back: manual"],
    ["live", 4], ["good", 4]);
  s.point(4);
  fs.rmSync(path.join(s.rel, id(2)), { recursive: true });
  const r = s.run(["rollback"]);
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, new RegExp(`ROLLED BACK ${id(4)} -> ${id(1)}`), "3 is bad and 2 is gone, so 1");
});

test("lb-release: a second rollback is refused when no good release is left, and nothing changes", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  for (const n of [1, 2]) s.add(n);
  s.log(["live", 1], ["good", 1], ["live", 2], ["good", 2]);
  s.point(2);
  const r1 = s.run(["rollback"]);
  assert.equal(r1.code, 0, r1.all);
  assert.equal(s.list().current, id(1));
  const logBefore = s.logText();
  const r2 = s.run(["rollback"]);
  assert.equal(r2.code, 1, r2.all);
  assert.match(r2.err, /no good release to roll back to; nothing changed/);
  assert.equal(s.list().current, id(1), "current unchanged");
  assert.equal(s.logText(), logBefore, "log unchanged");
});

test("lb-release: older log notes ('rollback from X', 'auto-rollback from X') mark X bad", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  for (const n of [1, 2, 3]) s.add(n);
  // Old-style log: only "live" lines, notes name the release that was left.
  s.log(["live", 1, "from=none"], ["live", 2, `from=${id(1)}`], ["live", 3, `from=${id(2)}`], ["live", 2, `auto-rollback from ${id(3)}`]);
  s.point(2);
  let l = s.list();
  assert.equal(l.status[id(3)], "bad");
  assert.equal(l.previous, id(1), "the release just left (3) is never the target");
  const r = s.run(["rollback"]);
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, new RegExp(`ROLLED BACK ${id(2)} -> ${id(1)}`));

  const s2 = makeServer(t);
  for (const n of [1, 2]) s2.add(n);
  s2.log(["live", 1], ["live", 2], ["live", 1, `rollback from ${id(2)}`]);
  s2.point(1);
  l = s2.list();
  assert.equal(l.status[id(2)], "bad");
  assert.equal(l.previous, "");
  const r2 = s2.run(["rollback"]);
  assert.equal(r2.code, 1, r2.all);
  assert.match(r2.err, /no good release to roll back to/);
});

test("lb-release: a rollback naming the wrong current release changes nothing", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  threeGood(s);
  const before = s.logText();
  const r = s.run(["rollback", id(2), "outside-check-failed"]);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, new RegExp(`current is ${id(3)}, not ${id(2)}; nothing changed`));
  assert.equal(s.list().current, id(3));
  assert.equal(s.logText(), before);
  const ok = s.run(["rollback", id(3), "outside-check-failed"]);
  assert.equal(ok.code, 0, ok.all);
  assert.match(s.logText(), new RegExp(`\\tbad\\t${id(3)}\\trolled-back: outside-check-failed`));
});

/* ------------------------------------------------------------ install, smoke, prune */

test("lb-release: install switches current after the smoke passes and logs it good", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  s.add(1);
  s.log(["live", 1], ["good", 1]);
  s.point(1);
  const [tar, msha, tarWin] = s.pack(2);
  const r = s.run(["install", tar, id(2), msha]);
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /smoke PASS/);
  const l = s.list();
  assert.equal(l.current, id(2));
  assert.equal(l.previous, id(1));
  assert.match(s.logText(), new RegExp(`\\tgood\\t${id(2)}\\tsmoke-pass`));
  assert.ok(!fs.existsSync(tarWin), "the uploaded tar is removed after a good install");
});

test("lb-release: a release that fails smoke is marked bad, the old one comes back, and no rollback picks it", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  s.add(1);
  s.log(["live", 1], ["good", 1]);
  s.point(1);
  const [tar, msha] = s.pack(2);
  const r = s.run(["install", tar, id(2), msha], { FAKE_SMOKE_FAIL: "1" });
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, new RegExp(`AUTO-ROLLBACK to ${id(1)} \\(${id(2)} marked bad\\)`));
  const l = s.list();
  assert.equal(l.current, id(1));
  assert.equal(l.status[id(2)], "bad");
  assert.equal(l.previous, "");
  const rb = s.run(["rollback"]);
  assert.equal(rb.code, 1, rb.all);
  assert.match(rb.err, /no good release to roll back to/);
});

test("lb-release: install refuses a manifest sha that is not the approved one", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  s.add(1);
  s.log(["live", 1], ["good", 1]);
  s.point(1);
  const [tar] = s.pack(2);
  const r = s.run(["install", tar, id(2), "0".repeat(64)]);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /manifest sha .* != approved/);
  assert.equal(s.list().current, id(1));
  assert.ok(!fs.existsSync(path.join(s.rel, id(2))), "nothing installed");
});

test("lb-release: pruning keeps current, the rollback target and the newest bad release; counts good only", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  for (const n of [1, 2, 3, 4, 5]) s.add(n);
  // 1, 2, 3 good; 4 and 5 failed smoke and were rolled back to 3.
  s.log(["live", 1], ["good", 1], ["live", 2], ["good", 2], ["live", 3], ["good", 3],
    ["live", 4], ["bad", 4, "smoke-failed"], ["live", 3, `auto-rollback from ${id(4)}`],
    ["live", 5], ["bad", 5, "smoke-failed"], ["live", 3, `auto-rollback from ${id(5)}`]);
  s.point(3);
  const [tar, msha] = s.pack(6);
  const r = s.run(["install", tar, id(6), msha], { LB_KEEP: "2" });
  assert.equal(r.code, 0, r.all);
  const left = fs.readdirSync(s.rel).sort();
  // 6 = current, 3 = rollback target (kept even though older than the bad ones), 5 = newest bad.
  assert.deepEqual(left, [id(3), id(5), id(6)]);
  const l = s.list();
  assert.equal(l.current, id(6));
  assert.equal(l.previous, id(3));
});

test("lb-release: pruning never removes an old rollback target, even past LB_KEEP", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  for (const n of [1, 2, 3]) s.add(n);
  // Old-style log: 1 was put back by hand after 3, with no "rollback from" note, so 3 is not bad.
  s.log(["live", 1, "from=none"], ["live", 2, `from=${id(1)}`], ["live", 3, `from=${id(2)}`], ["live", 1, `from=${id(3)}`]);
  s.point(1);
  const [tar, msha] = s.pack(4);
  const r = s.run(["install", tar, id(4), msha], { LB_KEEP: "2" });
  assert.equal(r.code, 0, r.all);
  // newest first: 4 current, 3 good (count 2), 2 good past LB_KEEP -> pruned, 1 = rollback target -> kept.
  assert.equal(s.list().previous, id(1));
  assert.deepEqual(fs.readdirSync(s.rel).sort(), [id(1), id(3), id(4)]);
});

test("lb-release: with a larger LB_KEEP, good releases are kept and bad ones never count", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  for (const n of [1, 2, 3, 4]) s.add(n);
  s.log(["live", 1], ["good", 1], ["live", 2], ["bad", 2, "smoke-failed"], ["live", 1, `auto-rollback from ${id(2)}`],
    ["live", 3], ["good", 3], ["live", 4], ["bad", 4, "smoke-failed"], ["live", 3, `auto-rollback from ${id(4)}`]);
  s.point(3);
  const [tar, msha] = s.pack(5);
  const r = s.run(["install", tar, id(5), msha], { LB_KEEP: "3", LB_KEEP_BAD: "0" });
  assert.equal(r.code, 0, r.all);
  // good: 5 (current), 3 (target), 1 -> 3 kept; bad 4 and 2 removed (LB_KEEP_BAD=0).
  assert.deepEqual(fs.readdirSync(s.rel).sort(), [id(1), id(3), id(5)]);
});

/* ------------------------------------------------------------ usage */

test("lb-release: usage and settings errors", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  const u = s.run(["bogus"]);
  assert.equal(u.code, 2, u.all);
  for (const [extra, re] of [
    [{ LB_ROOT: "" }, /LB_ROOT is not set/],
    [{ LB_ROOT: "relative/path" }, /LB_ROOT must be an absolute path/],
    [{ LB_ROOT: "/a/../b" }, /LB_ROOT must not hold \. or \.\. parts/],
    [{ LB_KEEP: "1" }, /LB_KEEP must be a whole number, 2 or more/],
    [{ LB_KEEP_BAD: "x" }, /LB_KEEP_BAD must be a whole number/],
  ]) {
    const r = s.run(["list"], extra);
    assert.equal(r.code, 1, r.all);
    assert.match(r.err, re);
  }
  const bad = s.run(["install", "x.tar", "not-an-id", "0".repeat(64)]);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /bad release id/);
});

test("lb-release: smoke fails when the app's route file is missing", { skip: SKIP }, (t) => {
  const s = makeServer(t);
  s.add(1);
  s.log(["live", 1], ["good", 1]);
  s.point(1);
  const ok = s.run(["smoke"]);
  assert.equal(ok.code, 0, ok.all);
  const r = s.run(["smoke"], { LB_ROUTE_FILE: H.toBash(path.join(s.root, "box", "missing.conf")) });
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /smoke FAIL: the app's route file is missing/);
});
