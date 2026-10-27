#!/usr/bin/env bash
# Builds the VOIDBREAK Android APKs from the web game using the local Android SDK.
#
#   ./build-apk.sh offline                    bundled assets, no connection needed
#   ./build-apk.sh live   --url https://x     loads the site, falls back to bundled assets
#   ./build-apk.sh both   --url https://x     both of the above
#
# Optional: VERSION_CODE=3 ./build-apk.sh ...   (bump so an installed app can be upgraded)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
A="$ROOT/android"

SDK="${ANDROID_HOME:-$HOME/AppData/Local/Android/Sdk}"
BT_VERSION="${BT_VERSION:-35.0.0}"
PLATFORM_VERSION="${PLATFORM_VERSION:-android-35}"
BT="$SDK/build-tools/$BT_VERSION"
PLATFORM="$SDK/platforms/$PLATFORM_VERSION/android.jar"
MIN_API=26
TARGET_API="${PLATFORM_VERSION#android-}"
VERSION_CODE="${VERSION_CODE:-2}"

exe() { local n="$1"; shift; [ -x "$BT/$n.exe" ] && "$BT/$n.exe" "$@" || "$BT/$n" "$@"; }
bat() { local n="$1"; shift; cmd //c "$(cygpath -w "$BT/$n.bat")" "$@"; }

VARIANT="${1:-both}"
SITE=""
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --url) SITE="${2:-}"; shift 2 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done
SITE="${SITE%/}"

VB_VERSION="$(sed -n 's/.*VB.VERSION = "\([^"]*\)".*/\1/p' "$ROOT/js/utils.js")"
[ -n "$VB_VERSION" ] || { echo "could not read VB.VERSION from js/utils.js"; exit 1; }

[ -d "$BT" ] || { echo "build-tools $BT_VERSION not found in $SDK"; exit 1; }
[ -f "$PLATFORM" ] || { echo "platform $PLATFORM_VERSION not found in $SDK"; exit 1; }

KS="$A/build/voidbreak-debug.keystore"
if [ ! -f "$KS" ]; then
  mkdir -p "$A/build"
  keytool -genkeypair -v -keystore "$KS" -alias voidbreak \
    -storepass voidbreak -keypass voidbreak \
    -dname "CN=VOIDBREAK Debug, OU=Games, O=VOIDBREAK, L=Orbit, S=NA, C=US" \
    -validity 10000 -keyalg RSA -keysize 2048 >/dev/null 2>&1
fi

build_one() {
  local MODE="$1" OUT="$2"
  local WORK="$A/build/$MODE"
  local LIVE=false
  [ "$MODE" = "live" ] && LIVE=true

  if [ "$LIVE" = true ] && [ -z "$SITE" ]; then
    echo "!! live variant needs --url https://your-site.vercel.app — skipped"
    return
  fi

  echo "==> [$MODE] syncing web assets"
  rm -rf "$WORK" "$A/assets/www"
  mkdir -p "$WORK/gen/com/voidbreak/nova9" "$A/assets/www"
  cp "$ROOT/index.html" "$A/assets/www/"
  cp -r "$ROOT/css" "$ROOT/js" "$A/assets/www/"

  # The engine reads window.VB_BUILD to know it is inside an app package.
  printf 'window.VB_BUILD = { mode: "%s", site: "%s" };\n' "$MODE" "$SITE" \
    > "$A/assets/www/build-config.js"
  sed -i 's#<script src="js/utils.js"></script>#<script src="build-config.js"></script>\n  <script src="js/utils.js"></script>#' \
    "$A/assets/www/index.html"
  grep -q 'build-config.js' "$A/assets/www/index.html" ||
    { echo "!! failed to inject build-config.js into the packaged index.html"; exit 1; }

  cat > "$WORK/gen/com/voidbreak/nova9/BuildConfig.java" <<EOF
package com.voidbreak.nova9;

final class BuildConfig {
    static final String SITE_URL = "$SITE";
    static final boolean LIVE = $LIVE;
    static final String VERSION = "$VB_VERSION";

    private BuildConfig() {}
}
EOF

  echo "==> [$MODE] compiling resources"
  exe aapt2 compile --dir "$A/res" -o "$WORK/res.zip"
  exe aapt2 link -o "$WORK/app.unsigned.apk" \
    -I "$PLATFORM" \
    --manifest "$A/AndroidManifest.xml" \
    --min-sdk-version "$MIN_API" \
    --target-sdk-version "$TARGET_API" \
    --version-code "$VERSION_CODE" --version-name "$VB_VERSION" \
    "$WORK/res.zip"

  echo "==> [$MODE] compiling java"
  mkdir -p "$WORK/classes"
  javac -nowarn -source 8 -target 8 -bootclasspath "$PLATFORM" \
    -d "$WORK/classes" $(find "$A/java" "$WORK/gen" -name '*.java')

  echo "==> [$MODE] dexing"
  bat d8 --release --min-api "$MIN_API" --lib "$PLATFORM" --output "$WORK" \
    $(find "$WORK/classes" -name '*.class')

  echo "==> [$MODE] packaging"
  cp "$WORK/app.unsigned.apk" "$WORK/app.apk"
  jar --update --file "$WORK/app.apk" -C "$WORK" classes.dex
  jar --update --file "$WORK/app.apk" -C "$A" assets
  exe zipalign -f 4 "$WORK/app.apk" "$WORK/app.aligned.apk"
  bat apksigner sign --ks "$KS" --ks-pass pass:voidbreak --key-pass pass:voidbreak \
    --out "$OUT" "$WORK/app.aligned.apk"

  echo "==> [$MODE] verifying"
  bat apksigner verify "$OUT" >/dev/null
  exe aapt dump badging "$OUT" | sed -n '1p'
  ls -la "$OUT"
}

case "$VARIANT" in
  offline) build_one offline "$ROOT/VOIDBREAK-offline.apk" ;;
  live)    build_one live "$ROOT/VOIDBREAK-live.apk" ;;
  both)
    build_one live "$ROOT/VOIDBREAK-live.apk"
    build_one offline "$ROOT/VOIDBREAK-offline.apk"
    ;;
  *) echo "usage: ./build-apk.sh [offline|live|both] [--url https://site.vercel.app]"; exit 1 ;;
esac

rm -rf "$A/assets/www"
echo
echo "done (v$VB_VERSION, versionCode $VERSION_CODE)"
