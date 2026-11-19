import type { SqlDatabase } from '@/database/types';

import { adhanLibraryBaseUrl, mirrorHost } from './config';
import { BUNDLED_CATALOGUE, parseCatalogue, setRemoteVoices } from './voices';

const META_KEY = 'adhan_remote_catalogue';
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;

export type RemoteResult = { status: 'unconfigured' } | { status: 'error' } | { status: 'ok'; added: number; rejected: number };

function apply(raw: unknown): { added: number; rejected: number } {
  const { catalogue, rejected } = parseCatalogue(raw, { extraHosts: mirrorHost(), allowMirrorOnly: true });
  const bundled = new Set(BUNDLED_CATALOGUE.voices.map((v) => v.id));
  const extras = catalogue.voices.filter((v) => !bundled.has(v.id));
  setRemoteVoices(extras);
  return { added: extras.length, rejected: rejected.length };
}

/** Restores the last validated remote catalogue (works offline). Silent if there is none or it no longer validates. */
export async function loadCachedRemoteCatalogue(db: SqlDatabase): Promise<void> {
  if (!adhanLibraryBaseUrl()) return;
  try {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM content_meta WHERE key = ?', [META_KEY]);
    if (row) apply(JSON.parse(row.value));
  } catch {
    // A corrupt cache is ignored; the next refresh replaces it.
  }
}

/**
 * Fetches `<mirror>/catalogue.json`, validates it strictly (licences, trusted hosts, pinned hashes), caches it and
 * makes new voices appear. Nothing from the network is trusted before validation, and bundled voices cannot be replaced.
 */
export async function refreshRemoteCatalogue(db: SqlDatabase, fetchImpl: typeof fetch = fetch): Promise<RemoteResult> {
  const base = adhanLibraryBaseUrl();
  if (!base) return { status: 'unconfigured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${base}/catalogue.json`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return { status: 'error' };
    const text = await res.text();
    if (text.length > MAX_BYTES) return { status: 'error' };
    const json: unknown = JSON.parse(text);
    const result = apply(json);
    await db.runAsync('INSERT OR REPLACE INTO content_meta (key, value) VALUES (?, ?)', [META_KEY, text]);
    return { status: 'ok', ...result };
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
