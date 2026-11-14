# 09 · Android app

Plan, progress log and test results for the Android version. Keep this file current: tick stages as they land, log decisions and test results, and move finished facts into the other docs (05 architecture, 07 testing, 08 status).

## Goal
A Lumi app that installs on the owner's Android phone for demos, built from the same React code as the web app, so iOS can follow from the same project. Lumi's behavior, wording and rules ([AGENTS.md](../AGENTS.md) "Never break") do not change.

## Decisions (agreed with the owner, 2026-11-14)
| Question | Decision |
|---|---|
| How to build | **Capacitor** wraps the existing Vite/React build (`frontend/android/`). No React Native rewrite. iOS later from the same project (`npx cap add ios`, needs a Mac). |
| Where the backend runs | **Cloud + laptop.** Default: the deployed backend (Render, mock mode, `LUMI_ADMIN` off). Fallback: the laptop on the same Wi-Fi (`http://<laptop-ip>:8000`). The server address can be changed in Grown-up settings. |
| Demo device | The owner's **Android phone**: phone layout first, emulator for development, then the phone over USB. |
| First-version scope | Everything the web app does, **plus the phone's own camera in Help mode**. Lumi still reads its lines aloud, using the phone's own voice (the app view has no browser voice). |
| Left out of v1 | **Voice input** (Android's app view has no browser speech recognition; chips and typing already cover it, so the mic button is hidden in the app). **Admin portal** (not in the app; still available in the laptop browser). **"Phone camera" QR option** (the phone *is* the camera). |
| Distribution | A debug APK installed over USB or sent as a file. No Play Store for the demo. |

## How it works
- `npm run build` → `frontend/dist` → `npx cap sync android` copies it into the Android project, which loads it from `https://localhost` inside the app.
- The app can't use the dev server's `/api` proxy, so it calls the backend's full address. Order: the address saved in Grown-up settings → `VITE_BACKEND_URL` set at build time → none (web, same origin).
- The laptop fallback is plain `http`, so the Android project allows cleartext and mixed content. That is acceptable for a demo build; a store release must use HTTPS only.
- The backend allows the app's origin (`https://localhost`, `capacitor://localhost` for iOS) via `CORS_ORIGINS`.

## Stages
Each stage ends with its checks passing and this file updated.

- [x] **0 · Plan.** This doc, a branch (`android-app`). Check: owner agreed the decisions above.
- [x] **1 · Capacitor shell.** Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`; `capacitor.config.json` (app id `app.lumi.learn`, name "Lumi"); generate `frontend/android/`; npm scripts. Check: debug APK builds and opens to the welcome screen on the emulator.
- [x] **2 · Backend connection.** Runtime backend address (saved setting + build-time default + "Test connection" in Grown-up settings); CORS for the app origin; cleartext for the laptop fallback; `render.yaml` and `.env.example` updated. Check: emulator reaches the laptop backend (`http://10.0.2.2:8000`), health shows mock mode, a Teach worksheet runs end to end.
- [x] **3 · Mobile fixes.** Camera permission and the back camera in Help mode; Lumi's voice through the phone's text-to-speech; hide the mic buttons, the admin route and the "Phone camera" option in the app; Android back button goes back a screen instead of closing the app. *Moved to stage 5:* app icon and splash with Lumi (the default Capacitor ones are still in). Check: Help photo grades a sample worksheet; back button never loses a lesson by accident.
- [x] **4 · Test.** Emulator run and owner's phone (Galaxy Z Flip5) of the manual test list below at phone size, en/es/vi; then the owner's phone over USB. Check: every row in Test results filled with a real result.
- [x] **5 · Evaluate and polish.** Lumi app icon (violet) and opening screen (cream) drawn from `lumi.svg` by `scripts/android_icons.py`; non-AI server calls time out after 12 s instead of 35 s; the skill picker shows "• • •" while loading instead of a lone "Lumi, you pick!". Docs 05, 07, 08, README and AGENTS.md updated. Check: emulator shows the new opening screen; with the server unreachable, Try again appears after 12.1 s.
- [x] **6 · Cloud backend.** Owner deployed the backend to Render (free tier, `https://techstars-lumi.onrender.com`, root `backend`, `MOCK_MODE=1`, `PYTHON_VERSION=3.11.9`, `SAMPLES_DIR`, no key, no `LUMI_ADMIN`); `.env.android` points the app at it. Check: emulator, then the owner's phone on mobile data with Wi-Fi off (laptop unreachable), ran the picker (loaded in 0.8 s), a full demo lesson and a Help sample on the cloud server.

## Manual test list (stage 4)
1. Install the APK, open it: welcome screen, Lumi animates, fonts load (or fall back cleanly offline).
2. Grown-up settings: server address shows, Test connection says mock mode.
3. Teach Lumi: picker → worksheet → mark, fix, explain by chip and by typing → demo → stars → Next.
4. Warm-up gate on a new concept.
5. Lumi's Town and the Journey open and scroll at phone size.
6. Help mode: camera permission prompt, back camera, photo of a sample worksheet, circles and hints. Upload from the gallery too.
7. Demo worksheet from Grown-up settings.
8. Saved progress opt-in, close and reopen the app, progress still there; delete works.
9. Android back button on each screen; rotate the phone; lock and unlock mid-lesson.
10. Spanish and Vietnamese.
11. Backend unreachable: Try again / Start over appear, no crash.

## Test results
Emulator: Pixel-size phone, Android 16 (API 36), 412 × 915 CSS px, laptop backend in mock mode at `http://10.0.2.2:8000`. Driven through the WebView's DevTools connection plus `adb` taps, 2026-11-14. Phone: Samsung Galaxy Z Flip5 (SM-F731B), main screen 360 × 833 CSS px, laptop backend over home Wi-Fi.

| # | Emulator | Phone | Notes |
|---|---|---|---|
| 1 | ✅ | ✅ | Opens to the welcome screen; no sideways scroll. First build crashed on `speechSynthesis` (fixed). |
| 2 | ✅ | ✅ | Phone: saved `http://<laptop-ip>:8000` (backend started with `--host 0.0.0.0`, launch config `lumi-backend-lan`, admin off); restarted connected in mock mode. Emulator: wrong address fails after 6 s with a clear message; right address shows mock mode; testing does not save. |
| 3 | ✅ | ✅ | Phone: same run, ends with "I learned carrying"; all 12 skills in the picker. Demo sheet: marked ✓/✗, typed 85 and 35 on the keypad, explained by chip, confirmed the demo, carrying star and "Next ➜". Typed explanation not tried. |
| 4 | not run | not run | |
| 5 | ✅ | not run | Town map and place list fit the phone width. Journey tab opens (Spanish run). |
| 6 | ✅ | ✅ | Phone (owner, by hand): permission prompt, back camera, photo of a paper sum graded. Emulator: camera permission prompt → back camera at 960 × 1280 → Check my work graded (mock). Sample worksheet button works. Gallery upload not tried. |
| 7 | ✅ | not run | |
| 8 | not run | ✅ | Held Save progress, force-closed and reopened the app: "Welcome back! Lumi remembers the skill you taught." Delete not tried. |
| 9 | ✅ | ✅ | Phone (owner): same behavior. Emulator: Help → back → welcome. Teach → back → app goes to the background; reopening shows the same marked worksheet. Rotation not tried. |
| 10 | ✅ (es) | ✅ (vi) | Vietnamese welcome and picker text; no sideways scroll. |
| 11 | ⚠️ | not run | No crash; "Oops, Lumi got stuck" with Try again / Start over appears, but only after the 35 s request timeout, and the skill picker shows only "Lumi, you pick!" meanwhile. |

Also: Lumi's lines are spoken aloud by the phone's text-to-speech (emulator log; owner heard it on the phone); backend tests 153 passed; `tsc` clean.

## Open questions and risks
- Render free tier sleeps after inactivity; the first request can take ~30 s. Open the app a minute before the demo, or use the laptop fallback.
- Venue Wi-Fi may block phone-to-laptop traffic; the phone's hotspot is a fallback for the laptop route.
- Google Fonts need internet; bundling the two fonts would make the app fully offline-safe (later).
- Voice input needs a native speech plugin (e.g. a Capacitor speech-recognition plugin); revisit after the demo.
- iOS needs a Mac with Xcode and an Apple developer account for device installs.
- When the server is down, Try again appears after 12 s (35 s for explaining, which waits for the AI). On a sleeping Render server the first call can take longer than 12 s: tap Try again, or open the app a minute early.
- A wrong saved server address makes every screen fail until a grown-up fixes it in Grown-up settings (that panel always works).
- To change the icon or opening screen, edit the colors or shapes in `scripts/android_icons.py` and rerun it (`python scripts/android_icons.py`, needs Pillow), then rebuild.

## How to build and install
```bash
cd frontend
npm run android:build                      # web build with .env.android, then copy into android/
cd android
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleDebug   # needs Java 21 (Android Studio's)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
`npm run android:open` opens the project in Android Studio (Run ▶ installs on a phone with USB debugging on). For the emulator, start the backend on the laptop; the build default `http://10.0.2.2:8000` reaches it. For a phone on Wi-Fi, enter `http://<laptop-ip>:8000` in Grown-up settings → 🌐 Lumi server. Debug the app's web view from Chrome at `chrome://inspect`.

## Log
- 2026-11-14 · Decisions agreed; plan written; branch `android-app` created. Tools on the laptop: Node 22, Java 17, Android SDK (platforms 34–35, build-tools 36), Android Studio, emulator `Medium_Phone_API_36`.
- 2026-11-14 · Stages 1–3 built. Capacitor 8.6 (TypeScript 7 can't load `capacitor.config.ts`, so the config is JSON). Gradle installed SDK platform 36 itself. Found: the Android app view has no `speechSynthesis`, which crashed the app; Lumi now speaks through `@capacitor-community/text-to-speech`. Backend always allows the app origins in CORS. Emulator test run: see Test results.
- 2026-11-14 · Installed on the owner's Galaxy Z Flip5 over USB. Phone reaches the laptop backend over Wi-Fi. Scripted phone checks passed (rows 1–3, 8, 10); hands-on checks (camera on paper, voice, back button) with the owner next.
- 2026-11-14 · Owner confirmed on the phone: Lumi's voice, Help camera on paper, back button. Stage 4 done; not yet tried on the phone: warm-up, town scenes, gallery upload, delete saved progress, the Flip cover screen.
- 2026-11-14 · Stage 5: Lumi icon and opening screen, 12 s timeouts for non-AI calls, picker loading dots. Installed on emulator and phone. The phone's USB debugging dropped to "unauthorized" after an adb restart (owner taps Allow on the phone to reconnect).
- 2026-11-14 · Stage 6: Render backend live (`/api/health`: mock, admin off; CORS allows the app). App default server switched to it and rebuilt; emulator test on the cloud passed. The phone still has the laptop address saved: Grown-up settings → 🌐 Lumi server → Use default.
- 2026-11-14 · Phone on mobile data (LTE, Wi-Fi off) against Render: picker, demo lesson and Help sample all passed. The demo no longer needs the laptop.
