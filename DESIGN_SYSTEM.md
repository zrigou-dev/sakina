# SAKINA — Design System

## 1. Concept: *"Courtyard at dusk"*

The interface is a quiet courtyard: warm ivory stone in daylight, deep midnight under the stars. Colour is restrained; geometry is present but whispered (a single eight-fold *khatam* lattice drawn at ≤ 6 % opacity). Emerald signals *action and life*, muted gold signals *the sacred and the time-bound* (the next prayer, the current ayah, completion). Everything else is neutral.

## 2. Colour tokens

Defined in `src/design-system/tokens.ts`. Components consume **semantic** tokens only.

| Semantic token | Light ("Ivory") | Dark ("Midnight") | Use |
|---|---|---|---|
| `bg` | `#F6F2EA` warm ivory | `#0A1020` midnight | screen background |
| `bgElevated` | `#FBF8F2` | `#0F1729` | sheets, tab bar |
| `surface` | `#FFFFFF` | `#141D31` | cards |
| `surfaceMuted` | `#EFE8DA` soft sand | `#1A2439` | inputs, chips, secondary cards |
| `border` | `#E3DACA` | `#243049` | hairlines |
| `text` | `#1C2420` | `#EEE9DE` | primary text |
| `textMuted` | `#5D665F` | `#A4ABB8` | secondary |
| `textFaint` | `#8C918A` | `#6E7689` | captions |
| `primary` | `#0E5A45` deep emerald | `#4FB894` luminous emerald | primary actions |
| `primaryInk` | `#FFFFFF` | `#06140F` | text on primary |
| `primarySoft` | `#DCEDE5` | `#15322C` | selected chips |
| `accent` | `#A8844C` muted gold | `#D2B278` | sacred/time highlights |
| `accentSoft` | `#F2E7D3` | `#2E2817` | highlight backgrounds |
| `danger` / `warning` / `success` | `#B4443A` / `#B37A1E` / `#2F7D5B` | `#E4867C` / `#E0B25F` / `#6CCB9F` | states (always paired with icon/text) |

Dark mode is a **separate palette**, not an inversion: midnight-blue base (never pure black), emerald brightened for contrast, gold warmed, surfaces stepped by luminance not by shadow. All text/background pairs meet **WCAG AA** (4.5:1 body, 3:1 large); verified by `tests/unit/contrast.test.ts`.

## 3. Typography

| Role | Arabic | Latin | Notes |
|---|---|---|---|
| Quran text | **Amiri Quran** (OFL) | — | Designed for Quranic orthography: correct rendering of Uthmani marks, small high letters, ayah-end glyph. Line height ≥ 2.0 |
| Display / headings | **Amiri** Bold (OFL) | **Fraunces** SemiBold (OFL) | Editorial serif voice |
| UI / body | **IBM Plex Sans Arabic** (OFL) | **IBM Plex Sans** (OFL) | Same superfamily → visual harmony across scripts |
| Transliteration | — | IBM Plex Sans *Italic* | |
| Numbers & times | Plex, `tabular-nums` | Plex, `tabular-nums` | Countdown never jitters |

Scale (pt): `caption 12 · footnote 13 · body 16 · callout 17 · title3 20 · title2 24 · title1 30 · display 40`. Arabic sizes get +1–2 pt and +25 % line height (`typography.ts`). User font scale (Settings) multiplies the whole scale; the Quran has an independent size control.

## 4. Space, shape, elevation

- **Spacing** 4-pt grid: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`. Screen gutter 20.
- **Radius**: `sm 10 · md 16 · lg 22 · xl 28 · pill 999`. Cards use `lg`; sheets `xl`.
- **Elevation**: light mode uses one soft, warm shadow (`#4A3B1F` @ 8 %); dark mode uses *no shadows*, only luminance steps + 1 px border.
- **Touch targets** ≥ 44 × 44 pt everywhere (`hitSlop` where visuals are smaller).
- Reading width capped at 680 pt on tablets.

## 5. Iconography

Lucide (ISC) line icons, 1.75 px stroke, 22 pt default. Directional icons (chevrons, arrows, back) mirror in RTL via `<Icon mirrored>`. Icons never stand alone for important actions — they carry a label or accessible name.

## 6. Motion system (`src/design-system/motion.ts`)

| Token | Value | Use |
|---|---|---|
| `duration.instant` | 120 ms | press feedback |
| `duration.quick` | 220 ms | toggles, chips |
| `duration.base` | 320 ms | card entrances, sheets |
| `duration.slow` | 600 ms | progress rings, completion |
| `duration.ambient` | 24 s | background lattice drift |
| `easing.standard` | cubic-bezier(0.2, 0, 0, 1) | most transitions |
| `easing.emphasized` | cubic-bezier(0.3, 0, 0, 1.0) | entrances |
| `spring.gentle` | damping 18, stiffness 180 | press scale, counters (no visible bounce) |

Signature moments:
1. **Dawn greeting** — on Home, the header gradient and greeting fade-rise in sequence (stagger 60 ms).
2. **Prayer arc** — the next-prayer card draws a thin gold arc showing elapsed time between prayers; the countdown digits cross-fade.
3. **Breathing lattice** — the khatam pattern drifts imperceptibly (translate ≤ 6 px over 24 s); pauses when reduced-motion is on.
4. **Completion bloom** — when a dhikr target or daily goal completes, an eight-point star scales from 0.6→1 with opacity, plus a light haptic.

Rules: animate `transform` and `opacity` only on the UI thread (Reanimated); no blur; no infinite animations except the ambient lattice; every animation checks `useReducedMotion()` and collapses to an instant state change.

## 7. Components (`src/design-system/components`)

`Screen` · `Header` · `Text` (role-based, direction-aware) · `Card` · `PressableScale` · `Button` (primary / secondary / ghost / danger) · `IconButton` · `Chip` · `SegmentedControl` · `ListRow` · `Switch` · `ProgressRing` · `ProgressBar` · `Sheet` · `EmptyState` · `ErrorState` · `Skeleton` · `Badge` · `SectionHeader` · `GeometricBackdrop` · `Divider` · `Stepper` · `TextField` · `Toast`.

Every component: semantic tokens only; RTL-safe (`start`/`end`, never `left`/`right`); `accessibilityRole` + label; respects font scale.

## 8. Voice

Calm, warm, concise. Arabic copy written natively (not translated word-for-word). Never guilt: "Pick up where you left off" — never "You missed 3 days".

## Brand assets

One emblem — the eight-point star (two overlapping squares, the shape of the rubʿ al-ḥizb marker) — layered as gold star / deep-green cut / gold core / centre dot, on the app's greens (`#14795F → #0B4636 → #072F25`), gold (`#F3D58F → #CF9D45 → #9A6B2F`), cream `#F6F2EA` and navy `#0A1020`.

`npm run branding:build` regenerates everything in `assets/` from `scripts/branding/build-icons.mjs` (SVG rendered with the system Chrome): `icon.png` (+ `ios-icon-dark.png`, `ios-icon-tinted.png`), Android adaptive `android-icon-background/foreground/monochrome.png` (star kept inside the 66 % safe zone), `splash-icon.png` / `splash-icon-dark.png`, `favicon.png`, and `notification-icon.png` (white silhouette for the Android status bar). Never hand-edit the PNGs; change the script.
