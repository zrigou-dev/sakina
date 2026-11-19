# SAKINA — Complete Product Vision, Engineering, Design & Execution Master Prompt

You are acting as an elite multidisciplinary product team consisting of:

- A world-class product strategist.
- A senior React Native / Expo architect.
- A principal TypeScript engineer.
- A world-class UI/UX designer.
- A premium motion and interaction designer.
- An Islamic digital product specialist.
- A database and offline-first architecture engineer.
- A quality assurance and automation engineer.
- An accessibility and performance specialist.

Your mission is to design, engineer, implement, test, and polish **SAKINA (سكينة)** into an exceptional, production-quality Islamic lifestyle application.

This is not a simple prototype, not a basic prayer-times application, and not a generic collection of Islamic tools.

The vision is to create a comprehensive digital companion for Muslims: an elegant, peaceful, intelligent, beautiful, reliable, and deeply useful application that supports Muslims throughout their daily lives.

The final product must feel like a premium international application, with an original visual identity, extraordinary attention to detail, exceptional usability, and a distinctive Islamic atmosphere.

Do not merely describe what should be built. Actually build it.

---

# 1. PRODUCT IDENTITY

Product name: SAKINA

Arabic name: سكينة

Core idea:

"Your peaceful Islamic companion. Everything a Muslim needs, thoughtfully organized in one place."

Arabic product positioning:

"رفيقك في رحلتك مع الله، في كل يوم."

SAKINA should communicate:

- Peace.
- Spiritual connection.
- Clarity.
- Trust.
- Simplicity.
- Knowledge.
- Beauty.
- Consistency.
- Personal growth.

The product must not feel overly religious in its visual treatment, old-fashioned, cluttered, or visually repetitive.

Create a modern Islamic identity that respects Islamic values while using sophisticated contemporary design.

Do not use generic templates or default component-library appearances.

The design should be recognizable as SAKINA.

---

# 2. NON-NEGOTIABLE TECHNICAL CONSTRAINTS

These requirements are mandatory.

## Architecture

Use:

- Expo.
- React Native.
- TypeScript with strict type checking.
- Expo Router.
- SQLite for local structured data.
- Expo FileSystem for downloaded content and media.
- Expo Audio for audio playback.
- Expo Notifications for local notifications.
- Expo Location where location permissions are required.
- Appropriate Expo APIs for device capabilities.
- A maintainable, modular architecture.

Choose stable, compatible package versions based on the project's Expo SDK.

Use Expo-compatible libraries only unless there is a compelling and documented reason otherwise.

## Absolutely no custom backend

SAKINA must not depend on:

- A custom backend.
- A private server.
- A cloud database.
- Firebase.
- Supabase.
- A mandatory user account.
- A subscription-based infrastructure service.
- A continuously running server.
- A custom API that I must maintain.

The application must be genuinely offline-first.

The user should be able to install SAKINA and use its essential functionality without creating an account.

## Offline-first requirements

Core functionality must work without an internet connection.

Internet must only be needed for optional operations such as:

- Downloading optional Quran recitations.
- Downloading audio collections.
- Downloading books.
- Downloading educational courses.
- Downloading videos.
- Updating optional content catalogues.
- Downloading optional map data.

After downloading, the content must remain usable offline.

Never make a core screen depend on an internet request.

Never display a blank screen simply because the user has no internet.

Provide graceful offline states and meaningful error messages.

## Local data

Use SQLite for:

- User preferences.
- Bookmarks.
- Reading progress.
- Quran memorization progress.
- Learning progress.
- Prayer logs.
- Fasting logs.
- Personal goals.
- Notes.
- Download metadata.
- Local content indexes.
- Other structured information.

Store large files in the filesystem, not in SQLite.

Store their metadata, local paths, download status, and checksums in SQLite.

Separate immutable bundled content from user-generated local data wherever appropriate.

Provide database migrations and safe database initialization.

Do not use AsyncStorage as a replacement for a proper relational database.

## No hidden cloud dependency

Do not introduce analytics, tracking, remote authentication, cloud synchronization, or paid services without explicit justification and approval.

Do not upload personal user information.

User data must remain on the device.

Consider optional encrypted manual export/import for backups.

---

# 3. PRODUCT DESIGN — THE MOST IMPORTANT REQUIREMENT

I want an extraordinary design.

The visual quality is one of the most important success factors of this project.

Do not interpret "Islamic design" as simply using green backgrounds, golden crescents, mosque illustrations, and decorative Arabic patterns everywhere.

Create a sophisticated visual language.

## Creative direction

Imagine a combination of:

- The refinement of premium Apple applications.
- The elegance of high-end editorial design.
- The calmness of meditation applications.
- The clarity of excellent productivity applications.
- The visual heritage of Islamic geometry and architecture.

