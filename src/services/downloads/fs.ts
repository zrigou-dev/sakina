import { Directory, File, Paths } from 'expo-file-system';

/**
 * Native file layer for downloaded packages.
 * Layout: Documents/packages/<packageId>/<relPath>. Partial files live in
 * Cache/partial/<packageId>/ and are moved into place only after validation,
 * so incomplete files are never read as content.
 */
export const supportsFileDownloads = true;

const root = () => new Directory(Paths.document, 'packages');
const partialRoot = () => new Directory(Paths.cache, 'partial');
const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_');

export function packageDir(packageId: string): Directory {
  return new Directory(root(), safe(packageId));
}

export function packageFile(packageId: string, relPath: string): File {
  return new File(packageDir(packageId), safe(relPath));
}

export function fileExists(packageId: string, relPath: string): boolean {
  return packageFile(packageId, relPath).exists;
}

export function fileUri(packageId: string, relPath: string): string | null {
  const f = packageFile(packageId, relPath);
  return f.exists ? f.uri : null;
}

export function availableSpace(): number | null {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}

export interface DownloadedFile {
  readonly bytes: number;
  readonly sha256: string;
  readonly head: Uint8Array;
}

/**
 * Downloads one file to a partial location, measures and hashes it, and returns its
 * metadata. The caller validates and then calls `commitFile`. Abort via `signal`.
 */
export async function downloadPartial(
  packageId: string,
  relPath: string,
  url: string,
  signal: AbortSignal,
  onProgress?: (bytesWritten: number, totalBytes: number) => void,
): Promise<DownloadedFile> {
  const dir = new Directory(partialRoot(), safe(packageId));
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, safe(relPath));
  if (dest.exists) dest.delete();
  const task = File.createDownloadTask(url, dest, {
    signal,
    onProgress: ({ bytesWritten, totalBytes }) => onProgress?.(bytesWritten, totalBytes),
    sessionType: 'foreground',
  });
  const file = await task.downloadAsync();
  if (!file || !file.exists) throw new Error('download incomplete');
  const handle = file.open();
  let head: Uint8Array;
  try {
    head = await handle.readBytes(12);
  } finally {
    handle.close();
  }
  const sha256 = await file.digest('SHA-256');
  return { bytes: file.size ?? 0, sha256, head };
}

export function commitFile(packageId: string, relPath: string): void {
  const src = new File(new Directory(partialRoot(), safe(packageId)), safe(relPath));
  const dir = packageDir(packageId);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = packageFile(packageId, relPath);
  if (dest.exists) dest.delete();
  src.move(dest);
}

/** Removes the installed files of a package (keeps nothing) — used before committing a replacement. */
export function clearInstalled(packageId: string): void {
  const dir = packageDir(packageId);
  if (dir.exists) dir.delete();
}

export function discardPartial(packageId: string): void {
  const dir = new Directory(partialRoot(), safe(packageId));
  if (dir.exists) dir.delete();
}

export function deletePackageFiles(packageId: string): void {
  const dir = packageDir(packageId);
  if (dir.exists) dir.delete();
  discardPartial(packageId);
}

export async function verifyFile(packageId: string, relPath: string, expectedSha256: string): Promise<boolean> {
  const f = packageFile(packageId, relPath);
  if (!f.exists) return false;
  return (await f.digest('SHA-256')) === expectedSha256;
}

export function deleteAllPackages(): void {
  if (root().exists) root().delete();
  if (partialRoot().exists) partialRoot().delete();
}
