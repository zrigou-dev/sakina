import { router } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Loader from 'lucide-react-native/icons/loader';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import { View } from 'react-native';

import { Badge, Card, FadeIn, ProgressRing } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useTheme, type TKey } from '@/runtime/AppProvider';
import { useAdhan, useAdhanState } from '@/services/adhan/AdhanProvider';
import { displayDuration, type AdhanVoice } from '@/services/adhan/voices';

import { prayersUsing, useVoiceInstall, useVoiceSettings } from './hooks';
import { VoiceDownload } from './VoiceDownload';

/** Round preview button with a progress ring — plays the bundled 30 s clip instantly, offline. */
export function PreviewButton({ voice, size = 56, testID }: { voice: AdhanVoice; size?: number; testID?: string }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const adhan = useAdhan();
  const st = useAdhanState();
  const mine = st.id === voice.id && st.mode === 'preview';
  const loading = mine && st.loading;
  const playing = mine && st.playing;
  const progress = mine && st.duration ? st.position / st.duration : 0;
  const label = `${playing ? t('adhan.stop') : t('adhan.preview')} — ${voice.name[lang]}`;
  return (
    <PressableScale
      onPress={() => adhan.preview(voice.id)}
      accessibilityLabel={label}
      testID={testID ?? `adhan-preview-${voice.id}`}
      haptic="selection"
      style={{ width: size, height: size }}
    >
      <ProgressRing progress={progress} size={size} stroke={4} color="accent" accessibilityLabel={label}>
        <View
          style={{
            width: size - 12,
            height: size - 12,
            borderRadius: (size - 12) / 2,
            backgroundColor: playing || loading ? colors.accent : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={loading ? Loader : playing ? Pause : Play} size={size * 0.38} color="primaryInk" />
        </View>
      </ProgressRing>
    </PressableScale>
  );
}

export function VoiceCard({ voice, index = 0 }: { voice: AdhanVoice; index?: number }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const fmt = useFormat();
  const vs = useVoiceSettings();
  const { available } = useVoiceInstall(voice);
  const st = useAdhanState();
  const used = prayersUsing(voice.id, vs);
  const isDefault = vs.defaultVoice === voice.id;
  const place = voice.place?.[lang];
  const style = voice.style?.[lang];
  const sub = [place, style].filter(Boolean).join(' · ');
  const error = st.id === voice.id && st.error ? (st.error === 'missing' ? 'adhan.errorMissing' : 'adhan.errorPlayback') : null;

  return (
    <FadeIn index={index}>
      <Card
        testID={`adhan-${voice.id}`}
        style={{ gap: space.md, borderWidth: isDefault ? 1.5 : undefined, borderColor: isDefault ? colors.accent : undefined }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <PreviewButton voice={voice} />
          <PressableScale
            onPress={() => router.push(`/adhan/${voice.id}`)}
            accessibilityLabel={voice.name[lang]}
            testID={`adhan-open-${voice.id}`}
            scaleTo={0.99}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{voice.name[lang]}</Text>
              {sub ? (
                <Text variant="footnote" color="textMuted">
                  {sub}
                </Text>
              ) : null}
              <Text variant="caption" color="textFaint">
                {fmt.digits(displayDuration(voice.durationSec))} · {fmt.bytes(voice.delivery === 'download' && voice.direct ? voice.direct.bytes : voice.bytes)}
              </Text>
            </View>
            <Icon icon={ChevronRight} size={18} color="textFaint" directional />
          </PressableScale>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {voice.kind === 'fajr' ? <Badge label={t('adhan.fajrBadge')} tone="accent" /> : null}
          {voice.delivery === 'bundled' ? (
            <Badge label={t('adhan.bundled')} tone="success" />
          ) : available ? (
            <Badge label={t('adhan.downloaded')} tone="success" />
          ) : null}
          {isDefault ? <Badge label={`✓ ${t('adhan.defaultVoice')}`} tone="primary" /> : null}
          {used
            .filter((p) => !isDefault || voice.kind === 'fajr' || p === 'fajr')
            .map((p) => (p === 'fajr' || !isDefault ? <Badge key={p} label={`✓ ${t(`prayers.${p}` as TKey)}`} tone="muted" /> : null))}
          <Badge label={voice.credit.licence} />
        </View>

        {error ? (
          <Text variant="footnote" color="danger">
            {t(error)}
          </Text>
        ) : null}
        <VoiceDownload voice={voice} />
      </Card>
    </FadeIn>
  );
}

export const VOICE_CARD_RADIUS = radius.lg;