However, the result must have its own identity.

## Visual atmosphere

Explore:

- Deep emerald.
- Warm ivory.
- Soft sand.
- Muted gold.
- Midnight blue.
- Subtle neutral surfaces.
- Carefully controlled gradients.
- Delicate Islamic geometric motifs.
- Beautiful Arabic typography.
- Elegant light and shadow.
- Generous whitespace.
- Sophisticated cards and surfaces.

Do not use all these colors everywhere. Establish a coherent design system with a restrained palette.

Support both light and dark themes.

Dark mode must be carefully designed, not simply the light theme with black backgrounds.

## Typography

Typography must be excellent, especially for Arabic.

Choose appropriate, legally usable Arabic and Latin fonts.

Use different typographic treatments for:

- Arabic Quran text.
- Arabic headings.
- Arabic body text.
- Transliterations.
- English and French content.
- Numbers and dates.

Ensure Quranic text is rendered correctly, including diacritics and special symbols.

Do not use a normal UI font for Quranic text if it compromises the correct rendering.

## Layout

Every screen must have:

- Clear hierarchy.
- Excellent spacing.
- Consistent alignment.
- Comfortable reading widths.
- Consistent component behavior.
- Clear primary actions.
- Meaningful empty states.
- Useful loading states.
- Error states.
- Responsive layouts.

Do not overcrowd the home screen.

Do not put every feature on the dashboard.

Use progressive disclosure: show the most important information first and reveal advanced functionality when needed.

## Navigation

Create an intuitive navigation system that works for users of all ages.

Use a carefully designed bottom navigation structure.

Potential main sections:

1. Home.
2. Worship.
3. Quran.
4. Learn.
5. More.

The exact navigation structure may be improved based on usability, but the application must remain easy to understand.

Important features must never become difficult to find because the application has too many sections.

Use meaningful icons and labels.

Do not rely on icons alone for important actions.

---

# 4. ANIMATION AND MOTION DESIGN

I want SAKINA to have exceptionally beautiful animations.

This is a major design requirement.

However, animations must enhance the experience, never make the application slow or annoying.

Create a dedicated motion system.

Use suitable Expo-compatible animation technologies, preferably React Native Reanimated and other stable libraries where appropriate.

Animations should include:

- Elegant screen transitions.
- Smooth navigation transitions.
- Beautiful card entrance animations.
- Subtle staggered list animations.
- Sophisticated button interactions.
- Gentle press feedback.
- Smooth expandable sections.
- Animated progress indicators.
- Beautiful modal presentations.
- Animated loading states.
- Elegant bottom sheets.
- Smooth tab transitions.
- Subtle background movement where appropriate.
- Delightful completion animations.
- Beautiful Quran reading transitions.
- Smooth audio player interactions.
- Elegant download progress animations.

## Signature SAKINA experience

Design a distinctive experience that makes the application feel alive without being distracting.

Consider:

- A very subtle geometric background that responds gently to interaction.
- Beautiful transitions between spiritual sections.
- A sophisticated prayer-time countdown.
- A refined animated progress ring.
- A peaceful daily welcome experience.
- Elegant animated completion states for daily goals.

Do not animate everything.

Avoid excessive bouncing, spinning, flashing, or childish animations.

Respect the device's reduced-motion accessibility settings.

Animations must remain smooth on mid-range Android devices.

Avoid unnecessary re-renders and expensive blur effects.

Do not use animation as an excuse for poor usability.

---

# 5. MULTILINGUAL SUPPORT

SAKINA must support multiple languages from the beginning.

Arabic is the primary and default language.

Initially support:

1. Arabic — default.
2. English.
3. French.

Build the architecture so additional languages can be added easily.

## Arabic requirements

- Full RTL support.
- Correct text alignment.
- Correct navigation direction where appropriate.
- Correct icon orientation when necessary.
- Correct forms and input fields.
- Correct dates and number formatting.
- Proper Arabic typography.
- No mixed-direction layout bugs.
- No clipped Arabic text.
- Correct handling of Quranic text.

## English and French

Provide full LTR support.

The application must adapt its entire interface when the language changes.

Do not simply translate visible labels while leaving layouts in the wrong direction.

Persist the user's language selection locally.

Do not mix interface languages unintentionally.

Religious source text must be kept distinct from interface translations.

Prepare the architecture for additional languages.

Use structured translation files rather than hardcoded strings.

Never scatter Arabic, English, and French UI strings directly throughout components.

---

# 6. ONBOARDING AND PERSONALIZATION

Create a beautiful, minimal onboarding experience.

Do not overwhelm new users.

Ask only for information that genuinely improves the application.

Potential onboarding steps:

