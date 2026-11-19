import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';

import uthmaniAsset from '../../../assets/content/quran-uthmani.xml';
import simpleCleanAsset from '../../../assets/content/quran-simple-clean.xml';

import type { BundledFile, SeedDeps } from './seed';

const MODULES: Record<BundledFile, number> = {
  'quran-uthmani.xml': uthmaniAsset,
  'quran-simple-clean.xml': simpleCleanAsset,
};

/** Web: fetch bundled assets from the static host. */
export const seedDeps: SeedDeps = {
  async readText(file) {
    const asset = Asset.fromModule(MODULES[file]);
    const res = await fetch(asset.uri);
    if (!res.ok) throw new Error(`Asset ${file} unavailable (${res.status})`);
    return res.text();
  },
  async sha256(text) {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
  },
};
