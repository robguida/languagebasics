#!/usr/bin/env bash
# lb-release.sh - LanguageBasics releases on the server. deploy.sh sends this file from the approved commit
# (stored on the server by content hash) and runs it there. It never edits the web server's config.
#
#   lb-release.sh install <tar> <release-id> <manifest-sha256>   unpack, verify, switch current, smoke; auto-rollback on fail
#   lb-release.sh rollback [<expected-current-id> [<reason>]]     switch to the last good release; the one left is marked bad
#   lb-release.sh list                                            current, rollback target, every release and its status
#   lb-release.sh smoke                                           origin-direct checks of the live release (no CDN)
#   lb-release.sh manifest                                        "release <id>", then the live release's manifest
#
# Settings come from the environment (deploy.sh sets them; no server paths are written in this file):
#   LB_ROOT         absolute folder that holds releases/, current and deploys.log (required)
#   LB_ROUTE_FILE   the web server's route file for the app; smoke fails if it is missing (required for smoke)
#   LB_KEEP         good releases kept when pruning, current and rollback target included (default 5, minimum 2)
#   LB_KEEP_BAD     bad releases kept for diagnosis (default 1)
#   LB_HOST_HEADER  Host header for smoke (default bengusa.pro)
#   LB_BASE         origin address for smoke (default http://127.0.0.1:80)
#   LB_PREFIX       URL path of the app (default /languagebasics)
#   LB_CURL         curl command (tests pass a fake)
#
# deploys.log is tab-separated: time, kind, id, note. Kinds:
#   live  current was switched to <id>
#   good  <id> passed smoke after going live
#   bad   <id> failed smoke or was rolled back from. A bad release is never picked by a rollback
#         and never counts toward LB_KEEP.
# Older lines (written before good/bad existed) are read too: a note "rollback from <id>" or
# "auto-rollback from <id>" marks <id> bad.
set -uo pipefail
export LC_ALL=C
umask 022

die()  { echo "lb-release: ERROR: $*" >&2; exit 1; }
say()  { echo "lb-release: $*"; }
ID_RE='^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$'
valid_id() { [[ "$1" =~ $ID_RE ]]; }