1. Welcome to SAKINA.
2. Choose the application language.
3. Choose a visual theme or system theme.
4. Configure location permissions for prayer times and Qibla.
5. Select a prayer calculation method.
6. Configure the Asr juristic method if relevant.
7. Select notification preferences.
8. Finish with a beautiful welcome screen.

Location must be optional.

If permission is denied, provide manual city selection and allow users to configure the application without location access.

Never force account creation.

Never require internet to complete onboarding.

Make settings editable later.

Use appropriate local defaults without making unsupported assumptions about the user's religious practices.

---

# 7. HOME DASHBOARD

The home screen should be beautiful, intelligent, and useful.

It should feel like a personal spiritual dashboard, not a list of shortcuts.

Include:

- A personalized greeting.
- Current date in Gregorian and Hijri calendars.
- Next prayer.
- Next prayer countdown.
- Today's prayer overview.
- A beautiful daily Quran section.
- Daily adhkar shortcut.
- Daily spiritual goal progress.
- Continue reading.
- Continue memorization.
- Recommended learning content.
- Important upcoming Islamic dates.
- Quick access to frequently used tools.

Use personalization based on local usage and preferences.

Do not make the dashboard excessively long.

Use clear visual prioritization.

Make the most important daily information immediately visible.

Create elegant empty states for new users.

---

# 8. WORSHIP AND PRAYER CENTER

Build a comprehensive prayer experience.

## Prayer times

Implement accurate local prayer calculations.

Support recognized calculation methods.

Allow configuration of:

- Calculation method.
- Asr juristic method.
- High-latitude adjustment where relevant.
- Manual adjustments.
- Location.
- Time format.

Display:

- Fajr.
- Sunrise.
- Dhuhr.
- Asr.
- Maghrib.
- Isha.

Show the next prayer prominently.

Create a sophisticated countdown.

Allow users to inspect the full daily schedule.

Do not invent prayer times.

Clearly distinguish calculated times from manually adjusted times.

## Notifications

Provide local notifications for:

- Prayer reminders.
- Optional Adhan notifications.
- Pre-prayer reminders.
- Daily adhkar.
- Sleep reminders.
- Quran reading goals.
- Custom reminders.

Allow users to configure each notification individually.

Explain notification permissions clearly.

Account for Android and iOS scheduling limitations.

Do not promise exact background execution where the operating system does not guarantee it.

Test notifications on real devices.

## Adhan library

Create a downloadable Adhan library.

Allow users to:

- Preview available sounds.
- Download an Adhan.
- Set a default Adhan.
- Assign different Adhans where supported.
- Delete downloaded sounds.

Never redistribute copyrighted audio without the necessary permission.

## Qibla

Create a beautiful Qibla experience.

Use device sensors appropriately.

Display compass direction and calibration instructions.

Handle unavailable or unreliable sensor readings gracefully.

## Additional prayer tools

Include:

- Travel prayer guidance.
- Friday prayer guidance.
- Eid prayer guidance.
- Sujud al-sahw educational guide.
- Prayer learning guides.
- Prayer tracking where appropriate.

Religious guidance must be properly sourced and reviewed.

---

# 9. THE HOLY QURAN

The Quran experience must be one of the strongest parts of SAKINA.

It deserves special attention.

## Quran reader

Implement:

- Complete Quran text.
- Correct Uthmani script where licensed and available.
- Surah navigation.
- Juz navigation.
- Hizb navigation where supported.
- Page navigation.
- Ayah navigation.
- Beautiful reading layouts.
- Bookmarking.
- Reading progress.
- Last-read position.
- Search.
- Font size controls.
- Reading appearance settings.
- Night reading mode.

Provide accurate Quran text from a trustworthy, verifiable source.

Do not generate Quranic text using an AI model.

Do not manually recreate Quranic content from memory.

Verify completeness and ordering.

## Tafsir and translations

Support optional content packages for:

- Tafsir.
- Quran translations.
- Word meanings.
- Asbab al-nuzul where reliable and available.
- Vocabulary.
- Additional scholarly resources.

Clearly identify each translation and tafsir source.

Do not present interpretations as Quranic text.

## Quran audio

Provide a high-quality audio experience.

Features:

- Multiple reciters.
- Surah downloads.
- Optional complete recitation downloads.
- Background playback where supported.
- Playback speed controls where supported.
- Repeat ayah.
- Repeat range.
- Playlist.
- Sleep timer.
- Playback progress.
- Lock-screen controls where supported.
- Download management.

Do not download the entire audio library automatically.

## Memorization

Build a useful memorization system.

Include:

- Memorization plans.
- Daily targets.
- Revision schedules.
- Memorized ayah tracking.
- Revision reminders.
- Personal progress.
- Revision sessions.
- Optional quizzes.
- Statistics.

