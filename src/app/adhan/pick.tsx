import { router, useLocalSearchParams } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import CloudDownload from 'lucide-react-native/icons/cloud-download';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Play from 'lucide-react-native/icons/play';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Search from 'lucide-react-native/icons/search';
import Trash2 from 'lucide-react-native/icons/trash';
import X from 'lucide-react-native/icons/x';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, IconButton, Notice, ProgressRing, TextField } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useAvailableVoiceIds, useVoices } from '@/features/adhan/hooks';
import { useFormat } from '@/hooks/useFormat';
import { useDbs, useI18n, useSettings, useTheme, type TKey } from '@/runtime/AppProvider';
import { useAdhan, useAdhanState } from '@/services/adhan/AdhanProvider';
import { loadCustomVoices, removeCustomVoice } from '@/services/adhan/custom';
import { customFileUri, pickCustomAdhan } from '@/services/adhan/customFiles';
import { customAdhanRepo } from '@/database/repositories/user';
import {
  displayDuration,
  downloadSize,
  PRAYERS,
  tierOf,
  voiceById,
  voiceFitsPrayer,
  voicePackageId,
  type AdhanVoice,
  type Prayer,
} from '@/services/adhan/voices';
import { useDownloadManager, usePackageStates } from '@/services/downloads/DownloadProvider';
import { progressFraction, type PackageState } from '@/services/downloads/state';
import { normalizeArabic, normalizeLatin } from '@/services/search/normalize';

type Row = { type: 'header'; key: string; title: string } | { type: 'default'; key: string } | { type: 'voice'; key: string; voice: AdhanVoice };

const isPrayer = (v: unknown): v is Prayer => typeof v === 'string' && (PRAYERS as readonly string[]).includes(v);

const VoiceRow = memo(function VoiceRow({
  voice,
  selected,
  available,
  state,
  playing,
  onSelect,
  onDownload,
  onRemove,
}: {
  voice: AdhanVoice;
  selected: boolean;
  available: boolean;
  state: PackageState | undefined;
  playing: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const fmt = useFormat();
  const tier = tierOf(voice);
  const s = state?.status ?? 'not_installed';
  const busy = s === 'queued' || s === 'downloading' || s === 'verifying' || s === 'installing';
  const sub = [
    voice.kind === 'fajr' ? t('adhan.fajrBadge') : null,
    voice.durationSec ? fmt.digits(displayDuration(voice.durationSec)) : null,
    fmt.bytes(voice.delivery === 'download' ? downloadSize(voice) : voice.bytes),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: space.lg, gap: space.md }} testID={`pick-row-${voice.id}`}>
      {/* Status: cloud = not on this device, ring = downloading, nothing = ready (as in the apps people know). */}
      <View style={{ width: 36, alignItems: 'center' }}>
        {tier === 'custom' ? (
          <IconButton
            icon={Trash2}
            label={`${t('adhanPick.remove')} — ${voice.name[lang]}`}
            size={20}
            color="textMuted"
            onPress={onRemove}
            testID={`pick-remove-${voice.id}`}
          />
        ) : available ? null : busy ? (
          <ProgressRing
            progress={progressFraction(state!)}
            size={30}
            stroke={3}
            color="accent"
            accessibilityLabel={t('adhan.downloading', { percent: `${Math.round(progressFraction(state!) * 100)}%` })}
          />
        ) : s === 'failed' ? (
          <IconButton icon={RotateCcw} label={t('adhan.retry')} size={20} color="danger" onPress={onDownload} testID={`pick-retry-${voice.id}`} />
        ) : s === 'paused' ? (
          <IconButton icon={Play} label={t('adhan.resume')} size={20} color="accent" onPress={onDownload} />
        ) : (
          <IconButton
            icon={CloudDownload}
            label={`${t('adhan.download', { size: fmt.bytes(downloadSize(voice)) })} — ${voice.name[lang]}`}
            size={24}
            color="accent"
            onPress={onDownload}
            testID={`pick-download-${voice.id}`}
          />
        )}
      </View>
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        aria-checked={selected}
        accessibilityLabel={voice.name[lang]}
        testID={`pick-voice-${voice.id}`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout" numberOfLines={2}>
            {voice.name[lang]}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
            <Text variant="caption" color="textMuted">
              {sub}
            </Text>

            {playing ? <Badge label="▶" tone="accent" /> : null}
          </View>
        </View>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: selected ? colors.accent : colors.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }} /> : null}
        </View>
      </Pressable>
    </View>
  );
});

