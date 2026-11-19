# SAKINA (سكينة) — Product Specification

> «رفيقك في رحلتك مع الله، في كل يوم.»
> *Your peaceful Islamic companion. Everything a Muslim needs, thoughtfully organized in one place.*

## 1. Product principles

| Principle | What it means in practice |
|---|---|
| **Offline-first** | Every core screen renders from local data. The network is used only for optional, user-initiated downloads. |
| **Private by design** | No account, no analytics, no tracking, no cloud sync. All user data stays in on-device SQLite. |
| **Content integrity** | Religious text comes only from documented, verifiable sources. Where no verified source exists the UI says so — it never improvises. |
| **Calm, not busy** | Progressive disclosure. Home shows *today*; everything else is one tap away. |
| **Encouraging, never judgmental** | No streak-shaming, no leaderboards, no guilt copy. |
| **Arabic-first, truly multilingual** | Arabic (RTL) is the default; English and French (LTR) are complete, not partial. |

## 2. Audience

Muslims of all ages and technical levels: beginners, older users, Arabic readers and non-Arabic speakers, users with visual or motor accessibility needs, families.

## 3. Information architecture

Bottom navigation (five destinations, icon **and** label):

| Tab | Arabic | Purpose |
|---|---|---|
| Home | الرئيسية | Today: greeting, dates, next prayer & countdown, daily ayah, adhkar shortcut, daily goals, continue reading/memorising, upcoming occasions |
| Prayer | الصلاة | Prayer times, Qibla, adhkar & duas, tasbih, prayer log, prayer guides |
| Quran | القرآن | Reader, surah/juz/hizb/page navigation, bookmarks, search, audio, memorisation |
| Learn | تعلّم | Library, academy courses, life guides, Hajj & Umrah, family — all package-driven |
| More | المزيد | Calendar, Zakat, Asma al-Husna, My Journey, My Library (downloads), Settings, About & Sources |

A unified **search** is reachable from Home and Quran.

## 4. Feature scope and status

Status key: ✅ implemented & tested · 🟡 implemented, content pending verified source · ⏳ planned

| Area | Scope | Status (see IMPLEMENTATION_ROADMAP.md for live status) |
|---|---|---|
| Onboarding | Language, theme, location (GPS or manual city), calculation method, Asr method, notifications | ✅ |
| Home | Personalised dashboard | ✅ |
| Prayer times | adhan-js astronomical calculation; 12 methods; Asr; high-latitude rule; per-prayer minute adjustments (flagged in UI) | ✅ |
| Notifications | Per-prayer reminders, pre-prayer reminder, adhkar & Quran-goal reminders; rolling schedule within OS limits | ✅ |
| Adhan library | 2 licence-verified, rights-reviewed recordings (a regular adhan and a Fajr adhan); premium muezzins need permission with preview, offline download, storage management, per-prayer voices, native Android alarm engine, iOS clips + tap-to-play, reliability screen | ✅ (device verification pending; see HANDOFF) |
| Sadaqah Jariyah & contact | A warm page asking users to remember the developer and their parents in du’a (hadith from verified data, Quran du’as for parents from the bundled mushaf); a Contact page that opens the user’s own email app with an editable draft to the developer. **No backend, no analytics:** nothing is sent by the app itself | ✅ |
| Qibla | Great-circle bearing + device heading with calibration guidance | ✅ |
| Quran reader | Full Tanzil Uthmani text, navigation, bookmarks, last-read, font controls, night mode | ✅ |
| Quran search | Local, normalised Arabic search (Simple-Clean index) + downloaded translations | ✅ |
| Translations / tafsir | Downloadable packages (AlQuran Cloud distribution of Tanzil-hosted editions) | ✅ (download) |
| Quran audio | Per-ayah recitation, repeat ayah/range, speed, sleep timer, downloads | ✅ |
| Memorisation | Plans, ayah status, spaced revision queue, statistics | ✅ |
| Adhkar | Quranic adhkar bundled from Tanzil text; Hisn al-Muslim downloadable from its official public API; counter, favourites, completion | ✅ / 🟡 licence |
| Tasbih | Free counter with targets & haptics | ✅ |
| Calendar | Umm al-Qura Hijri, user adjustment ±2 days, occasions, fasting log | ✅ |
| Zakat | Money / gold / silver / trade goods / debts, transparent nisab methodology | ✅ |
| Hajj & Umrah | Step journey, Tawaf & Sa'i counters, progress | ✅ structure · 🟡 guidance text |
| Library / Academy / Guides / Family | Package format, installer, reader, progress | ✅ engine · 🟡 verified content |
| My Journey | Daily goals, prayer & fasting logs, reflections, history | ✅ |
| My Library | Download manager: catalogue, progress, pause/resume, integrity, storage | ✅ |
| Settings / Privacy | All preferences, export/import backup, delete-all-data | ✅ |
| About & Sources | Every content source with licence and verification status | ✅ |

## 5. Non-goals (explicit)

- No backend, server, cloud DB, Firebase, Supabase, auth or subscriptions.
- No fatwa engine. Complex personal rulings → "consult a qualified scholar".
- No gamified worship (no points, no ranks, no social comparison).
- No AI-generated religious text.

## 6. Success criteria

1. A first-time user, offline, can complete onboarding and see accurate prayer times for a manually chosen city.
2. Quran reader opens instantly at the last-read ayah and scrolls smoothly on a mid-range Android device.
3. Every religious text on screen can be traced to a row in **About → Sources**.
4. Switching Arabic ↔ English ↔ French flips the full layout direction with no mixed-direction artefacts.