The system should encourage consistency without guilt or pressure.

## Quran search

Implement local search where possible.

Support searching Arabic text and available translations.

Use SQLite FTS5 or an appropriate local indexing solution.

---

# 10. ADHKAR AND DUAS

Build a comprehensive, carefully organized collection.

Categories may include:

- Morning adhkar.
- Evening adhkar.
- Sleep.
- Waking up.
- After prayer.
- Entering and leaving the home.
- Eating and drinking.
- Travel.
- Illness.
- Anxiety and distress.
- Repentance.
- Parents.
- Children.
- Rain.
- Istikhara.
- Ruqyah.
- Other authentic daily supplications.

Each entry should support:

- Arabic text.
- Diacritics where available.
- Translation.
- Source.
- Hadith reference.
- Authenticity grading where applicable.
- Repetition count where established.
- Personal favorites.
- Completion tracking.
- Optional audio.
- Sharing with attribution and source.

Provide a beautiful reading experience.

Create a refined counter interface.

Do not invent adhkar, hadith references, repetition counts, or authenticity grades.

Do not label a supplication authentic without evidence.

If a source or grading cannot be verified, disclose that limitation instead of fabricating it.

---

# 11. ISLAMIC KNOWLEDGE LIBRARY

Create a structured Islamic knowledge library.

Potential categories:

- Aqeedah.
- Fiqh.
- Hadith.
- Tafsir.
- Seerah.
- Stories of the Prophets.
- Companions.
- Islamic history.
- Islamic manners.
- Family and relationships.
- Worship.
- Transactions.
- Islamic terminology.

Organize information into readable articles and books.

Support:

- Local search.
- Categories.
- Bookmarks.
- Reading progress.
- Notes.
- Reading history.
- Downloadable content packages.

Do not invent scholarly statements or references.

Clearly distinguish between established religious sources, scholarly opinions, and educational summaries.

When a matter has recognized differences of opinion, avoid presenting one position as universally agreed upon.

---

# 12. ISLAMIC LEARNING ACADEMY

Build a beautiful educational section.

It should feel like a premium learning application.

Potential learning paths:

- Learn how to pray.
- Learn Wudu.
- Learn basic Aqeedah.
- Learn Quran reading.
- Learn Tajweed.
- Learn the Seerah.
- Learn daily Sunnah.
- Learn essential Islamic knowledge.
- Learn how to perform Hajj and Umrah.

Each course can contain:

- Lessons.
- Written content.
- Audio.
- Optional videos.
- Illustrations.
- Quizzes.
- Flashcards.
- Progress tracking.
- Completion milestones.

Use downloadable course packages.

Build a local learning progress system.

Make learning approachable for beginners.

Use short lessons and clear language.

Do not make the learning experience feel like a school examination.

---

# 13. DAILY MUSLIM LIFE GUIDES

Create a section that helps users understand what to do in real-life situations.

Examples:

- When traveling.
- When sick.
- When experiencing anxiety.
- When someone dies.
- When welcoming a newborn.
- During marriage.
- When dealing with financial obligations.
- When facing hardship.
- When seeking repentance.
- When managing family responsibilities.
- When preparing for Ramadan.

Each guide should contain:

- A simple introduction.
- Practical steps.
- Relevant authentic supplications.
- Relevant Quranic verses and hadith references.
- Additional reading.
- Clear source attribution.

Avoid unsupported religious rulings.

For complex personal religious matters, encourage consulting a qualified scholar.

---

# 14. ISLAMIC CALENDAR

Implement a comprehensive Islamic calendar.

Include:

- Hijri date.
- Gregorian date.
- Month navigation.
- Important Islamic dates.
- Ramadan.
- The last ten nights.
- Eid al-Fitr.
- Eid al-Adha.
- Day of Arafah.
- Ashura.
- The white days.
- Mondays and Thursdays.
- Other relevant occasions.

Support configurable Hijri date adjustments.

Explain that Hijri dates can vary depending on local moon sighting and accepted calendar conventions.

Provide manual correction.

Include optional fasting tracking:

- Voluntary fasting.
- Ramadan fasting.
- Missed fasting days.
- Personal notes.

Do not assume that a calculated Hijri date is universally authoritative.

---

# 15. ZAKAT AND ISLAMIC FINANCIAL TOOLS

Create useful local calculators.

Potential tools:

- Zakat on money.
- Zakat on gold.
- Zakat on silver.
- Zakat on trade goods.
- Nisab calculation.
- Hawl tracking.
- Debt considerations.
- Personal charity tracking.

Make calculation assumptions transparent.

Never silently make complex jurisprudential assumptions.

Where scholarly differences exist, explain the selected methodology.

