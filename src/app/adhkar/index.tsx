import { router } from 'expo-router';
import BedDouble from 'lucide-react-native/icons/bed-double';
import BookOpen from 'lucide-react-native/icons/book-open';
import Heart from 'lucide-react-native/icons/heart';
import Moon from 'lucide-react-native/icons/moon';
import Sun from 'lucide-react-native/icons/sun';
import Sunrise from 'lucide-react-native/icons/sunrise';
import Users2 from 'lucide-react-native/icons/users-round';
import { useState } from 'react';
import { View } from 'react-native';

import { ADHKAR_GROUPS, HISN } from '@/content/adhkar/groups';
import { adhkarRepo } from '@/database/repositories/content';
import { dhikrRepo } from '@/database/repositories/user';
import { Card, FadeIn, ProgressRing, SectionHeader, TextField } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { completion, loadCollection, sessionCollection } from '@/features/adhkar/data';
import { GROUP_ICONS } from '@/features/adhkar/groupIcons';
import { useDebounced } from '@/hooks/useDebounced';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';

function QuickTile({ icon, label, onPress, testID }: { icon: typeof Sun; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      accessibilityLabel={label}
      style={{
        flex: 1,
        minWidth: '30%',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Icon icon={icon} color="primary" />
      <Text variant="caption" align="center" numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

export default function AdhkarIndex() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const session = sessionCollection(new Date());

  const data = useLoader(async () => {
    if (quranStatus !== 'ready') return null;
    const [counts, favorites, groupCounts] = await Promise.all([
      dhikrRepo.countsOn(dbs.user, new Date()),
      dhikrRepo.favorites(dbs.user),
      adhkarRepo.groupCounts(dbs.content),
    ]);
    const titles = { morning: '', evening: '', quranDuas: '', favorites: '' };
    const [m, e] = await Promise.all([loadCollection(dbs.content, 'morning', lang, titles), loadCollection(dbs.content, 'evening', lang, titles)]);
    return { counts, favorites, groupCounts, morning: completion(m.items, 'morning', counts), evening: completion(e.items, 'evening', counts) };
  }, [quranStatus, lang]);

  const results = useLoader(async () => (query.length >= 2 ? adhkarRepo.search(dbs.content, query, 30) : []), [query]);

  const daily = (id: 'morning' | 'evening') => {
    const p = data.data?.[id] ?? { done: 0, total: 0 };
    const active = id === session;
    return (
      <Card
        key={id}
        onPress={() => router.push(`/adhkar/${id}`)}
        testID={`collection-${id}`}
        tone={active ? 'primary' : 'surface'}
        style={{ flex: 1, gap: space.sm, minHeight: 150 }}
        accessibilityLabel={t(id === 'morning' ? 'adhkarMore.morning' : 'adhkarMore.evening')}
      >
        <ProgressRing progress={p.total ? p.done / p.total : 0} size={52} stroke={4} color={p.total && p.done === p.total ? 'accent' : 'primary'}>
          <Icon icon={id === 'morning' ? Sun : Moon} size={20} color="primary" />
        </ProgressRing>
        <Text variant="headline">{t(id === 'morning' ? 'adhkarMore.morning' : 'adhkarMore.evening')}</Text>
        <Text variant="caption" color="textMuted">
          {t(id === 'morning' ? 'adhkarMore.morningBody' : 'adhkarMore.eveningBody')}
        </Text>
        <Text variant="caption" color="accent" weight="semibold">
          {t('common.of', { done: fmt.digits(p.done), total: fmt.digits(p.total) })}
        </Text>
      </Card>
    );
  };

  return (
    <Screen back title={t('adhkar.title')} large testID="adhkar-index">
      <TextField value={q} onChangeText={setQ} placeholder={t('adhkar.search')} testID="adhkar-search" autoCorrect={false} />
      {query.length >= 2 ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {(results.data ?? []).length === 0 && !results.loading ? (
            <Text variant="footnote" color="textMuted">
              {t('search.empty', { query })}
            </Text>
          ) : null}
          {(results.data ?? []).map((r) => (
            <Card key={r.id} onPress={() => router.push(`/adhkar/${encodeURIComponent(r.categoryId)}`)} testID={`adhkar-hit-${r.id}`}>
              <Text script="arabic" variant="callout" numberOfLines={3} style={{ fontFamily: 'Amiri_400Regular', lineHeight: 30 }}>
                {r.textAr}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <>
          <FadeIn index={0}>
            <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
              {daily('morning')}
              {daily('evening')}
            </View>
          </FadeIn>
          <FadeIn index={1}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
              <QuickTile icon={BedDouble} label={t('adhkar.sleep')} onPress={() => router.push(`/adhkar/hisn:${HISN.sleep}`)} testID="quick-sleep" />
              <QuickTile icon={Sunrise} label={t('adhkarMore.waking')} onPress={() => router.push(`/adhkar/hisn:${HISN.waking}`)} testID="quick-waking" />
              <QuickTile
                icon={Users2}
                label={t('adhkarMore.afterPrayer')}
                onPress={() => router.push(`/adhkar/hisn:${HISN.afterPrayer}`)}
                testID="quick-after-prayer"
              />
            </View>
          </FadeIn>
          <FadeIn index={2}>
            <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
              <Card onPress={() => router.push('/adhkar/quran-duas')} testID="collection-quran-duas" style={{ flex: 1, gap: space.xs }} tone="accent">
                <Icon icon={BookOpen} color="accent" />
                <Text variant="headline">{t('adhkarMore.quranDuas')}</Text>
                <Text variant="caption" color="textMuted" numberOfLines={3}>
                  {t('adhkarMore.quranDuasBody')}
                </Text>
              </Card>
              <Card onPress={() => router.push('/adhkar/favorites')} testID="collection-favorites" style={{ flex: 1, gap: space.xs }}>
                <Icon icon={Heart} color="danger" />
                <Text variant="headline">{t('adhkar.favorites')}</Text>
                <Text variant="caption" color="textMuted">
                  {data.data?.favorites.length ? t('adhkarMore.dhikrCount', { count: data.data.favorites.length }) : t('adhkar.noFavorites')}
                </Text>
              </Card>
            </View>
          </FadeIn>
          <SectionHeader title={t('adhkarMore.browse')} />
          <View style={{ gap: space.sm }}>
            {ADHKAR_GROUPS.map((g, i) => (
              <FadeIn key={g.id} index={i + 3}>
                <PressableScale
                  onPress={() => router.push(`/adhkar/group/${g.id}`)}
                  testID={`group-${g.id}`}
                  accessibilityLabel={t(g.title)}
                  scaleTo={0.99}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    padding: space.md,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: i % 2 ? colors.accentSoft : colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon={GROUP_ICONS[g.id]} size={20} color={i % 2 ? 'accent' : 'primary'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="callout">{t(g.title)}</Text>
                    <Text variant="caption" color="textMuted">
                      {t('adhkarMore.chaptersCount', { count: data.data?.groupCounts[g.id] ?? g.chapters.length })}
                    </Text>
                  </View>
                </PressableScale>
              </FadeIn>
            ))}
          </View>
          <Text variant="caption" color="textFaint" align="center" style={{ marginTop: space.lg }}>
            {t('adhkarMore.sourceHisn')}
          </Text>
        </>
      )}
    </Screen>
  );
}
