import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card, Divider, Notice, SectionHeader, SegmentedControl, Switch, TextField } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, type TKey } from '@/runtime/AppProvider';
import { calculateZakat, EMPTY_ZAKAT_INPUT, parseAmount, type ZakatInput } from '@/services/zakat/zakat';

type NumField = 'cash' | 'goldGrams' | 'silverGrams' | 'tradeGoods' | 'receivables' | 'debtsDue' | 'goldPricePerGram' | 'silverPricePerGram';

export default function Zakat() {
  const { t } = useI18n();
  const fmt = useFormat();
  const [raw, setRaw] = useState<Record<NumField, string>>({
    cash: '',
    goldGrams: '',
    silverGrams: '',
    tradeGoods: '',
    receivables: '',
    debtsDue: '',
    goldPricePerGram: '',
    silverPricePerGram: '',
  });
  const [opts, setOpts] = useState({ goldPurity: 1, nisabStandard: EMPTY_ZAKAT_INPUT.nisabStandard, deductDebts: true, hawlComplete: true });

  const parsed = useMemo(() => {
    const out: Partial<Record<NumField, number>> = {};
    const invalid: NumField[] = [];
    (Object.keys(raw) as NumField[]).forEach((k) => {
      const v = parseAmount(raw[k]);
      if (v === null) invalid.push(k);
      else out[k] = v;
    });
    return { out, invalid };
  }, [raw]);

  const result = useMemo(() => {
    if (parsed.invalid.length) return null;
    return calculateZakat({ ...EMPTY_ZAKAT_INPUT, ...parsed.out, ...opts } as ZakatInput);
  }, [parsed, opts]);

  const field = (k: NumField, label: TKey) => (
    <TextField
      key={k}
      label={t(label)}
      value={raw[k]}
      onChangeText={(v) => setRaw((r) => ({ ...r, [k]: v }))}
      keyboardType="decimal-pad"
      inputMode="decimal"
      placeholder="0"
      error={parsed.invalid.includes(k) ? t('zakat.invalid') : null}
      testID={`zakat-${k}`}
    />
  );

  const row = (label: TKey, value: number, strong?: boolean, testID?: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs }}>
      <Text variant={strong ? 'headline' : 'subhead'} color={strong ? 'text' : 'textMuted'}>
        {t(label)}
      </Text>
      <Text variant={strong ? 'title3' : 'numeric'} color={strong ? 'primary' : 'text'} testID={testID}>
        {fmt.number(value)}
      </Text>
    </View>
  );

  return (
    <Screen back title={t('zakat.title')} subtitle={t('zakat.intro')} large testID="zakat-screen">
      <SectionHeader title={t('zakat.assets')} style={{ marginTop: 0 }} />
      <Card style={{ gap: space.md }}>
        {field('cash', 'zakat.cash')}
        {field('goldGrams', 'zakat.gold')}
        <Text variant="footnote" color="textMuted">
          {t('zakat.goldPurity')}
        </Text>
        <SegmentedControl
          value={opts.goldPurity}
          onChange={(v) => setOpts((o) => ({ ...o, goldPurity: v }))}
          options={[
            { value: 1, label: '24k' },
            { value: 0.875, label: '21k' },
            { value: 0.75, label: '18k' },
          ]}
        />
        {field('silverGrams', 'zakat.silver')}
        {field('tradeGoods', 'zakat.tradeGoods')}
        {field('receivables', 'zakat.receivables')}
        {field('debtsDue', 'zakat.debts')}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="callout" style={{ flex: 1 }}>
            {t('zakat.deductDebts')}
          </Text>
          <Switch value={opts.deductDebts} onValueChange={(v) => setOpts((o) => ({ ...o, deductDebts: v }))} label={t('zakat.deductDebts')} />
        </View>
      </Card>

      <SectionHeader title={t('zakat.prices')} />
      <Card style={{ gap: space.md }}>
        {field('goldPricePerGram', 'zakat.goldPrice')}
        {field('silverPricePerGram', 'zakat.silverPrice')}
        <Notice text={t('zakat.pricesNote')} />
        <Text variant="footnote" color="textMuted">
          {t('zakat.nisabStandard')}
        </Text>
        <SegmentedControl
          testID="nisab-standard"
          value={opts.nisabStandard}
          onChange={(v) => setOpts((o) => ({ ...o, nisabStandard: v }))}
          options={[
            { value: 'silver', label: t('zakat.nisabSilver') },
            { value: 'gold', label: t('zakat.nisabGold') },
          ]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="callout" style={{ flex: 1 }}>
            {t('zakat.hawl')}
          </Text>
          <Switch value={opts.hawlComplete} onValueChange={(v) => setOpts((o) => ({ ...o, hawlComplete: v }))} label={t('zakat.hawl')} />
        </View>
      </Card>

      <SectionHeader title={t('zakat.result')} />
      <Card tone="primary" testID="zakat-result">
        {result ? (
          <>
            {row('zakat.totalAssets', result.totalAssets)}
            {row('zakat.deductions', result.deductions)}
            {row('zakat.netWealth', result.netWealth)}
            {row('zakat.nisabValue', result.nisabValue)}
            <Divider style={{ marginVertical: space.sm }} />
            {row('zakat.zakatDue', result.zakatDue, true, 'zakat-due')}
            {result.reason !== 'due' ? (
              <Text variant="footnote" color="textMuted" style={{ marginTop: space.sm }} testID="zakat-reason">
                {t(result.reason === 'below_nisab' ? 'zakat.below' : result.reason === 'hawl_incomplete' ? 'zakat.hawlIncomplete' : 'zakat.missingPrice')}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="subhead" color="danger">
            {t('zakat.invalid')}
          </Text>
        )}
      </Card>

      <SectionHeader title={t('zakat.methodology')} />
      <Card tone="muted">
        <Text variant="subhead" color="textMuted">
          {t('zakat.methodologyBody')}
        </Text>
      </Card>
    </Screen>
  );
}
