/**
 * Zakat calculator — transparent, assumption-explicit.
 *
 * Methodology (shown in-app):
 *  - Rate: 2.5 % (1/40) of zakatable wealth held for one lunar year (hawl) above the nisab.
 *  - Nisab: 85 g of gold or 595 g of silver (the commonly used contemporary equivalents of
 *    20 mithqal and 200 dirham). The user chooses which standard applies; scholars differ,
 *    and the silver standard yields a lower threshold.
 *  - Cash, gold, silver and trade goods are combined for the nisab test (majority view).
 *  - Debts due now may be deducted (the user can turn this off — another point of difference).
 *  - Prices are entered by the user. SAKINA does not fetch metal prices.
 */
export const ZAKAT_RATE = 0.025;
export const NISAB_GOLD_GRAMS = 85;
export const NISAB_SILVER_GRAMS = 595;

export type NisabStandard = 'gold' | 'silver';

export interface ZakatInput {
  readonly cash: number;
  readonly goldGrams: number;
  /** Purity 0..1 (24k = 1, 21k = 0.875, 18k = 0.75). */
  readonly goldPurity: number;
  readonly silverGrams: number;
  readonly tradeGoods: number;
  readonly receivables: number;
  readonly debtsDue: number;
  readonly goldPricePerGram: number;
  readonly silverPricePerGram: number;
  readonly nisabStandard: NisabStandard;
  readonly deductDebts: boolean;
  /** Whether the wealth has been held for a full lunar year. */
  readonly hawlComplete: boolean;
}

export interface ZakatBreakdown {
  readonly goldValue: number;
  readonly silverValue: number;
  readonly totalAssets: number;
  readonly deductions: number;
  readonly netWealth: number;
  readonly nisabValue: number;
  readonly meetsNisab: boolean;
  readonly zakatDue: number;
  readonly reason: 'due' | 'below_nisab' | 'hawl_incomplete' | 'missing_price';
}

export class ZakatInputError extends Error {
  constructor(readonly field: keyof ZakatInput) {
    super(`Invalid value for ${field}`);
    this.name = 'ZakatInputError';
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function validateZakatInput(input: ZakatInput): void {
  const nonNegative: (keyof ZakatInput)[] = [
    'cash',
    'goldGrams',
    'silverGrams',
    'tradeGoods',
    'receivables',
    'debtsDue',
    'goldPricePerGram',
    'silverPricePerGram',
  ];
  for (const k of nonNegative) {
    const v = input[k] as number;
    if (!Number.isFinite(v) || v < 0) throw new ZakatInputError(k);
  }
  if (!(input.goldPurity > 0 && input.goldPurity <= 1)) throw new ZakatInputError('goldPurity');
}

export function calculateZakat(input: ZakatInput): ZakatBreakdown {
  validateZakatInput(input);
  const goldValue = input.goldGrams * input.goldPurity * input.goldPricePerGram;
  const silverValue = input.silverGrams * input.silverPricePerGram;
  const totalAssets = input.cash + goldValue + silverValue + input.tradeGoods + input.receivables;
  const deductions = input.deductDebts ? Math.min(input.debtsDue, totalAssets) : 0;
  const netWealth = totalAssets - deductions;

  const price = input.nisabStandard === 'gold' ? input.goldPricePerGram : input.silverPricePerGram;
  const nisabValue = (input.nisabStandard === 'gold' ? NISAB_GOLD_GRAMS : NISAB_SILVER_GRAMS) * price;

  const base = {
    goldValue: round2(goldValue),
    silverValue: round2(silverValue),
    totalAssets: round2(totalAssets),
    deductions: round2(deductions),
    netWealth: round2(netWealth),
    nisabValue: round2(nisabValue),
  };

  if (price <= 0) return { ...base, meetsNisab: false, zakatDue: 0, reason: 'missing_price' };
  const meetsNisab = netWealth >= nisabValue;
  if (!meetsNisab) return { ...base, meetsNisab, zakatDue: 0, reason: 'below_nisab' };
  if (!input.hawlComplete) return { ...base, meetsNisab, zakatDue: 0, reason: 'hawl_incomplete' };
  return { ...base, meetsNisab, zakatDue: round2(netWealth * ZAKAT_RATE), reason: 'due' };
}

export const EMPTY_ZAKAT_INPUT: ZakatInput = {
  cash: 0,
  goldGrams: 0,
  goldPurity: 1,
  silverGrams: 0,
  tradeGoods: 0,
  receivables: 0,
  debtsDue: 0,
  goldPricePerGram: 0,
  silverPricePerGram: 0,
  nisabStandard: 'silver',
  deductDebts: true,
  hawlComplete: true,
};

export { parseAmount } from '@/utils/number';
