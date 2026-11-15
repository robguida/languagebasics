# Deploy kit

Ships the contents of `src/` from an approved `origin/main` commit to the live site. Nothing else ships.
**Every deploy needs the owner's go, naming that release.**

| File | Runs on | What it does |
|---|---|---|
| `deploy.sh` | your computer | checks, builds, uploads, switches, checks from outside |
| `lb-release.sh` | the server | unpacks, verifies, switches `current`, smoke test, rollback, list |
| `preflight.js` | your computer | extra pre-upload checks on the built release, run by `deploy.sh` before any server contact |
| `deploy.env.example` | — | shape of the private settings (placeholders only) |
| `expected-headers.txt` | — | the response headers the live site must send |

## One-time setup

1. Copy `deploy.env.example` to a private file **outside this repo**, for example
   `$HOME/.config/languagebasics/deploy.env` (or set `LB_DEPLOY_CONFIG=<path>`).
2. Fill in every value. Set `LB_WORK_DIR` to a folder outside any repo.
3. The settings file and the work folder are refused if they sit inside the repo or any git working tree.
   Never commit the settings file.

## Release

Run from a clean checkout. `<sha>` is the full 40-character id of the approved `origin/main` commit.

```bash
LB_EXPECT_SHA=<sha> bash scripts/deploy/deploy.sh --preflight   # local checks only; no server contact
LB_EXPECT_SHA=<sha> bash scripts/deploy/deploy.sh --dry-run     # + server checks; no release uploaded
LB_EXPECT_SHA=<sha> bash scripts/deploy/deploy.sh               # the release (needs the owner's go)
```

Before anything leaves your computer, `deploy.sh`:

1. Loads and checks the private settings.
2. Refuses a short or wrong commit id, uncommitted changes, or a running kit that differs from the kit commit.
3. Clones the remote into the work folder and confirms `origin/main` is the approved commit.
4. Unpacks that commit (not your working folder) and runs `npm test` and `npm run check:data` there.
5. Builds `src/` from it and byte-checks every file against git, the file count and dot-files.
   Every problem is listed before it refuses.
6. Runs `preflight.js` from the kit commit, if the kit has one.
7. Pins the server's host key.

After the upload, the server runs its smoke test and rolls back on its own if it fails. Then `deploy.sh`
checks from outside, through the CDN: every file of the release (200 and the right hash), the privacy page,
a list of private paths that must answer 404, the headers in `expected-headers.txt`, no cookies, and for
each language lesson 1, one alphabet deck and one words deck. Any failure rolls the release back.

## Other modes

```bash
bash scripts/deploy/deploy.sh --list       # live release, rollback target, every release and its status
bash scripts/deploy/deploy.sh --smoke      # server-side smoke test of the live release
bash scripts/deploy/deploy.sh --verify     # outside checks of the live release
bash scripts/deploy/deploy.sh --rollback   # back to the last good release, then outside checks
```

- A rollback marks the release it leaves as **bad**. Bad releases are never picked by a later rollback and
  never count toward the releases kept on the server. Run `--list` first to see the target.
- A deploy or rollback only uses kit code that is already on `origin/main`. To try a new kit with
  `--dry-run`, `--list`, `--smoke` or `--verify` before it is merged, push its branch and set
  `LB_KIT_SHA=<that commit>`.
- The server script is sent from the kit commit and stored on the server by content hash.

## Tests

Tests never touch the network. The commands can be replaced with fakes through these variables:
`LB_SSH_BIN`, `LB_SCP_BIN`, `LB_SSH_KEYSCAN_BIN`, `LB_SSH_KEYGEN_BIN`, `LB_CURL_BIN`, `LB_NPM_BIN`,
`LB_NODE_BIN` (deploy.sh) and `LB_CURL` (lb-release.sh). `LB_OUTSIDE_TRIES` and `LB_OUTSIDE_WAIT` set the
CDN retry count and wait. Exit codes: 0 ok, 1 refused or failed, 2 usage error,
3 a rollback switched releases but the release now live fails the server smoke checks (the message names it).
