# SAKINA — Architecture

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Expo SDK 58 · React Native 0.88 · React 19.3 · Hermes · New Architecture | Current stable SDK |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) | |
| Routing | Expo Router (file-based, `src/app/`) | |
| Local DB | `expo-sqlite` (two databases, see §3) | Relational, migrations, FTS5 on native |
| Files | `expo-file-system` (`File`, `Directory`, `File.createDownloadTask` with pause/resume, native SHA-256 `digest`) | |
| Audio | `expo-audio` (`AudioPlayer`, lock-screen controls, background mode) | |
| Notifications | `expo-notifications` (local only, DATE triggers) | |
| Location / heading | `expo-location` (`getCurrentPositionAsync`, `watchHeadingAsync`) | No extra sensor lib needed for Qibla |
| Prayer times | `adhan` (MIT, adhan-js) | Peer-reviewed astronomical implementation |
| Hijri | `@umalqura/core` (MIT, Umm al-Qura tables 1300–1600 AH) + user day offset | Deterministic, offline |
| Animation | `react-native-reanimated` 4 + `react-native-worklets` | UI-thread animation |
| Graphics | `react-native-svg` (geometric patterns, rings, compass) | |
| Icons | `lucide-react-native` | |
| Fonts | `@expo-google-fonts/*` (Amiri Quran, Amiri, IBM Plex Sans Arabic, IBM Plex Sans, Fraunces) — all SIL OFL | |
| Tests | Jest (`jest-expo`) · `better-sqlite3` for real-SQL repository tests · Playwright for web E2E + screenshots | |

**No backend.** The only network calls are user-initiated package downloads to the URLs declared in the content catalogue.

## 2. Layering

```
src/app/            Routes only. Thin: compose feature components, read params.
src/features/<f>/   Feature UI + hooks (home, prayer, quran, adhkar, …). May depend on services, repositories, design-system.
src/design-system/  Tokens, theme provider, motion, primitives. Depends on nothing app-specific.
src/localization/   Typed i18n (ar/en/fr), plural rules, number/date formatting, direction.
src/services/       Pure-ish domain logic (prayer, hijri, qibla, search normalisation, zakat, downloads, notifications, audio, backup).
src/database/       DB interface, migrations, repositories. No React.
src/content/        Generated, immutable content metadata (from scripts).
src/state/          Small external stores (settings) exposed via useSyncExternalStore.
```

Rules: services and repositories are **React-free and unit-testable**; UI never issues SQL directly; only `src/services/downloads/catalogue.ts` knows remote URLs.

## 3. Data architecture

Two SQLite databases, separating immutable content from user data:

| DB | File | Contents | Lifecycle |
|---|---|---|---|
| **Content** | `sakina-content.db` | Quran ayahs (Uthmani + search form), FTS5 index, installed translations/tafsir text, installed adhkar & package content | Rebuildable. Re-seeded when `CONTENT_SCHEMA_VERSION` changes. Never backed up |
| **User** | `sakina-user.db` | Settings, bookmarks, reading progress, memorisation, prayer/fasting logs, goals, notes, dhikr progress, downloads metadata | Versioned migrations (`PRAGMA user_version`). Exported in backups |

Both are opened through a minimal `SqlDatabase` interface (`src/database/types.ts`) that `expo-sqlite`'s `SQLiteDatabase` satisfies structurally. Tests supply a `better-sqlite3` adapter so **migrations and repositories run against real SQLite in CI**.

### User schema (v1) — see `src/database/user/migrations.ts`
`settings(key PK, value JSON)` · `bookmarks(id, surah, ayah, note, created_at, UNIQUE(surah,ayah))` · `reading_progress(id=1, surah, ayah, updated_at)` + `reading_log(date, ayahs_read)` · `memorization(surah, ayah, status, ease, interval_days, due_date, reviewed_at, PK(surah,ayah))` · `memorization_plan(...)` · `prayer_log(date, prayer, status, PK(date,prayer))` · `fasting_log(date PK, kind, note)` · `goals(id, kind, target, active)` + `goal_progress(goal_id, date, value)` · `dhikr_progress(date, item_id, count, PK)` · `dhikr_favorites(item_id PK)` · `notes(id, title, body, ref, created_at, updated_at)` · `packages(id PK, kind, version, status, bytes, sha256, local_path, installed_at, error, meta JSON)` · `package_files(package_id FK, rel_path, sha256, bytes)` · `hajj_progress(step_id PK, done_at)` · `tasbih(id, label, count, target)`.

