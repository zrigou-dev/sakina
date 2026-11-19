import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { fullSource, type PlaybackProfile } from './sources';
import type { AdhanVoice } from './voices';

/**
 * A native alarm engine needs a real, durable file path. Downloaded voices already are files. Bundled voices live
 * inside the app package, so they are copied once into app storage (not the cache — the OS may purge that, and a
 * missing file at prayer time would mean a silent adhan).
 */
export async function ensureLocalFile(voice: AdhanVoice): Promise<{ uri: string; profile: PlaybackProfile } | null> {
  const src = fullSource(voice);
  if (!src) return null;
  if (src.kind === 'file') return { uri: src.uri, profile: src.profile };
  const dir = new Directory(Paths.document, 'adhan-bundled');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${voice.id}.m4a`);
  if (dest.exists && dest.size === voice.bytes) return { uri: dest.uri, profile: src.profile };
  const asset = Asset.fromModule(src.asset);
  await asset.downloadAsync();
  const from = asset.localUri;
  if (!from) return null;
  if (dest.exists) dest.delete();
  new File(from).copy(dest);
  return dest.exists ? { uri: dest.uri, profile: src.profile } : null;
}
