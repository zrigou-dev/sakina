import { router } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import BookOpen from 'lucide-react-native/icons/book-open';
import BookOpenCheck from 'lucide-react-native/icons/book-open-check';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import Compass from 'lucide-react-native/icons/compass';
import Coins from 'lucide-react-native/icons/coins';
import Library from 'lucide-react-native/icons/library';
import MapPin from 'lucide-react-native/icons/map-pin';
import Moon from 'lucide-react-native/icons/moon';
import Search from 'lucide-react-native/icons/search';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Sun from 'lucide-react-native/icons/sun';
import Target from 'lucide-react-native/icons/target';
import Volume2 from 'lucide-react-native/icons/volume-2';
import { View } from 'react-native';

import { Badge, Card, FadeIn, IconButton, ProgressRing, SectionHeader, Skeleton } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { completion, loadCollection, sessionCollection } from '@/features/adhkar/data';
import { DailyHadith } from '@/features/hadith/DailyHadith';
import { KhatmaCard } from '@/features/quran/KhatmaCard';
import { RamadanCard } from '@/features/prayer/RamadanCard';
import { PrayerHero } from '@/features/prayer/PrayerHero';
import { DailyVerse } from '@/features/quran/DailyVerse';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useNow } from '@/hooks/useNow';
import { usePrayerTimes } from '@/hooks/usePrayer';
import { dhikrRepo, logsRepo, memorizationRepo, readingRepo } from '@/database/repositories/user';
import { useDbs, useI18n, useRuntime, useSettings, useTheme, type TKey } from '@/runtime/AppProvider';
import { upcomingOccasions } from '@/services/hijri/occasions';
import { getSurah } from '@/services/quran/navigation';

function greetingKey(hour: number): TKey {
  if (hour >= 4 && hour < 12) return 'greeting.morning';
  if (hour >= 12 && hour < 17) return 'greeting.afternoon';
  if (hour >= 17 && hour < 22) return 'greeting.evening';
  return 'greeting.night';
}

function GoalTile({
  label,
  progress,
  value,
  icon,
  onPress,
  testID,
}: {
  label: string;
  progress: number;
  value: string;
  icon: typeof Sun;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <PressableScale onPress={onPress} testID={testID} accessibilityLabel={`${label}, ${value}`} style={{ flex: 1, alignItems: 'center', gap: space.sm }}>
      <ProgressRing progress={progress} size={64} stroke={5} color={progress >= 1 ? 'accent' : 'primary'}>
        <Icon icon={icon} size={20} color={progress >= 1 ? 'accent' : 'primary'} />
      </ProgressRing>
      <Text variant="caption" align="center" numberOfLines={2}>
        {label}
      </Text>
      <Text variant="caption" color="textMuted" align="center">
        {value}
      </Text>
    </PressableScale>
  );
}

