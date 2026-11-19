import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Heart from 'lucide-react-native/icons/heart';
import Pause from 'lucide-react-native/icons/pause';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Share2 from 'lucide-react-native/icons/share-2';
import Volume2 from 'lucide-react-native/icons/volume-2';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { dhikrRepo } from '@/database/repositories/user';
import { Badge, Card, EmptyState, FadeIn, IconButton, Notice, ProgressBar, ProgressRing, Skeleton } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { completion, loadCollection, progressKey, type DhikrView } from '@/features/adhkar/data';
import { AyahText } from '@/features/quran/AyahText';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';

const ARABIC = /[؀-ۿ]/;

const DhikrCard = memo(function DhikrCard({
  item,
  count,
  favorite,
  playing,
  onCount,
  onReset,
  onFavorite,
  onAudio,
}: {
  item: DhikrView;
  count: number;
  favorite: boolean;
  playing: boolean;
  onCount: () => void;
  onReset: () => void;
  onFavorite: () => void;
  onAudio: () => void;
}) {
  const { t } = useI18n();
  const { colors, reducedMotion } = useTheme();
  const fmt = useFormat();
  const [open, setOpen] = useState(false);
  const done = count >= item.target;
  const bloom = useSharedValue(0);
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ scale: 0.6 + 0.4 * bloom.value }] }));

  useEffect(() => {
    if (done && !reducedMotion) bloom.set(withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 900 })));
  }, [done, reducedMotion, bloom]);

  const hasDetails = !!(item.virtue || item.reference);
  return (
    <Card testID={`dhikr-${item.id}`} style={{ gap: space.md, borderWidth: done ? 1.5 : undefined, borderColor: done ? colors.accent : undefined }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {done ? (
            <Badge label={t('adhkar.completed')} tone="success" />
          ) : (
            <Badge label={item.countLabel ?? t('adhkar.repeat', { count: item.target })} tone={item.target > 1 ? 'accent' : 'muted'} />
          )}
        </View>
        {item.audioUrl ? (
          <IconButton
            icon={playing ? Pause : Volume2}
            label={playing ? t('adhkarMore.stopListening') : t('adhkarMore.listen')}
            size={18}
            color="textMuted"
            onPress={onAudio}
          />
        ) : null}
        <IconButton
          icon={Share2}
          label={t('share.share')}
          size={18}
          color="textMuted"
          onPress={() => Share.share({ message: `${item.text}${item.reference ? `\n\n— ${item.reference}` : ''}\n\n${t('share.via')}` }).catch(() => undefined)}
        />
        <IconButton icon={RotateCcw} label={t('common.reset')} size={18} color="textMuted" onPress={onReset} />
        <IconButton
          icon={Heart}
          label={favorite ? t('adhkar.removeFavorite') : t('adhkar.addFavorite')}
          size={18}
          color={favorite ? 'danger' : 'textMuted'}
          onPress={onFavorite}
          selected={favorite}
          testID={`fav-${item.id}`}
        />
      </View>
      {item.isQuran ? (
        <AyahText text={item.text} ayah={item.ayah} size={24} />
      ) : (
        <Text script="arabic" variant="title3" selectable style={{ fontFamily: 'Amiri_400Regular', fontSize: 22, lineHeight: 44 }}>
          {item.text}
        </Text>
      )}
      {item.translation ? (
        <View style={{ gap: 2 }}>
          {item.translationIsEnglishFallback ? (
            <Text variant="caption" color="textFaint">
              {t('adhkarMore.translationEnglish')}
            </Text>
          ) : null}
          <Text variant="subhead" color="textMuted" script="latin" selectable>
            {item.translation}
          </Text>
        </View>
      ) : null}
      {hasDetails ? (
        <PressableScale onPress={() => setOpen((o) => !o)} scaleTo={0.99} aria-expanded={open} testID={`details-${item.id}`} style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Text variant="footnote" weight="semibold" color="accent" style={{ flex: 1 }}>
              {[item.virtue ? t('adhkarMore.virtue') : null, item.reference ? t('adhkarMore.reference') : null].filter(Boolean).join(' · ')}
            </Text>
            <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
              <Icon icon={ChevronDown} size={16} color="accent" />
            </View>
          </View>
          {open ? (
            <View style={{ gap: space.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: space.md }}>
              {item.virtue ? (
                <Text variant="footnote" color="textMuted" script={ARABIC.test(item.virtue) ? 'arabic' : 'latin'} selectable>
                  {item.virtue}
                </Text>
              ) : null}
              {item.reference ? (
                <Text variant="caption" color="textFaint" script={ARABIC.test(item.reference) ? 'arabic' : 'latin'} selectable>
                  {item.reference}
                </Text>
              ) : null}
            </View>
          ) : null}
        </PressableScale>
      ) : null}
      <PressableScale
        onPress={onCount}
        haptic="light"
        disabled={done}
        testID={`count-${item.id}`}
        accessibilityLabel={`${t('adhkar.tapToCount')}: ${t('adhkar.count', { done: count, total: item.target })}`}
        style={{ alignSelf: 'center' }}
      >
        <ProgressRing progress={count / item.target} size={80} stroke={5} color={done ? 'accent' : 'primary'}>
          <Text variant="headline" align="center" fixedSize>
            {fmt.digits(count)}/{fmt.digits(item.target)}
          </Text>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, bloomStyle]}>
            <EightPointStar size={104} color={colors.accent} />
          </Animated.View>
        </ProgressRing>
      </PressableScale>
    </Card>
  );
});

