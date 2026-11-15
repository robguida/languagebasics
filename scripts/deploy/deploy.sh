#!/usr/bin/env bash
# deploy.sh - ship LanguageBasics ./src to the live site. Runs on the developer's computer (Git Bash or Linux bash).
#
#   LB_EXPECT_SHA=<sha> bash scripts/deploy/deploy.sh               deploy: checks, upload, switch, smoke, outside checks
#   LB_EXPECT_SHA=<sha> bash scripts/deploy/deploy.sh --preflight   every pre-upload check; never contacts the server
#   LB_EXPECT_SHA=<sha> bash scripts/deploy/deploy.sh --dry-run     pre-upload checks + server checks; uploads no release
#   bash scripts/deploy/deploy.sh --rollback   switch to the last good release; the release left is marked bad
#   bash scripts/deploy/deploy.sh --list       releases on the server: which is live, which is the rollback target
#   bash scripts/deploy/deploy.sh --smoke      server-side smoke checks of the live release
#   bash scripts/deploy/deploy.sh --verify     outside checks (through the CDN) of the live release
#   bash scripts/deploy/deploy.sh --help
#
#   <sha>       the FULL 40-character id of the approved origin/main commit. Every deploy needs the owner's go.
#   LB_KIT_SHA  optional: take the kit (scripts/deploy) from this pushed commit instead of <sha>. A deploy or a
#               rollback only accepts a kit commit that is already on origin/main.
#   Settings:   a private file OUTSIDE this repo: $HOME/.config/languagebasics/deploy.env, or LB_DEPLOY_CONFIG=<path>.
#               See deploy.env.example and README.md.
#   Exit codes: 0 ok, 1 refused or failed, 2 usage error,
#               3 a rollback switched releases, but the release now live fails the server smoke checks.
set -uo pipefail
export LC_ALL=C

PROG=deploy
info()   { echo "$PROG: $*"; }
die()    { echo "$PROG: REFUSED: $*" >&2; exit 1; }
usage()  { echo "$PROG: $*" >&2; echo "$PROG: try --help" >&2; exit 2; }
FAILS=()
fail()   { FAILS+=("$*"); }
gate()   { # refuse, listing every problem collected so far
    [ ${#FAILS[@]} -eq 0 ] && return 0
    local f
    echo "$PROG: REFUSED at '$1' (${#FAILS[@]} problem(s)); nothing was sent to the server:" >&2
    for f in "${FAILS[@]}"; do echo "  - $f" >&2; done
    exit 1
}

# ---- commands (tests override these with fakes; no test needs the network) ----
SSH_BIN=${LB_SSH_BIN:-ssh}
SCP_BIN=${LB_SCP_BIN:-scp}
KEYSCAN_BIN=${LB_SSH_KEYSCAN_BIN:-ssh-keyscan}
KEYGEN_BIN=${LB_SSH_KEYGEN_BIN:-ssh-keygen}
CURL_BIN=${LB_CURL_BIN:-curl}
NPM_BIN=${LB_NPM_BIN:-npm}
NODE_BIN=${LB_NODE_BIN:-node}
OUT_TRIES=${LB_OUTSIDE_TRIES:-6}
OUT_WAIT=${LB_OUTSIDE_WAIT:-5}

# ---- arguments ----
mode=deploy
[ $# -le 1 ] || usage "one mode at a time"
case "${1:-}" in
  "") ;;
  --preflight) mode=preflight ;;
  --dry-run)   mode=dry ;;
  --rollback|--list|--smoke|--verify) mode=${1#--} ;;
  -h|--help) awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
  *) usage "unknown argument $1" ;;
esac
[[ "$OUT_TRIES" =~ ^[1-9][0-9]*$ ]] || usage "LB_OUTSIDE_TRIES must be a whole number, 1 or more"
[[ "$OUT_WAIT" =~ ^[0-9]+$ ]] || usage "LB_OUTSIDE_WAIT must be a whole number of seconds"