function ToolTile({ icon, label, onPress, testID }: { icon: typeof Sun; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} testID={testID} accessibilityLabel={label} style={{ width: '22%', flexGrow: 1, alignItems: 'center', gap: space.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} color="primary" />
      </View>
      <Text variant="caption" align="center" numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [settings] = useSettings();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const now = useNow(1000);
  const { schedule, next } = usePrayerTimes(now);
  const dayKey = now.toDateString();

  const data = useLoader(async () => {
    const session = sessionCollection(new Date());
    const [position, ayahsToday, counts, mem, prayers, collection] = await Promise.all([
      readingRepo.getPosition(dbs.user),
      readingRepo.ayahsReadOn(dbs.user, new Date()),
      dhikrRepo.countsOn(dbs.user, new Date()),
      memorizationRepo.stats(dbs.user, new Date()),
      logsRepo.prayersOn(dbs.user, new Date()),
      quranStatus === 'ready' ? loadCollection(dbs.content, session, 'ar', { morning: '', evening: '', quranDuas: '', favorites: '' }) : Promise.resolve(null),
    ]);
    const adhkar = collection ? completion(collection.items, session, counts) : { done: 0, total: 0 };
    return { position, ayahsToday, mem, prayersLogged: Object.keys(prayers).length, adhkar };
  }, [dbs, dayKey, quranStatus]);

  const hour = now.getHours();
  const isMorning = sessionCollection(now) === 'morning';
  const morningProgress = data.data?.adhkar ?? { done: 0, total: 0 };
  const greeting = t(greetingKey(hour));
  const occasions = upcomingOccasions(now, settings.hijriOffset, 90).slice(0, 2);
  const goal = settings.goals;
  const position = data.data?.position;

  return (
    <Screen header={false} tabBarInset testID="home">
      <FadeIn index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: space.md, marginBottom: space.lg }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title1" accessibilityRole="header" testID="greeting">
              {settings.displayName ? t('greeting.named', { greeting, name: settings.displayName }) : greeting}
            </Text>
            <Text variant="subhead" color="accent" weight="medium">
              {fmt.hijri(now)}
            </Text>
            <Text variant="footnote" color="textMuted">
              {fmt.gregorian(now)}
            </Text>
          </View>
          <IconButton icon={Search} label={t('search.title')} tone="filled" onPress={() => router.push('/search')} testID="home-search" />
        </View>
      </FadeIn>

      <FadeIn index={1}>
        {next && schedule ? (
          <PrayerHero next={next} today={schedule.times} now={now} placeName={fmt.placeName(settings.location)} onPress={() => router.push('/prayer')} />
        ) : (
          <Card onPress={() => router.push('/settings/location')} testID="set-location" tone="accent">
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Icon icon={MapPin} color="accent" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="headline">{t('home.setLocationTitle')}</Text>
                <Text variant="footnote" color="textMuted">
                  {t('home.setLocationBody')}
                </Text>
              </View>
            </View>
          </Card>
        )}
      </FadeIn>

      <RamadanCard now={now} />

      <FadeIn index={2}>
        <SectionHeader title={t('home.dailyGoals')} action={t('journey.editGoals')} onAction={() => router.push('/journey')} />
        <Card>
          {data.loading && !data.data ? (
            <Skeleton height={96} />
          ) : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {goal.quranAyahs > 0 ? (
                <GoalTile
                  testID="goal-quran"
                  icon={BookOpen}
                  label={t('journey.goalQuran', { count: goal.quranAyahs })}
                  progress={(data.data?.ayahsToday ?? 0) / goal.quranAyahs}
                  value={t('common.of', { done: fmt.digits(Math.min(data.data?.ayahsToday ?? 0, goal.quranAyahs)), total: fmt.digits(goal.quranAyahs) })}
                  onPress={() => router.push(position ? `/quran/${position.surah}?ayah=${position.ayah}` : '/quran/1')}
                />
              ) : null}
              {(isMorning ? goal.morning : goal.evening) ? (
                <GoalTile
                  testID="goal-adhkar"
                  icon={isMorning ? Sun : Moon}
                  label={isMorning ? t('home.morningAdhkar') : t('home.eveningAdhkar')}
                  progress={morningProgress.total ? morningProgress.done / morningProgress.total : 0}
                  value={t('common.of', { done: fmt.digits(morningProgress.done), total: fmt.digits(morningProgress.total) })}
                  onPress={() => router.push(isMorning ? '/adhkar/morning' : '/adhkar/evening')}
                />
              ) : null}
              {goal.prayers ? (
                <GoalTile
                  testID="goal-prayers"
                  icon={CircleDot}
                  label={t('journey.goalPrayers')}
                  progress={(data.data?.prayersLogged ?? 0) / 5}
                  value={t('common.of', { done: fmt.digits(data.data?.prayersLogged ?? 0), total: fmt.digits(5) })}
                  onPress={() => router.push('/prayer')}
                />
              ) : null}
              {!goal.quranAyahs && !goal.morning && !goal.evening && !goal.prayers ? (
                <Text variant="subhead" color="textMuted" style={{ flex: 1 }}>
                  {t('home.goalsEmpty')}
                </Text>
              ) : null}
            </View>
          )}
        </Card>
      </FadeIn>

      <FadeIn index={3}>
        <SectionHeader title={t('home.dailyAyah')} />
        <DailyVerse date={now} />
        <SectionHeader title={t('hadith.daily')} action={t('common.seeAll')} onAction={() => router.push('/hadith')} />
        <DailyHadith date={now} />
      </FadeIn>
      <KhatmaCard />

      <FadeIn index={4}>
        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
          <Card
            style={{ flex: 1 }}
            testID="continue-reading"
            onPress={() => router.push(position ? `/quran/${position.surah}?ayah=${position.ayah}` : '/quran/1')}
            accessibilityLabel={position ? t('home.continueReading') : t('home.startReading')}
          >
            <Icon icon={BookOpen} color="primary" />
            <Text variant="headline" style={{ marginTop: space.md }}>
              {position ? t('home.continueReading') : t('home.startReading')}
            </Text>
            <Text variant="footnote" color="textMuted" numberOfLines={2}>
              {position
                ? t('quran.continueAt', { surah: fmt.surahShort(getSurah(position.surah)), ayah: fmt.digits(position.ayah) })
                : t('home.startReadingBody')}
            </Text>
          </Card>
          <Card
            style={{ flex: 1 }}
            testID="adhkar-shortcut"
            onPress={() => router.push(isMorning ? '/adhkar/morning' : '/adhkar/evening')}
            accessibilityLabel={isMorning ? t('home.morningAdhkar') : t('home.eveningAdhkar')}
          >
            <Icon icon={isMorning ? Sun : Moon} color="accent" />
            <Text variant="headline" style={{ marginTop: space.md }}>
              {isMorning ? t('home.morningAdhkar') : t('home.eveningAdhkar')}
            </Text>
            <Text variant="footnote" color="textMuted">
              {t('home.adhkarHint')}
            </Text>
          </Card>
        </View>
      </FadeIn>

      {data.data && (data.data.mem.learning > 0 || data.data.mem.memorized > 0) ? (
        <FadeIn index={5}>
          <Card style={{ marginTop: space.md }} onPress={() => router.push('/quran/memorization')} testID="continue-memorizing">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Icon icon={BookOpenCheck} color="primary" />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{t('home.continueMemorizing')}</Text>
                <Text variant="footnote" color="textMuted">
                  {t('home.reviewsDue', { count: data.data.mem.due })}
                </Text>
              </View>
              {data.data.mem.due > 0 ? <Badge label={fmt.digits(data.data.mem.due)} tone="accent" /> : null}
            </View>
          </Card>
        </FadeIn>
      ) : null}

      {occasions.length ? (
        <FadeIn index={6}>
          <SectionHeader title={t('home.upcoming')} action={t('common.seeAll')} onAction={() => router.push('/calendar')} />
          <Card padded={false}>
            {occasions.map((o, i) => (
              <View
                key={`${o.id}-${o.hijri.year}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.lg,
                  borderBottomWidth: i < occasions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: o.major ? colors.accentSoft : colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon icon={Sparkles} size={20} color={o.major ? 'accent' : 'textMuted'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="callout">{t(`occasions.${o.id}` as TKey)}</Text>
                  <Text variant="footnote" color="textMuted">
                    {fmt.gregorian(o.start)}
                  </Text>
                </View>
                <Text variant="footnote" weight="semibold" color={o.daysUntil <= 1 ? 'accent' : 'textMuted'}>
                  {t('home.daysUntil', { count: o.daysUntil })}
                </Text>
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn index={7}>
        <SectionHeader title={t('home.quickTools')} />
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', rowGap: space.lg }}>
          <ToolTile icon={Volume2} label={t('adhan.title')} onPress={() => router.push('/adhan')} testID="tool-adhan" />
          <ToolTile icon={Library} label={t('hadith.title')} onPress={() => router.push('/hadith')} testID="tool-hadith" />
          <ToolTile icon={Target} label={t('khatma.title')} onPress={() => router.push('/khatma')} testID="tool-khatma" />
          <ToolTile icon={Compass} label={t('prayer.qibla')} onPress={() => router.push('/qibla')} testID="tool-qibla" />
          <ToolTile icon={CircleDot} label={t('more.tasbih')} onPress={() => router.push('/tasbih')} testID="tool-tasbih" />
          <ToolTile icon={CalendarDays} label={t('more.calendar')} onPress={() => router.push('/calendar')} testID="tool-calendar" />
          <ToolTile icon={Coins} label={t('more.zakat')} onPress={() => router.push('/zakat')} testID="tool-zakat" />
          <ToolTile icon={Bell} label={t('reminders.title')} onPress={() => router.push('/reminders')} testID="tool-reminders" />
        </View>
      </FadeIn>
    </Screen>
  );
}
