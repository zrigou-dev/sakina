const ARABIC_DIGITS = /[\u0660-\u0669]/g;
/** Accepts Western and Arabic-Indic digits, comma or point decimals. */
export function parseAmount(s: string): number | null {
  const normalized = s
    .replace(ARABIC_DIGITS, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٬\s]/g, '')
    .replace(/[٫,]/g, '.');
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
