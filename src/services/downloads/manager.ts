import { hadithRepo, translationRepo } from '@/database/repositories/content';
import { packagesRepo } from '@/database/repositories/user';
import type { Databases } from '@/database/connection';
import { globalIndex } from '@/services/quran/navigation';
import { createStore, type Store } from '@/state/store';

import { findPackage, reciterById, ayahAudioUrl, type PackageManifest } from './catalogue';
import { INITIAL_PACKAGE_STATE, recoverAfterRestart, transition, type PackageEvent, type PackageState } from './state';
import { parseHadithEdition, PayloadValidationError, validateAdhanFile, validateAlQuranCloudEdition, validateAudioFile, verifyChecksum } from './validators';

export type DownloadErrorCode = 'network' | 'integrity' | 'space' | 'wifi' | 'offline' | 'generic';

export interface NetworkInfo {
  readonly connected: boolean;
  readonly wifi: boolean;
}

export interface DownloadFs {
  readonly supportsFileDownloads: boolean;
  downloadPartial(
    packageId: string,
    relPath: string,
    url: string,
    signal: AbortSignal,
    onProgress?: (written: number, total: number) => void,
  ): Promise<{ bytes: number; sha256: string; head: Uint8Array }>;
  commitFile(packageId: string, relPath: string): void;
  clearInstalled(packageId: string): void;
  discardPartial(packageId: string): void;
  deletePackageFiles(packageId: string): void;
  fileExists(packageId: string, relPath: string): boolean;
  availableSpace(): number | null;
}

export interface DownloadDeps {
  readonly dbs: Databases;
  readonly fs: DownloadFs;
  fetchText(url: string, signal: AbortSignal): Promise<string>;
  network(): Promise<NetworkInfo>;
  sha256Text(text: string): Promise<string>;
  wifiOnly(): boolean;
}

export type PackageStates = Readonly<Record<string, PackageState & { errorCode?: DownloadErrorCode }>>;

class AbortedError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortedError';
  }
}

/**
 * Serial download queue. Every state change goes through the pure state machine
 * and is persisted to the user DB, so the UI and a restarted app agree on reality.
 */
export class DownloadManager {
  readonly store: Store<PackageStates> = createStore<PackageStates>({});
  private queue: string[] = [];
  private running: { id: string; controller: AbortController; reason: 'pause' | 'cancel' | null } | null = null;

  constructor(private readonly deps: DownloadDeps) {}

  /** Loads persisted package rows and recovers states interrupted by an app restart. */
  async init(): Promise<void> {
    const rows = await packagesRepo.list(this.deps.dbs.user);
    const next: Record<string, PackageState> = {};
    for (const r of rows) {
      // A voice that left the catalogue must not keep its file (storage) or its row.
      if (r.kind === 'adhan' && !findPackage(r.id)) {
        if (this.deps.fs.supportsFileDownloads) this.deps.fs.deletePackageFiles(r.id);
        await packagesRepo.remove(this.deps.dbs.user, r.id);
        continue;
      }
      const recovered = recoverAfterRestart({ status: r.status, bytesDone: r.bytesDone, bytesTotal: r.bytesTotal, error: r.error });
      next[r.id] = recovered;
      if (recovered.status !== r.status) await this.persist(r.id, recovered, r.kind, r.version);
    }
    this.store.set(next);
  }

  state(id: string): PackageState {
    return this.store.get()[id] ?? INITIAL_PACKAGE_STATE;
  }

  async download(id: string): Promise<void> {
    const s = this.state(id);
    if (s.status === 'queued' || s.status === 'downloading' || s.status === 'verifying' || s.status === 'installing') return;
    const event: PackageEvent =
      s.status === 'failed'
        ? { type: 'retry' }
        : s.status === 'installed'
          ? { type: 'update' }
          : s.status === 'paused'
            ? { type: 'resume' }
            : { type: 'download' };
    await this.apply(id, event);
    this.queue.push(id);
    void this.pump();
  }

  async pause(id: string): Promise<void> {
    if (this.running?.id === id) {
      this.running.reason = 'pause';
      this.running.controller.abort();
      return;
    }
    this.queue = this.queue.filter((q) => q !== id);
    if (this.state(id).status === 'queued') await this.apply(id, { type: 'pause' });
  }

  async cancel(id: string): Promise<void> {
    if (this.running?.id === id) {
      this.running.reason = 'cancel';
      this.running.controller.abort();
      return;
    }
    this.queue = this.queue.filter((q) => q !== id);
    await this.cleanup(id);
    await this.apply(id, { type: 'cancel' });
  }

  async remove(id: string): Promise<void> {
    await this.cleanup(id);
    const s = this.state(id);
    if (s.status === 'installed' || s.status === 'failed') await this.apply(id, { type: 'delete' });
    await packagesRepo.remove(this.deps.dbs.user, id);
    const { [id]: _removed, ...rest } = this.store.get();
    this.store.set(rest);
  }

