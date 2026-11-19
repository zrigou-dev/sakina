/** Bundled Tanzil Quran XML files resolve to Metro asset module ids. */
declare module '*.xml' {
  const assetId: number;
  export default assetId;
}

/** Bundled adhan recordings resolve to Metro asset module ids. */
declare module '*.mp3' {
  const assetId: number;
  export default assetId;
}

/** Bundled full adhan recordings (AAC in an MP4 container). */
declare module '*.m4a' {
  const assetId: number;
  export default assetId;
}
