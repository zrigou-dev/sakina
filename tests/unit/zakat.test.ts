import { calculateZakat, EMPTY_ZAKAT_INPUT, parseAmount, ZakatInputError } from '@/services/zakat/zakat';

/**
 * Hand-computed worked examples (arithmetic shown so they can be checked independently).
 */
describe('zakat calculator', () => {
  it('cash above the silver nisab: 10,000 × 2.5% = 250', () => {
    // nisab = 595 g × 1.00/g = 595 → 10,000 ≥ 595
    const r = calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: 10_000, silverPricePerGram: 1 });
    expect(r).toMatchObject({ totalAssets: 10_000, nisabValue: 595, meetsNisab: true, zakatDue: 250, reason: 'due' });
  });

  it('same wealth is below the gold nisab when gold is expensive', () => {
    // gold nisab = 85 g × 150/g = 12,750 > 10,000
    const r = calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: 10_000, goldPricePerGram: 150, nisabStandard: 'gold' });
    expect(r).toMatchObject({ nisabValue: 12_750, meetsNisab: false, zakatDue: 0, reason: 'below_nisab' });
  });

  it('combines gold by purity, silver, trade goods and receivables, minus debts', () => {
    // gold: 100 g × 0.875 × 80 = 7,000 ; silver: 500 g × 1 = 500 ; cash 2,000 ; trade 1,500 ; receivables 1,000
    // total = 12,000 ; debts 2,000 → net 10,000 ; silver nisab 595 → zakat 250
    const r = calculateZakat({
      ...EMPTY_ZAKAT_INPUT,
      cash: 2_000,
      goldGrams: 100,
      goldPurity: 0.875,
      goldPricePerGram: 80,
      silverGrams: 500,
      silverPricePerGram: 1,
      tradeGoods: 1_500,
      receivables: 1_000,
      debtsDue: 2_000,
    });
    expect(r).toMatchObject({ goldValue: 7_000, silverValue: 500, totalAssets: 12_000, deductions: 2_000, netWealth: 10_000, zakatDue: 250 });
  });

  it('debt deduction can be disabled (difference of opinion)', () => {
    const r = calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: 1_000, debtsDue: 900, silverPricePerGram: 1, deductDebts: false });
    expect(r).toMatchObject({ deductions: 0, netWealth: 1_000, zakatDue: 25 });
  });

  it('debts never make wealth negative', () => {
    const r = calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: 100, debtsDue: 5_000, silverPricePerGram: 1 });
    expect(r.netWealth).toBe(0);
    expect(r.zakatDue).toBe(0);
  });

  it('is not due before the hawl completes', () => {
    const r = calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: 10_000, silverPricePerGram: 1, hawlComplete: false });
    expect(r).toMatchObject({ meetsNisab: true, zakatDue: 0, reason: 'hawl_incomplete' });
  });

  it('asks for a price instead of guessing it', () => {
    expect(calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: 10_000 }).reason).toBe('missing_price');
  });

  it('rejects invalid input', () => {
    expect(() => calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: -1 })).toThrow(ZakatInputError);
    expect(() => calculateZakat({ ...EMPTY_ZAKAT_INPUT, goldPurity: 1.2 })).toThrow(ZakatInputError);
    expect(() => calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: Number.NaN })).toThrow(ZakatInputError);
  });

  it('rounds to cents', () => {
    expect(calculateZakat({ ...EMPTY_ZAKAT_INPUT, cash: 1234.567, silverPricePerGram: 1 }).zakatDue).toBe(30.86);
  });
});

describe('amount parsing', () => {
  it.each([
    ['', 0],
    ['1500', 1500],
    ['1 500,5', 1500.5],
    ['١٥٠٠', 1500],
    ['١٢٫٥', 12.5],
    ['abc', null],
    ['-5', null],
  ])('%s → %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});