### Content schema — see `src/database/content/schema.ts`
`ayah(id = global index 1..6236, surah, ayah, page, juz, hizb_quarter, text_uthmani, text_search)` · `ayah_fts` (FTS5 over `text_search`, when available; otherwise LIKE fallback) · `translation(edition, ayah_id, text)` · `translation_edition(id, kind, language, name, author, source, license)` · `adhkar_category`, `adhkar_item` · `content_meta(key, value)`.

## 4. Quran seeding (first launch)

1. Load bundled assets `quran-uthmani.xml` + `quran-simple-clean.xml` (Tanzil XML exports, expo-asset). XML keeps each surah's Basmala as a separate attribute (the TXT export prefixes it to ayah 1).
2. Verify SHA-256 against `src/content/integrity.generated.ts` (expo-crypto). Mismatch → hard error screen, no seeding.
3. Parse, validate 6236 ayahs, ordering against Tanzil metadata, and Basmala structure (present on 112 surahs, absent on 1 and 9).
4. Insert in one transaction with page/juz/hizb computed from metadata; normalise search text; build FTS5 if supported.
5. Record `content_meta.quran_seeded = <hash>`.

Runs in the background during onboarding (≈1–2 s on mid-range devices); screens that need the Quran show a skeleton until ready.

## 5. Localisation & direction

- `src/localization/locales/{ar,en,fr}.ts` — `en` is the typed source of keys; `ar`/`fr` are type-checked against it (missing key = compile error).
- `t(key, params)` with ICU-like `{name}` interpolation and CLDR plural categories (Arabic: zero/one/two/few/many/other).
- **Direction**: SAKINA applies `direction: 'rtl' | 'ltr'` at the root view and exposes `useDirection()`. This switches instantly without an app reload and works identically on web. `I18nManager.allowRTL(false)` prevents the OS from double-flipping. Text components set `textAlign`/`writingDirection` from the context.
- Religious source text (Quran, adhkar Arabic) is always RTL regardless of UI language.

## 6. Download & content-package system

```
Catalogue (bundled snapshot + optional remote static JSON)  →  PackageManifest[]
          │ user taps Download
          ▼
DownloadQueue (state machine: queued → downloading ⇄ paused → verifying → installing → installed | failed | cancelled)
          │ per file: File.createDownloadTask (native, resumable, savable state persisted) / fetch (web)
          ▼
Validators: HTTP ok → size/type sanity → payload validator → SHA-256 (pinned if catalogue has it)
          ▼
Installer (per kind): translation → content DB rows; audio → files in Documents/packages/<id>/; adhkar → content DB
          ▼
packages / package_files rows (status, bytes, sha256, local path)
```

State machine is pure (`src/services/downloads/state.ts`) and unit-tested. Wi-Fi-only preference via `expo-network`. Free-space check via `Paths.availableDiskSpace` before starting. Interrupted downloads resume from persisted `DownloadPauseState` or restart cleanly; partial files live in `cache/partial/` and are never read as content.

The remote catalogue URL is `null` by default (no hosting yet). Set `CATALOGUE_URL` in `src/services/downloads/catalogue.ts` once a static host (e.g. GitHub Pages) is chosen; the bundled snapshot keeps working if it is unreachable.

## 7. Notifications

Local DATE triggers only. iOS allows 64 pending notifications, so SAKINA schedules a **rolling window** (next 4 days × enabled prayers + daily reminders, capped at 60) and re-plans on every app foreground and settings change. Documented limitation: if the app is not opened for > 4 days, reminders stop until next launch.

## 7a. The adhan system

```
scripts/adhan/build-library.mjs   verify licences → quality gate → master (−16 LUFS AAC) → ≤28 s clips → catalogue + lockfile
        │
        ├─ src/content/adhan/catalogue.generated.json   voices (validated at module load by src/services/adhan/voices.ts)
        ├─ assets/adhan/full/*.m4a      bundled full recordings        (delivery: "bundled")
        ├─ assets/adhan/clips/*.mp3     30 s preview + Android fallback sound   (every voice, always offline)
        ├─ assets/sounds/*.wav          iOS notification sound, PCM 22.05 kHz mono (every voice)
        └─ library/adhan/               the same masters + catalogue.json + clips — hostable on any static host
```