Provide educational explanations and source references.

Any inheritance calculator must clearly disclose its limitations and must not present itself as a substitute for qualified legal and religious advice.

All calculations must be tested against independently verified examples.

---

# 16. HAJJ AND UMRAH CENTER

Create a comprehensive offline-friendly Hajj and Umrah guide.

Include:

- Preparation.
- Ihram.
- Miqat.
- Tawaf.
- Sa'i.
- Arafah.
- Muzdalifah.
- Mina.
- Stoning.
- Sacrifice guidance.
- Completion.
- Common mistakes.
- Supplications with sources.

Create a step-by-step guided journey.

Provide local progress tracking.

Include counters for Tawaf and Sa'i.

Optional maps may be downloaded in advance where technically and legally possible.

Never depend on live maps for the essential guide.

---

# 17. CHILDREN AND FAMILY

Create an optional family-friendly learning area.

Potential content:

- Stories of Prophets.
- Stories of Companions.
- Basic Islamic education.
- Learning Wudu.
- Learning prayer.
- Short surahs.
- Daily duas.
- Islamic manners.
- Quizzes.
- Flashcards.
- Simple learning games.

Use age-appropriate presentation.

Do not collect children's personal information.

Do not add advertisements or tracking.

Use a clear distinction between child-friendly content and general content.

---

# 18. PERSONAL SPIRITUAL JOURNEY

Create a personal area that helps users build consistent habits.

Possible tools:

- Daily goals.
- Quran reading goals.
- Memorization goals.
- Adhkar goals.
- Prayer tracking.
- Fasting tracking.
- Learning goals.
- Personal reflections.
- Private notes.
- Bookmarks.
- Progress history.

The experience must be encouraging, not judgmental.

Avoid guilt-based messages.

Do not turn worship into a competitive game.

Use thoughtful progress visualization.

All information stays on the device.

---

# 19. CONTENT LIBRARY AND DOWNLOAD MANAGER

This is a critical architectural component.

Because SAKINA must work offline without a custom server, build a professional download-management system.

Create a dedicated section called:

"My Library" / "مكتبتي"

It should manage:

- Quran recitations.
- Adhan sounds.
- Adhkar audio.
- Islamic books.
- Tafsir packages.
- Translation packages.
- Courses.
- Lessons.
- Videos.
- Optional maps.
- Other downloadable content.

For each package display:

- Name.
- Description.
- Language.
- Size.
- Download status.
- Progress.
- Local availability.
- Version.
- Source.
- License information where applicable.

Support:

- Download.
- Pause where supported.
- Resume where supported.
- Retry.
- Cancel.
- Delete.
- Download over Wi-Fi only.
- Storage usage.
- Free-space awareness.
- Integrity verification.
- Safe handling of interrupted downloads.

Use SHA-256 checksums when available.

Do not trust a download simply because the URL returned a successful response.

Prevent corrupted or incomplete files from being treated as valid content.

Build a clear package manifest format.

Use a static, versioned content catalogue hosted on a suitable static hosting provider or a properly licensed public distribution source.

A static catalogue is acceptable; a custom backend is not.

The app must continue working if the catalogue is temporarily unavailable.

Never hardcode fragile third-party download URLs throughout the application.

Centralize content sources and package metadata.

Do not automatically download huge files.

Let users choose what they want.

---

# 20. SEARCH ENGINE

Build a unified local search experience.

Users should be able to search:

- Quran.
- Adhkar.
- Duas.
- Books.
- Lessons.
- Articles.
- Islamic terminology.
- Downloaded content.

Search must be fast and work offline.

Support Arabic search normalization carefully.

Consider:

- Diacritics.
- Alef variations.
- Common Arabic orthographic variations.
- Arabic and Latin queries where appropriate.

Do not destroy the original displayed text during normalization.

Use a suitable local indexing strategy.

Display search results with clear categories and source attribution.

---

# 21. ADDITIONAL UTILITIES

Create a coherent utilities area.

Potential tools:

- Digital Tasbih.
- Asma Allah al-Husna.
- Personal notes.
- Quran bookmarks.
- Prayer direction.
- Islamic date conversion.
- Zakat calculator.
- Fasting tracker.
- Quran reading planner.
- Memorization planner.
- Hajj and Umrah counters.
- Personal worship reminders.

Do not add features merely to increase the number of screens.

Every tool must have a clear user benefit.

---

# 22. CONTENT INTEGRITY, ISLAMIC SOURCES AND LICENSING

This is extremely important.

SAKINA is a religious application.

Incorrect Quranic text, fabricated hadith, incorrect religious references, and misleading rulings are unacceptable.

Never use AI-generated religious content as an authoritative source.

Use verified and appropriately licensed sources.