  private async cleanup(id: string): Promise<void> {
    const manifest = findPackage(id);
    this.deps.fs.discardPartial(id);
    if (!manifest) return;
    if (manifest.payload.type === 'alquran-cloud-edition') await translationRepo.remove(this.deps.dbs.content, manifest.payload.edition);
    if (manifest.payload.type === 'hadith-edition') {
      // Only remove the collection if this variant is the one installed.
      const book = await hadithRepo.book(this.deps.dbs.content, manifest.payload.book);
      const lang = manifest.payload.translationLang ?? 'ar';
      if (book && !book.bundled && (book.languages === 'ar' ? 'ar' : book.languages.split(',').find((l) => l !== 'ar')) === lang) {
        await hadithRepo.remove(this.deps.dbs.content, manifest.payload.book);
      }
    }
    if ((manifest.payload.type === 'ayah-audio' || manifest.payload.type === 'adhan-audio') && this.deps.fs.supportsFileDownloads)
      this.deps.fs.deletePackageFiles(id);
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const id = this.queue.shift();
    if (!id) return;
    const manifest = findPackage(id);
    const controller = new AbortController();
    this.running = { id, controller, reason: null };
    try {
      if (!manifest) throw new PayloadValidationError('Unknown package');
      await this.preflight(manifest);
      await this.apply(id, { type: 'start' });
      await this.run(manifest, controller.signal);
    } catch (e) {
      const reason = this.running?.reason;
      if (reason === 'pause') {
        await this.apply(id, { type: 'pause' });
      } else if (reason === 'cancel') {
        await this.cleanup(id);
        await this.apply(id, { type: 'cancel' });
      } else {
        const code = errorCode(e);
        const s = this.state(id);
        if (s.status !== 'installed' && s.status !== 'not_installed') await this.apply(id, { type: 'fail', error: code }, code);
      }
    } finally {
      this.running = null;
      void this.pump();
    }
  }

  private async preflight(m: PackageManifest): Promise<void> {
    const net = await this.deps.network();
    if (!net.connected) throw new PreflightError('offline');
    if (this.deps.wifiOnly() && !net.wifi) throw new PreflightError('wifi');
    const free = this.deps.fs.availableSpace();
    if (free !== null && free < m.approxBytes * 2) throw new PreflightError('space');
  }

