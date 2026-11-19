import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import uthmaniAsset from '../../../assets/content/quran-uthmani.xml';
import simpleCleanAsset from '../../../assets/content/quran-simple-clean.xml';

import type { BundledFile, SeedDeps } from './seed';

const MODULES: Record<BundledFile, number> = {
  'quran-uthmani.xml': uthmaniAsset,
  'quran-simple-clean.xml': simpleCleanAsset,
};

/** Native: read bundled assets from disk via expo-asset + expo-file-system. */
export const seedDeps: SeedDeps = {
  async readText(file) {
    const asset = await Asset.fromModule(MODULES[file]).downloadAsync();
    if (!asset.localUri) throw new Error(`Asset ${file} unavailable`);
    return new File(asset.localUri).text();
  },
  async sha256(text) {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
  },
};
