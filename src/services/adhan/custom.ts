import { customAdhanRepo, type CustomAdhanRow } from '@/database/repositories/user';
import type { SqlDatabase } from '@/database/types';

import { deleteCustomFile } from './customFiles';
import { setCustomVoices, type AdhanVoice } from './voices';

/** A user-picked file as a voice. Regular adhan kind, so it may be used for any prayer (the user knows what they chose). */
export function customVoice(row: CustomAdhanRow, fileUri: string): AdhanVoice {
  return {
    id: row.id,
    tier: 'custom',
    kind: 'adhan',
    name: { ar: row.name, en: row.name, fr: row.name },
    place: null,
    style: null,
    delivery: 'local',
    localUri: fileUri,
    performer: null,
    durationSec: 0,
    bytes: row.bytes,
    sha256: '0'.repeat(64),
    format: 'mp3',
    file: row.file,
    direct: null,
    clip: null,
    audio: { lufs: -16, truePeak: -1, lra: 0, sampleRateHz: 44100, channels: 2, bitrateKbps: 0 },
    credit: {
      recordist: 'You',
      licence: 'Your own file',
      licenceUrl: null,
      sourceTitle: row.file,
      sourceUrl: '',
      modified: 'None',
      shareAlike: false,
      commercialUse: false,
      verifiedOn: row.createdAt.slice(0, 10),
    },
  };
}

/** Loads the user's files into the voice list (call at startup and after every change). */
export async function loadCustomVoices(db: SqlDatabase, resolveUri: (file: string) => string | null): Promise<void> {
  const rows = await customAdhanRepo.list(db);
  const voices: AdhanVoice[] = [];
  for (const r of rows) {
    const uri = resolveUri(r.file);
    if (uri) voices.push(customVoice(r, uri));
  }
  setCustomVoices(voices);
}

export async function removeCustomVoice(db: SqlDatabase, row: { id: string; file: string }, resolveUri: (file: string) => string | null): Promise<void> {
  await customAdhanRepo.remove(db, row.id);
  deleteCustomFile(row.file);
  await loadCustomVoices(db, resolveUri);
}
