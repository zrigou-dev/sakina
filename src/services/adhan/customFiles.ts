import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { CUSTOM_EXTENSIONS, MAX_CUSTOM_BYTES } from './customLimits';

const dir = () => new Directory(Paths.document, 'adhan-custom');

export type PickResult = { ok: true; id: string; name: string; file: string; bytes: number } | { ok: false; reason: 'cancelled' | 'type' | 'size' | 'failed' };

/** Lets the user choose an audio file from their device and copies it into app storage (it is never uploaded anywhere). */
export async function pickCustomAdhan(): Promise<PickResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets[0]) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    const ext = (a.name.split('.').pop() ?? '').toLowerCase();
    if (!(CUSTOM_EXTENSIONS as readonly string[]).includes(ext)) return { ok: false, reason: 'type' };
    const src = new File(a.uri);
    const bytes = src.size ?? a.size ?? 0;
    if (bytes <= 0 || bytes > MAX_CUSTOM_BYTES) return { ok: false, reason: 'size' };
    if (!dir().exists) dir().create({ intermediates: true, idempotent: true });
    const id = `c-${Date.now().toString(36)}`;
    const file = `${id}.${ext}`;
    src.copy(new File(dir(), file));
    return {
      ok: true,
      id,
      name:
        a.name
          .replace(/\.[^.]+$/, '')
          .replace(/[_]+/g, ' ')
          .trim() || 'Adhan',
      file,
      bytes,
    };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export function customFileUri(file: string): string | null {
  const f = new File(dir(), file);
  return f.exists ? f.uri : null;
}

export function deleteCustomFile(file: string): void {
  const f = new File(dir(), file);
  if (f.exists) f.delete();
}
