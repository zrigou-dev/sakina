import { router } from 'expo-router';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import MapPin from 'lucide-react-native/icons/map-pin';
import { View } from 'react-native';

import { CityPicker } from '@/features/location/CityPicker';
import { useLocate } from '@/features/location/useLocate';
import { Button, Card, Notice } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useSettings } from '@/runtime/AppProvider';
import type { SavedLocation } from '@/state/settings';

export default function LocationSettings() {
  const { t } = useI18n();
  const [settings, update] = useSettings();
  const fmt = useFormat();
  const { state, locate } = useLocate();

  const apply = async (loc: SavedLocation) => {
    await update({ location: loc });
    if (router.canGoBack()) router.back();
  };

  return (
    <Screen back title={t('prayer.location')} subtitle={t('onboarding.locationBody')} large testID="location-screen">
      <View style={{ gap: space.md }}>
        {settings.location ? (
          <Card tone="primary">
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Icon icon={MapPin} color="primary" />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{fmt.placeName(settings.location)}</Text>
                <Text variant="footnote" color="textMuted">
                  {fmt.number(settings.location.latitude, 4)}, {fmt.number(settings.location.longitude, 4)}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}
        {state === 'denied' ? <Notice tone="warning" text={t('onboarding.locationDenied')} /> : null}
        {state === 'failed' ? <Notice tone="warning" text={t('onboarding.locationFailed')} /> : null}
        <Button
          label={state === 'locating' ? t('onboarding.locating') : t('onboarding.useLocation')}
          icon={LocateFixed}
          loading={state === 'locating'}
          onPress={async () => {
            const loc = await locate();
            if (loc) await apply(loc);
          }}
        />
        <CityPicker onSelect={apply} />
      </View>
    </Screen>
  );
}
