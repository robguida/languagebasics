/* LB-37: tests that pin the command-line options scripts/deploy/deploy.sh gives ssh, scp, curl and
 * tar, and tests for the test harness's own guards (fake curl allow list, hang guard). Fakes only.
 *
 * Run:  node --test        (needs bash 4+ with git; on Windows, Git Bash. Without it these
 *                           tests are skipped and the skip reason is printed.)
 *
 * Why: these options are the kit's hardening. Without a test, deleting one keeps every other test
 * green. The fake ssh, scp and curl and the tar shim write their FULL argument lists to the
 * FAKE_ARGS log (test/fixtures/deploy-fakes/), and one passing deploy is checked call by call:
 *  - every ssh call: -F none (no user or system ssh config), -i <the key>, IdentitiesOnly=yes,
 *    BatchMode=yes, StrictHostKeyChecking=yes and UserKnownHostsFile=<work folder>/known_hosts
 *    (the pinned host key), only known options, then user@host and the remote command;
 *  - every scp call: -q, -F none and the same key and -o options, then source and user@host:target;
 *  - every outside-check curl call: -q FIRST (curl reads ~/.curlrc unless -q is first), then
 *    -sS -g --proto =https;
 *  - every server-side curl call (lb-release.sh smoke, run by the fake ssh): -q FIRST, so the
 *    server account's ~/.curlrc is never read;
 *  - the release tar: "--" comes right before the member names, so a file name that starts with
 *    "-" can never be read as a tar option. The world holds src/-x.txt, so the manifest's
 *    sha256sum, the tar and the server install are all proven to take it as a name.
 * Harness guards:
 *  - the fake curl refuses an option that is not on its allow list, a missing value and a second
 *    address (so a misspelt curl option in the kit fails the tests instead of passing them);
 *  - the hang guard stops a timed-out run's whole process tree (a child that kept writing into the
 *    calls file stops), and the world then refuses further runs with a clear message.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./helpers/deploy-env.js");
const { DECKS, HEADERS, builtId, makeWorld, write } = require("./helpers/deploy-world.js");

const BASH = H.findBash();
const SKIP = BASH.bash ? (H.gitAvailable() ? false : "git is not installed") : BASH.reason;

const SITE = "https://example.invalid/languagebasics/";

/* The pair <flag> <value> appears next to each other in args. */
function hasPair(args, flag, value) {
  for (let i = 0; i + 1 < args.length; i++) if (args[i] === flag && args[i + 1] === value) return true;
  return false;
}

/* Every option before the last `tail` arguments is one of the allowed flags (with a value when
 * it takes one); returns the problems found. */
function optionProblems(args, tail, flags, withValue) {
  const problems = [];
  let i = 0;
  while (i < args.length - tail) {
    const a = args[i];
    if (withValue.includes(a)) i += 2;
    else if (flags.includes(a)) i += 1;
    else { problems.push(`unexpected argument ${JSON.stringify(a)} at ${i}`); i += 1; }
  }
  if (i !== args.length - tail) problems.push("an option value runs into the target");
  return problems;
}

/* The -o options deploy.sh must give both ssh and scp. */
function assertHostKeyOptions(a, w, label) {
  const show = `${label}: ${JSON.stringify(a)}`;
  assert.ok(hasPair(a, "-F", "none"), `-F none (no ssh config file is read) ${show}`);
  assert.ok(hasPair(a, "-i", w.settings.LB_SSH_KEY), `-i <the configured key> ${show}`);
  assert.ok(hasPair(a, "-o", "IdentitiesOnly=yes"), `IdentitiesOnly=yes ${show}`);
  assert.ok(hasPair(a, "-o", "BatchMode=yes"), `BatchMode=yes ${show}`);
  assert.ok(hasPair(a, "-o", "StrictHostKeyChecking=yes"), `StrictHostKeyChecking=yes (host key pin) ${show}`);
  assert.ok(hasPair(a, "-o", `UserKnownHostsFile=${H.toBash(w.known)}`), `UserKnownHostsFile=<work>/known_hosts ${show}`);
  // No second, weaker value anywhere, and no other config source.
  assert.deepEqual(a.filter((x) => /^StrictHostKeyChecking=/i.test(x)), ["StrictHostKeyChecking=yes"], show);
  assert.deepEqual(a.filter((x) => /^UserKnownHostsFile=/i.test(x)), [`UserKnownHostsFile=${H.toBash(w.known)}`], show);
  assert.equal(a.filter((x) => x === "-F").length, 1, `exactly one -F ${show}`);
}

