import { router } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import BookHeart from 'lucide-react-native/icons/book-heart';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import Compass from 'lucide-react-native/icons/compass';
import History from 'lucide-react-native/icons/rotate-ccw-clock';
import MapPin from 'lucide-react-native/icons/map-pin';
import MoonStar from 'lucide-react-native/icons/moon-star';
import Settings2 from 'lucide-react-native/icons/settings-2';
import Volume2 from 'lucide-react-native/icons/volume-2';
import Landmark from 'lucide-react-native/icons/landmark';
import { Linking, Platform, View } from 'react-native';

import { logsRepo } from '@/database/repositories/user';
import { mosqueSearchUrl } from '@/services/mosques/mapsUrl';
import { nightTimes } from '@/services/prayer/night';
import { addDays } from '@/utils/date';
import { Text } from '@/design-system/Text';
import { Card, EmptyState, FadeIn, IconButton, ListGroup, ListRow, Notice, SectionHeader } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { space } from '@/design-system/tokens';
import { PrayerHero } from '@/features/prayer/PrayerHero';
import { PrayerSchedule } from '@/features/prayer/PrayerSchedule';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useNow } from '@/hooks/useNow';
import { usePrayerTimes } from '@/hooks/usePrayer';
import { useDbs, useI18n, useSettings, useTheme } from '@/runtime/AppProvider';

export default function PrayerTab() {
  const { t } = useI18n();
  const [settings] = useSettings();
  const { colors } = useTheme();
  const dbs = useDbs();
  const fmt = useFormat();
  const now = useNow(1000);
  const { schedule, next } = usePrayerTimes(now);
  const dayKey = now.toDateString();
  const log = useLoader(() => logsRepo.prayersOn(dbs.user, new Date()), [dbs, dayKey]);
  const week = useLoader(async () => (await logsRepo.prayerHistory(dbs.user, addDays(new Date(), -6))).reduce((s, d) => s + d.done, 0), [dbs, dayKey]);
  const { config } = usePrayerTimes(now);
  const night = config ? nightTimes(config, now.getHours() < 12 ? addDays(now, -1) : now) : null;

  return (
    <Screen
      title={t('prayer.title')}
      subtitle={settings.location ? `${fmt.placeName(settings.location)} · ${fmt.hijri(now)}` : undefined}
      large
      tabBarInset
      testID="prayer-tab"
      actions={
        <IconButton icon={Settings2} label={t('prayer.settings')} onPress={() => router.push('/settings/prayer')} tone="filled" testID="prayer-settings" />
      }
    >
      {schedule && next ? (
        <>
          <FadeIn index={0}>
            <PrayerHero next={next} today={schedule.times} now={now} placeName={fmt.placeName(settings.location)} />
          </FadeIn>
          <FadeIn index={1}>
            <SectionHeader title={t('prayer.schedule')} />
            <PrayerSchedule times={schedule.times} next={next} now={now} log={log.data ?? {}} />
          </FadeIn>
          {night ? (
            <FadeIn index={2}>
              <SectionHeader title={t('prayerExtra.nightTitle')} />
              <Card testID="night-times">
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  {(
                    [
                      [t('prayerExtra.middleOfNight'), night.middle],
                      [t('prayerExtra.lastThird'), night.lastThird],
                    ] as const
                  ).map(([label, time]) => (
                    <View key={label} style={{ flex: 1, gap: space.xs }}>
                      <MoonStar size={18} color={colors.accent} />
                      <Text variant="footnote" color="textMuted">
                        {label}
                      </Text>
                      <Text variant="title3">{fmt.time(time)}</Text>
                    </View>
                  ))}
                </View>
                <Text variant="caption" color="textFaint" style={{ marginTop: space.sm }}>
                  {t('prayerExtra.nightNote')}
                </Text>
              </Card>
            </FadeIn>
          ) : null}
          <FadeIn index={3}>
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <Text variant="footnote" color="textMuted" testID="prayer-week">
                {t('prayerExtra.stats')} · {t('prayerExtra.statsBody', { count: week.data ?? 0 })}
              </Text>
              <Notice text={t('prayer.calculatedNote', { method: fmt.methodName(settings.prayer.method) })} />
            </View>
          </FadeIn>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={MapPin}
            title={t('home.setLocationTitle')}
            body={t('home.setLocationBody')}
            action={t('prayer.changeLocation')}
            onAction={() => router.push('/settings/location')}
          />
        </Card>
      )}

      <FadeIn index={3}>
        <SectionHeader title={t('prayer.tools')} />
        <ListGroup>
          <ListRow
            icon={Volume2}
            iconTone="accent"
            title={t('adhan.title')}
            subtitle={t('adhan.library')}
            onPress={() => router.push('/adhan')}
            testID="row-adhan"
          />
          <ListRow icon={Compass} title={t('prayer.qibla')} onPress={() => router.push('/qibla')} testID="row-qibla" />
          <ListRow
            icon={Landmark}
            title={t('prayer.nearbyMosques')}
            subtitle={t('prayer.nearbyMosquesBody')}
            onPress={() => {
              const loc = settings.location;
              if (!loc) return router.push('/settings/location');
              const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
              Linking.openURL(mosqueSearchUrl(loc.latitude, loc.longitude, platform)).catch(() => undefined);
            }}
            testID="row-mosques"
          />
          <ListRow icon={BookHeart} iconTone="accent" title={t('prayer.adhkar')} onPress={() => router.push('/adhkar')} testID="row-adhkar" />
          <ListRow icon={CircleDot} title={t('prayer.tasbih')} onPress={() => router.push('/tasbih')} testID="row-tasbih" />
          <ListRow icon={Bell} title={t('reminders.title')} onPress={() => router.push('/reminders')} testID="row-reminders" />
          <ListRow icon={History} iconTone="muted" title={t('qada.title')} onPress={() => router.push('/qada')} testID="row-qada" />
          <ListRow icon={CalendarDays} iconTone="accent" title={t('more.calendar')} onPress={() => router.push('/calendar')} last testID="row-calendar" />
        </ListGroup>
      </FadeIn>
    </Screen>
  );
}