# ---- where am I: the kit must run from a checkout of this repo ----
abs_dir() { ( cd "$1" 2>/dev/null && pwd -P ); }
lc() { printf '%s' "${1,,}"; }
inside() { # inside <child> <parent>: true if child is parent or under it (case-insensitive, for Windows)
    local c p; c=$(lc "${1%/}"); p=$(lc "${2%/}")
    [ "$c" = "$p" ] || [[ "$c" == "$p"/* ]]
}
in_any_worktree() { [ "$(git -C "$1" rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; }

KIT=$(abs_dir "$(dirname "${BASH_SOURCE[0]}")") || die "cannot find the kit folder"
REPO_GIT=$(git -C "$KIT" rev-parse --show-toplevel 2>/dev/null) || die "run deploy.sh from a checkout of the repo"
REPO=$(abs_dir "$REPO_GIT") || die "cannot resolve the repo folder"
REMOTE=$(git -C "$REPO" remote get-url origin 2>/dev/null) || die "the repo has no 'origin' remote"

# ---- private settings: outside the repo, never tracked, no empty values ----
CONF=${LB_DEPLOY_CONFIG:-${HOME:-}/.config/languagebasics/deploy.env}
REQUIRED_KEYS=(LB_HOST LB_HOST_FPR LB_SSH_USER LB_SSH_KEY LB_BOX_KIT LB_BOX_ROOT LB_BOX_ROUTE_FILE LB_WORK_DIR)
OPTIONAL_KEYS=(LB_SITE_URL LB_EXPECT_TREE LB_KEEP)
declare -A CFG=()
known_key() { local k; for k in "${REQUIRED_KEYS[@]}" "${OPTIONAL_KEYS[@]}"; do [ "$k" = "$1" ] && return 0; done; return 1; }

[ -f "$CONF" ] || die "settings file not found at $CONF (copy scripts/deploy/deploy.env.example there, outside the repo, and fill it in)"
CONF_DIR=$(abs_dir "$(dirname "$CONF")") || die "cannot resolve the settings folder"
CONF_ABS=$CONF_DIR/$(basename "$CONF")
inside "$CONF_ABS" "$REPO" && fail "the settings file is inside the repo; move it outside (default \$HOME/.config/languagebasics/deploy.env)"
in_any_worktree "$CONF_DIR" && fail "the settings file is inside a git working tree; move it outside any repo"
git -C "$REPO" ls-files --error-unmatch -- "$CONF_ABS" >/dev/null 2>&1 && fail "the settings file is tracked by git; remove it from git and rotate anything it held"

n=0
while IFS= read -r line || [ -n "$line" ]; do
    n=$((n+1)); line=${line%$'\r'}
    [[ "$line" =~ ^[[:space:]]*(#.*)?$ ]] && continue
    if [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
        key=${BASH_REMATCH[1]}; val=${BASH_REMATCH[2]}
        if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then val=${BASH_REMATCH[1]}; fi
        known_key "$key" || { fail "settings line $n: unknown setting $key"; continue; }
        [ -n "$val" ] || { fail "settings line $n: $key is empty"; continue; }
        [[ "$val" == *"<"*">"* ]] && { fail "settings line $n: $key still holds the example placeholder"; continue; }
        [ -z "${CFG[$key]+x}" ] || fail "settings line $n: $key is set twice"
        CFG[$key]=$val
    else
        fail "settings line $n: not in KEY=value form"
    fi
done < "$CONF"
for k in "${REQUIRED_KEYS[@]}"; do [ -n "${CFG[$k]:-}" ] || fail "setting $k is missing"; done
# Shape checks (values are never printed).
chk_re() { [ -z "${CFG[$1]:-}" ] || [[ "${CFG[$1]}" =~ $2 ]] || fail "setting $1 is not $3"; }
chk_re LB_HOST           '^[A-Za-z0-9.:-]+$'                   "a plain host name or IP address"
chk_re LB_HOST_FPR       '^SHA256:[A-Za-z0-9+/=]+$'           "an SSH fingerprint (SHA256:...)"
chk_re LB_SSH_USER       '^[a-z_][a-z0-9_-]*$'                 "a plain login name"
chk_re LB_BOX_KIT        '^/[A-Za-z0-9._/-]+$'                 "an absolute server path of plain characters"
chk_re LB_BOX_ROOT       '^/[A-Za-z0-9._/-]+$'                 "an absolute server path of plain characters"
chk_re LB_BOX_ROUTE_FILE '^/[A-Za-z0-9._/-]+$'                 "an absolute server path of plain characters"
chk_re LB_SITE_URL       '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~-]+)*/$' "an https URL ending in /"
chk_re LB_EXPECT_TREE    '^[0-9a-f]{40}$'                      "a full 40-character tree id"
chk_re LB_KEEP           '^[0-9]+$'                            "a whole number"
for k in LB_BOX_KIT LB_BOX_ROOT LB_BOX_ROUTE_FILE; do
    case "/${CFG[$k]:-}/" in */../*|*/./*) fail "setting $k must not hold . or .. parts" ;; esac
done
[ -z "${CFG[LB_KEEP]:-}" ] || [ "${CFG[LB_KEEP]}" -ge 2 ] || fail "setting LB_KEEP must be 2 or more"
gate "settings"

SITE=${CFG[LB_SITE_URL]:-https://bengusa.pro/languagebasics/}
KEEP=${CFG[LB_KEEP]:-5}
BOXKIT=${CFG[LB_BOX_KIT]%/}

# ---- work folder (clone, build, logs, known_hosts): outside the repo, never inside any repo ----
abs_path() { # absolute form of a path that may not exist yet (nearest existing parent resolved); creates nothing
    local p=${1%/} rest=""
    while [ -n "$p" ] && [ ! -d "$p" ]; do rest=/$(basename "$p")$rest; p=$(dirname "$p"); done
    printf '%s%s' "$(abs_dir "${p:-/}")" "$rest"
}
W=$(abs_path "${CFG[LB_WORK_DIR]}")
[ -n "$W" ] || die "cannot resolve the work folder (LB_WORK_DIR)"
case "$W/" in */../*|*/./*) fail "the work folder (LB_WORK_DIR) must not hold . or .. parts" ;; esac
inside "$W" "$REPO" && fail "the work folder (LB_WORK_DIR) is inside the repo; clone, build, log and known_hosts must never be written there"
wp=$W; while [ ! -d "$wp" ]; do wp=$(dirname "$wp"); done
in_any_worktree "$wp" && fail "the work folder (LB_WORK_DIR) is inside a git working tree; pick a folder outside any repo"
gate "work folder"
mkdir -p "$W" 2>/dev/null || die "cannot create the work folder (LB_WORK_DIR)"
W=$(abs_dir "$W") || die "cannot resolve the work folder (LB_WORK_DIR)"
CLONE=$W/clone
BUILD=$W/build
KH=$W/known_hosts
LOG=$W/deploy-log.txt
mkdir -p "$BUILD" || die "cannot create $BUILD"
logrow() { printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$mode" "$*" >> "$LOG"; }

# ---- the approved commit ----
EXPECT=${LB_EXPECT_SHA:-}
KIT_SHA=${LB_KIT_SHA:-}
if [ -n "$EXPECT" ]; then
    [[ "$EXPECT" =~ ^[0-9a-f]{40}$ ]] || fail "LB_EXPECT_SHA must be the full 40-character lower-case commit id"
elif [ "$mode" = deploy ] || [ "$mode" = dry ] || [ "$mode" = preflight ]; then
    fail "set LB_EXPECT_SHA to the full 40-character id of the approved origin/main commit"
fi
[ -z "$KIT_SHA" ] || [[ "$KIT_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "LB_KIT_SHA must be a full 40-character lower-case commit id"

# Clean tree: the deploy, the dry run, the preflight and a rollback start from a committed state.
case "$mode" in
  deploy|dry|preflight|rollback)
    dirty=$(git -C "$REPO" status --porcelain --untracked-files=all 2>/dev/null) || fail "git status failed"
    if [ -n "$dirty" ]; then
        while IFS= read -r l; do fail "uncommitted change: $l"; done <<<"$dirty"
    fi ;;
esac
gate "commit id and clean tree"

# ---- clean clone (never the working folder) ----
git_c() { git -C "$CLONE" -c core.autocrlf=false -c core.eol=lf "$@"; }
if [ ! -d "$CLONE/.git" ]; then
    git -c core.autocrlf=false clone --quiet --no-checkout "$REMOTE" "$CLONE" || die "clone failed"
    git -C "$CLONE" config core.autocrlf false
fi
[ "$(git -C "$CLONE" remote get-url origin)" = "$REMOTE" ] || die "the work clone points at another remote; delete $CLONE and run again"
git_c fetch --quiet --prune origin '+refs/heads/*:refs/remotes/origin/*' || die "git fetch failed"
MAIN=$(git_c rev-parse --verify "origin/main^{commit}" 2>/dev/null) || die "no origin/main"
info "origin/main = $MAIN"
if [ -n "$EXPECT" ] && { [ "$mode" = deploy ] || [ "$mode" = dry ] || [ "$mode" = preflight ]; }; then
    [ "$MAIN" = "$EXPECT" ] || fail "origin/main is $MAIN, not the approved $EXPECT"
    if [ -n "${CFG[LB_EXPECT_TREE]:-}" ]; then
        tree=$(git_c rev-parse "$MAIN^{tree}")
        [ "$tree" = "${CFG[LB_EXPECT_TREE]}" ] || fail "tree of origin/main is $tree, not the expected tree"
    fi
fi
[ -n "$KIT_SHA" ] || KIT_SHA=${EXPECT:-$MAIN}
if ! git_c cat-file -e "$KIT_SHA^{commit}" 2>/dev/null; then
    fail "kit commit $KIT_SHA is not on the remote"
else
    [ -n "$(git_c branch -r --contains "$KIT_SHA" 2>/dev/null)" ] || fail "kit commit $KIT_SHA is on no remote branch"
    if [ "$mode" = deploy ] || [ "$mode" = rollback ]; then
        git_c merge-base --is-ancestor "$KIT_SHA" "$MAIN" || fail "kit commit $KIT_SHA is not on origin/main; a deploy or rollback uses reviewed, merged kit code only"
    fi
fi
gate "approved commit"

# The running kit must be byte-for-byte the kit at KIT_SHA (lists every difference, then refuses).
kit_files=$(git_c ls-tree -r --name-only "$KIT_SHA" -- scripts/deploy)
[ -n "$kit_files" ] || fail "commit $KIT_SHA has no scripts/deploy"
for f in deploy.sh lb-release.sh expected-headers.txt; do
    grep -qxF "scripts/deploy/$f" <<<"$kit_files" || fail "commit $KIT_SHA has no scripts/deploy/$f"
done
while IFS= read -r p; do
    [ -n "$p" ] || continue
    want=$(git_c rev-parse "$KIT_SHA:$p")
    if [ ! -f "$REPO/$p" ]; then fail "running kit is missing $p"; continue; fi
    got=$(git -C "$REPO" hash-object --no-filters -- "$REPO/$p")
    [ "$got" = "$want" ] || fail "running $p differs from commit $KIT_SHA"
done <<<"$kit_files"
while IFS= read -r p; do
    rel=${p#"$REPO"/}
    grep -qxF "$rel" <<<"$kit_files" || fail "running kit has $rel, which is not in commit $KIT_SHA"
done < <(find "$REPO/scripts/deploy" -type f 2>/dev/null)
gate "running kit matches the kit commit"

# Kit files used at run time come from the kit commit, never from the working folder.
KT=$BUILD/kit-${KIT_SHA:0:12}
rm -rf "$KT"; mkdir -p "$KT"
git_c archive --format=tar "$KIT_SHA:scripts/deploy" | tar -xf - -C "$KT" || die "cannot unpack the kit from $KIT_SHA"

# ---- server access (only after every local check) ----
SSH=(); SCP=(); BOXSCRIPT=""
box_setup() {
    local tmp got h
    [ -f "${CFG[LB_SSH_KEY]}" ] || die "SSH key not found (LB_SSH_KEY); is the key drive mounted?"
    tmp=$(mktemp -p "$W" keyscan.XXXXXX) || die "cannot write in the work folder"
    "$KEYSCAN_BIN" -t ed25519 -T 10 "${CFG[LB_HOST]}" 2>/dev/null > "$tmp"
    got=$("$KEYGEN_BIN" -lf "$tmp" 2>/dev/null | awk '{print $2}')
    [ "$got" = "${CFG[LB_HOST_FPR]}" ] || { rm -f "$tmp"; die "server host key does not match the pinned fingerprint (LB_HOST_FPR)"; }
    mv "$tmp" "$KH"
    SSH=("$SSH_BIN" -i "${CFG[LB_SSH_KEY]}" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o LogLevel=ERROR
         -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KH" "${CFG[LB_SSH_USER]}@${CFG[LB_HOST]}")
    SCP=("$SCP_BIN" -q -i "${CFG[LB_SSH_KEY]}" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o LogLevel=ERROR
         -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KH")
    # The server script is the copy from the kit commit, stored by content hash (never overwrites another version).
    h=$(sha256sum "$KT/lb-release.sh" | cut -d' ' -f1)
    BOXSCRIPT=$BOXKIT/lb-release-${h:0:16}.sh
    "${SSH[@]}" "mkdir -p $BOXKIT/incoming && chmod 700 $BOXKIT" || die "cannot reach the server"
    got=$("${SSH[@]}" "sha256sum $BOXSCRIPT 2>/dev/null | cut -d' ' -f1")
    if [ "$got" != "$h" ]; then
        "${SCP[@]}" "$KT/lb-release.sh" "${CFG[LB_SSH_USER]}@${CFG[LB_HOST]}:$BOXSCRIPT" || die "upload of the server script failed"
        got=$("${SSH[@]}" "sha256sum $BOXSCRIPT | cut -d' ' -f1")
        [ "$got" = "$h" ] || die "server script on the server does not match the kit commit after upload"
        info "server script lb-release-${h:0:16}.sh uploaded (from commit ${KIT_SHA:0:12})"
    fi
}
box() { # run lb-release.sh on the server; arguments are ids, hashes and server paths checked above
    "${SSH[@]}" "LB_ROOT=${CFG[LB_BOX_ROOT]} LB_ROUTE_FILE=${CFG[LB_BOX_ROUTE_FILE]} LB_KEEP=$KEEP bash $BOXSCRIPT $*"
}
box_manifest() { # box_manifest <out-file>: saves the live manifest, prints the live release id
    local raw=$BUILD/live-$$.txt id
    box manifest > "$raw" || { rm -f "$raw"; return 1; }
    id=$(head -1 "$raw" | awk '$1=="release"{print $2}')
    [[ "$id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]] || { rm -f "$raw"; return 1; }
    tail -n +2 "$raw" > "$1"; rm -f "$raw"
    echo "$id"
}

# ---- outside checks, through the CDN (no query string is ever used as proof) ----
NOT_SERVED=(data/sq.json data/ scripts/ scripts/build-data.js scripts/deploy/deploy.sh scripts/deploy/lb-release.sh
    scripts/deploy/deploy.env.example parked/content/sq/lesson-5.js content/sq/lesson-5.js package.json CLAUDE.md
    .manifest.sha256 .git/HEAD test/schema.test.js deploys.log)
# Plus every top-level entry of the commit other than src/ (folders as name/): none of it may be served.
while IFS=$'\t' read -r meta name; do
    [ "$name" = src ] && continue
    case "$meta" in *" tree "*) name=$name/ ;; esac
    grep -qxF -- "$name" < <(printf '%s\n' "${NOT_SERVED[@]}") || NOT_SERVED+=("$name")
done < <(git_c ls-tree "${EXPECT:-$MAIN}")
HEADER_PATHS=("" content/languages.js content/sq/lesson-1.js privacy.html)

fetch() { # fetch <url> <body-out> <headers-out>: prints the HTTP code (000 on a transport error)
    local code
    code=$("$CURL_BIN" -sS --max-time 20 -o "$2" -D "$3" -w '%{http_code}' "$1" 2>/dev/null) || code=000
    printf '%s' "${code:-000}"
}
hdr_values() { # hdr_values <lower-case name> <header file>: every value of that header, one per line
    tr -d '\r' < "$2" | awk -v n="$1" '{ i=index($0, ":"); if (i>0) { k=tolower(substr($0,1,i-1)); v=substr($0,i+1); sub(/^[ \t]+/,"",v); sub(/[ \t]+$/,"",v); if (k==n) print v } }'
}
outside_check() { # outside_check <manifest-file> <release-id>: every problem is listed; returns 1 if any
    local man=$1 rid=$2 dir code got p h url round=1 ext line name val vals lang
    local -a ofail=() todo=() next=()
    local -A want=() lastc=() lasth=()
    dir=$BUILD/outside-$rid-$$; rm -rf "$dir"; mkdir -p "$dir"
    while read -r h p; do p=${p#\*}; [ -n "$p" ] && want[$p]=$h && todo+=("$p"); done < "$man"
    [ ${#todo[@]} -gt 0 ] || { echo "$PROG: OUTSIDE FAIL: empty manifest" >&2; return 1; }
    [ -n "${want[index.html]:-}" ] || ofail+=("manifest has no index.html")
    want[/]=${want[index.html]:-none}; todo+=("/")
    # a. every manifest file (and the app's own address) answers 200 with the release's bytes; retry for the CDN
    while :; do
        next=()
        for p in "${todo[@]}"; do
            if [ "$p" = / ]; then url=$SITE; else url=$SITE$p; fi
            code=$(fetch "$url" "$dir/body" "$dir/hdr")
            got=$(sha256sum "$dir/body" 2>/dev/null | cut -d' ' -f1)
            lastc[$p]=$code; lasth[$p]=$got
            { [ "$code" = 200 ] && [ "$got" = "${want[$p]}" ]; } || next+=("$p")
        done
        [ ${#next[@]} -eq 0 ] && break
        [ "$round" -ge "$OUT_TRIES" ] && break
        info "outside: ${#next[@]} file(s) not current yet; retry $round of $((OUT_TRIES-1)) in ${OUT_WAIT}s"
        round=$((round+1)); sleep "$OUT_WAIT"; todo=("${next[@]}")
    done
    for p in "${next[@]}"; do ofail+=("file ${p}: HTTP ${lastc[$p]}, hash ${lasth[$p]:-none} (want 200 and the release hash)"); done
    local -A afail=(); for p in "${next[@]}"; do afail[$p]=1; done
    # b. the privacy page
    code=$(fetch "${SITE}privacy.html" "$dir/body" "$dir/hdr"); [ "$code" = 200 ] || ofail+=("privacy.html: HTTP $code (want 200)")
    # c. things that must never be served
    for p in "${NOT_SERVED[@]}"; do
        code=$(fetch "$SITE$p" "$dir/body" "$dir/hdr"); [ "$code" = 404 ] || ofail+=("$p: HTTP $code (want 404)")
    done
    # d. headers equal the baseline in expected-headers.txt (from the kit commit); no cookies
    for p in "${HEADER_PATHS[@]}"; do
        code=$(fetch "$SITE$p" "$dir/body" "$dir/hdr")
        [ "$code" = 200 ] || { ofail+=("headers of /${p}: HTTP $code"); continue; }
        case "$p" in ""|*.html) ext=.html ;; *.js) ext=.js ;; *.css) ext=.css ;; *) ext=. ;; esac
        while IFS= read -r line || [ -n "$line" ]; do
            line=${line%$'\r'}
            [[ "$line" =~ ^[[:space:]]*(#.*)?$ ]] && continue
            if [[ "$line" == '!'* ]]; then
                name=${line#!}; name=${name,,}
                [ -z "$(hdr_values "$name" "$dir/hdr")" ] || ofail+=("headers of /${p}: ${name} must not be sent")
                continue
            fi
            if [[ "$line" == .* ]]; then [[ "$line" == "$ext "* ]] || continue; line=${line#* }; fi
            name=${line%%:*}; val=${line#*:}; val=${val# }; name=${name,,}
            vals=$(hdr_values "$name" "$dir/hdr")
            [ "$vals" = "$val" ] || ofail+=("headers of /${p}: ${name} is '${vals//$'\n'/ | }', want '${val}'")
        done < "$KT/expected-headers.txt"
    done
    # e. each language: lesson 1, one alphabet deck and one words deck are current; its lesson page loads
    local langs; langs=$(printf '%s\n' "${!want[@]}" | sed -n 's#^content/\([a-z][a-z0-9-]*\)/lesson-1\.js$#\1#p' | sort)
    [ -n "$langs" ] || ofail+=("no language found in the manifest")
    for lang in $langs; do
        local alpha; alpha=$(printf '%s\n' "${!want[@]}" | grep -E "^content/$lang/alphabet-[^/]+\.js$" | sort | head -1)
        for p in "content/$lang/lesson-1.js" "${alpha:-content/$lang/alphabet-(none)}" "content/$lang/words-1.js"; do
            if [ -z "${want[$p]:-}" ]; then ofail+=("language $lang: $p is not in the release");
            elif [ -n "${afail[$p]:-}" ]; then ofail+=("language $lang: $p is not served correctly"); fi
        done
        code=$(fetch "${SITE}?lesson=$lang/lesson-1" "$dir/body" "$dir/hdr")
        got=$(sha256sum "$dir/body" 2>/dev/null | cut -d' ' -f1)
        { [ "$code" = 200 ] && [ "$got" = "${want[index.html]:-}" ]; } || ofail+=("language $lang: lesson page HTTP $code or not the release's index.html")
    done
    rm -rf "$dir"
    if [ ${#ofail[@]} -eq 0 ]; then
        info "OUTSIDE OK: ${#want[@]} addresses current, ${#NOT_SERVED[@]} private paths 404, headers match, languages: $(echo $langs)"
        return 0
    fi
    echo "$PROG: OUTSIDE FAIL for release $rid (${#ofail[@]} problem(s)):" >&2
    for p in "${ofail[@]}"; do echo "  - $p" >&2; done
    return 1
}

# A rollback on the server exited 3: current WAS switched and the release left is marked bad,
# but the release now live fails the server smoke checks. Say what is live now, then exit 3.
switched_but_smoke_fails() { # <what rolled back> <what was left>
    local live
    live=$(box_manifest "$BUILD/live.manifest") || live="(cannot read it from the server)"
    echo "$PROG: SWITCHED, BUT SMOKE FAILS: $1 switched the live release; $2 is marked bad." >&2
    echo "$PROG: live now: $live. It FAILS the server smoke checks. Check the server now." >&2
    logrow "switched, live now $live, smoke FAIL"
    exit 3
}

# ---- modes that only talk to the server ----
case "$mode" in
  list)  box_setup; box list; exit $? ;;
  smoke) box_setup; box smoke; exit $? ;;
  verify)
    box_setup
    m=$BUILD/live.manifest
    rid=$(box_manifest "$m") || die "cannot read the live release from the server"
    if [ -n "$EXPECT" ] && [ "${rid##*-}" != "${EXPECT:0:12}" ]; then die "live release is $rid, not commit $EXPECT"; fi
    outside_check "$m" "$rid"; rc=$?; logrow "$rid rc=$rc"; exit $rc ;;
  rollback)
    box_setup
    box rollback; rc=$?
    logrow "rollback rc=$rc"
    [ $rc = 3 ] && switched_but_smoke_fails "the rollback" "the release it left"
    [ $rc = 0 ] || die "rollback failed on the server (rc=$rc); nothing was switched; see the output above"
    m=$BUILD/live.manifest
    rid=$(box_manifest "$m") || die "rolled back, but cannot read the live release from the server"
    outside_check "$m" "$rid" || die "rolled back to $rid, but the outside checks fail; see above"
    exit 0 ;;
esac

# ---- deploy, dry run, preflight: test the exact approved commit (full tree, not the working folder) ----
sha=$EXPECT
id="$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:12}"
TT=$BUILD/$id.tree
rm -rf "$TT"; mkdir -p "$TT"
git_c archive --format=tar "$sha" | tar -xf - -C "$TT" || die "cannot unpack commit $sha"
# Temp folders made by the test run go under the work folder (outside the repo), never the system temp folder.
TTMP=$BUILD/$id.tmp
rm -rf "$TTMP"; mkdir -p "$TTMP" || die "cannot create $TTMP"
TTMP_NATIVE=$TTMP
command -v cygpath >/dev/null 2>&1 && TTMP_NATIVE=$(cygpath -w "$TTMP")
run_npm() { # run_npm <label> <log> <npm args...>: runs in the commit's tree; returns npm's exit status.
    local label=$1 log=$2 rc; shift 2   # the callers run both commands and collect every failure (continue on error)
    ( cd "$TT" && LB_TEST_TMP=$TTMP_NATIVE TMP=$TTMP_NATIVE TEMP=$TTMP_NATIVE TMPDIR=$TTMP "$NPM_BIN" "$@" ) > "$log" 2>&1
    rc=$?
    if [ $rc = 0 ]; then info "$label passes on $sha"; return 0; fi
    fail "$label failed on commit $sha (exit $rc, log: $log)"
    tail -n 15 "$log" | sed 's/^/    | /' >&2
    return $rc
}
run_npm "npm test" "$BUILD/$id.npm-test.log" test
run_npm "npm run check:data" "$BUILD/$id.check-data.log" run check:data
rm -rf "$TTMP"

# ---- build ./src of that commit and check every byte ----
B=$BUILD/$id
rm -rf "$B"; mkdir -p "$B"
git_c archive --format=tar "$sha:src" | tar -xf - -C "$B" || die "git archive of src failed"
n=0
while IFS= read -r p; do
    n=$((n+1))
    a=$(sha256sum "$B/$p" 2>/dev/null | cut -d' ' -f1)
    b=$(git_c cat-file blob "$sha:src/$p" | sha256sum | cut -d' ' -f1)
    [ -n "$a" ] && [ "$a" = "$b" ] || fail "byte mismatch: src/$p"
done < <(git_c ls-tree -r --name-only "$sha:src")
count=$(find "$B" -type f | wc -l | tr -d ' ')
[ "$count" = "$n" ] || fail "build has $count files, git has $n"
while IFS= read -r p; do fail "dot-file in src: ${p#"$B"/}"; done < <(find "$B" -mindepth 1 -name '.*')
gate "tests and build checks"
( cd "$B" && find . -type f | sed 's#^\./##' | sort | while IFS= read -r f; do sha256sum "$f" | sed 's/ [*]/  /'; done ) > "$BUILD/$id.manifest" || die "manifest failed"
mv "$BUILD/$id.manifest" "$B/.manifest.sha256"
msha=$(sha256sum "$B/.manifest.sha256" | cut -d' ' -f1)
T=$BUILD/$id.tar
mapfile -t top < <(cd "$B" && find . -mindepth 1 -maxdepth 1 ! -name .manifest.sha256 | sed 's#^\./##' | sort)
( cd "$B" && tar --sort=name --format=ustar --owner=0 --group=0 --numeric-owner --mtime="@$(git_c log -1 --format=%ct "$sha")" -cf "$T" .manifest.sha256 "${top[@]}" ) || die "tar failed"
info "built $id: $n files, manifest $msha, tar $(sha256sum "$T" | cut -d' ' -f1)"

# ---- seam: optional Node pre-upload module from the kit commit ----
if [ -f "$KT/preflight.js" ]; then
    ( cd "$TT" && "$NODE_BIN" "$KT/preflight.js" --sha "$sha" --tree "$TT" --build "$B" --manifest "$B/.manifest.sha256" --repo "$REPO" ) \
        || fail "preflight.js refused commit $sha"
    gate "preflight.js"
fi

if [ "$mode" = preflight ]; then
    logrow "$id sha=$sha kit=$KIT_SHA manifest=$msha PREFLIGHT PASS"
    info "PREFLIGHT PASS for $sha: tests, data check and build checks pass. The server was not contacted."
    exit 0
fi

box_setup
if [ "$mode" = dry ]; then
    box list
    logrow "$id sha=$sha kit=$KIT_SHA manifest=$msha DRY RUN"
    info "dry run: every check passed; no release was uploaded"
    exit 0
fi

"${SCP[@]}" "$T" "${CFG[LB_SSH_USER]}@${CFG[LB_HOST]}:$BOXKIT/incoming/$id.tar" || die "upload failed"
box install "$BOXKIT/incoming/$id.tar" "$id" "$msha"; rc=$?
logrow "$id sha=$sha kit=$KIT_SHA manifest=$msha install rc=$rc"
[ $rc = 0 ] || die "install failed on the server (rc=$rc); see the output above (the server rolls back on a failed smoke)"

if outside_check "$B/.manifest.sha256" "$id"; then
    logrow "$id outside OK"
    info "LIVE: release $id of $sha passes every outside check"
    exit 0
fi
echo "$PROG: outside checks failed; rolling back automatically" >&2
box rollback "$id" outside-check-failed; rc=$?
logrow "$id outside FAIL, auto-rollback rc=$rc"
[ $rc = 3 ] && switched_but_smoke_fails "the automatic rollback after failed outside checks" "release $id"
[ $rc = 0 ] || die "AUTOMATIC ROLLBACK FAILED (rc=$rc); release $id may still be live. Check the server now."
m=$BUILD/live.manifest
if rid=$(box_manifest "$m"); then
    outside_check "$m" "$rid" && info "rolled back to $rid; it passes the outside checks"
fi
die "release $id failed the outside checks and was rolled back"