**Voices & delivery.** `bundled` voices ship inside the app. `download` voices are fetched on demand: from the optional mirror (`expo.extra.adhanLibraryUrl`, mastered AAC) first, then from the **pinned Wikimedia Commons file** (MP3 — iOS cannot play Ogg). The installer (`DownloadManager`, payload `adhan-audio`) accepts a file only if its **exact size, SHA-256 and container** match the catalogue; otherwise it tries the next source, then fails with a clear error and keeps nothing. A raw Commons file is levelled at playback time with a stored attenuation (`gainDb`), trim and fade-out (`playbackProfile`, `levelAt`).

**Selection.** `resolveVoice(prayer, settings, isAvailable)`: the prayer's own choice → (Fajr) the built-in Fajr adhan → the default voice → a bundled voice. A deleted download can never make a prayer silent.

**Playback.**
| | Prayer time, app closed | App open | Tap on notification |
|---|---|---|---|
| **Android (native module `modules/sakina-adhan`)** | `AlarmManager.setAlarmClock` → receiver → **foreground service** plays the full file on the *alarm* stream with audio focus, fade-in/out, Stop action, wake lock; falls back to a bundled clip if the file is bad | same service (the JS watcher is disabled to avoid two adhans) | — |
| **iOS** | notification with the voice's ≤ 30 s clip, Time-Sensitive | JS player plays the full adhan + overlay | opens the app and plays the full adhan |
| **Fallback (no native module / Expo Go)** | per-voice Android notification channel with the clip | JS player | JS player |

Alarms are planned 14 days ahead (no 64-item cap on Android), re-armed from durable storage after reboot / app update / clock change, and a time-zone change posts a notice to reopen the app (prayer times change with the zone).

**Optional online catalogue.** If a mirror is configured, `<mirror>/catalogue.json` is fetched, validated as strictly as the bundled one (allowed licences, trusted hosts, pinned hashes, size caps), cached in the content DB, and its new voices appear without an app update. Bundled voices cannot be replaced.

**Pure and tested:** `voices.ts` (validation, selection, levelling), `alarmPlan.ts`, `nativeEngine.buildNativePayload`, `plan.ts`, `playback.ts`, validators. **Device-only:** the Kotlin service, receivers, audio focus, OEM battery behaviour, iOS notification sound rendering.

## 7b. Feedback & contact (no backend)

`src/content/contact.ts` holds the developer's address. The Contact page and the crash screen only build a `mailto:` URL (`src/services/feedback/mailto.ts`, pure and tested: RFC 6068 encoding, CRLF body) and ask the OS to open it, so the app collects and transmits nothing. The draft contains prompts in the user's language and a small footer (app version, platform, OS version, language) that the user can edit or delete before sending. If no mail app exists the address is shown on screen and can be copied.

## 8. Decisions log

| # | Decision | Alternatives | Reason |
|---|---|---|---|
| D1 | Seed Quran from bundled verbatim text at runtime | Prebuilt `.db` asset | One code path native+web; runtime SHA-256 verification of the licensed verbatim file; keeps Tanzil copyright block intact |
| D2 | Search on Tanzil Simple-Clean, display Uthmani | Normalise Uthmani | Uthmani orthography (dagger alef, etc.) differs from everyday spelling; Simple-Clean is an official Tanzil edition aligned ayah-by-ayah |
| D3 | Root `direction` style instead of `I18nManager.forceRTL` + reload | forceRTL | Instant language switch, identical on web, no restart |
| D4 | Hisn al-Muslim downloaded on demand, not bundled | Bundle | Redistribution licence unconfirmed |
| D5 | Custom typed i18n (~150 LOC) | i18next | Compile-time key checking, Arabic plural forms, zero runtime deps |
| D6 | Web build used for automated E2E and screenshots | Device farm | No emulator available in the build environment; native behaviour still requires device testing (see TEST_STRATEGY.md) |
| D7 | Node 22 (`.nvmrc`) | Node 20 | Expo SDK 58 requires Node ≥ 22.13 |
