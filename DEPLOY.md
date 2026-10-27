# VOIDBREAK — deploy + APK release

Everything the game needs is plain static files: `index.html`, `css/`, `js/`.
The scripts in this folder assemble the two deliverables — a Vercel site and
installable Android APKs — from that one source.

## 1. Publish to Vercel (playable in any browser)

```bash
./build-deploy.sh                 # writes deploy/
cd deploy
vercel                            # first run: creates the project, gives you the URL
vercel --prod
```

`vercel` is not installed here, so install it first (`npm i -g vercel`, or
download the standalone binary) and run `vercel login`. The deploy target is the
`deploy/` folder — it holds its own `vercel.json`, so nothing else in this
project is uploaded.

If you prefer the dashboard: drag the whole `deploy/` folder into
https://vercel.com/new as a static project.

After the first deploy you get an address like
`https://voidbreak-nova9.vercel.app`.

## 2. Build the APKs against that address

```bash
./build-apk.sh both --url https://your-site.vercel.app
./build-deploy.sh --url https://your-site.vercel.app
cd deploy && vercel --prod        # republish so the APKs are downloadable
```

Two files land in the project root:

| file | what it is |
| --- | --- |
| `VOIDBREAK-live.apk` | opens the site in a WebView, so every deploy is instantly live. Falls back to the bundled copy when there is no connection. |
| `VOIDBREAK-offline.apk` | ships the game inside the APK; polls `version.json` and shows **NEW BUILD AVAILABLE — PLAY LATEST**, which jumps to the site. Plays with no connection at all. |

`build-deploy.sh` copies them into `download/VOIDBREAK-nova9.apk` (the button on
the title screen) and `download/VOIDBREAK-nova9-offline.apk`. Until the live
build exists, the offline one covers the main button so it never 404s.

Requirements already met on this machine: Android SDK build-tools 35.0.0,
platform `android-35`, JDK 17. Both APKs are signed with
`android/build/voidbreak-debug.keystore` (password `voidbreak`), so keep that
file — same key means a new build upgrades the installed app instead of
conflicting with it. Install by sideloading, or with a device attached:

```bash
adb install -r VOIDBREAK-live.apk
```

Android asks to allow "unknown apps" for the browser that downloaded it. The
package name is `com.voidbreak.nova9`; both variants share it, so installing one
replaces the other.

## 3. Shipping an update

1. Edit the game, then bump `VB.VERSION` in `js/utils.js` and `version` in
   `version.json` (they must match).
2. Bump `VERSION_CODE=3 ./build-apk.sh ...` whenever the APKs themselves change,
   so Android treats it as an upgrade.
3. `./build-deploy.sh --url <your url>` → `cd deploy && vercel --prod`.

Browsers pick it up on reload (`vercel.json` marks HTML/JS/CSS `no-cache`);
installed APKs notice within a minute via `version.json` (`no-store`, plus
`Access-Control-Allow-Origin: *` so the offline APK can read it cross-origin) and
show the chip on the title screen.

## 4. The download prompt

The title screen offers the APK on every browser except when the page is opened
from disk (`file://`) or is already running inside an APK. iPhone/iPad get a note
instead of a button — there is no iOS build, and the page itself can be added to
the home screen. "NOT NOW" hides the row and remembers the choice.

## 5. Local preview

Opening `index.html` from disk works for the game itself, but the APK row and the
update check stay hidden because there is no server. Any static server over
`http://` shows them; the `?touch=1` query forces the touch HUD on a desktop
browser.