Before integrating content, document:

- Content name.
- Original source.
- Author or institution.
- License.
- Attribution requirements.
- Language.
- Version.
- Verification status.

Do not scrape copyrighted books, audio, videos, translations, or tafsir without permission.

Do not assume that publicly accessible content is free to redistribute.

Do not fabricate references or authenticity grades.

Create a content validation pipeline.

Validate Quran completeness, surah ordering, ayah counts, and text integrity using trusted source data.

Include a clear About and Sources section.

Where content has not yet been verified, label it as unavailable or awaiting verification rather than inventing content.

Religious review is necessary before public release.

---

# 23. DATA ARCHITECTURE

Design a maintainable local data model.

Potential entities include:

- Surahs.
- Ayahs.
- Translations.
- Tafsir sources.
- Reciters.
- Audio tracks.
- Adhkar.
- Duas.
- Hadith references.
- Books.
- Book sections.
- Courses.
- Lessons.
- Quiz questions.
- Downloads.
- Content packages.
- Bookmarks.
- Reading progress.
- Memorization progress.
- Prayer settings.
- Prayer logs.
- Fasting logs.
- Personal notes.
- User goals.
- App settings.

This is a conceptual list, not an instruction to create unnecessary tables.

Design the actual schema based on real data requirements.

Use:

- Database migrations.
- Foreign keys.
- Appropriate indexes.
- Transactions.
- Repository or data-access layers.
- Strong TypeScript types.
- Data validation.
- Safe initialization.
- Database versioning.

Consider separate bundled read-only content databases and writable user databases when that improves performance and maintainability.

Avoid one enormous, unstructured JSON file.

Do not load the entire Quran, all books, or every content package into memory.

Use pagination and efficient queries.

---

# 24. APPLICATION ARCHITECTURE

Use a modular feature-based architecture.

A suggested starting point:

app/
  (tabs)/
  onboarding/
  prayer/
  quran/
  adhkar/
  library/
  downloads/
  learning/
  calendar/
  zakat/
  hajj/
  family/
  settings/

src/
  components/
  design-system/
  features/
  database/
    migrations/
    repositories/
    seeds/
  services/
    prayer/
    qibla/
    audio/
    downloads/
    notifications/
    search/
  content/
  hooks/
  localization/
  theme/
  constants/
  types/
  utils/

assets/
  fonts/
  icons/
  images/

scripts/
  content-import/
  content-validation/
  database-build/

Adjust this structure when necessary.

Keep UI components separate from business logic.

Use reusable, well-designed components.

Avoid giant components and duplicated code.

Use clear naming conventions.

Keep feature modules independent where possible.

Document important architectural decisions.

---

# 25. PERFORMANCE AND DEVICE COMPATIBILITY

The application must perform well on real devices, including mid-range Android phones.

Optimize:

- Initial launch.
- Navigation.
- Lists.
- Quran reading.
- Search.
- Audio playback.
- Downloads.
- SQLite queries.
- Memory consumption.
- Animations.
- Image loading.

Avoid:

- Unnecessary rendering.
- Large synchronous operations on the UI thread.
- Huge bundled assets.
- Excessive animation effects.
- Memory-heavy content loading.
- Unbounded lists.

Use virtualized lists.

Use pagination where appropriate.

Lazy-load large content.

Optimize fonts and assets.

Provide appropriate loading states.

Test both Android and iOS behavior.

Do not claim support for a device feature until it has been tested.

---

# 26. ACCESSIBILITY AND USABILITY

SAKINA must be usable by:

- Beginners.
- Older users.
- Children where appropriate.
- Users with limited technical experience.
- Users who prefer Arabic.
- Users who prefer English or French.
- Users with visual or motor accessibility needs.

Implement:

- Readable font sizes.
- Sufficient contrast.
- Accessible labels.
- Appropriate touch targets.
- Screen-reader support.
- Clear feedback.
- Simple navigation.
- Consistent controls.
- Reduced-motion support.

Do not make essential information dependent only on color or animation.

Provide simple explanations for religious and technical terminology.

---

# 27. SETTINGS AND PERSONALIZATION

Create a premium settings experience.

Include:

- Language.
- Theme.
- Font settings.
- Prayer calculation method.
- Asr method.
- Location.
- Notifications.
- Adhan preferences.
- Quran reading preferences.
- Audio preferences.
- Download preferences.
- Storage management.
- Privacy.
- Data export/import.
- About SAKINA.
- Content sources.
- App version.

Make settings easy to understand.

Avoid exposing technical options to ordinary users unless necessary.

---

# 28. PRIVACY AND SECURITY

Privacy is a fundamental product principle.

No user accounts are required.

No personal data should be transmitted to a private server.