ROOT=${LB_ROOT:-}
[ -n "$ROOT" ] || die "LB_ROOT is not set"
[[ "$ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "LB_ROOT must be an absolute path of plain characters"
case "/$ROOT/" in */../*|*/./*) die "LB_ROOT must not hold . or .. parts" ;; esac
ROOT=${ROOT%/}
REL=$ROOT/releases
LOG=$ROOT/deploys.log
ROUTE=${LB_ROUTE_FILE:-}
KEEP=${LB_KEEP:-5}
KEEP_BAD=${LB_KEEP_BAD:-1}
[[ "$KEEP" =~ ^[0-9]+$ ]] && [ "$KEEP" -ge 2 ] || die "LB_KEEP must be a whole number, 2 or more"
[[ "$KEEP_BAD" =~ ^[0-9]+$ ]] || die "LB_KEEP_BAD must be a whole number"
HOST_HEADER=${LB_HOST_HEADER:-bengusa.pro}
BASE=${LB_BASE:-http://127.0.0.1:80}
PREFIX=${LB_PREFIX:-/languagebasics}
CURL=${LB_CURL:-curl}
BAD=""

cur_id() { local t; t=$(readlink "$ROOT/current" 2>/dev/null || true); case "$t" in releases/*) echo "${t#releases/}" ;; *) echo "" ;; esac; }
point()  { ln -sfn "releases/$1" "$ROOT/.current.new" && mv -Tf "$ROOT/.current.new" "$ROOT/current"; }
logl()   { printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$1" "$2" "$3" >> "$LOG"; }

# Every id marked bad, one per line (new "bad" lines and the older rollback notes).
bad_ids() {
    [ -f "$LOG" ] || return 0
    awk -F'\t' '
        $2=="bad" && $3!="" { print $3 }
        $2=="live" && match($4, /rollback from [^ \t]+/) { s=substr($4, RSTART, RLENGTH); n=split(s, a, " "); print a[n] }
    ' "$LOG" | sort -u
}
is_bad() { grep -qxF -- "$1" <<<"$BAD"; }

# Rollback target: the release that most recently went live or passed smoke, that is not current,
# not bad, and still on disk.
target_id() {
    local c=$1 id
    [ -f "$LOG" ] || { echo ""; return; }
    while IFS= read -r id; do
        [ -n "$id" ] || continue
        [ "$id" = "$c" ] && continue
        is_bad "$id" && continue
        valid_id "$id" || continue
        [ -d "$REL/$id" ] || continue
        echo "$id"; return
    done < <(awk -F'\t' '($2=="live" || $2=="good") && $3!="" { last[$3]=NR } END { for (i in last) print last[i] "\t" i }' "$LOG" | sort -rn | cut -f2)
    echo ""
}

smoke() {
    local fails=0 id want got loc hdr
    if [ -z "$ROUTE" ] || [ ! -f "$ROUTE" ]; then say "smoke FAIL: the app's route file is missing (LB_ROUTE_FILE)"; return 1; fi
    id=$(cur_id); [ -n "$id" ] || { say "smoke FAIL: no current release"; return 1; }
    chk() { # path expect-code [content-type-prefix]
        local out
        out=$("$CURL" -s -o /dev/null -w '%{http_code} %{content_type}' -H "Host: $HOST_HEADER" "$BASE$1") || out="000"
        if [[ "$out" == "$2"* ]] && { [ -z "${3:-}" ] || [[ "${out#* }" == "$3"* ]]; }; then echo "  ok   $out  $1"; else echo "  FAIL $out  $1 (want $2 ${3:-})"; fails=$((fails+1)); fi
    }
    chk "$PREFIX/" 200 text/html
    chk "$PREFIX/?lesson=sq/lesson-1" 200 text/html
    chk "$PREFIX/engine.js" 200 application/javascript
    chk "$PREFIX/styles.css" 200 text/css
    chk "$PREFIX/content/languages.js" 200 application/javascript
    chk "$PREFIX/content/sq/lesson-1.js" 200 application/javascript
    chk "$PREFIX/content/es/lesson-1.js" 200 application/javascript
    chk "$PREFIX/content/ja/lesson-1.js" 200 application/javascript
    chk "$PREFIX/content/bn/lesson-1.js" 200 application/javascript
    chk "$PREFIX/.manifest.sha256" 404
    chk "$PREFIX/.x" 404
    chk "$PREFIX/nope.js" 404
    loc=$("$CURL" -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Host: $HOST_HEADER" "$BASE$PREFIX?lesson=es/lesson-1")
    hdr=$("$CURL" -s -D - -o /dev/null -H "Host: $HOST_HEADER" "$BASE$PREFIX?lesson=es/lesson-1" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
    if [[ "$loc" == 301* ]] && [ "$hdr" = "$PREFIX/?lesson=es/lesson-1" ]; then echo "  ok   301 -> $hdr"; else echo "  FAIL no-slash redirect: $loc / $hdr"; fails=$((fails+1)); fi
    want=$(awk '{p=$2; sub(/^[*]/,"",p)} p=="index.html"{print $1}' "$ROOT/current/.manifest.sha256" 2>/dev/null)
    got=$("$CURL" -s -H "Host: $HOST_HEADER" "$BASE$PREFIX/" | sha256sum | cut -d' ' -f1)
    if [ -n "$want" ] && [ "$want" = "$got" ]; then echo "  ok   served index.html = release $id"; else echo "  FAIL served index.html $got != manifest $want"; fails=$((fails+1)); fi
    if [ "$fails" = 0 ]; then say "smoke PASS ($id)"; return 0; fi
    say "smoke FAIL ($fails)"; return 1
}

prune() { # keep current, the rollback target, the newest $KEEP good releases and the newest $KEEP_BAD bad ones
    local c=$1 t=$2 d good=0 badn=0
    for d in $(ls -1 "$REL" 2>/dev/null | grep -E "$ID_RE" | sort -r); do
        if [ "$d" = "$c" ] || [ "$d" = "$t" ]; then good=$((good+1)); continue; fi
        if is_bad "$d"; then
            badn=$((badn+1)); [ "$badn" -le "$KEEP_BAD" ] && continue
        else
            good=$((good+1)); [ "$good" -le "$KEEP" ] && continue
        fi
        { chmod -R u+w "$REL/$d" && rm -rf "${REL:?}/$d"; } || echo "lb-release: could not prune $d" >&2
    done
}

cmd=${1:-}
case "$cmd" in
  install)
    [ $# -eq 4 ] || die "usage: install <tar> <release-id> <manifest-sha256>"
    tar=$2 id=$3 msha=$4
    valid_id "$id" || die "bad release id $id"
    [[ "$msha" =~ ^[0-9a-f]{64}$ ]] || die "bad manifest sha"
    [ -f "$tar" ] || die "no $tar"
    mkdir -p "$REL"
    [ ! -e "$REL/$id" ] || die "release $id already exists"
    # Only plain relative paths, no .., no absolute, no links.
    bad=$(tar -tvf "$tar" | awk '$1 !~ /^[-d]/' | head -3); [ -z "$bad" ] || die "tar holds links/special files: $bad"
    bad=$(tar -tf "$tar" | grep -E '(^/|(^|/)\.\.(/|$))' | head -3); [ -z "$bad" ] || die "tar holds unsafe paths: $bad"
    grep -qx '.manifest.sha256' <<<"$(tar -tf "$tar")" || die "tar has no .manifest.sha256"
    P=$REL/$id.partial; rm -rf "$P"; mkdir "$P"
    tar -xf "$tar" -C "$P" --no-same-owner --no-same-permissions || { rm -rf "$P"; die "unpack failed"; }
    got=$(sha256sum "$P/.manifest.sha256" | cut -d' ' -f1)
    [ "$got" = "$msha" ] || { rm -rf "$P"; die "manifest sha $got != approved $msha"; }
    ( cd "$P" && sha256sum --quiet --strict -c .manifest.sha256 ) || { rm -rf "$P"; die "files do not match the manifest"; }
    listed=$(wc -l < "$P/.manifest.sha256" | tr -d ' '); actual=$(find "$P" -type f ! -name .manifest.sha256 | wc -l | tr -d ' ')
    [ "$listed" = "$actual" ] || { rm -rf "$P"; die "manifest lists $listed files, release has $actual"; }
    odd=$(find "$P" ! -type f ! -type d | head -3); [ -z "$odd" ] || { rm -rf "$P"; die "links/special files: $odd"; }
    [ -f "$P/index.html" ] && [ -f "$P/engine.js" ] || { rm -rf "$P"; die "index.html/engine.js missing"; }
    find "$P" -type f -exec chmod 0444 {} + ; find "$P" -type d -exec chmod 0555 {} +
    mv -T "$P" "$REL/$id"
    old=$(cur_id)
    point "$id" || die "could not switch current"
    logl live "$id" "from=${old:-none}"
    say "LIVE $id (was ${old:-none})"
    if ! smoke; then
        logl bad "$id" "smoke-failed"
        if [ -n "$old" ] && [ -d "$REL/$old" ]; then
            point "$old" && logl live "$old" "auto-rollback from $id"
            say "AUTO-ROLLBACK to $old ($id marked bad)"
            smoke || say "WARNING: smoke also fails on $old; check the server now"
        else
            say "no previous release to roll back to; $id stays live and is marked bad"
        fi
        exit 1
    fi
    logl good "$id" "smoke-pass"
    BAD=$(bad_ids)
    c=$(cur_id); t=$(target_id "$c")
    prune "$c" "$t"
    rm -f "$tar"
    ;;
  rollback)
    [ $# -le 3 ] || die "usage: rollback [<expected-current-id> [<reason>]]"
    want=${2:-} reason=${3:-manual}
    [[ "$reason" =~ ^[a-z0-9-]{1,40}$ ]] || reason=manual
    c=$(cur_id); [ -n "$c" ] || die "no current release"
    if [ -n "$want" ] && [ "$c" != "$want" ]; then die "current is $c, not $want; nothing changed"; fi
    BAD=$(bad_ids)
    t=$(target_id "$c")
    [ -n "$t" ] || die "no good release to roll back to; nothing changed"
    point "$t" || die "switch failed; nothing changed"
    logl bad "$c" "rolled-back: $reason"
    logl live "$t" "rollback from $c"
    say "ROLLED BACK $c -> $t ($c marked bad)"
    smoke
    ;;
  list)
    BAD=$(bad_ids)
    c=$(cur_id); t=$(target_id "$c")
    say "current: $c  previous: $t"
    for d in $(ls -1 "$REL" 2>/dev/null | grep -E "$ID_RE" | sort); do
        if [ "$d" = "$c" ]; then s=current; elif is_bad "$d"; then s=bad; elif [ "$d" = "$t" ]; then s="good (rollback target)"; else s=good; fi
        printf '  %s  %s\n' "$d" "$s"
    done
    ;;
  smoke) smoke ;;
  manifest)
    c=$(cur_id); [ -n "$c" ] || die "no current release"
    [ -f "$ROOT/current/.manifest.sha256" ] || die "current release has no manifest"
    echo "release $c"
    cat "$ROOT/current/.manifest.sha256"
    ;;
  *) sed -n '4,8p' "$0"; exit 2 ;;
esac
