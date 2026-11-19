import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { bumpDataVersion, getSettingsSnapshot, useDbs } from '@/runtime/AppProvider';

import * as fs from './fs';
import { DownloadManager, type PackageStates } from './manager';
import { INITIAL_PACKAGE_STATE } from './state';

const DownloadContext = createContext<DownloadManager | null>(null);

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`network: HTTP ${res.status}`);
  return res.text();
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const dbs = useDbs();
  const manager = useMemo(
    () =>
      new DownloadManager({
        dbs,
        fs,
        fetchText,
        sha256Text: (t) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, t),
        wifiOnly: () => getSettingsSnapshot().downloads.wifiOnly,
        network: async () => {
          if (process.env.EXPO_OS === 'web') {
            const online = typeof navigator === 'undefined' ? true : navigator.onLine;
            return { connected: online, wifi: true };
          }
          const s = await Network.getNetworkStateAsync();
          return {
            connected: !!s.isConnected && s.isInternetReachable !== false,
            wifi: s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET,
          };
        },
      }),
    [dbs],
  );

  useEffect(() => {
    manager.init().catch(() => undefined);
    // Installed content changes what screens show (translations, adhkar): refresh them.
    let last = '';
    return manager.store.subscribe(() => {
      const installed = Object.entries(manager.store.get())
        .filter(([, s]) => s.status === 'installed')
        .map(([k]) => k)
        .sort()
        .join(',');
      if (installed !== last) {
        last = installed;
        bumpDataVersion();
      }
    });
  }, [manager]);

  return <DownloadContext.Provider value={manager}>{children}</DownloadContext.Provider>;
}

export function useDownloadManager(): DownloadManager {
  const m = useContext(DownloadContext);
  if (!m) throw new Error('useDownloadManager must be used inside <DownloadProvider>');
  return m;
}

export function usePackageStates(): PackageStates {
  const m = useDownloadManager();
  return useSyncExternalStore(m.store.subscribe, m.store.get, m.store.get);
}

export function usePackageState(id: string) {
  const states = usePackageStates();
  return states[id] ?? INITIAL_PACKAGE_STATE;
}
