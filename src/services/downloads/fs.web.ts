/**
 * Web build: file packages (audio) are not stored; recitations stream instead.
 * Text packages (translations, adhkar) are stored in SQLite and work on web.
 */
export const supportsFileDownloads = false;

export interface DownloadedFile {
  readonly bytes: number;
  readonly sha256: string;
  readonly head: Uint8Array;
}

const unsupported = () => {
  throw new Error('File downloads are not supported on web');
};

export const packageDir = unsupported;
export const packageFile = unsupported;
export const fileExists = (_packageId: string, _relPath: string) => false;
export const fileUri = (_packageId: string, _relPath: string): string | null => null;
export const availableSpace = (): number | null => null;
export async function downloadPartial(..._args: unknown[]): Promise<DownloadedFile> {
  return unsupported();
}
export const commitFile = (_packageId: string, _relPath: string) => unsupported();
export const clearInstalled = (_packageId: string) => undefined;
export const discardPartial = (_packageId: string) => undefined;
export const deletePackageFiles = (_packageId: string) => undefined;
export const verifyFile = async (_p: string, _r: string, _s: string) => false;
export const deleteAllPackages = () => undefined;