export default function AdhkarCollection() {
  const { collection: raw } = useLocalSearchParams<{ collection: string }>();
  const collectionId = decodeURIComponent(raw ?? '');
  const { t, lang } = useI18n();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const player = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    dhikrRepo
      .countsOn(dbs.user, new Date())
      .then(setCounts)
      .catch(() => undefined);
    dhikrRepo
      .favorites(dbs.user)
      .then(setFavorites)
      .catch(() => undefined);
    return () => {
      player.current?.remove();
      player.current = null;
    };
  }, [dbs]);

  const data = useLoader(async () => {
    if (quranStatus !== 'ready') return null;
    const favs = collectionId === 'favorites' ? await dhikrRepo.favorites(dbs.user) : [];
    return loadCollection(
      dbs.content,
      collectionId,
      lang,
      { morning: t('adhkarMore.morning'), evening: t('adhkarMore.evening'), quranDuas: t('adhkarMore.quranDuas'), favorites: t('adhkar.favorites') },
      favs,
    );
  }, [collectionId, quranStatus, lang]);

  const setCount = useCallback(
    async (key: string, value: number) => {
      setCounts((c) => ({ ...c, [key]: value }));
      await dhikrRepo.setCount(dbs.user, new Date(), key, value);
      bumpDataVersion();
    },
    [dbs],
  );

  const toggleAudio = useCallback(
    (item: DhikrView) => {
      if (!item.audioUrl) return;
      if (!player.current) {
        player.current = createAudioPlayer(null);
        player.current.addListener('playbackStatusUpdate', (s) => {
          if (s.didJustFinish) setPlayingId(null);
        });
      }
      if (playingId === item.id) {
        player.current.pause();
        setPlayingId(null);
        return;
      }
      player.current.replace({ uri: item.audioUrl });
      player.current.play();
      setPlayingId(item.id);
    },
    [playingId],
  );

  const items = useMemo(() => data.data?.items ?? [], [data.data]);
  const prog = completion(items, collectionId, counts);
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const isHisn = collectionId.startsWith('hisn:');

  return (
    <Screen back title={data.data?.title ?? ''} subtitle={data.data?.subtitle ?? undefined} large testID="adhkar-collection">
      {items.length ? (
        <View style={{ gap: space.xs, marginBottom: space.md }}>
          <Text variant="footnote" color="textMuted" testID="adhkar-progress">
            {t('common.of', { done: fmt.digits(prog.done), total: fmt.digits(prog.total) })}
          </Text>
          <ProgressBar progress={prog.total ? prog.done / prog.total : 0} color="accent" />
        </View>
      ) : null}
      {prog.total > 0 && prog.done === prog.total ? (
        <View style={{ marginBottom: space.md }}>
          <Notice tone="accent" text={t('adhkar.allCompleted')} />
        </View>
      ) : null}
      <View style={{ gap: space.md }}>
        {data.loading && !data.data ? (
          <>
            <Skeleton height={200} />
            <Skeleton height={160} />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={collectionId === 'favorites' ? t('adhkar.favorites') : t('common.errorTitle')}
            body={collectionId === 'favorites' ? t('adhkar.noFavorites') : undefined}
          />
        ) : (
          items.map((item, i) => {
            const key = progressKey(collectionId, item.id);
            return (
              <FadeIn key={item.id} index={i}>
                <DhikrCard
                  item={item}
                  count={counts[key] ?? 0}
                  favorite={favSet.has(item.id)}
                  playing={playingId === item.id}
                  onAudio={() => toggleAudio(item)}
                  onCount={() => {
                    const next = Math.min(item.target, (counts[key] ?? 0) + 1);
                    if (next === item.target && process.env.EXPO_OS !== 'web')
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                    void setCount(key, next);
                  }}
                  onReset={() => void setCount(key, 0)}
                  onFavorite={async () => {
                    const on = await dhikrRepo.toggleFavorite(dbs.user, item.id);
                    setFavorites((f) => (on ? [item.id, ...f] : f.filter((x) => x !== item.id)));
                    bumpDataVersion();
                  }}
                />
              </FadeIn>
            );
          })
        )}
      </View>
      {items.length ? (
        <Text variant="caption" color="textFaint" align="center" style={{ marginTop: space.lg }}>
          {collectionId === 'quran-duas' ? t('quran.textSource') : isHisn ? t('adhkarMore.sourceHisn') : t('adhkarMore.sourceMe')}
        </Text>
      ) : null}
    </Screen>
  );
}
