# SAKINA — Content Integrity & Licensing Policy

SAKINA is a religious application. Incorrect Quranic text, fabricated hadith, invented references or misleading rulings are **release-blocking defects**.

## 1. Rules

1. **No AI-generated religious content** is ever used as Quran, hadith, dhikr, du'a, tafsir, ruling or reference.
2. **No recreation from memory.** Quranic text is imported verbatim from Tanzil by script, hashed, and verified at runtime.
3. **Every content item has provenance**: source, author/institution, licence, attribution, language, version, verification status.
4. **Publicly accessible ≠ redistributable.** Content whose redistribution licence is unconfirmed is *not bundled*; at most, the app acts as a client that downloads it on the user's request directly from the publisher's own public endpoint, and the licence status is shown.
5. **Unknown is shown as unknown.** Missing hadith references or gradings are displayed as "not provided by source", never filled in.
6. **Differences of opinion are disclosed** (e.g. Asr method, nisab standard, Hijri sighting).
7. **Religious review is required before public release.** Items marked *Draft educational summary* must be reviewed by a qualified scholar.

## 2. Content register

| ID | Content | Source | Author / institution | Licence | Distribution in SAKINA | Verification |
|---|---|---|---|---|---|---|
| `quran.uthmani` | Quran text, Uthmani script (v1.1) | tanzil.net | Tanzil Project | CC BY 3.0, verbatim only, attribution + link | **Bundled** verbatim, Tanzil XML export with copyright block (`assets/content/quran-uthmani.xml`). XML is used because it keeps the Basmala as a separate attribute; the TXT export prefixes it to ayah 1 | Script: 114 surahs / 6236 ayahs / ordering vs Tanzil metadata. Runtime: SHA-256 `203f0f1b…e0fd` + Basmala structure (112 surahs, none on 1 and 9) before seeding |
| `quran.simple-clean` | Quran text, simple (imla'i) without diacritics | tanzil.net | Tanzil Project | CC BY 3.0 | **Bundled** (XML export), used *only* as a search index, never displayed as Quran | Same as above, SHA-256 `140787b7…b1fe` |
| `quran.metadata` | Surah names, juz/hizb/page/sajda boundaries | tanzil.net quran-data.xml | Tanzil.info | CC BY | Generated TS module | Counts (114/30/240/604) checked by script |
| `asma` | 99 Names (Arabic, transliteration, English meaning) | api.aladhan.com | Islamic Network | Public API; attribution | Generated TS module | 99 entries checked. UI discloses that scholars differ on the authenticity of the *enumerated list* |
| `translation.*` / `tafsir.*` | Quran translations & tafsir (e.g. Saheeh International, Hamidullah, Tafsir al-Muyassar) | api.alquran.cloud (Islamic Network) | Per edition (translator named in UI) | Per-edition terms; mostly non-commercial redistribution via Tanzil | **Downloaded on demand** by the user | Structural: 6236 entries, ordering. Displayed separately from Quran text and labelled with translator |
| `audio.recitation.*` | Per-ayah recitations (e.g. Mishary Alafasy) | cdn.islamic.network | Islamic Network / reciters | Freely streamed by publisher; redistribution terms per reciter | **Downloaded on demand** | MP3 header + size check, SHA-256 recorded at install; verified on demand |
| `adhkar.hisn` | Ḥiṣn al-Muslim, all 132 chapters / 267 adhkār, Arabic + English, repetition counts, chapter audio | [YousefAsalya/Islamic-Pro-azkar-API](https://github.com/YousefAsalya/Islamic-Pro-azkar-API) | Book: Saʿīd ibn ʿAlī ibn Wahf al-Qaḥṭānī; dataset: YousefAsalya | Dataset **MIT**. The book is widely distributed free of charge; SAKINA is free and non-commercial. **Before any commercial distribution, obtain written permission from the author's publisher.** | **Bundled** (`src/content/adhkar/hisn.generated.json`); chapter audio streamed from jsDelivr | Import script: 132 chapters, non-empty text, integer counts; SHA-256 in `content/SOURCES.extended.lock.json`. Reference shown = "Ḥiṣn al-Muslim, chapter N: title" (the dataset has no per-item takhrīj, so none is invented). French: no licensed French translation available → English shown, disclosed in UI |
| `adhkar.morningEvening` | 34 morning/evening adhkār with counts, virtue (faḍl) and takhrīj incl. al-Albānī gradings | [Seen-Arabic/Morning-And-Evening-Adhkar-DB](https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB) | Seen-Arabic | **MIT** | **Bundled**; session (morning/evening/both) from the dataset | Count + field checks at import; displayed verbatim |
| `sadaqah.hadith` | The hadith on ongoing charity shown on the Sadaqah Jariyah page: Ṣaḥīḥ Muslim 1631 (Arabic, English, French) | fawazahmed0/hadith-api (`ara/eng/fra-muslim`) | Compilers; translators per edition | Dataset **The Unlicense** | **Bundled**; the Arabic saying is a verbatim slice of the source text (chain of narrators omitted, kept in `arFull`) | Import script selects by `arabicnumber` 1631 and fails unless exactly one match and the three key phrases are present; SHA-256 in `content/SOURCES.extended.lock.json`; validated by `content:validate` and tests. The du’as for parents on that page are Quran 17:24, 14:41, 71:28 **read from the verified bundled mushaf** (a test checks each is about parents) |
| `adhkar.quranic` | Quranic supplications (Rabbanā / Rabbi duʿāʾ) | Tanzil text (above) | — | CC BY 3.0 | 65 references in `QURANIC_DUA_REFS`; text read verbatim from the bundled mushaf | Test asserts every reference is a supplication in the verified text (contains رب / سبحانك / اهدنا, or directly continues a listed ayah) |
| `hadith.forty` | Forty Hadith of an-Nawawī (42) and Forty Hadith Qudsī (40) — Arabic, English, French | [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) | Compilers; translators per edition | Dataset **The Unlicense** | **Bundled** | Counts at import + integration test; gradings displayed exactly as published, with the grader's name; Bukhārī/Muslim marked "ṣaḥīḥ collection" only for those two books |
| `hadith.<book>.<ar\|en\|fr>` | Bukhārī, Muslim, Abū Dāwūd, Tirmidhī, Nasāʾī, Ibn Mājah, Mālik (Arabic + translation where the source has it) | jsDelivr mirror of hadith-api | as above | The Unlicense | **Downloaded on demand** | `parseHadithEdition`: required fields, numbering, sections, ≥40 hadith, empty entries ≤20 % of valid ones; empty source entries are skipped and counted, never filled in |
| `adhan.*` | The adhan library: **2 recordings** (a regular adhan and a Fajr adhan), both bundled | Wikimedia Commons | Aaqib Azeez (reciter and rights holder, confirmed in writing by him); Besim Azemi, published by Islamic Center Malmö | CC BY-SA 4.0; CC BY 3.0 — both allow commercial use, redistribution and adaptation | Audio extracted, trimmed to the adhan, loudness-normalised (a *modification*, disclosed in the app and in each `credit.modified`) | See §2a: licence + provenance + quality verified, **and** the library was cut back after a listening and rights review. Hashes in `content/adhan/SOURCES.lock.json`; originals + attribution records in `content/adhan/originals/` |
| `notification.sounds` | One ≤ 30 s clip per voice: `adhan_<voice>.wav` (iOS notification sound, 16-bit mono 22.05 kHz PCM) and `adhan_<voice>.mp3` (Android channel fallback, in-app preview) | Cut from the mastered recording at the last phrase boundary under 28 s | Same recordist / licence as the voice | Same as the voice | Bundled | Test: every clip < 30 s, valid PCM/MP3 container, listed in `app.json` |
| `library.*`, `course.*`, `guide.*` | Third-party content packages | User-imported JSON | — | Must be stated in the package | Package format and validator (`parseContentPackage`); the Learn section itself is built from the verified sources above (no invented lessons) | Structural validation |
| `hajj.guide` | Hajj/Umrah step titles + Quranic references | Tanzil text for verses | — | — | Step structure bundled; any explanatory text is labelled *Draft educational summary — awaiting scholarly review* | Pending religious review |

## 2a. The adhan library — sourcing, verification, and what is *not* in it

**Rule: nothing is shipped on an uploader's say-so.** `scripts/adhan/build-library.mjs evaluate` checks, per recording, and `build` refuses to run unless all pass:

1. **Licence (automated, against the live Commons record).** Only CC0, CC BY and CC BY-SA (2.5–4.0) are accepted — the licences that permit commercial use, redistribution and adaptation (trimming/normalising). NC and ND variants, fair-use and deletion/permission flags are rejected. A bare "public domain" label is *not* accepted.
2. **Provenance (automated).** The licence must be the uploader's own (own work), or a YouTube CC BY licence that a Commons volunteer reviewed (`YouTubeReview` / `LicenseReview`). A third-party copy of something whose original cannot be verified is rejected.
3. **File integrity.** The downloaded original's SHA-1 must equal Commons' recorded SHA-1.
4. **Audio-quality gate** (measured on the voiced part): background ≤ −34 dBFS, voice ≥ 20 dB above background, sample rate ≥ 32 kHz, some energy above 6 kHz (not telephone-band), duration 40–420 s.
5. **Human-reviewable evidence.** Every candidate — accepted or rejected, with the reason — is recorded in `content/adhan/library.source.json` and `content/adhan/evaluation.json`.

**Preserved:** for every shipped voice, `content/adhan/originals/<id>.<ext>` (the untouched audio stream) and `<id>.attribution.json` (Commons page, original SHA-1, author, licence, review status).

**Attribution in the app:** the voice detail screen shows recordist, licence (with link), source page, the changes made, and — for CC BY-SA — that the file is shared under the same licence. The About screen lists every recording.

### The personal-use tier (added 2026-11-19, on the owner's explicit instruction)

The owner wants the Salat-First-style experience — a long list of famous reciters — **for personal use on their own phone, not commercially**. That cannot be done with licensed audio, so it is a **separate tier** that never mixes with the verified one:

| | Licensed tier (default) | Personal-use tier |
|---|---|---|
| Source | Wikimedia Commons / Internet Archive, licence verified | public GitHub collection `Kiwifu/adhan-mp3`, pinned commit; **no licence stated** |
| Rights | verified in writing / by licence | **not verified**; the recordings are other people's work |
| In the app | bundled + downloadable, mastered | downloadable on demand only, each pinned by size + SHA-256, played as published (volume lowered when too loud) |
| UI | listed in the library | listed only in the voice picker, with a "personal use only" note; detail page says so |
| Switch | always on | `expo.extra.personalAdhanLibrary` (true in this working copy) |

Rules: do **not** publish a build with this tier. `npm run adhan:strip-personal` disables it and empties its file; `SAKINA_PUBLISH=1 npm run content:validate` fails while it is present. Nothing was scraped from Salat First; its list was only used as a design reference. Own files added with "More…" stay on the device (SQLite row + app-private file), are never uploaded, and are included in backups only as a name.

### Library review after listening (2026-11-19)

The first library (5 recordings) passed every automated check and still sounded amateur when a person listened. Technical cleanliness is not beauty, and measurements cannot judge a performance. The library was therefore **cut back to the recordings whose performer, rights and provenance are strongest**, accepting a smaller library over a larger mediocre one:

| Recording | Decision | Why |
|---|---|---|
| Aaqib Azeez (Commons) | **Kept** (now bundled) | The reciter himself uploads it and states in writing on his Commons talk page that he is the reciter and rights holder and that commercial use is fine; studio-style, trained tajweed reciter |
| Fajr adhan — Malmö Mosque (Besim Azemi) | **Kept**, re-trimmed to the adhan only (the du'a that followed was removed) | Published by the mosque on its own channel; a Commons reviewer verified the YouTube licence; named muezzin |
| Masjid al-Haram, Jan 2013 | **Removed** | A visitor's phone video of the live muezzin: his performer rights are unresolved, and it is reverberant and amateur |
| Shalkar mosque, Kazakhstan | **Removed** | A visitor's field recording; the performer's consent to the "own work" licence cannot be verified |
| "Beautiful adhan" (CC0) | **Removed** | The uploader account is **blocked indefinitely on Commons for abusing multiple accounts** (verified in the block log) and imported other people's images; its "own work" claim is unreliable |

### Rejected on licensing (examples that matter)

| Recording | Why it was **not** used |
|---|---|
| Sabah Fakhri — "Call to prayer" (Commons) | Tagged PD-Old on the page, with the rationale "Adhan has been in effect since c.622 A.D." — a 1985 recording by a singer who died in 2021 is copyrighted. It was in the very first library and has been **removed**. |
| Prophet's Mosque, Madinah (Freesound import, CC BY 3.0 claimed) | A 2014 third-party copy; the Freesound original has since been deleted and no Commons reviewer confirmed the licence. |
| Cambridge / World Oral Literature Project Cairo adhans | CC BY-NC-ND 3.0 — non-commercial and no derivatives. |
| Public-domain-*marked* Internet Archive uploads of modern muezzins | The mark is set by an anonymous re-uploader, not a rights holder. |
| Recordings of famous muezzins (Alafasy, the Haram and Prophet's Mosque muezzins, …) | Commercially released or controlled by a state body; no free licence exists. **Not in the licensed tier.** (They are reachable only through the personal-use tier above, for the owner's own phone.) Permission list: `content/adhan/PERMISSIONS_NEEDED.md`. |

### Rejected on quality (measured)
Maghrib at the Masjid al-Haram 2012 (crowd noise throughout), Mecca 2018 (mono, −33 dBFS floor), Istanbul and Konya (street ambience, fragments), Jaffa/Kfar Kama (16 kHz handheld), Kalenderhane (very faint), several short fragments and a 45-minute lecture. Details: `content/adhan/library.source.json`.

### Rejected because wording cannot be verified
Two recordings in Iranian/Persian tradition and one Karbala upload. Adhan wording differs between traditions and a spectrogram cannot confirm it.

### What the checks cannot do
**No one on the project has listened to these recordings with a trained ear.** Automated checks removed obviously bad audio; they cannot say a performance is beautiful. Before release a person who reads Arabic should listen to every shipped recording (HANDOFF.md has the checklist).

### Open points
* Aaqib Azeez says his older recordings contain tajweed errors he regrets; this adhan dates from 2020. Ask him whether he still stands behind it (PERMISSIONS_NEEDED.md B1).
* The Fajr phrase («الصلاة خير من النوم») in the Malmö recording is expected but has not been verified by ear.
* Hosting: both voices are bundled. The download system is complete and tested (with real-bytes test fixtures) and ready for the next voices; set `expo.extra.adhanLibraryUrl` once you host `library/adhan/`.

## 3. Content validation pipeline

```
scripts/content-import/import-content.mjs   download verbatim → parse → validate → generate modules → SOURCES.lock.json
scripts/content-validation/validate-content.mjs   re-hashes bundled assets, re-runs structural checks (CI-able, offline)
scripts/adhan/build-library.mjs              adhan only: verify licences → measure quality → master → clips → catalogue + lockfile
src/services/quran/seed.ts                   runtime: SHA-256 check → parse → count/order check → seed content DB
src/services/downloads/validators.ts         per-package structural + checksum validation before activation
```

A download is **never** activated because a URL returned 200. It must pass: HTTP success → size/type sanity → payload validator (e.g. 6236 ayahs) → checksum (catalogue-pinned when available) → atomic activation.

## 4. Adding new content (checklist)

- [ ] Source and licence documented in this register.
- [ ] Redistribution permission confirmed **in writing** if bundling.
- [ ] Import script (no hand-typing).
- [ ] Structural validator.
- [ ] SHA-256 recorded in catalogue.
- [ ] UI attribution string in all three locales.
- [ ] Scholar review logged (name, date) for any explanatory text.
