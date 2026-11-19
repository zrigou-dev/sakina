import * as DocumentPicker from 'expo-document-picker';

import { toISODate } from '@/utils/date';

export async function saveBackupFile(json: string): Promise<void> {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sakina-backup-${toISODate(new Date())}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pickBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}
