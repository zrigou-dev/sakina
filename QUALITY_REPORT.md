# SAKINA — Quality Report (adhan release)

All numbers below come from runs executed in this environment on 2026-11-19. Nothing here is estimated. What was **not** run is listed in §4.

## 1. Results

| Check | Result |
|---|---|
| `tsc --noEmit` (strict) | ✅ clean |
| `eslint .` (incl. React Compiler rules) | ✅ clean |
| `prettier --check` | ✅ clean (Unicode escapes preserved) |
| `content:validate` | ✅ Quran text hashes, adhkar, hadith, and the **adhan library** (5 voices: licences, provenance, hashes vs lockfile, clips < 30 s) |
| `expo-doctor` | ✅ 20/20 |
| **Jest** (unit + integration, real SQLite, real audio files) | ✅ **326 tests / 17 suites** |
| **Playwright, dev server** | ✅ **16/16** — incl. two sweeps of **47 routes** (Arabic-light, English-dark): every screen renders with no runtime error and scrolls to its very end |
| **Playwright, production web build** | ✅ features + journeys 13/14 on the first run; the 14th (offline journey) was a test-scope issue (see §3) and passes on both builds after the fix |
| Production exports | ✅ web (28 MB) and Android Hermes bundle (8.7 MB) |
| Prebuild (`expo prebuild`) | ✅ 10 notification sounds in `res/raw` and the iOS bundle; Time-Sensitive entitlement present; native folders removed afterwards (CNG) |

## 2. What the adhan tests actually prove

* **Library integrity (24 tests, real files):** every mastered file's size and SHA-256 match the catalogue; AAC container; **decoded and re-measured** (loudness within 0.3 LU of the catalogue, true peak ≤ −0.9 dBFS, duration); every notification clip parsed — PCM mono 22.05 kHz, **< 30 s**; originals + attribution records exist; provenance rule satisfied; catalogue, assets module, `app.json` sounds, lockfile and the hostable folder all agree; no trace of the previous library.
* **Catalogue validation (33 tests):** rejects NC/ND/"public domain" licences, missing credit, clips ≥ 30 s, hot peaks, bad hashes, path-like ids, HTTP or untrusted hosts, Ogg downloads (iOS cannot play them), boosting gains, inverted trims; drops invalid/duplicate voices from a remote catalogue without crashing.
* **Selection:** per-prayer choice → built-in Fajr adhan → default → bundled; a deleted download never leaves a prayer without a voice.
* **Downloads (with real audio bytes):** installs only the exact pinned file; **a flipped byte, a truncated file and an HTML error page are each rejected** and nothing is kept; mirror-first with fallback to Commons on unreachable / corrupted / HTML mirror; all sources bad → clean failure then successful retry; re-download replaces the old variant (no two files); orphaned files of removed voices are cleaned; bundled voices cannot be "downloaded".
* **Scheduling:** 14-day alarm plan (order, uniqueness, disabled/silent/short-tone prayers skipped); the **native payload** (resolved voice per prayer, Fajr adhan, levelling gain dB→linear, trim s→ms, fade, bundled fallback-clip name, Arabic titles); notification planner stamps voices and leaves adhan prayers to the native engine without losing tone/silent ones.
* **Online catalogue:** validated, cached, restored offline, bundled voices immutable, survives HTTP errors / bad JSON / oversized bodies / network failure; a mirror-only voice previews by streaming and downloads with full verification.
* **Browser journeys (real playback on web):** the preview control flips to *Stop* only when the player reports `playing`; filters; detail page with attribution; full-recording playback; per-prayer voice and mute persist across reload; test-adhan overlay; storage and reliability screens.

## 3. Bugs found and fixed by testing (this session)

| Found by | Defect | Fix |
|---|---|---|
| Browser journey | Arabic **hadith search returned nothing** when typed early — loaders ran before content seeding finished | one global data-version bump when content becomes ready |
| Browser journey | **Preview never played on web** — Metro asset imports are not reliably `number`s; code branched on `typeof` | previews are a typed `PlaybackSource` |
| Browser journey | Duplicate test IDs (hero + card) | per-placement IDs |
| Visual review | Informational notes used a warning triangle; quality line was a bidi jumble in Arabic; "changes made" was English-only | info icon; structured rows with isolated numbers; localised sentence |
| Code review (Kotlin) | `startForegroundService()` then `stopSelf()` without `startForeground()` would crash; two bridge functions returned a non-serialisable `ComponentName?` | placeholder foreground notification; explicit `Unit` |
| Code review | A "short tone" prayer would still start the full adhan when the app was open | only adhan-sound prayers use the in-app adhan |
| Licence audit | Previous library shipped **Sabah Fakhri as "public domain"** on a bogus rationale; Madinah copy had an unverifiable licence | removed / excluded and recorded in the audit trail |
| Test run | Old offline test used `setOffline`, which also blocks the prod web build's own lazy chunks | scoped to external requests (the intent of the test) |

## 4. NOT verified — read before release

1. **Android native module (Kotlin): never compiled, never run.** No JDK/Android SDK on this machine; installing one was blocked. Reviewed by hand; module config validated by `expo-modules-autolinking` and `expo prebuild`. The service, receivers, audio focus, wake lock, boot re-arm and OEM battery behaviour need a real phone.
2. **iOS** notification sound, Time-Sensitive delivery and tap-to-play on a device.
3. **Nobody has listened to the audio here.** Quality was measured (noise floor, voice-to-background, bandwidth, loudness, spectrograms viewed); **wording and musical quality need a person who reads Arabic**, especially the Fajr adhan.
4. Native file downloads on hardware (the file layer is injected in tests).
5. Production-web screen sweeps (only dev-server sweeps were run); 47 routes × 2 themes were run on dev.

## 5. Honest limits of the recording library

Five recordings pass the licence + provenance + quality gates. **Famous-muezzin recordings are copyrighted and are not in the licensed library** (a separate, clearly labelled personal-use tier exists for the owner's own phone — CONTENT_POLICY.md §2a); the free-licence pool is small and mostly field recordings. Details of every candidate considered and why each was rejected: `content/adhan/library.source.json`, CONTENT_POLICY.md §2a.