/**
 * Choose a voice: a searchable list of every available muezzin with a radio per row, a cloud icon on the ones not yet on
 * the device, "More…" to use your own audio file, and Confirm / Cancel. `?prayer=fajr|dhuhr|asr|maghrib|isha|default`.
 */
export default function AdhanPick() {
  const { prayer: param } = useLocalSearchParams<{ prayer?: string }>();
  const prayer: Prayer | null = isPrayer(param) ? param : null;
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fmt = useFormat();
  const dbs = useDbs();
  const [settings, update] = useSettings();
  const adhan = useAdhan();
  const st = useAdhanState();
  const manager = useDownloadManager();
  const states = usePackageStates();
  const available = useAvailableVoiceIds();
  const allVoices = useVoices();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ tone: 'accent' | 'warning'; text: string } | null>(null);
  /** The staged choice; `null` means "use the default". Nothing is saved until Confirm. */
  const [staged, setStaged] = useState<string | null>(prayer === null ? settings.adhan.voice : settings.adhan.byPrayer[prayer]);

  const prayerName = prayer ? t(`prayers.${prayer}` as TKey) : '';
  const title = prayer ? t('adhanPick.titleFor', { prayer: prayerName }) : t('adhanPick.titleDefault');
  const fits = useMemo(() => allVoices.filter((v) => voiceFitsPrayer(v, prayer ?? 'dhuhr')), [allVoices, prayer]);
  const personalCount = fits.filter((v) => tierOf(v) === 'personal').length;

  const rows = useMemo<Row[]>(() => {
    const byName = (a: AdhanVoice, b: AdhanVoice) => a.name[lang].localeCompare(b.name[lang], lang);
    const q = query.trim();
    if (q) {
      const nq = normalizeArabic(q);
      const nl = normalizeLatin(q);
      return fits
        .filter((v) => normalizeArabic(v.name.ar).includes(nq) || normalizeLatin(v.name.en).includes(nl))
        .sort(byName)
        .map((voice) => ({ type: 'voice', key: voice.id, voice }));
    }
    const out: Row[] = [];
    if (prayer !== null) out.push({ type: 'default', key: 'default' });
    const section = (key: string, title: string, list: AdhanVoice[]) => {
      if (!list.length) return;
      out.push({ type: 'header', key: `h-${key}`, title });
      for (const voice of list) out.push({ type: 'voice', key: voice.id, voice });
    };
    section(
      'custom',
      t('adhanPick.mySection'),
      fits.filter((v) => tierOf(v) === 'custom'),
    );
    section(
      'curated',
      t('adhanPick.curatedSection'),
      fits.filter((v) => tierOf(v) === 'licensed'),
    );
    const personal = fits.filter((v) => tierOf(v) === 'personal').sort(byName);
    if (prayer === 'fajr') {
      section(
        'fajr',
        t('adhanPick.fajrSection'),
        personal.filter((v) => v.kind === 'fajr'),
      );
      section(
        'personal',
        t('adhanPick.voicesSection'),
        personal.filter((v) => v.kind !== 'fajr'),
      );
    } else section('personal', t('adhanPick.voicesSection'), personal);
    return out;
  }, [fits, query, lang, prayer, t]);

  const select = (id: string | null) => {
    setStaged(id);
    if (id) adhan.preview(id);
    else adhan.dismiss();
  };

  const confirm = () => {
    adhan.dismiss();
    if (prayer === null) {
      if (staged) update({ adhan: { voice: staged } });
    } else {
      update({ adhan: { byPrayer: { ...settings.adhan.byPrayer, [prayer]: staged } } });
    }
    const v = staged ? voiceById(staged) : null;
    // Not downloaded yet: start it now; the voice is used as soon as it is ready (until then the default sounds).
    if (v && v.delivery === 'download' && !available.has(v.id)) void manager.download(voicePackageId(v.id));
    router.back();
  };

  const addFile = async () => {
    setMessage(null);
    const r = await pickCustomAdhan();
    if (!r.ok) {
      if (r.reason === 'cancelled') return;
      setMessage({
        tone: 'warning',
        text: t(
          r.reason === 'type'
            ? 'adhanPick.badType'
            : r.reason === 'size'
              ? 'adhanPick.badSize'
              : process.env.EXPO_OS === 'web'
                ? 'adhanPick.webOnlyMobile'
                : 'adhanPick.failed',
        ),
      });
      return;
    }
    await customAdhanRepo.add(dbs.user, { id: r.id, name: r.name, file: r.file, bytes: r.bytes });
    await loadCustomVoices(dbs.user, customFileUri);
    setStaged(r.id);
    setMessage({ tone: 'accent', text: t('adhanPick.added', { name: r.name }) });
  };

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'header')
      return (
        <Text
          variant="overline"
          color="textMuted"
          style={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs }}
          accessibilityRole="header"
        >
          {item.title}
        </Text>
      );
    if (item.type === 'default')
      return (
        <Pressable
          onPress={() => select(null)}
          accessibilityRole="radio"
          aria-checked={staged === null}
          testID="pick-default"
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, gap: space.md }}
        >
          <View style={{ width: 36 }} />
          <Text variant="callout" style={{ flex: 1 }}>
            {t('adhanPick.useDefault')}
          </Text>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: staged === null ? colors.accent : colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {staged === null ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }} /> : null}
          </View>
        </Pressable>
      );
    const v = item.voice;
    const row = { id: v.id, file: v.file };
    return (
      <VoiceRow
        voice={v}
        selected={staged === v.id}
        available={available.has(v.id)}
        state={states[voicePackageId(v.id)]}
        playing={st.id === v.id && st.mode === 'preview' && (st.playing || st.loading)}
        onSelect={() => select(v.id)}
        onDownload={() => void manager.download(voicePackageId(v.id))}
        onRemove={() => {
          if (staged === v.id) setStaged(null);
          adhan.dismiss();
          void removeCustomVoice(dbs.user, row, customFileUri);
        }}
      />
    );
  };

  return (
    <Screen
      back
      scroll={false}
      title={title}
      testID="adhan-pick"
      actions={
        <IconButton
          icon={searching ? X : Search}
          label={t('adhanPick.search')}
          testID="pick-search-toggle"
          onPress={() => {
            setSearching((s) => !s);
            setQuery('');
          }}
        />
      }
    >
      {searching ? (
        <View style={{ paddingHorizontal: space.gutter, paddingBottom: space.sm }}>
          <TextField value={query} onChangeText={setQuery} placeholder={t('adhanPick.searchPlaceholder')} autoFocus autoCorrect={false} testID="pick-search" />
        </View>
      ) : (
        <Text variant="caption" color="textFaint" style={{ paddingHorizontal: space.gutter, paddingBottom: space.xs }}>
          {t('adhanPick.count', { count: fmt.digits(fits.length) })}
        </Text>
      )}
      {message ? (
        <View style={{ paddingHorizontal: space.gutter, paddingBottom: space.sm }}>
          <Notice tone={message.tone} text={message.text} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        initialNumToRender={14}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text variant="subhead" color="textMuted" align="center" style={{ padding: space.xl }}>
            {t('adhanPick.noResults')}
          </Text>
        }
        ListHeaderComponent={
          personalCount > 0 && !query ? (
            <View style={{ paddingHorizontal: space.lg, paddingBottom: space.xs }}>
              <Notice text={t('adhanPick.personalNote')} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{ paddingBottom: 150 }}
      />

      {/* "More…": use your own audio file. */}
      <Pressable
        onPress={addFile}
        accessibilityRole="button"
        accessibilityLabel={t('adhanPick.pickFile')}
        testID="pick-more"
        style={{
          position: 'absolute',
          start: space.lg,
          bottom: insets.bottom + 72,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: colors.accent,
          borderRadius: radius.pill,
          paddingHorizontal: space.lg,
          minHeight: 52,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        }}
      >
        <Icon icon={FolderOpen} size={22} color="primaryInk" />
        <Text variant="callout" weight="semibold" color="primaryInk">
          {t('adhanPick.more')}
        </Text>
      </Pressable>

      {/* Confirm / Cancel */}
      <View
        style={{
          position: 'absolute',
          start: 0,
          end: 0,
          bottom: 0,
          flexDirection: 'row',
          gap: space.md,
          paddingHorizontal: space.gutter,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: colors.bgElevated,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            label={t('adhanPick.cancel')}
            variant="ghost"
            onPress={() => {
              adhan.dismiss();
              router.back();
            }}
            testID="pick-cancel"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('adhanPick.confirm')} icon={Check} onPress={confirm} testID="pick-confirm" />
        </View>
      </View>
    </Screen>
  );
}
