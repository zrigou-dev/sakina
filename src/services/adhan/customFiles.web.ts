import type { PickResult } from './customFiles';

/** The web preview has no durable file storage: custom adhan files need the mobile app. */
export async function pickCustomAdhan(): Promise<PickResult> {
  return { ok: false, reason: 'failed' };
}
export const customFileUri = (_file: string): string | null => null;
export const deleteCustomFile = (_file: string): void => undefined;
