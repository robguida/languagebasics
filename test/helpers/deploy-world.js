/* Test helper (LB-37): a "world" for running scripts/deploy/deploy.sh with fakes only.
 *
 * A world is a temp folder with a local bare origin, a clean checkout of it, a private settings
 * file outside the checkout, a fake "server" folder (box/) and fake ssh / scp / ssh-keyscan /
 * ssh-keygen / curl / npm (test/fixtures/deploy-fakes/). The fake ssh runs the server command
 * in the local box folder; the fake curl serves box/root/current. Nothing contacts a real
 * server or the network.
 *
 * Node built-ins only.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./deploy-env.js");

/* Every text file of the real kit, LF only (the kit is checked out with eol=lf). */
function kitFiles() {
  const out = {};
  for (const f of fs.readdirSync(H.KIT)) {
    const p = path.join(H.KIT, f);
    if (fs.statSync(p).isFile()) out[`scripts/deploy/${f}`] = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  }
  return out;
}

const BASE_FILES = {
  "src/index.html": "<!doctype html><title>t</title>\n",
  "src/engine.js": "window.LBEngine = {};\n",
  "src/styles.css": "body{}\n",
  "src/privacy.html": "<p>privacy</p>\n",
  "src/content/languages.js": "window.LB_LANGUAGES = [];\n",
  "src/content/sq/lesson-1.js": "window.LB_LESSON = {};\n",
  "package.json": '{ "name": "fixture", "private": true }\n',
};

/* The decks the server smoke and the outside checks look for, in all four languages. A world
 * that really deploys needs these. */
const DECKS = {};
for (const l of ["sq", "es", "ja", "bn"]) {
  DECKS[`src/content/${l}/lesson-1.js`] = `window.LB_LESSON = { l: "${l}" };\n`;
  DECKS[`src/content/${l}/alphabet-1.js`] = `window.LB_LESSON = { a: "${l}" };\n`;
  DECKS[`src/content/${l}/words-1.js`] = `window.LB_LESSON = { w: "${l}" };\n`;
}

/* The kit's own header baseline, in bash form, for FAKE_HEADERS (a passing outside check). */
const HEADERS = H.toBash(path.join(H.KIT, "expected-headers.txt"));

