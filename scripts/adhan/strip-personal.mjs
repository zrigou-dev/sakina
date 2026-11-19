#!/usr/bin/env node
/**
 * Prepares a PUBLIC build: turns the personal-use adhan catalogue off (app.json) and empties its generated file, so no
 * recording with unverified rights is listed, downloadable or bundled. Re-run `node scripts/adhan/build-personal.mjs`
 * and set `extra.personalAdhanLibrary` back to true to restore it on your own phone.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const p = (...s) => resolve(root, ...s);

const app = JSON.parse(readFileSync(p('app.json'), 'utf8'));
app.expo.extra = { ...(app.expo.extra ?? {}), personalAdhanLibrary: false };
writeFileSync(p('app.json'), JSON.stringify(app, null, 2) + '\n');

const empty = JSON.stringify({
  schemaVersion: 2,
  tier: 'personal',
  generatedAt: new Date().toISOString().slice(0, 10),
  source: { repo: '', commit: '' },
  voices: [],
});
writeFileSync(p('src/content/adhan/personal.generated.json'), empty);
writeFileSync(
  p('content/adhan/PERSONAL_SOURCES.lock.json'),
  JSON.stringify(
    { repo: '', commit: '', licence: 'EMPTY — stripped for a public build', voices: 0, catalogueSha256: createHash('sha256').update(empty).digest('hex') },
    null,
    2,
  ) + '\n',
);
console.log(
  '✓ personal-use adhan catalogue disabled and emptied. Rebuild it with: node scripts/adhan/build-personal.mjs (then set extra.personalAdhanLibrary=true).',
);
