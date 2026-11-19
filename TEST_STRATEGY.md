# SAKINA — Test Strategy

**Rule zero: never report a test as passed unless it was executed. Results live in `QUALITY_REPORT.md`, generated from real runs.**

## Layers

| Layer | Tool | Location | Runs where |
|---|---|---|---|
| Static | `tsc --noEmit` (strict), ESLint (`eslint-config-expo`), Prettier `--check`, `expo-doctor` | — | CI / local |
| Content validation | `scripts/content-validation/validate-content.mjs` | — | CI / local, offline |
| Unit | Jest (`jest-expo` preset) | `tests/unit/**` | Node |
| Integration (DB) | Jest + `better-sqlite3` adapter implementing `SqlDatabase` | `tests/integration/**` | Node — real SQLite, real migrations |
| E2E / visual | Playwright (Chromium) against `expo export -p web` served with COOP/COEP | `e2e/**` | Headless browser |
| Device | Manual checklist (below) + recommended Maestro flows | `e2e/maestro/` | Android / iOS devices (not available in this environment) |

## Independent test vectors

- **Prayer times**: 21 cases (7 cities × 3 seasons × 7 methods incl. Hanafi Asr) captured from the AlAdhan API — an implementation independent of adhan-js. Tolerance ±1 min (rounding conventions differ).
- **Hijri (Umm al-Qura)**: 10 dates captured from AlAdhan `calendarMethod=UAQ`.
- **Adhan test voice**: no shipped voice is download-delivered, so download/mirror/levelling tests use a voice built from real bytes (`tests/helpers/adhan-fixtures.ts`: a Commons-style MP3 and the real mastered AAC) — never mocks.
- **Adhan audio**: every shipped file is decoded in the test and its loudness, true peak and duration re-measured independently of the build script; clips are checked by parsing their WAV/MP3 headers against the iOS 30-second limit; download integrity is exercised with the real pinned bytes, a flipped byte, a truncated file and an HTML error page.
- **Zakat**: hand-computed worked examples documented inline with arithmetic.
- **Qibla**: published bearings for well-known cities (e.g. London ≈ 118.99°, New York ≈ 58.48°) cross-checked with great-circle formula.
- **Arabic normalisation**: hand-built pairs (alef forms, ta marbuta, alef maqsura, tashkeel, tatweel, Quranic marks).

## Unit test targets
prayer calculation & next-prayer selection · manual adjustments flagged · Hijri conversion + offset · Islamic occasions · Arabic normalisation · search query building · download state machine (all legal/illegal transitions) · checksum verification · progress tracking · Quran navigation (page/juz/hizb lookup) · tasbih/dhikr counters · zakat · memorisation scheduling · backup validation · i18n completeness & plural rules · colour contrast (WCAG AA).

## Integration targets
user DB init + migration idempotency · settings persistence · bookmarks · reading progress · memorisation · prayer/fasting logs · package records lifecycle · content DB seeding from the real Tanzil files (+ FTS search) · translation package install from fixture · export → wipe → import round-trip.

## E2E journeys (Playwright, web)
`e2e/journeys.spec.ts` — 1 first launch → Arabic onboarding (RTL asserted) → all tabs · 2 read Quran, bookmark, last-read restored after reload · 3 Quran search with/without diacritics + Go-to page · 4 morning adhkar render; complete a Ḥiṣn chapter with the counter · 5 English (LTR) / French / dark, persisted after reload · 6 English onboarding with manual coordinates (location denied) · 7 fully offline after first load (download error state, reader, calendar, zakat, qibla, tasbīḥ) · 8 large text.

`e2e/features.spec.ts` — adhan library (instant preview flips to *stop*, filters, detail with attribution, full-recording playback, per-prayer voice + sound persist after reload; test-adhan overlay; storage and reliability screens) · hadith search, collection reader, bookmark, deep link to a hadith beyond the first page · periodic dhikr reminders persist · khatma plan (start, mark day, open reader at the portion) + qaḍāʾ counters persist · guides open Ḥiṣn chapters; kids quiz accepts the right answer.

`e2e/screens.spec.ts` — **every screen (43 routes)** in Arabic/light and English/dark: renders with no runtime error, then is scrolled to its very end with real wheel events and must reach it (no clipped bottom content); top and bottom screenshots saved to `e2e/screenshots/screens/` for visual review.

## Not automatable here (must be done on devices before release)
Notifications delivery timing · Qibla heading accuracy · background audio & lock-screen controls · resumable native downloads across app kill · haptics · real RTL on native Text (iOS `writingDirection`) · mid-range Android frame timing.

### Device checklist
- [ ] Android mid-range (e.g. 4 GB RAM): launch < 2 s warm, Quran scroll 60 fps
- [ ] iOS: 64-notification cap respected; reminders fire
- [ ] Airplane mode cold start
- [ ] Download interrupted by airplane mode → resume
- [ ] Qibla vs known landmark
- [ ] **Android adhan engine** (several phones incl. Samsung/Xiaomi): alarm fires on time with the screen off and the app swiped away; full adhan plays on the alarm stream; Stop works; phone call / another app's audio ends it; reboot → next adhan still fires; changing time zone → notice appears; Do-Not-Disturb "alarms only" still sounds; alarm volume 0 → raised for the adhan and restored
- [ ] **Android battery**: with battery optimisation ON, check delay; the reliability screen links to the right settings
- [ ] **iOS adhan**: notification plays the voice's clip (< 30 s) with the ringer on; Time-Sensitive breaks through a Focus; tapping it plays the full adhan; foreground plays full + overlay
- [ ] **Downloads on a device**: download a voice over Wi-Fi, airplane mode → plays offline; delete → plays the fallback; corrupt/kill mid-download → recovers; storage screen matches actual usage
- [ ] **Listen to every shipped adhan end to end** (HANDOFF.md §2a checklist: wording, Fajr phrase, pleasing voice, clean start/end, level match)
- [ ] Periodic dhikr notifications respect the active window and the 60-notification budget; in-app dhikr toast appears at the chosen interval
- [ ] Download a hadith collection and an adhan over mobile data with “Wi-Fi only” on → blocked with explanation