test("deploy.sh: ssh, scp, curl and tar get the hardening options on every call of a passing deploy (with a src/-x.txt)", { skip: SKIP }, (t) => {
  // src/-x.txt: a file name that starts with "-" must reach the manifest, the tar and the server as a name.
  const w = makeWorld(t, { files: Object.assign({}, DECKS, { "src/-x.txt": "dash file\n" }) });
  H.installOddShim(w.shims, "tar"); // logs every tar call's arguments, then runs the real tar
  const r = w.run([], { LB_EXPECT_SHA: w.sha, FAKE_HEADERS: HEADERS });
  assert.equal(r.code, 0, r.all);
  const id = builtId(r);
  assert.ok(r.out.includes(`LIVE: release ${id} of ${w.sha} passes every outside check`), r.out);

  // ssh: every call, options then user@host then the remote command
  const ssh = r.args.filter((a) => a[0] === "ssh").map((a) => a.slice(1));
  assert.ok(ssh.length >= 4, `ssh calls logged: ${ssh.length}`);
  assert.equal(ssh.length, r.calls.filter((c) => c.startsWith("ssh ")).length, "every ssh call has an argument row");
  for (const a of ssh) {
    assertHostKeyOptions(a, w, "ssh");
    assert.equal(a[a.length - 2], "deployer@box.invalid", JSON.stringify(a));
    assert.deepEqual(optionProblems(a, 2, [], ["-F", "-i", "-o"]), [], JSON.stringify(a));
  }

  // scp: every call, -q, options, then source and user@host:target
  const scp = r.args.filter((a) => a[0] === "scp").map((a) => a.slice(1));
  assert.ok(scp.length >= 2, `scp calls logged (server script and release tar): ${scp.length}`);
  assert.equal(scp.length, r.calls.filter((c) => c.startsWith("scp ")).length, "every scp call has an argument row");
  assert.ok(scp.some((a) => a[a.length - 1].endsWith(`/incoming/${id}.tar`)), "the release tar went through scp");
  for (const a of scp) {
    assert.ok(a.includes("-q"), `scp -q ${JSON.stringify(a)}`);
    assertHostKeyOptions(a, w, "scp");
    assert.match(a[a.length - 1], /^deployer@box\.invalid:\//, JSON.stringify(a));
    assert.deepEqual(optionProblems(a, 2, ["-q"], ["-F", "-i", "-o"]), [], JSON.stringify(a));
  }

  // curl: every outside-check call starts with -q, then -sS -g --proto =https
  const curl = r.args.filter((a) => a[0] === "curl" && a[a.length - 1].startsWith(SITE)).map((a) => a.slice(1));
  assert.ok(curl.length >= 20, `outside-check curl calls logged: ${curl.length}`);
  assert.equal(curl.length, r.calls.filter((c) => c.startsWith(`curl ${SITE}`)).length, "every outside-check curl call has an argument row");
  for (const a of curl) {
    assert.deepEqual(a.slice(0, 5), ["-q", "-sS", "-g", "--proto", "=https"], `curl options, -q first: ${JSON.stringify(a)}`);
    assert.equal(a.filter((x) => x === "-q").length, 1, JSON.stringify(a));
  }

  // curl on the server (lb-release.sh smoke, through the fake ssh): -q FIRST, so the server
  // account's ~/.curlrc is never read
  const BOX = "http://127.0.0.1:80/";
  const scurl = r.args.filter((a) => a[0] === "curl" && a[a.length - 1].startsWith(BOX)).map((a) => a.slice(1));
  assert.ok(scurl.length >= 14, `server smoke curl calls logged: ${scurl.length}`);
  assert.equal(scurl.length, r.calls.filter((c) => c.startsWith(`curl ${BOX}`)).length, "every server curl call has an argument row");
  assert.equal(r.args.filter((a) => a[0] === "curl").length, curl.length + scurl.length, "no curl call to any other address");
  for (const a of scurl) {
    assert.equal(a[0], "-q", `server curl, -q first: ${JSON.stringify(a)}`);
    assert.equal(a.filter((x) => x === "-q").length, 1, JSON.stringify(a));
  }

  // src/-x.txt went through as a file name: in the manifest, and live on the server
  const live = path.join(w.box.root, "current");
  assert.equal(fs.readFileSync(path.join(live, "-x.txt"), "utf8"), "dash file\n");
  assert.match(fs.readFileSync(path.join(live, ".manifest.sha256"), "utf8"), /^[0-9a-f]{64} {2}-x\.txt$/m);

  // tar: the release tar puts "--" right before its member names
  const creates = r.args.filter((a) => a[0] === "tar" && a.some((x) => /^-[a-zA-Z]*c[a-zA-Z]*f$/.test(x))).map((a) => a.slice(1));
  assert.equal(creates.length, 1, `one tar create call: ${JSON.stringify(creates)}`);
  const a = creates[0];
  const dd = a.indexOf("--");
  assert.ok(dd > 0, `tar has "--" before the member names: ${JSON.stringify(a)}`);
  assert.deepEqual(a.slice(dd + 1), [".manifest.sha256", "-x.txt", "content", "engine.js", "index.html", "privacy.html", "styles.css"],
    `tar member names, all after "--": ${JSON.stringify(a)}`);
  const beforeDd = a.slice(0, dd).filter((x) => !x.startsWith("-"));
  assert.equal(beforeDd.length, 1, `before "--" only options and the tar file: ${JSON.stringify(a)}`);
  assert.ok(beforeDd[0].endsWith(`/${id}.tar`), JSON.stringify(a));
});

test("fake curl: refuses an option off its allow list, a missing value and a second address", { skip: SKIP }, (t) => {
  const tr = H.tempRoot("lb37o-");
  if (tr.reason) throw new Error(tr.reason);
  t.after(() => H.removeTree(tr.root));
  const env = H.cleanEnv(tr.root);
  const { bin, shims } = H.installFakes(tr.root);
  const calls = path.join(tr.root, "calls.txt");
  const args = path.join(tr.root, "args.txt");
  const run = (...a) => H.runBash(null, [H.toBash(path.join(bin, "curl")), ...a], {
    command: '"$1" "${@:2}"', env: Object.assign({}, env, { FAKE_CALLS: H.toBash(calls), FAKE_ARGS: H.toBash(args), FAKE_ROOT: H.toBash(tr.root) }), shims,
  });
  // the options the kit and the server script use are accepted
  const ok = run("-q", "-sS", "-g", "--proto", "=https", "--max-time", "20", "-o", "/dev/null", "-D", "/dev/null", "-w", "code-written", "-H", "Host: x", `${SITE}x`);
  assert.equal(ok.code, 0, ok.all);
  assert.equal(ok.out, "code-written"); // (a %{...} value would be changed by Git Bash's own argument handling here)
  for (const [a, re] of [
    [["-L", `${SITE}x`], /option -L is not on the allow list/],
    [["--prot", "=https", `${SITE}x`], /option --prot is not on the allow list/],
    [["-k", `${SITE}x`], /option -k is not on the allow list/],
    [[`${SITE}x`, "--max-time"], /option --max-time needs a value/],
    [[`${SITE}x`, `${SITE}y`], /expected exactly one address, got 2/],
    [["-s"], /expected exactly one address, got 0/],
  ]) {
    const r = run(...a);
    assert.equal(r.code, 2, `${a.join(" ")}: ${r.all}`);
    assert.match(r.err, re);
  }
  // every call logged its full argument list (escapes undone), also the refused ones
  const rows = H.readArgs(args);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0].slice(0, 6), ["curl", "-q", "-sS", "-g", "--proto", "=https"]);
  assert.ok(rows[0].includes("Host: x"));
  // a refused call never reached the "server"
  assert.deepEqual(H.readCalls(calls), [`curl ${SITE}x`]);
});

