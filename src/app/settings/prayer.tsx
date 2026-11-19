import { router } from 'expo-router';
import MapPin from 'lucide-react-native/icons/map-pin';
import { View } from 'react-native';

import { Card, Chip, ListGroup, ListRow, Notice, SectionHeader, SegmentedControl, Stepper } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useSettings, type TKey } from '@/runtime/AppProvider';
import { METHOD_IDS } from '@/services/prayer/methods';
import { PRAYERS, type HighLatitudeSetting } from '@/services/prayer/times';

export default function PrayerSettings() {
  const { t } = useI18n();
  const [settings, update] = useSettings();
  const fmt = useFormat();
  const p = settings.prayer;
  return (
    <Screen back title={t('prayer.settings')} large testID="prayer-settings-screen">
      <ListGroup>
        <ListRow
          icon={MapPin}
          title={t('prayer.location')}
          subtitle={fmt.placeName(settings.location) || '—'}
          onPress={() => router.push('/settings/location')}
          last
        />
      </ListGroup>

      <SectionHeader title={t('prayer.method')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {METHOD_IDS.map((m) => (
          <Chip key={m} label={fmt.methodName(m)} selected={p.method === m} onPress={() => update({ prayer: { method: m } })} testID={`set-method-${m}`} />
        ))}
      </View>
      <Text variant="footnote" color="textMuted" style={{ marginTop: space.sm }}>
        {fmt.methodAngles(p.method)}
      </Text>

      <SectionHeader title={t('prayer.asrMethod')} />
      <SegmentedControl
        value={p.madhab}
        onChange={(v) => update({ prayer: { madhab: v } })}
        options={[
          { value: 'shafi', label: t('onboarding.asrStandard') },
          { value: 'hanafi', label: t('onboarding.asrHanafi') },
        ]}
      />

      <SectionHeader title={t('prayer.highLatitude')} />
      <View style={{ gap: space.sm }}>
        {(
          [
            ['auto', 'prayer.highLatitudeAuto'],
            ['middle_of_the_night', 'prayer.highLatitudeMiddle'],
            ['seventh_of_the_night', 'prayer.highLatitudeSeventh'],
            ['twilight_angle', 'prayer.highLatitudeTwilight'],
          ] as [HighLatitudeSetting, TKey][]
        ).map(([v, k]) => (
          <Chip key={v} label={t(k)} selected={p.highLatitudeRule === v} onPress={() => update({ prayer: { highLatitudeRule: v } })} />
        ))}
        <Text variant="footnote" color="textMuted">
          {t('prayer.highLatitudeHelp')}
        </Text>
      </View>

      <SectionHeader title={t('prayer.adjustments')} />
      <Card style={{ gap: space.xs }}>
        {PRAYERS.map((name) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="callout">{t(`prayers.${name}` as TKey)}</Text>
            <Stepper
              testID={`adjust-${name}`}
              label={t(`prayers.${name}` as TKey)}
              value={p.adjustments[name]}
              min={-30}
              max={30}
              format={(v) => fmt.digits(v > 0 ? `+${v}` : v)}
              onChange={(v) => update({ prayer: { adjustments: { ...p.adjustments, [name]: v } } })}
            />
          </View>
        ))}
      </Card>
      <View style={{ marginTop: space.sm }}>
        <Notice text={t('prayer.adjustmentsHelp')} />
      </View>

      <SectionHeader title={t('prayer.timeFormat')} />
      <SegmentedControl
        value={p.timeFormat}
        onChange={(v) => update({ prayer: { timeFormat: v } })}
        options={[
          { value: '24h', label: t('prayer.format24') },
          { value: '12h', label: t('prayer.format12') },
        ]}
      />
    </Screen>
  );
}
