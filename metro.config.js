// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite on web ships a wasm build of SQLite.
config.resolver.assetExts.push('wasm');
// Bundled verbatim Tanzil Quran text files are loaded as assets, not as JS.
config.resolver.assetExts.push('xml');

// SharedArrayBuffer (required by expo-sqlite web) needs cross-origin isolation.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
