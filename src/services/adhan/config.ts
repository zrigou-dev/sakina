import Constants from 'expo-constants';

/**
 * Optional mirror of the mastered adhan library (the output of `scripts/adhan/build-library.mjs`).
 * Set `expo.extra.adhanLibraryUrl` in app.json (https, no trailing slash needed). When unset the app uses the
 * catalogue shipped inside it and downloads straight from the pinned Wikimedia Commons files.
 */
export function adhanLibraryBaseUrl(): string | null {
  const raw = (Constants.expoConfig?.extra as { adhanLibraryUrl?: unknown } | undefined)?.adhanLibraryUrl;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? u.origin + u.pathname.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

/**
 * The personal-use catalogue (recordings whose rights are NOT verified; see scripts/adhan/build-personal.mjs).
 * Enabled by `expo.extra.personalAdhanLibrary: true` in app.json. Turn it off, and delete the generated file, before
 * publishing a build to anyone else.
 */
export function personalAdhanEnabled(): boolean {
  return (Constants.expoConfig?.extra as { personalAdhanLibrary?: unknown } | undefined)?.personalAdhanLibrary === true;
}

export function mirrorHost(): string[] {
  const base = adhanLibraryBaseUrl();
  return base ? [new URL(base).hostname] : [];
}
