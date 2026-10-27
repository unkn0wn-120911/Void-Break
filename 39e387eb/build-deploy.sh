#!/usr/bin/env bash
# Assembles deploy/ — the exact folder to hand to Vercel.
#
#   ./build-deploy.sh [--url https://your-site.vercel.app]
#
# --url is only used to print the follow-up commands; the live APK needs the
# deployed address, which does not exist until the first deploy has run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$ROOT/deploy"

SITE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --url) SITE="${2:-}"; shift 2 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done
SITE="${SITE%/}"

VERSION="$(sed -n 's/.*VB.VERSION = "\([^"]*\)".*/\1/p' "$ROOT/js/utils.js")"
[ -n "$VERSION" ] || { echo "could not read VB.VERSION from js/utils.js"; exit 1; }

echo "==> writing deploy/ for v$VERSION"
# The folder itself can be held open by Explorer or AV on Windows, so only its
# contents are replaced.
mkdir -p "$OUT"
rm -rf "$OUT/css" "$OUT/js" "$OUT/download"
mkdir -p "$OUT/download"
cp "$ROOT/index.html" "$ROOT/version.json" "$ROOT/vercel.json" "$OUT/"
cp -r "$ROOT/css" "$ROOT/js" "$OUT/"

# The page always offers download/VOIDBREAK-nova9.apk first, so that name must
# resolve; the offline build covers it until the live build exists.
if [ -f "$ROOT/VOIDBREAK-live.apk" ]; then
  cp "$ROOT/VOIDBREAK-live.apk" "$OUT/download/VOIDBREAK-nova9.apk"
  echo "  + download/VOIDBREAK-nova9.apk (live, auto-updating)"
elif [ -f "$ROOT/VOIDBREAK-offline.apk" ]; then
  cp "$ROOT/VOIDBREAK-offline.apk" "$OUT/download/VOIDBREAK-nova9.apk"
  echo "  + download/VOIDBREAK-nova9.apk (offline build — replace after first deploy)"
else
  echo "  ! no APK found — run ./build-apk.sh first, the download button will 404"
fi

if [ -f "$ROOT/VOIDBREAK-offline.apk" ]; then
  cp "$ROOT/VOIDBREAK-offline.apk" "$OUT/download/VOIDBREAK-nova9-offline.apk"
  echo "  + download/VOIDBREAK-nova9-offline.apk"
fi

grep -q 'js/touch.js' "$OUT/index.html" || { echo "!! deploy/index.html looks incomplete"; exit 1; }

echo
echo "deploy/ contains:"
find "$OUT" -type f | sed "s#$OUT/##" | sort
echo
if [ -n "$SITE" ]; then
  echo "next:"
  echo "  cd deploy && vercel --prod"
  echo "  ../build-apk.sh live --url $SITE   # then re-run this script"
else
  echo "next:  cd deploy && vercel --prod"
fi
