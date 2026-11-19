#!/usr/bin/env node
/**
 * Generates every brand image from one emblem: the eight-point star (two overlapping squares, the shape of the
 * rubʿ al-ḥizb marker) in SAKINA's palette. Output is rendered with the system Chrome that Playwright already uses.
 *
 *   node scripts/branding/build-icons.mjs
 *
 * Files: icon, iOS dark/tinted variants, Android adaptive layers (+ monochrome), splash (light/dark),
 * favicon and the Android notification (status-bar) icon.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (f) => resolve(root, 'assets', f);

const C = { green1: '#14795F', green2: '#0B4636', green3: '#072F25', gold1: '#F3D58F', gold2: '#CF9D45', gold3: '#9A6B2F', cream: '#F6F2EA', navy: '#0A1020' };

/** Two overlapping squares = eight-point star. `rx` softens the points slightly (reads better at small sizes). */
const star = (cx, cy, s, fill, rx = 0.05) =>
  `<g fill="${fill}"><rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${s * rx}"/><rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${s * rx}" transform="rotate(45 ${cx} ${cy})"/></g>`;

const defs = `
<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="${C.green1}"/><stop offset=".62" stop-color="${C.green2}"/><stop offset="1" stop-color="${C.green3}"/></radialGradient>
  <radialGradient id="bgDark" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="#16213D"/><stop offset=".7" stop-color="#0C1428"/><stop offset="1" stop-color="#070B17"/></radialGradient>
  <linearGradient id="gold" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0" stop-color="${C.gold1}"/><stop offset=".5" stop-color="${C.gold2}"/><stop offset="1" stop-color="${C.gold3}"/></linearGradient>
</defs>`;

/** Layered emblem: gold star, deep-green star cut, gold core star, centre dot. */
function emblem({ cx, cy, s, outer = 'url(#gold)', cut = C.green2, core = 'url(#gold)', dot = C.green2 }) {
  return (
    star(cx, cy, s, outer) + star(cx, cy, s * 0.66, cut) + star(cx, cy, s * 0.34, core, 0.06) + `<circle cx="${cx}" cy="${cy}" r="${s * 0.04}" fill="${dot}"/>`
  );
}

/** Same emblem as a single-colour silhouette: the cut becomes transparent (mask) — for monochrome / notification icons. */
function mono({ cx, cy, s, color, id }) {
  return `<mask id="${id}"><rect width="100%" height="100%" fill="white"/>${star(cx, cy, s * 0.66, 'black')}${star(cx, cy, s * 0.34, 'white', 0.06)}</mask><g mask="url(#${id})">${star(cx, cy, s, color)}</g>`;
}

const rings = (size, stroke, opacity) =>
  [0.46, 0.39]
    .map(
      (k) =>
        `<circle cx="${size / 2}" cy="${size / 2}" r="${size * k}" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${size * 0.004}"/>`,
    )
    .join('');

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}${body}</svg>`;

const ASSETS = {
  // iOS / store icon: full-bleed square, no transparency, no rounded corners (the OS masks it).
  'icon.png': {
    size: 1024,
    opaque: true,
    svg: svg(1024, `<rect width="1024" height="1024" fill="url(#bg)"/>${rings(1024, C.gold2, 0.22)}${emblem({ cx: 512, cy: 512, s: 500 })}`),
  },
  'ios-icon-dark.png': {
    size: 1024,
    opaque: true,
    svg: svg(
      1024,
      `<rect width="1024" height="1024" fill="url(#bgDark)"/>${rings(1024, C.gold2, 0.16)}${emblem({ cx: 512, cy: 512, s: 500, cut: '#0C1428', dot: '#0C1428' })}`,
    ),
  },
  // Tinted: the OS colours a greyscale image — keep strong luminance contrast.
  'ios-icon-tinted.png': {
    size: 1024,
    opaque: true,
    svg: svg(
      1024,
      `<rect width="1024" height="1024" fill="#000"/>${emblem({ cx: 512, cy: 512, s: 500, outer: '#E8E8E8', cut: '#000', core: '#E8E8E8', dot: '#000' })}`,
    ),
  },
  // Android adaptive icon: 66 % safe zone → the star's circumscribed circle stays inside radius 0.33 × size.
  'android-icon-background.png': { size: 512, opaque: true, svg: svg(512, `<rect width="512" height="512" fill="url(#bg)"/>${rings(512, C.gold2, 0.2)}`) },
  'android-icon-foreground.png': { size: 512, svg: svg(512, emblem({ cx: 256, cy: 256, s: 236 })) },
  'android-icon-monochrome.png': { size: 432, svg: svg(432, mono({ cx: 216, cy: 216, s: 200, color: '#000', id: 'm1' })) },
  // Splash: shown on cream (light) and navy (dark) at 120 pt wide.
  'splash-icon.png': { size: 1024, svg: svg(1024, emblem({ cx: 512, cy: 512, s: 760, outer: C.green1, cut: C.cream, core: 'url(#gold)', dot: C.cream })) },
  'splash-icon-dark.png': { size: 1024, svg: svg(1024, emblem({ cx: 512, cy: 512, s: 760, outer: 'url(#gold)', cut: C.navy, core: C.green1, dot: C.navy })) },
  'favicon.png': { size: 48, opaque: true, svg: svg(48, `<rect width="48" height="48" rx="10" fill="url(#bg)"/>${emblem({ cx: 24, cy: 24, s: 30 })}`) },
  // Android status-bar icon: white silhouette on transparent; the OS tints it.
  'notification-icon.png': { size: 96, svg: svg(96, mono({ cx: 48, cy: 48, s: 78, color: '#fff', id: 'm2' })) },
};

mkdirSync(out('.'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
for (const [file, a] of Object.entries(ASSETS)) {
  const page = await browser.newPage({ viewport: { width: a.size, height: a.size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${a.svg}</body></html>`);
  await page.screenshot({ path: out(file), omitBackground: !a.opaque, clip: { x: 0, y: 0, width: a.size, height: a.size } });
  await page.close();
  console.log(`✓ assets/${file} (${a.size}×${a.size})`);
}
await browser.close();