Use secure local storage for sensitive settings where appropriate.

Validate imported files.

Protect database integrity.

Handle file access safely.

Do not expose internal filesystem paths unnecessarily.

Do not store secrets in source code.

Provide a clear privacy explanation.

Build a local data deletion feature that explains what will be deleted.

Ensure export and import operations are safe and validated.

---

# 29. TESTING — EXTREMELY IMPORTANT

Do not consider the project complete merely because it builds.

I want comprehensive testing.

Create a real testing strategy and execute it.

## A. Static quality checks

Run:

- TypeScript type checking.
- ESLint.
- Formatting checks.
- Dependency checks.
- Production bundling checks.

Resolve all critical errors.

Do not silence errors using broad `any` types or arbitrary lint suppressions.

## B. Unit tests

Test critical business logic:

- Prayer calculations.
- Date conversion.
- Hijri adjustment.
- Arabic normalization.
- Search.
- Download state transitions.
- Checksum verification.
- Progress tracking.
- Quran navigation.
- Counters.
- Zakat calculations.
- Data validation.
- Database repositories.

Use known test vectors and independently verified expected results.

## C. Integration tests

Test:

- Database initialization.
- Database migrations.
- Database persistence.
- Reading progress.
- Bookmarks.
- Settings persistence.
- Download management.
- File deletion.
- Audio state.
- Offline behavior.
- Content package installation.
- Import/export.

## D. UI and end-to-end tests

Use an appropriate Expo-compatible testing strategy.

Test complete user journeys:

1. First installation.
2. First launch.
3. Arabic onboarding.
4. Switching to English.
5. Switching to French.
6. RTL and LTR behavior.
7. Changing themes.
8. Configuring location.
9. Denying location permission.
10. Prayer time configuration.
11. Navigating all main sections.
12. Reading the Quran.
13. Bookmarking an ayah.
14. Continuing from the last-read position.
15. Searching Quran text.
16. Completing adhkar.
17. Playing available audio.
18. Downloading a package.
19. Interrupting a download.
20. Resuming a download.
21. Deleting a package.
22. Using the app offline.
23. Reopening the app and checking persistence.
24. Changing notification settings.
25. Using the app with large text.
26. Testing empty states.
27. Testing error states.
28. Exporting and restoring local data.

Test important flows on both Android and iOS where available.

## E. Offline tests

This is mandatory.

Test the application with:

- Wi-Fi disabled.
- Mobile data disabled.
- No initial network connection.
- Network interrupted during a download.
- Unavailable content catalogue.
- Missing optional media.
- Reopening the application offline.

Verify that essential functionality continues to work.

## F. Visual QA

Inspect actual rendered screens, not only source code.

Check:

- Arabic typography.
- RTL layout.
- English layout.
- French layout.
- Light theme.
- Dark theme.
- Small screens.
- Large screens.
- Long text.
- Empty states.
- Modal positioning.
- Bottom navigation.
- Animation smoothness.
- Touch targets.
- Scroll behavior.
- Text clipping.
- Visual consistency.

Take screenshots of major screens and review them.

Do not claim visual testing was performed if you only inspected the source code.

## G. Performance testing

Measure:

- App launch.
- Navigation responsiveness.
- Quran scrolling.
- Search latency.
- Database performance.
- Memory usage where tooling allows.
- Download behavior.
- Animation performance.

Fix measurable bottlenecks.

## H. Final quality report

At the end, provide a clear report containing:

- Implemented features.
- Incomplete features.
- Unit test results.
- Integration test results.
- E2E test results.
- Static checks.
- Build results.
- Visual QA results.
- Performance observations.
- Known limitations.
- Licensing and content issues.
- Recommended next steps.

Never claim that a test passed if it was not actually executed.

Never fabricate test results.

---

# 30. EXECUTION STRATEGY

Do not attempt to create the entire application as one giant, unstructured implementation.

Work in well-defined phases.

However, do not stop after producing a plan.

You must execute the phases and create working code.

## Phase 0 — Inspect and plan

First inspect the existing workspace.

Determine:

- Whether an Expo project already exists.
- Current dependencies.
- Existing architecture.
- Existing screens.
- Existing tests.
- Existing assets.
- Existing project constraints.

Preserve valuable existing work.

Do not overwrite files blindly.

Create:

- PRODUCT_SPEC.md
- ARCHITECTURE.md
- DESIGN_SYSTEM.md
- CONTENT_POLICY.md
- TEST_STRATEGY.md
- IMPLEMENTATION_ROADMAP.md

Record important technical decisions.

Identify unavailable licensed content and external resources.

## Phase 1 — Foundation and design system

Build:

