import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { I18nManager, useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { openDatabases, type Databases } from '@/database/connection';
import { settingsRepo } from '@/database/repositories/user';
import { DARK, LIGHT, type ColorTokens } from '@/design-system/tokens';
import { directionOf, type Direction, type Language } from '@/localization/languages';
import ar from '@/localization/locales/ar';
import en from '@/localization/locales/en';
import fr from '@/localization/locales/fr';
import { translate, type MessageKey, type MessageTree, type TranslateParams } from '@/localization/translate';
import { seedDeps } from '@/services/quran/assets';
import { ContentIntegrityError, seedQuran } from '@/services/quran/seed';
import { loadBundleData } from '@/services/content/bundle-data';
import { loadCachedRemoteCatalogue } from '@/services/adhan/remote';
import { seedBundle } from '@/services/content/bundle-seed';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '@/state/settings';
import { createStore } from '@/state/store';
import type { EnMessages } from '@/localization/locales/en';

// SAKINA controls layout direction itself (root `direction` style), so the OS must not flip it too.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

export type TKey = MessageKey<EnMessages>;
const MESSAGES: Record<Language, MessageTree> = { ar: ar as unknown as MessageTree, en: en as unknown as MessageTree, fr: fr as unknown as MessageTree };

const seeding = new WeakMap<object, Promise<unknown>>();
/** Seeds at most once concurrently per content database. */
function seedOnce(dbs: Databases, force: boolean): Promise<unknown> {
  let p = seeding.get(dbs.content);
  if (!p || force) {
    p = seedQuran(dbs.content, seedDeps)
      .then(() => seedBundle(dbs.content, loadBundleData()))
      .then(() => loadCachedRemoteCatalogue(dbs.content));
    seeding.set(dbs.content, p);
    p.catch(() => seeding.delete(dbs.content));
  }
  return p;
}

export type QuranStatus = 'pending' | 'ready' | 'integrity_error' | 'error';

interface RuntimeValue {
  readonly dbs: Databases;
  readonly quranStatus: QuranStatus;
  readonly retryQuran: () => void;
}

const RuntimeContext = createContext<RuntimeValue | null>(null);
const settingsStore = createStore<Settings>(DEFAULT_SETTINGS);
/** Bumped whenever user data changes, so screens can refresh derived queries. */
const dataVersionStore = createStore(0);

export function bumpDataVersion(): void {
  dataVersionStore.set((v) => v + 1);
}

export function useDataVersion(): number {
  return useSyncExternalStore(dataVersionStore.subscribe, dataVersionStore.get, dataVersionStore.get);
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends readonly unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

function merge<T>(base: T, patch: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const prev = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object' ? merge(prev, v as DeepPartial<typeof prev>) : v;
  }
  return out as T;
}

export interface BootState {
  readonly phase: 'loading' | 'ready' | 'error';
  readonly error?: unknown;
}

export function AppProvider({
  children,
  fallback,
  errorView,
}: {
  children: ReactNode;
  fallback: ReactNode;
  errorView: (e: unknown, retry: () => void) => ReactNode;
}) {
  const [dbs, setDbs] = useState<Databases | null>(null);
  const [boot, setBoot] = useState<BootState>({ phase: 'loading' });
  const [quranStatus, setQuranStatus] = useState<QuranStatus>('pending');
  const [attempt, setAttempt] = useState(0);
  const [quranAttempt, setQuranAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await openDatabases();
        const raw = await settingsRepo.getAll(opened.user);
        if (cancelled) return;
        settingsStore.set(sanitizeSettings(raw));
        setDbs(opened);
        setBoot({ phase: 'ready' });
      } catch (error) {
        if (!cancelled) setBoot({ phase: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (!dbs) return;
    let cancelled = false;
    seedOnce(dbs, quranAttempt > 0)
      .then(() => {
        if (cancelled) return;
        setQuranStatus('ready');
        // Content queries issued while seeding (e.g. a search typed early) re-run against the seeded data.
        bumpDataVersion();
      })
      .catch((e) => !cancelled && setQuranStatus(e instanceof ContentIntegrityError ? 'integrity_error' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [dbs, quranAttempt]);

  const retryQuran = useCallback(() => {
    setQuranStatus('pending');
    setQuranAttempt((n) => n + 1);
  }, []);
  const value = useMemo(() => (dbs ? { dbs, quranStatus, retryQuran } : null), [dbs, quranStatus, retryQuran]);

  if (boot.phase === 'error') return <>{errorView(boot.error, () => setAttempt((n) => n + 1))}</>;
  if (!value) return <>{fallback}</>;
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useRuntime must be used inside <AppProvider>');
  return ctx;
}

export function useDbs(): Databases {
  return useRuntime().dbs;
}

/** Current settings plus a persisting, deep-merging updater. */
export function useSettings(): [Settings, (patch: DeepPartial<Settings>) => Promise<void>] {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
  const { dbs } = useRuntime();
  const update = useCallback(
    async (patch: DeepPartial<Settings>) => {
      const next = sanitizeSettings(merge(settingsStore.get(), patch) as unknown as Record<string, unknown>);
      settingsStore.set(next);
      const changed: Record<string, unknown> = {};
      for (const k of Object.keys(patch) as (keyof Settings)[]) changed[k] = next[k];
      await settingsRepo.setMany(dbs.user, changed);
    },
    [dbs],
  );
  return [settings, update];
}

/** Replace the whole settings object (used by restore / delete-all). */
export function replaceSettings(next: Settings): void {
  settingsStore.set(next);
}

export function getSettingsSnapshot(): Settings {
  return settingsStore.get();
}

// ─── i18n ─────────────────────────────────────────────────────────────────────
export interface I18n {
  readonly lang: Language;
  readonly dir: Direction;
  readonly isRTL: boolean;
  t(key: TKey, params?: TranslateParams): string;
}

export function makeI18n(lang: Language): I18n {
  const tree = MESSAGES[lang];
  const dir = directionOf(lang);
  return {
    lang,
    dir,
    isRTL: dir === 'rtl',
    t: (key, params) => translate(tree, MESSAGES.en, lang, key, params),
  };
}

const I18N_CACHE = new Map<Language, I18n>();

export function useI18n(): I18n {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
  const lang = settings.language;
  let i18n = I18N_CACHE.get(lang);
  if (!i18n) {
    i18n = makeI18n(lang);
    I18N_CACHE.set(lang, i18n);
  }
  return i18n;
}

// ─── Theme ────────────────────────────────────────────────────────────────────
export interface Theme {
  readonly scheme: 'light' | 'dark';
  readonly colors: ColorTokens;
  readonly fontScale: number;
  readonly reducedMotion: boolean;
}

export function useTheme(): Theme {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
  const system = useColorScheme();
  const reducedMotion = useReducedMotion();
  const scheme = settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;
  return useMemo(
    () => ({ scheme, colors: scheme === 'dark' ? DARK : LIGHT, fontScale: settings.fontScale, reducedMotion }),
    [scheme, settings.fontScale, reducedMotion],
  );
}
