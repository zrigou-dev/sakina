import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { toISODate } from '@/utils/date';

/** Writes the backup to a cache file and opens the system share sheet so the user chooses where it goes. */
export async function saveBackupFile(json: string): Promise<void> {
  const file = new File(Paths.cache, `sakina-backup-${toISODate(new Date())}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'SAKINA backup', UTI: 'public.json' });
  }
}

/** Lets the user pick a backup file; returns its text or null if cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  if ((asset.size ?? 0) > 50 * 1024 * 1024) throw new Error('file too large');
  return new File(asset.uri).text();
}