const ID_RE = /\d{8}T\d{6}Z-[0-9a-f]{12}/;

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function settingsText(s) {
  return Object.entries(s).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

/* makeWorld(t, { files }) -> world. files: extra or replaced files in the deployed commit (null = leave
 * that file out, e.g. a kit commit without scripts/deploy/preflight.js).
 * t: anything with an after(fn) hook (a test context, or { after } from node:test). */
function makeWorld(t, opts) {
  const tr = H.tempRoot("lb37d-");
  if (tr.reason) throw new Error(tr.reason);
  const root = tr.root;
  t.after(() => H.removeTree(root));
  const env = H.cleanEnv(root);
  const { bin, shims } = H.installFakes(root);
  const origin = path.join(root, "origin.git");
  const seed = path.join(root, "seed");
  const checkout = path.join(root, "checkout");
  H.git(env, root, "init", "-q", "--bare", "-b", "main", origin);
  H.git(env, root, "init", "-q", "-b", "main", seed);
  const files = Object.assign({}, BASE_FILES, kitFiles(), (opts && opts.files) || {});
  for (const [f, s] of Object.entries(files)) if (s !== null) write(path.join(seed, f), s);
  H.git(env, seed, "add", "-A");
  H.git(env, seed, "commit", "-q", "-m", "fixture");
  H.git(env, seed, "remote", "add", "origin", origin);
  H.git(env, seed, "push", "-q", "origin", "main");
  H.git(env, root, "clone", "-q", origin, checkout);
  const sha = H.git(env, checkout, "rev-parse", "HEAD");

  const box = { kit: path.join(root, "box", "kit"), root: path.join(root, "box", "root"), route: path.join(root, "box", "route.conf") };
  fs.mkdirSync(box.root, { recursive: true });
  write(box.route, "# route\n");
  const conf = path.join(root, "conf", "deploy.env");
  const key = path.join(root, "conf", "fake.key");
  write(key, "not a key\n");
  const work = path.join(root, "work");
  const settings = {
    LB_HOST: "box.invalid",
    LB_HOST_FPR: "SHA256:fakefingerprint",
    LB_SSH_USER: "deployer",
    LB_SSH_KEY: H.toBash(key),
    LB_BOX_KIT: H.toBash(box.kit),
    LB_BOX_ROOT: H.toBash(box.root),
    LB_BOX_ROUTE_FILE: H.toBash(box.route),
    LB_WORK_DIR: H.toBash(work),
    LB_SITE_URL: "https://example.invalid/languagebasics/",
  };
  write(conf, settingsText(settings));
  const calls = path.join(root, "calls.txt");
  const benv = Object.assign({}, env, {
    LB_DEPLOY_CONFIG: H.toBash(conf),
    LB_SSH_BIN: H.toBash(path.join(bin, "ssh")),
    LB_SCP_BIN: H.toBash(path.join(bin, "scp")),
    LB_SSH_KEYSCAN_BIN: H.toBash(path.join(bin, "ssh-keyscan")),
    LB_SSH_KEYGEN_BIN: H.toBash(path.join(bin, "ssh-keygen")),
    LB_CURL_BIN: H.toBash(path.join(bin, "curl")),
    LB_NPM_BIN: H.toBash(path.join(bin, "npm")),
    LB_NODE_BIN: H.toBash(process.execPath),
    LB_OUTSIDE_TRIES: "1",
    LB_OUTSIDE_WAIT: "0",
    FAKE_CALLS: H.toBash(calls),
    FAKE_ROOT: H.toBash(box.root),
    FAKE_FPR: "SHA256:fakefingerprint",
  });
  let n = 0;
  const w = {
    root, env, checkout, origin, sha, box, conf, work, settings, calls, shims,
    script: path.join(checkout, "scripts", "deploy", "deploy.sh"),
    writeSettings(s) { write(conf, settingsText(s)); },
    run(args, extra) { return w.runFrom(w.script, args, extra); },
    /* Run another copy of deploy.sh (e.g. one copied into an ignored folder of the checkout). */
    runFrom(script, args, extra) {
      try { fs.rmSync(calls, { force: true }); } catch { /* none yet */ }
      const r = H.runBash(script, args, { env: Object.assign({}, benv, extra || {}), shims, cwd: checkout });
      r.calls = H.readCalls(calls);
      r.server = H.serverCalls(r.calls);
      return r;
    },
    git(...a) { return H.git(env, checkout, ...a); },
    /* A new commit on origin/main (src/engine.js changes), pushed from the checkout. Returns its id. */
    commit(label) {
      n += 1;
      fs.appendFileSync(path.join(checkout, "src", "engine.js"), `// ${label || "change"} ${n}\n`);
      w.git("commit", "-q", "-am", `fixture change ${n}`);
      w.git("push", "-q", "origin", "HEAD:main");
      return w.git("rev-parse", "HEAD");
    },
    /* The release the fake server serves now ("" when none). */
    boxLive() {
      try { return path.basename(fs.realpathSync.native(path.join(box.root, "current"))); } catch { return ""; }
    },
    /* The server's deploys.log as rows [time, kind, id, note]. */
    boxLog() {
      try {
        return fs.readFileSync(path.join(box.root, "deploys.log"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
      } catch { return []; }
    },
    /* The laptop-side log (work folder) as rows [time, mode, text]. */
    localLog() {
      try {
        return fs.readFileSync(path.join(work, "deploy-log.txt"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
      } catch { return []; }
    },
  };
  return w;
}

/* A refusal: exit 1, nothing reached the server. */
function assertRefused(r, re) {
  assert.equal(r.code, 1, `exit ${r.code}\n${r.all}`);
  if (re) assert.match(r.all, re);
  assert.deepEqual(r.server, [], "no ssh / scp / ssh-keyscan / curl call after a refusal");
}

/* The release id a deploy run built ("deploy: built <id>: ..."). */
function builtId(r) {
  const m = /built (\d{8}T\d{6}Z-[0-9a-f]{12}):/.exec(r.out);
  return m ? m[1] : "";
}

/* One world shared by the tests of a describe() suite (they run in order); removed when the
 * suite ends. Call inside describe(); read holder.w in the tests. */
function suiteWorld(opts) {
  const { before, after } = require("node:test");
  const cleanups = [];
  const holder = {};
  before(() => { holder.w = makeWorld({ after: (fn) => cleanups.push(fn) }, opts); });
  after(() => { for (const fn of cleanups) fn(); });
  return holder;
}

/* Some row matches cols (undefined = any value, RegExp = matches, string = equal). */
function hasRow(rows, cols, msg) {
  assert.ok(rows.some((r) => cols.every((c, i) => c === undefined || (c instanceof RegExp ? c.test(r[i] || "") : r[i] === c))),
    `${msg || "row not found"}: ${JSON.stringify(cols.map(String))}\n${rows.map((r) => r.join(" | ")).join("\n")}`);
}

/* The laptop log rows of one mode (deploy, verify, rollback, ...), text only. */
function localRows(w, mode) {
  return w.localLog().filter((r) => r[1] === mode).map((r) => r[2]);
}

/* The fake curl calls made by the outside checks (the site address, not the server's own). */
function outsideCalls(r) { return r.calls.filter((c) => c.startsWith("curl https://example.invalid/")); }

module.exports = { kitFiles, BASE_FILES, DECKS, HEADERS, ID_RE, write, settingsText, makeWorld, assertRefused, builtId,
  suiteWorld, hasRow, localRows, outsideCalls };