  private async run(m: PackageManifest, signal: AbortSignal): Promise<void> {
    const p = m.payload;
    switch (p.type) {
      case 'alquran-cloud-edition': {
        const raw = await this.fetchChecked(p.url, signal);
        await this.apply(m.id, { type: 'progress', bytesDone: raw.length, bytesTotal: raw.length });
        await this.apply(m.id, { type: 'files_done' });
        const sha = await this.deps.sha256Text(raw);
        verifyChecksum(sha, p.sha256);
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          throw new PayloadValidationError('Invalid JSON');
        }
        const ayahs = validateAlQuranCloudEdition(json, p.edition);
        await this.apply(m.id, { type: 'verified' });
        await translationRepo.install(
          this.deps.dbs.content,
          {
            id: p.edition,
            kind: m.kind === 'tafsir' ? 'tafsir' : 'translation',
            language: m.language,
            name: m.name.en,
            author: m.author,
            source: m.source.name,
            license: m.licence.text,
          },
          ayahs,
        );
        await this.finish(m, raw.length, sha);
        return;
      }
      case 'hadith-edition': {
        const arRaw = await this.fetchChecked(p.arabicUrl, signal);
        await this.apply(m.id, { type: 'progress', bytesDone: arRaw.length, bytesTotal: m.approxBytes });
        const trRaw = p.translationUrl ? await this.fetchChecked(p.translationUrl, signal) : null;
        await this.apply(m.id, { type: 'progress', bytesDone: arRaw.length + (trRaw?.length ?? 0), bytesTotal: arRaw.length + (trRaw?.length ?? 0) });
        await this.apply(m.id, { type: 'files_done' });
        const parse = (raw: string) => {
          try {
            return parseHadithEdition(JSON.parse(raw));
          } catch (e) {
            if (e instanceof PayloadValidationError) throw e;
            throw new PayloadValidationError('Invalid JSON');
          }
        };
        const ar = parse(arRaw);
        const tr = trRaw ? parse(trRaw) : null;
        const trByNumber = new Map((tr?.hadiths ?? []).map((h) => [h.number, h]));
        await this.apply(m.id, { type: 'verified' });
        await hadithRepo.install(this.deps.dbs.content, {
          book: p.book,
          name: ar.name,
          sections: (tr ?? ar).sections,
          languages: p.translationLang ? ['ar', p.translationLang] : ['ar'],
          hadiths: ar.hadiths.map((h) => {
            const t = trByNumber.get(h.number);
            const grades = h.grades.length ? h.grades : (t?.grades ?? []);
            return {
              number: h.number,
              section: h.section ?? t?.section ?? null,
              ar: h.text,
              en: p.translationLang === 'en' ? (t?.text ?? null) : null,
              fr: p.translationLang === 'fr' ? (t?.text ?? null) : null,
              grades,
            };
          }),
        });
        await this.finish(m, arRaw.length + (trRaw?.length ?? 0), await this.deps.sha256Text(arRaw));
        return;
      }
      case 'adhan-audio': {
        if (!this.deps.fs.supportsFileDownloads) throw new PreflightError('generic');
        if (!p.sources.length) throw new PayloadValidationError('No download source');
        let lastError: unknown = null;
        for (const src of p.sources) {
          if (signal.aborted) throw new AbortedError();
          try {
            const got = await this.deps.fs.downloadPartial(m.id, src.file, src.url, signal, (w, t) => {
              if (t > 0) void this.apply(m.id, { type: 'progress', bytesDone: w, bytesTotal: t }).catch(() => undefined);
            });
            validateAdhanFile(got, src);
            // Replace any previously installed variant (e.g. a Commons MP3 when the mirror's M4A arrives).
            this.deps.fs.clearInstalled(m.id);
            this.deps.fs.commitFile(m.id, src.file);
            await this.apply(m.id, { type: 'files_done' });
            await this.apply(m.id, { type: 'verified' });
            await packagesRepo.setFiles(this.deps.dbs.user, m.id, [{ relPath: src.file, bytes: got.bytes, sha256: got.sha256 }]);
            await this.finish(m, got.bytes, got.sha256);
            return;
          } catch (e) {
            if (signal.aborted) throw e;
            lastError = e;
            this.deps.fs.discardPartial(m.id);
          }
        }
        throw lastError instanceof Error ? lastError : new PayloadValidationError('Download failed');
      }
      case 'ayah-audio': {
        if (!this.deps.fs.supportsFileDownloads) throw new PreflightError('generic');
        const reciter = reciterById(p.reciter);
        const files: { relPath: string; bytes: number; sha256: string }[] = [];
        let bytes = 0;
        for (let ayah = 1; ayah <= p.ayahCount; ayah++) {
          if (signal.aborted) throw new AbortedError();
          const relPath = `${ayah}.mp3`;
          const url = ayahAudioUrl(reciter, globalIndex({ surah: p.surah, ayah }));
          const got = await this.deps.fs.downloadPartial(m.id, relPath, url, signal);
          validateAudioFile(got.bytes, got.head);
          this.deps.fs.commitFile(m.id, relPath);
          files.push({ relPath, bytes: got.bytes, sha256: got.sha256 });
          bytes += got.bytes;
          await this.apply(m.id, { type: 'progress', bytesDone: ayah, bytesTotal: p.ayahCount });
        }
        await this.apply(m.id, { type: 'files_done' });
        await this.apply(m.id, { type: 'verified' });
        await packagesRepo.setFiles(this.deps.dbs.user, m.id, files);
        await this.finish(m, bytes, null);
        return;
      }
    }
  }

  private async fetchChecked(url: string, signal: AbortSignal): Promise<string> {
    if (signal.aborted) throw new AbortedError();
    const text = await this.deps.fetchText(url, signal);
    if (signal.aborted) throw new AbortedError();
    if (!text || text.length < 2) throw new PayloadValidationError('Empty response');
    return text;
  }

  private async finish(m: PackageManifest, bytes: number, sha256: string | null): Promise<void> {
    const s = transition({ ...this.state(m.id), bytesTotal: bytes, bytesDone: bytes }, { type: 'installed' });
    this.store.set((all) => ({ ...all, [m.id]: s }));
    await packagesRepo.upsert(this.deps.dbs.user, {
      id: m.id,
      kind: m.kind,
      version: m.version,
      status: s.status,
      bytesTotal: bytes,
      bytesDone: bytes,
      sha256,
      error: null,
      resumeState: null,
      installedAt: new Date().toISOString(),
    });
  }

  private async apply(id: string, event: PackageEvent, code?: DownloadErrorCode): Promise<void> {
    const next = transition(this.state(id), event);
    this.store.set((all) => ({ ...all, [id]: code ? { ...next, errorCode: code } : next }));
    const m = findPackage(id);
    if (event.type !== 'progress') await this.persist(id, next, m?.kind ?? 'unknown', m?.version ?? '0');
  }

  private async persist(id: string, s: PackageState, kind: string, version: string): Promise<void> {
    if (s.status === 'not_installed') {
      await packagesRepo.remove(this.deps.dbs.user, id);
      return;
    }
    const prev = await packagesRepo.get(this.deps.dbs.user, id);
    await packagesRepo.upsert(this.deps.dbs.user, {
      id,
      kind,
      version,
      status: s.status,
      bytesTotal: s.bytesTotal,
      bytesDone: s.bytesDone,
      sha256: prev?.sha256 ?? null,
      error: s.error,
      resumeState: null,
      installedAt: prev?.installedAt ?? null,
    });
  }
}

class PreflightError extends Error {
  constructor(readonly code: DownloadErrorCode) {
    super(code);
    this.name = 'PreflightError';
  }
}

function errorCode(e: unknown): DownloadErrorCode {
  if (e instanceof PreflightError) return e.code;
  if (e instanceof PayloadValidationError) return 'integrity';
  if (e instanceof TypeError || (e instanceof Error && /network|fetch|timeout|connection/i.test(e.message))) return 'network';
  return 'generic';
}
