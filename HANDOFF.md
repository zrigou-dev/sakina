# SAKINA — Handoff

Exact state of the project and what a person (or the next session) must do next. Nothing here is aspirational: items marked **unverified** have not been run.

## 0. Latest change — Salat-First-style adhan, Misbaha tasbih, Western numerals

* **Voice picker** (`/adhan/pick`, opened from the hub card, "All voices", and each prayer's sheet): searchable list (Arabic and Latin), radio per row, cloud icon on voices not yet downloaded (progress ring while downloading), preview on tap, **More…** to use your own audio file, Cancel / Confirm. Confirming a not-yet-downloaded voice starts its download; until it is ready the default sounds, so a prayer is never silent.
* **231 reciter recordings** (216 regular + 16 Fajr, ~600 MB if you downloaded all) from the pinned public collection `Kiwifu/adhan-mp3`. **Rights are not verified** (no licence stated). This is the *personal-use tier*: your phone only, never publish it (CONTENT_POLICY.md §2a). `npm run adhan:personal` rebuilds it; `npm run adhan:strip-personal` removes it for a public build.
* **Fajr rule kept**: a Fajr adhan (with «الصلاة خير من النوم») is only offered/used for Fajr.
* **Own files**: "More…" → system file picker → copied into the app, stored in SQLite (`custom_adhan`, migration v3), usable for any prayer, deletable.
* **Tasbih** is now a rotating 33-bead Misbaha with imām bead and tassel; **numbers are Western (0–9)** in every language.
* **Not verified**: sound quality of these recordings (I cannot listen — judge them yourself; some are loud/quiet, they are levelled only downward), and everything native (Android module never compiled; iOS can play only a built-in ≤30 s clip as notification sound — mp3 reciters use the standard tone there and play fully when you tap the notification or open the app).

## 0a. Latest change — app size, Nearby mosques, polish

* **Size** (Android export, before → after): JS bundle 8.7 → 6.5 MB, bundled assets 16.0 → 8.7 MB, plus no `.wav` copies in Android `res/raw` (−1.8 MB) and ARM-only ABIs (was 4 ABIs).
  * `lucide-react-native` is imported per icon (`lucide-react-native/icons/<name>`), never from the barrel — the barrel bundled ~2,000 icons.
  * Fonts are imported per weight (`@expo-google-fonts/<family>/<weight>`) — the barrel bundled every weight (30+ files).
  * Bundled adhans re-mastered as 64 kbps mono AAC with a −3 dBFS peak limiter (was 128 kbps stereo): 5.0 → 2.5 MB. Side channel of both recordings is 16–26 dB below centre. **Re-listen** (§2a checklist).
  * `plugins/withAndroidLeanSounds.js` removes the iOS-only `.wav` notification sounds from the Android project (must stay listed before `expo-notifications`).
  * `expo-build-properties`: R8 minify + resource shrinking, `arm64-v8a` + `armeabi-v7a` only (x86 emulators need a dev build). Removed unused `expo-keep-awake`, `expo-localization`.
  * Verified with `expo export` and `expo prebuild` only — **no APK/AAB was built here (no JDK/SDK)**; measure the real artefact with `eas build`.
* **Nearby mosques** row (Prayer tab → Worship tools): opens the device maps app on a "mosque" search around the saved location (`src/services/mosques/mapsUrl.ts`, tested). Nothing is sent by SAKINA.
* Home/Prayer hero shows **Tomorrow** when the next prayer is tomorrow's Fajr; the floating tab bar is centred on wide screens.
* Tests need **Node 22** (`.nvmrc`); on Node 20 `better-sqlite3` segfaults.

## 1. What this session delivered — the adhan system

A replacement of the previous adhan implementation (8 low-quality / partly mis-licensed recordings, a notification sound hard-wired to one file) with a licence-verified library and a reliable playback engine.

| Area | State |
|---|---|
| Recordings | **2 voices** after a listening-and-rights review: a regular adhan (**Aaqib Azeez**, a trained reciter who confirmed in writing that the voice and rights are his) and a **Fajr adhan** (muezzin **Besim Azemi**, published by Islamic Center Malmö). Both licence-verified, bundled, mastered to −16 LUFS. The first library's other three recordings were removed (§4). Originals + attribution preserved. |
| Online/offline library | Browse, instant offline 30 s preview, full-recording playback, download with progress / pause / resume / cancel, **size + SHA-256 + container verification**, delete / re-download, storage screen, filters, per-voice attribution screen. |
| Voice choice | Default muezzin, per-prayer voice, separate Fajr adhan, per-prayer mode (adhan / short tone / silent). Deleted downloads fall back automatically — a prayer is never silent. |
| Android | Native module `modules/sakina-adhan`: `setAlarmClock` alarms (14 days ahead) → foreground service on the **alarm stream** (audio focus, fades, Stop action, wake lock, volume safety, bundled-clip fallback), re-armed after reboot / update / clock change, time-zone notice. **Unverified — not compiled, not run (see §3).** |
| iOS | Per-voice ≤ 30 s clip as the notification sound, Time-Sensitive entitlement, tap → full adhan in the app, foreground → full adhan + overlay. **Unverified on a device.** |
| Reliability screen | Engine in use, notification permission, battery optimisation, alarm volume, next adhan, **"play a test adhan now"**, OEM and iOS guidance. |
| Optional online catalogue | If `expo.extra.adhanLibraryUrl` is set: new voices appear without an app update (strictly validated, cached). Not set by default. |

**What needs permission to reach "leading-app" quality:** `content/adhan/PERMISSIONS_NEEDED.md` — exact recordings, owners, contact routes (verified vs not), and what the licence must say. The most realistic first steps are **Aaqib Azeez** (re-license as CC0, record a Fajr adhan and more styles — he answers on Commons) and the **Asim Javed** CC0 recording after the caller's consent is confirmed.

Everything outside the adhan (Quran, adhkar, hadith, tools, learn, notifications…) is unchanged except where noted below.

## 2. Commands

```bash
npm run adhan:evaluate        # licence + quality verdict for every candidate in content/adhan/library.source.json
npm run adhan:build           # master → clips → catalogue/lockfile → app.json sounds → library/adhan/ (hostable)
npm run content:validate      # includes the adhan library (hashes, licences, provenance, clip limits)
npm run check                 # typecheck + lint + format + content + Jest
npm run e2e                   # Playwright (dev server on :8089, or BASE_URL=… for a production export)
```

To add a recording: add a candidate to `content/adhan/library.source.json` (Commons file title, names in ar/en/fr, place, `delivery`), run `adhan:evaluate` — it either accepts it or prints exactly why not — then `adhan:build`.

## 2a. Your listening checklist (the one step no tool can do)

Files: `library/adhan/aaqib-azeez.m4a` and `library/adhan/malmo-fajr.m4a` (exactly what ships). Listen end to end on a phone speaker **and** headphones.

| Check | Aaqib Azeez (regular) | Malmö (Fajr) |
|---|---|---|
| Wording correct and complete (incl. the 2 extra Fajr phrases «الصلاة خير من النوم» in Malmö) | ☐ | ☐ |
| Voice and maqam pleasing; would you want this at 5 a.m.? | ☐ | ☐ |
| Clean start and end (no click, no room noise, no stray voice) | ☐ | ☐ |
| Level matches the other voice (both are −16 LUFS) | ☐ | ☐ |
| The 15–27 s notification clip ends on a natural phrase (Settings → Adhan → play the preview) | ☐ | ☐ |

If either fails, say which and why; removing a voice is one line in `content/adhan/library.source.json` plus `npm run adhan:build`. Aaqib Azeez says his *older* recordings have tajweed errors — this one is from 2020 (PERMISSIONS_NEEDED.md B1).

## 3. What is **not** verified, and what to do about it

1. **The Android native module has never been compiled or run.** This machine has no JDK/Android SDK and installing them was blocked. It was reviewed line by line, its Expo config is accepted by `expo-modules-autolinking` and `expo prebuild` (sounds in `res/raw`, entitlement present), and all of its *inputs* are produced and tested in TypeScript — but a compile error or runtime fault is possible. **First step on a dev machine:** `npx expo run:android`, then Settings → Adhan → Reliability → *Play a test adhan now*, then schedule an adhan 2 minutes ahead, swipe the app away and lock the screen. Check the items in TEST_STRATEGY.md "Android adhan engine".
2. **iOS** notification sound rendering, Time-Sensitive behaviour and tap-to-play on a real iPhone.
3. **Nobody on the project has listened to these recordings with a trained ear — I cannot hear audio.** Measurements removed obviously bad audio; they cannot judge a performance (that is exactly why the first five were rejected). Use the checklist in §2a.
4. **Real-device downloads** (native `expo-file-system` path) — covered by tests with an injected file layer, not run on hardware.

## 4. Decisions you should know about

* **Famous muezzins are not in the licensed library.** They are commercially released and copyrighted; no free licence exists (the owner's personal-use tier, §0, is the only route to them). The library is as good as freely-licensed audio allows. If you hold licences for professional recordings, the pipeline needs one small extension: today it takes Wikimedia Commons sources only, so a "licensed local file" source type (with the licence evidence recorded in the manifest and shown in the app) must be added. The mastering, clips, catalogue, downloads and UI work unchanged.
* **Downloads come from Wikimedia Commons** (free, pinned by hash) because no hosting was approved. Before launch at scale, host `library/adhan/` yourself and set `expo.extra.adhanLibraryUrl`; the app tries the mirror first and falls back to Commons.
* **Both voices are bundled** (~5 MB) so the first adhan works with no network. The download system, mirror, storage screen and online catalogue are complete and tested (with real-bytes test fixtures) but currently have no shipped voice to deliver — by design: nothing ships that failed the review.
* **Removed after review:** the Masjid al-Haram phone video (the muezzin's performer rights are unresolved; amateur capture), the Shalkar field recording (performer consent unverifiable), and "Beautiful adhan" (its uploader account is blocked on Commons for abusing multiple accounts). Also never shipped: Madinah (source deleted), two Persian-tradition recordings (wording unverifiable).
* **A Fajr-only adhan can never sound for another prayer** (it contains the extra Fajr phrase): enforced in selection, in every picker and on the detail page, and tested.
* Sabah Fakhri's recording, which the previous library shipped as "public domain", was removed: the licence claim was invalid.

## 5. Known limitations

* Android alarms are planned 14 days ahead; if the app is not opened for longer, they stop.
* A time-zone change keeps the old instants until the app is opened (a notification tells the user).
* Android 14+: the adhan screen is a notification with a Stop button, not a full-screen takeover.
* iOS: a notification can never play more than 30 s; the full adhan needs a tap (or the app open).
* Web has no downloads or native alarms (preview/playback only).
* Remote-catalogue voices have no bundled iOS notification clip (iOS uses the default sound for them until an app update).

## 6. Files to know

`scripts/adhan/` (pipeline) · `content/adhan/` (source manifest, evaluation, originals, lockfile, pinned bytes) · `library/adhan/` (hostable output) · `src/services/adhan/` (voices, sources, playback, alarm plan, native bridge, provider, remote) · `src/features/adhan/` + `src/app/adhan/` (UI) · `modules/sakina-adhan/` (Android) · `src/services/downloads/` (`adhan-audio` installer) · tests: `tests/unit/adhan-*.test.ts`, `tests/integration/adhan-*.test.ts`, `e2e/features.spec.ts`.

Real test results: see [QUALITY_REPORT.md](QUALITY_REPORT.md).