- Expo foundation.
- TypeScript configuration.
- Routing.
- Theme system.
- Arabic-first localization.
- RTL/LTR infrastructure.
- Typography.
- Colors.
- Spacing.
- Design tokens.
- Reusable components.
- Animation infrastructure.
- Database foundation.

Deliver a polished application shell.

## Phase 2 — Core daily experience

Implement:

- Onboarding.
- Home dashboard.
- Prayer times.
- Qibla.
- Adhkar.
- Notifications.
- Settings.

Ensure these work offline.

## Phase 3 — Quran

Implement:

- Quran reader.
- Quran navigation.
- Bookmarks.
- Reading progress.
- Search.
- Audio architecture.
- Memorization tracking.

Use verified Quran data.

## Phase 4 — Knowledge and learning

Implement:

- Islamic library.
- Learning academy.
- Daily life guides.
- Downloadable learning packages.

## Phase 5 — Additional Islamic tools

Implement:

- Calendar.
- Fasting tracker.
- Zakat.
- Hajj and Umrah.
- Children and family.
- Personal spiritual journey.
- Additional utilities.

## Phase 6 — Downloads and content infrastructure

Implement:

- Content manifests.
- Package validation.
- Download manager.
- File integrity.
- Storage management.
- Offline content installation.
- Versioning.

## Phase 7 — Quality and release preparation

Execute the full testing plan.

Fix bugs.

Polish the UI.

Check performance.

Verify Android and iOS builds.

Prepare release documentation.

---

# 31. IMPORTANT DEVELOPMENT RULES

Follow these rules throughout the project.

1. Do not build a fake prototype with nonfunctional buttons.
2. Do not leave important screens as placeholders.
3. Do not invent religious data.
4. Do not use fake prayer times.
5. Do not use random Quran text.
6. Do not use fabricated audio download links.
7. Do not introduce a backend.
8. Do not introduce paid services without approval.
9. Do not require registration.
10. Do not sacrifice usability for visual effects.
11. Do not sacrifice performance for animation.
12. Do not use generic UI templates.
13. Do not create inconsistent components.
14. Do not duplicate business logic.
15. Do not ignore Arabic RTL.
16. Do not ignore iOS limitations.
17. Do not claim that something works without testing it.
18. Do not stop when the application merely compiles.
19. Do not hide unfinished features behind misleading UI.
20. Do not remove existing functionality without a good reason.

When a feature depends on unavailable content, implement its architecture and UI correctly, and clearly mark the content as unavailable until a verified source is integrated.

When a technical limitation prevents a requested behavior, explain the limitation and implement the best honest alternative.

If a decision is not specified, choose the most maintainable, user-friendly, privacy-preserving solution.

Avoid asking me dozens of small questions. Use professional judgment and document assumptions.

If a genuinely critical decision requires my approval, ask one focused question rather than making an irreversible assumption.

---

# 32. DEFINITION OF DONE

SAKINA is not finished simply because the main screens exist.

A feature is complete only when:

- It has a polished UI.
- It works.
- It handles errors.
- It works offline when required.
- It persists relevant data.
- It supports Arabic, English, and French.
- It respects RTL/LTR.
- It has been tested.
- It does not break other functionality.
- It has appropriate accessibility.
- It has no fabricated religious content.
- Its limitations are documented.

The overall application must have:

- A coherent visual identity.
- A complete design system.
- Reliable navigation.
- A stable local database.
- A working offline architecture.
- A proper content download system.
- Beautiful and restrained animations.
- Complete multilingual infrastructure.
- Strong error handling.
- Meaningful automated tests.
- Successful production builds where the environment permits.

---

# 33. YOUR FIRST ACTION

Start by inspecting the project and understanding the current workspace.

Then create the product and technical documentation.

After that, begin implementation.

Do not respond with only a proposal or a list of recommendations.

I expect you to work directly on the codebase, create the actual application, run commands, install compatible dependencies, implement features, test them, inspect the UI, fix problems, and improve the result.

Work iteratively.

At the end of each phase:

- Summarize what was implemented.
- List files and modules created or changed.
- Report actual tests executed.
- Identify any remaining limitations.
- Continue to the next phase without waiting for my approval unless a genuinely critical decision requires it.

If the context window becomes insufficient, create or update a detailed HANDOFF.md file containing the exact implementation status, architecture, decisions, unfinished work, and next steps. This must allow another Claude session to continue without losing context.

Do not pretend that a massive application can be completed perfectly in one session. Prioritize correctness, complete vertical features, and continuous quality improvement.

The goal is not to produce the largest application possible.

The goal is to produce the best possible SAKINA experience: a beautiful, reliable, peaceful, accessible, offline-first Islamic companion that users genuinely love using.

**Build SAKINA with the quality, care, and engineering discipline expected from a world-class product team.**