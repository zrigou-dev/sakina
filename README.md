# SAKINA · سكينة

A peaceful, private, offline-first Islamic companion — Expo SDK 58 · React Native 0.88 · TypeScript (strict).

> «رفيقك في رحلتك مع الله، في كل يوم.»

## Quick start

```bash
nvm use                     # Node 22 (Expo SDK 58 requires ≥ 22.13)
npm install
npm run web -- --port 8089  # web preview (dev)
npm run android             # needs a development build (native modules), see below
```

SAKINA uses native modules not bundled in Expo Go (SQLite with FTS5, audio background mode, notifications channels…). Build a development client with `npx expo run:android` / `npx expo run:ios` or `eas build --profile development`.

## Quality gates

```bash
npm run typecheck           # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint                # eslint-config-expo incl. React Compiler rules
npm run format:check        # prettier
npm run content:validate    # re-hash bundled Tanzil text + structural checks (offline)
npm test                    # Jest: unit + integration (real SQLite via better-sqlite3)
npm run e2e                 # Playwright journeys against the web build (server on :8089)
npm run check               # all of the above except e2e
```

## Adhan library

```bash
npm run adhan:evaluate     # verify every candidate's licence on Commons, measure audio quality, record the verdict
npm run adhan:build        # master accepted voices, cut notification clips, write catalogue + lockfile + library/adhan/
```

Recordings are licence-verified (CC0 / CC BY / CC BY-SA), quality-gated and credited in the app — see [CONTENT_POLICY.md §2a](CONTENT_POLICY.md). To serve downloads from your own host, upload `library/adhan/` and set `expo.extra.adhanLibraryUrl` in `app.json`; the app then also learns new voices from `catalogue.json` without an update. The Android alarm engine is a local Expo module (`modules/sakina-adhan`) and needs a development build.

## Content

All religious text comes from documented sources — see [CONTENT_POLICY.md](CONTENT_POLICY.md). Re-import with `npm run content:import` (downloads verbatim sources, validates, regenerates typed modules and `content/SOURCES.lock.json`).

## Documents

| | |
|---|---|
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | Vision, scope, status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, layering, data model, decisions |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Tokens, typography, motion, components |
| [CONTENT_POLICY.md](CONTENT_POLICY.md) | Sources, licences, validation pipeline |
| [TEST_STRATEGY.md](TEST_STRATEGY.md) | Test layers and device checklist |
| [QUALITY_REPORT.md](QUALITY_REPORT.md) | Results of the last executed test run |
| [HANDOFF.md](HANDOFF.md) | Exact status and next steps for the next session |
