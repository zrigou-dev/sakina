import Check from 'lucide-react-native/icons/check';
import Info from 'lucide-react-native/icons/info';
import { View } from 'react-native';

import { router } from 'expo-router';

import { ListGroup, ListRow, Notice, SegmentedControl, Sheet } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useI18n, useSettings, useTheme, type TKey } from '@/runtime/AppProvider';
import { voiceFitsPrayer, voiceById, resolveVoice, DEFAULT_FAJR_VOICE_ID, type AdhanVoice, type Prayer } from '@/services/adhan/voices';
import type { AdhanSound } from '@/state/settings';

import { useAvailableVoiceIds, useVoices, useVoiceSettings } from './hooks';
import { PreviewButton } from './VoiceCard';

function VoiceOption({ voice, selected, usable, onPick }: { voice: AdhanVoice; selected: boolean; usable: boolean; onPick: () => void }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const place = voice.place?.[lang];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: usable ? 1 : 0.55 }}>
      <PreviewButton voice={voice} size={44} testID={`pick-preview-${voice.id}`} />
      <PressableScale
        onPress={usable ? onPick : undefined}
        disabled={!usable}
        testID={`pick-${voice.id}`}
        accessibilityLabel={voice.name[lang]}
        scaleTo={0.99}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          minHeight: 56,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
        }}
      >
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="callout">{voice.name[lang]}</Text>
          <Text variant="caption" color="textMuted">
            {usable ? (place ?? '') : t('adhan.needsDownload')}
          </Text>
        </View>
        {selected ? <Icon icon={Check} size={20} color="primary" /> : null}
      </PressableScale>
    </View>
  );
}

/** Pick one voice (or "Default") — used for the default muezzin and per prayer. */
export function VoicePickerList({
  selectedId,
  onSelect,
  allowDefault,
  prayer,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allowDefault: boolean;
  prayer?: Prayer;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const available = useAvailableVoiceIds();
  // A Fajr-only adhan is never offered for the other prayers (it contains the extra Fajr phrase).
  const voices = useVoices().filter((v) => voiceFitsPrayer(v, prayer ?? 'dhuhr'));
  const fajrFirst = prayer === 'fajr' ? [...voices].sort((a, b) => Number(b.kind === 'fajr') - Number(a.kind === 'fajr')) : voices;
  return (
    <View style={{ gap: space.sm }}>
      {allowDefault ? (
        <PressableScale
          onPress={() => onSelect(null)}
          testID="pick-default"
          style={{
            minHeight: 52,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            backgroundColor: selectedId === null ? colors.primarySoft : colors.surfaceMuted,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
          }}
        >
          <Text variant="callout" style={{ flex: 1 }}>
            {prayer === 'fajr' ? `${t('adhan.useDefault')} (${t('adhan.fajrBadge')})` : t('adhan.useDefault')}
          </Text>
          {selectedId === null ? <Icon icon={Check} size={20} color="primary" /> : null}
        </PressableScale>
      ) : null}
      {fajrFirst.map((v) => (
        <VoiceOption key={v.id} voice={v} selected={selectedId === v.id} usable={available.has(v.id)} onPick={() => onSelect(v.id)} />
      ))}
    </View>
  );
}

/** Default muezzin chooser. */
export function DefaultVoiceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [settings, update] = useSettings();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('adhan.defaultVoice')} testID="default-voice-sheet">
      <Text variant="footnote" color="textMuted" style={{ marginBottom: space.md }}>
        {t('adhan.defaultVoiceHelp')}
      </Text>
      <VoicePickerList
        selectedId={settings.adhan.voice}
        allowDefault={false}
        onSelect={(id) => {
          if (id) update({ adhan: { voice: id } });
          onClose();
        }}
      />
    </Sheet>
  );
}

/** Per-prayer sheet: how it sounds (adhan / short tone / silent) and which muezzin. */
export function PrayerSheet({ prayer, onClose }: { prayer: Prayer | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [settings, update] = useSettings();
  const vs = useVoiceSettings();
  if (!prayer)
    return (
      <Sheet visible={false} onClose={onClose}>
        {null}
      </Sheet>
    );
  const name = t(`prayers.${prayer}` as TKey);
  const mode = settings.adhan.sound[prayer];
  const own = settings.adhan.byPrayer[prayer];
  const chosen = own ? voiceById(own) : null;
  const resolved = resolveVoice(prayer, vs, () => true);
  return (
    <Sheet visible onClose={onClose} title={name} testID={`prayer-sheet-${prayer}`}>
      <Text variant="overline" color="textMuted" style={{ marginBottom: space.xs }}>
        {t('adhan.soundTitle')}
      </Text>
      <SegmentedControl<AdhanSound>
        value={mode}
        onChange={(v) => update({ adhan: { sound: { ...settings.adhan.sound, [prayer]: v } } })}
        options={[
          { value: 'adhan', label: t('adhan.soundAdhan') },
          { value: 'default', label: t('adhan.soundDefault') },
          { value: 'silent', label: t('adhan.soundSilent') },
        ]}
        testID={`adhan-sound-${prayer}`}
      />
      {mode === 'adhan' ? (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Text variant="overline" color="textMuted">
            {t('adhan.chooseVoiceFor', { prayer: name })}
          </Text>
          {prayer === 'fajr' ? <Notice tone="accent" icon={Info} text={t('adhan.fajrNote')} /> : null}
          <ListGroup>
            <ListRow
              title={t('adhanPick.voice')}
              subtitle={chosen ? chosen.name[lang] : `${t('adhan.inUseDefault')} · ${resolved.name[lang]}`}
              onPress={() => {
                onClose();
                router.push({ pathname: '/adhan/pick', params: { prayer } });
              }}
              testID={`prayer-voice-${prayer}`}
              last
            />
          </ListGroup>
        </View>
      ) : null}
    </Sheet>
  );
}

export const FAJR_DEFAULT = DEFAULT_FAJR_VOICE_ID;
