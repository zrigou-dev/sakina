import { View } from 'react-native';

import { qadaRepo, QADA_KINDS, type QadaKind } from '@/database/repositories/user';
import { Card, SectionHeader, Stepper } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, type TKey } from '@/runtime/AppProvider';

export default function Qada() {
  const { t } = useI18n();
  const dbs = useDbs();
  const fmt = useFormat();
  const data = useLoader(() => qadaRepo.all(dbs.user), [dbs]);
  const values = data.data;

  const row = (k: QadaKind) => (
    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
      <View style={{ flex: 1 }}>
        <Text variant="callout">{k === 'fast' ? t('qada.fasts') : t(`prayers.${k}` as TKey)}</Text>
        <Text variant="caption" color="textMuted">
          {t('qada.remaining', { count: values?.[k] ?? 0 })}
        </Text>
      </View>
      <Stepper
        testID={`qada-${k}`}
        label={k === 'fast' ? t('qada.fasts') : t(`prayers.${k}` as TKey)}
        value={values?.[k] ?? 0}
        min={0}
        max={99999}
        format={(v) => fmt.digits(v)}
        onChange={async (v) => {
          await qadaRepo.adjust(dbs.user, k, v - (values?.[k] ?? 0));
          bumpDataVersion();
        }}
      />
    </View>
  );

  return (
    <Screen back title={t('qada.title')} subtitle={t('qada.intro')} large testID="qada-screen">
      <SectionHeader title={t('qada.prayers')} style={{ marginTop: 0 }} />
      <Card>{QADA_KINDS.filter((k) => k !== 'fast').map(row)}</Card>
      <SectionHeader title={t('qada.fasts')} />
      <Card>{row('fast')}</Card>
      <Text variant="footnote" color="textMuted" style={{ marginTop: space.md }}>
        {t('journey.encouragement')}
      </Text>
    </Screen>
  );
}