test("hang guard: a timed-out run stops its whole process tree, and the world refuses later runs", { skip: SKIP }, (t) => {
  const w = makeWorld(t);
  const hang = path.join(w.root, "hang.sh");
  // A child and a grandchild keep writing into the run's calls file, as deploy.sh's fakes did.
  write(hang, [
    "( while :; do echo child >> \"$FAKE_CALLS\"; sleep 0.2; done ) &",
    "bash -c 'while :; do echo grandchild >> \"$FAKE_CALLS\"; sleep 0.2; done' &",
    "echo started",
    "wait",
    "",
  ].join("\n"));
  const t0 = Date.now();
  const r = w.runFrom(hang, [], {}, { timeout: 3000 });
  const took = Date.now() - t0;
  assert.equal(r.timedOut, true, r.all);
  assert.equal(r.code, null);
  assert.match(String(r.error && r.error.message), /timed out after 3000 ms; its whole process tree was stopped/);
  assert.match(r.out, /started/);
  assert.ok(took < 45000, `the run returned soon after the timeout (${took} ms), not when its children ended`);
  const size = () => { try { return fs.statSync(w.calls).size; } catch { return 0; } };
  const before = size();
  assert.ok(before > 0, "the children wrote before the timeout");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500); // 1.5 s: a live child writes every 0.2 s
  assert.equal(size(), before, "nothing writes into the calls file after the timeout");
  assert.throws(() => w.run(["--help"]), /an earlier run in this world hit the hang guard/);
});
