# SAKINA — Implementation Roadmap

Live status (updated 2026-11-19). ✅ done & tested · 🟡 partial / content pending · ⏳ not started

| Phase | Deliverables | Status |
|---|---|---|
| 0 Inspect & plan | Workspace inspected (empty but for guide.md). Expo SDK 58 scaffolded. PRODUCT_SPEC, ARCHITECTURE, DESIGN_SYSTEM, CONTENT_POLICY, TEST_STRATEGY, this file. Sources identified & imported by script | ✅ |
| 1 Foundation | Tokens (light/dark), fonts, typed i18n ar/en/fr + CLDR plurals, root-direction RTL/LTR, motion, 20+ components, two-DB architecture with migrations and repositories, routing shell with custom tab bar | ✅ |
| 2 Core daily | Onboarding (7 steps, GPS or offline city search or coordinates), Home dashboard, Prayer times (21 methods, verified vs AlAdhan), prayer log, Qibla, Quranic adhkar + Hisn al-Muslim download, rolling local notifications, Settings | ✅ (notifications & compass need device verification) |
| 3 Quran | Verified seeding (SHA-256 + structure), reader (virtualised, Basmala, sajda badges, translations), surah/juz navigation, bookmarks, last-read, reading log, FTS5/LIKE search, per-ayah audio (stream/local, repeat, speed, sleep), memorisation (SM-2-style) | ✅ (audio on device unverified) · 🟡 page/hizb browsing UI |
| 4b Adhan | Licence-verified library pipeline, 2 voices (after a listening-and-rights review), online/offline library UI, verified downloads, storage management, per-prayer voices, Android native alarm engine, iOS clips, reliability screen, optional online catalogue | ✅ JS/tests/web · ⏳ Android native + devices unverified |
| 4 Knowledge | Content-package format + validator + installer + reader with progress; Library/Academy/Guides/Family sections | ✅ engine · 🟡 no verified packages published |
| 5 Tools | Hijri calendar (Umm al-Qura, ±2 offset, occasions), fasting log, Zakat (transparent methodology), Hajj & ʿUmrah steps + Tawaf/Saʿy counters, Asma al-Husna, My Journey (goals, week, reflections), Tasbīḥ | ✅ · 🟡 Hajj guidance text awaits reviewed source |
| 6 Downloads | Catalogue (bundled snapshot), state machine, serial queue, preflight (offline/Wi-Fi/space), validators, checksum, installers (translation/tafsir, Hisn, per-ayah audio), restart recovery, My Library | ✅ (native file path on device unverified) |
| 7 Quality | Static checks, 213 Jest tests, 8 Playwright journeys, visual QA screenshots, production exports — see QUALITY_REPORT.md | ✅ in this environment · ⏳ device testing |

## Open items needing an owner decision
1. **Hisn al-Muslim licence** — obtain written permission to bundle (currently download-on-demand from the publisher).
2. **Adhan recordings** — only 2 recordings ship (the rest failed the rights or listening review). Premium muezzin recordings need written permission: see `content/adhan/PERMISSIONS_NEEDED.md`. A person must listen to both before release (HANDOFF §2a). Licensed files can be added through `content/adhan/library.source.json` once a "licensed local file" source type is added.
2a. **Adhan on devices** — the Android alarm engine (Kotlin) is written but has not been compiled or run; test it on real phones per TEST_STRATEGY.md before release.
2b. **Mirror host (optional)** — for large-scale traffic, host `library/adhan/` and set `expo.extra.adhanLibraryUrl` (downloads otherwise come from Wikimedia Commons).
3. **Static catalogue host** — choose (e.g. GitHub Pages) and set `CATALOGUE_URL`; pin SHA-256 per file there.
4. **Scholarly reviewer** — required for the Quranic adhkar selection, Hajj step references, and any future courses.
5. **Device testing** — run TEST_STRATEGY.md's device checklist on a mid-range Android and an iPhone.
