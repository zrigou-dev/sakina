import Gauge from 'lucide-react-native/icons/gauge';
import Moon from 'lucide-react-native/icons/moon';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import Repeat from 'lucide-react-native/icons/repeat';
import Repeat1 from 'lucide-react-native/icons/repeat-1';
import SkipBack from 'lucide-react-native/icons/skip-back';
import SkipForward from 'lucide-react-native/icons/skip-forward';
import X from 'lucide-react-native/icons/x';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { IconButton, Notice } from '@/design-system/components';
import { PressableScale } from '@/design-system/PressableScale';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useNow } from '@/hooks/useNow';
import { useI18n, useSettings, useTheme } from '@/runtime/AppProvider';
import { useAudio, usePlayerState } from '@/services/audio/AudioProvider';
import { reciterById } from '@/services/downloads/catalogue';
import { getSurah } from '@/services/quran/navigation';

const REPEATS = [1, 3, 5, 10];
const RATES = [1, 1.25, 1.5, 0.75];
const SLEEP = [null, 15, 30, 60] as const;

function Pill({ label, onPress, active, icon: IconC, testID }: { label: string; onPress: () => void; active?: boolean; icon: typeof Gauge; testID?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: space.sm,
        minHeight: 32,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.primarySoft : colors.surfaceMuted,
      }}
    >
      <IconC size={14} color={active ? colors.primary : colors.textMuted} />
      <Text variant="caption" color={active ? 'primary' : 'textMuted'}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Compact recitation controls: play/pause, ayah navigation, repetition, speed and sleep timer. */
export function MiniPlayer() {
  const audio = useAudio();
  const st = usePlayerState();
  const [settings] = useSettings();
  const { t } = useI18n();
  const { colors, reducedMotion } = useTheme();
  const fmt = useFormat();
  const now = useNow(15_000);
  if (!st.queue) return null;
  const q = st.queue;
  const reciter = reciterById(settings.quran.reciter);
  const sleepIdx = SLEEP.findIndex((m) => (m === null ? st.sleepAt === null : false));
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(260)}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(180)}
      testID="mini-player"
      style={{ backgroundColor: colors.bgElevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm }}
    >
      {st.error ? <Notice tone="warning" text={st.error === 'offline' ? t('audio.offlineUnavailable') : t('audio.loadError')} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <View style={{ flex: 1 }}>
          <Text variant="callout" numberOfLines={1}>
            {fmt.surahShort(getSurah(q.surah))} · {fmt.digits(q.current)}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {settings.language === 'ar' ? reciter.nameAr : reciter.nameLatin} ·{' '}
            {st.source === 'local' ? t('audio.downloaded') : st.source === 'stream' ? t('audio.streaming') : ''}
          </Text>
        </View>
        <IconButton icon={SkipBack} label={t('audio.previous')} onPress={() => audio.previous()} directional size={20} />
        <PressableScale
          onPress={() => audio.toggle()}
          testID="player-toggle"
          accessibilityLabel={st.playing ? t('audio.pause') : t('audio.play')}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          {st.playing ? <Pause size={22} color={colors.primaryInk} /> : <Play size={22} color={colors.primaryInk} />}
        </PressableScale>
        <IconButton icon={SkipForward} label={t('audio.next')} onPress={() => audio.next()} directional size={20} />
        <IconButton icon={X} label={t('audio.stop')} onPress={() => audio.stop()} size={20} testID="player-stop" />
      </View>
      <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
        <Pill
          icon={Repeat1}
          active={q.repeatAyah > 1}
          testID="player-repeat"
          label={q.repeatAyah > 1 ? `${t('audio.repeatAyah')} ${t('audio.repeatTimes', { count: q.repeatAyah })}` : t('audio.repeatOff')}
          onPress={() => audio.setRepeatAyah(REPEATS[(REPEATS.indexOf(q.repeatAyah) + 1) % REPEATS.length]!)}
        />
        <Pill icon={Repeat} active={q.repeatRange} label={t('audio.repeatRange')} onPress={() => audio.setRepeatRange(!q.repeatRange)} />
        <Pill
          icon={Gauge}
          active={st.rate !== 1}
          label={`${fmt.number(st.rate)}×`}
          onPress={() => audio.setRate(RATES[(RATES.indexOf(st.rate) + 1) % RATES.length]!)}
        />
        <Pill
          icon={Moon}
          active={st.sleepAt !== null}
          label={st.sleepAt ? t('audio.sleepIn', { min: Math.max(1, Math.round((st.sleepAt - now.getTime()) / 60_000)) }) : t('audio.sleepTimer')}
          onPress={() => {
            const cur = st.sleepAt === null ? 0 : Math.max(1, sleepIdx);
            audio.setSleepTimer(SLEEP[(cur + 1) % SLEEP.length] ?? null);
          }}
        />
      </View>
    </Animated.View>
  );
}
