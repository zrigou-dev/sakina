import { router } from 'expo-router';
import HardDrive from 'lucide-react-native/icons/hard-drive';
import Library from 'lucide-react-native/icons/library';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Badge, Card, Chip, ListGroup, ListRow, Notice, SectionHeader, Switch } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { PreviewButton, VoiceCard } from '@/features/adhan/VoiceCard';
import { PrayerSheet } from '@/features/adhan/VoiceSheets';
import { useAvailableVoiceIds, useVoices, useVoiceSettings } from '@/features/adhan/hooks';
import { useFormat } from '@/hooks/useFormat';
import { useDbs, useI18n, useSettings, type TKey } from '@/runtime/AppProvider';
import { adhanLibraryBaseUrl } from '@/services/adhan/config';
import { refreshRemoteCatalogue, type RemoteResult } from '@/services/adhan/remote';
import { PRAYERS, resolveVoice, tierOf, voiceById, voicePackageId, type Prayer } from '@/services/adhan/voices';
import { usePackageStates } from '@/services/downloads/DownloadProvider';

type Filter = 'all' | 'fajr' | 'downloaded';

export default function AdhanHub() {
  const { t, lang } = useI18n();
  const fmt = useFormat();
  const [settings, update] = useSettings();
  const vs = useVoiceSettings();
  const available = useAvailableVoiceIds();
  const states = usePackageStates();
  const [filter, setFilter] = useState<Filter>('all');
  const [prayerOpen, setPrayerOpen] = useState<Prayer | null>(null);
  const dbs = useDbs();
  const [sync, setSync] = useState<RemoteResult | 'busy' | null>(null);

  const voices = useVoices();
  const shown = useMemo(
    () =>
      voices
        .filter((v) => tierOf(v) !== 'personal')
        .filter((v) => (filter === 'fajr' ? v.kind === 'fajr' : filter === 'downloaded' ? v.delivery === 'download' && available.has(v.id) : true)),
    [voices, filter, available],
  );
  const defaultVoice = voiceById(settings.adhan.voice) ?? voices[0]!;
  const downloadedBytes = voices.reduce(
    (n, v) => n + (v.delivery === 'download' && states[voicePackageId(v.id)]?.status === 'installed' ? (states[voicePackageId(v.id)]?.bytesTotal ?? 0) : 0),
    0,
  );

  const rowSubtitle = (p: Prayer): string => {
    const mode = settings.adhan.sound[p];
    if (mode === 'silent') return t('adhan.soundSilent');
    if (mode === 'default') return t('adhan.soundDefault');
    const own = settings.adhan.byPrayer[p];
    const shownVoice = resolveVoice(p, vs, () => true);
    const missing = own && !available.has(own);
    const name = shownVoice.name[lang];
    return own ? (missing ? `${name} — ${t('adhan.errorMissing')}` : name) : `${t('adhan.inUseDefault')} · ${name}`;
  };

  return (
    <Screen back title={t('adhan.title')} subtitle={t('adhan.intro')} large testID="adhan-screen">
      <SectionHeader title={t('adhan.yourAdhan')} style={{ marginTop: 0 }} />
      <Card tone="primary" style={{ gap: space.md }} testID="adhan-default-card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <PreviewButton voice={defaultVoice} size={64} testID="adhan-default-preview" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="overline" color="textMuted">
              {t('adhan.defaultVoice')}
            </Text>
            <Text variant="title3">{defaultVoice.name[lang]}</Text>
            <Text variant="footnote" color="textMuted">
              {defaultVoice.place?.[lang] ?? defaultVoice.style?.[lang] ?? ''}
            </Text>
          </View>
        </View>
        <Chip
          label={t('adhan.chooseVoice')}
          onPress={() => router.push({ pathname: '/adhan/pick', params: { prayer: 'default' } })}
          testID="adhan-change-default"
        />
      </Card>

      <SectionHeader title={t('adhan.byPrayer')} />
      <ListGroup>
        {PRAYERS.map((p, i) => (
          <ListRow
            key={p}
            title={t(`prayers.${p}` as TKey)}
            subtitle={rowSubtitle(p)}
            onPress={() => setPrayerOpen(p)}
            testID={`adhan-row-${p}`}
            last={i === PRAYERS.length - 1}
            trailing={
              settings.adhan.sound[p] !== 'adhan' ? (
                <Badge label={t(settings.adhan.sound[p] === 'silent' ? 'adhan.soundSilent' : 'adhan.soundDefault')} />
              ) : undefined
            }
          />
        ))}
      </ListGroup>

      <SectionHeader title={t('adhan.library')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
        {(['all', 'fajr', 'downloaded'] as const).map((f) => (
          <Chip
            key={f}
            label={t(f === 'all' ? 'adhan.filterAll' : f === 'fajr' ? 'adhan.filterFajr' : 'adhan.filterDownloaded')}
            selected={filter === f}
            onPress={() => setFilter(f)}
            testID={`adhan-filter-${f}`}
          />
        ))}
      </View>
      <View style={{ gap: space.md }}>
        {shown.length === 0 ? <Notice text={t('adhan.noMatch')} /> : shown.map((v, i) => <VoiceCard key={v.id} voice={v} index={i} />)}
      </View>

      <View style={{ marginTop: space.md }}>
        <ListGroup>
          <ListRow
            icon={Library}
            iconTone="accent"
            title={t('adhanPick.allVoices', { count: fmt.digits(voices.length) })}
            subtitle={t('adhanPick.allVoicesHelp')}
            onPress={() => router.push({ pathname: '/adhan/pick', params: { prayer: 'default' } })}
            testID="adhan-all-voices"
            last
          />
        </ListGroup>
      </View>

      {adhanLibraryBaseUrl() ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <ListGroup>
            <ListRow
              icon={RefreshCw}
              iconTone="muted"
              title={t('adhan.checkUpdates')}
              subtitle={t('adhan.voicesCount', { count: fmt.digits(voices.length) })}
              onPress={async () => {
                setSync('busy');
                setSync(await refreshRemoteCatalogue(dbs.content));
              }}
              testID="adhan-check-updates"
              last
            />
          </ListGroup>
          {sync && sync !== 'busy' ? (
            <Notice
              tone={sync.status === 'error' ? 'warning' : 'accent'}
              text={
                sync.status === 'error'
                  ? t('adhan.errorNetwork')
                  : sync.status === 'ok' && sync.added > 0
                    ? t('adhan.newVoices', { count: fmt.digits(sync.added) })
                    : t('adhan.upToDate')
              }
            />
          ) : null}
        </View>
      ) : null}

      <SectionHeader title={t('adhan.storage')} />
      <ListGroup>
        <ListRow
          icon={HardDrive}
          iconTone="accent"
          title={t('adhan.storage')}
          subtitle={downloadedBytes > 0 ? t('adhan.storageUsed', { size: fmt.bytes(downloadedBytes) }) : t('adhan.storageEmpty')}
          onPress={() => router.push('/adhan/storage')}
          testID="adhan-storage-row"
        />
        <ListRow
          icon={ShieldCheck}
          title={t('adhan.reliability')}
          subtitle={t('adhan.reliabilityIntro')}
          onPress={() => router.push('/adhan/reliability')}
          testID="adhan-reliability-row"
          last
        />
      </ListGroup>

      <View style={{ marginTop: space.lg }}>
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text variant="callout" style={{ flex: 1 }}>
              {t('adhan.playInApp')}
            </Text>
            <Switch
              value={settings.adhan.playInApp}
              onValueChange={(v) => update({ adhan: { playInApp: v } })}
              label={t('adhan.playInApp')}
              testID="adhan-play-in-app"
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text variant="callout" style={{ flex: 1 }}>
              {t('adhan.showDua')}
            </Text>
            <Switch
              value={settings.adhan.showDua}
              onValueChange={(v) => update({ adhan: { showDua: v } })}
              label={t('adhan.showDua')}
              testID="adhan-show-dua"
            />
          </View>
        </Card>
      </View>

      <PrayerSheet prayer={prayerOpen} onClose={() => setPrayerOpen(null)} />
    </Screen>
  );
}
