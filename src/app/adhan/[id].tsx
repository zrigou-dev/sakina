import { router, useLocalSearchParams } from 'expo-router';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Info from 'lucide-react-native/icons/info';
import Trash2 from 'lucide-react-native/icons/trash';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { Badge, Button, Card, Chip, EmptyState, ListGroup, ListRow, Notice, SectionHeader } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { prayersUsing, useVoiceInstall, useVoiceSettings } from '@/features/adhan/hooks';
import { PreviewButton } from '@/features/adhan/VoiceCard';
import { VoiceDownload } from '@/features/adhan/VoiceDownload';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useSettings, type TKey } from '@/runtime/AppProvider';
import { useAdhan, useAdhanState } from '@/services/adhan/AdhanProvider';
import { displayDuration, PRAYERS, tierOf, voiceById, voiceFitsPrayer, voicePackageId, type AdhanVoice } from '@/services/adhan/voices';
import { useDownloadManager } from '@/services/downloads/DownloadProvider';

/** Keeps a technical value (number + unit) in one left-to-right run inside right-to-left text. */
const ltr = (s: string) => `\u2066${s}\u2069`;

export default function AdhanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const voice = voiceById(id ?? '');
  if (!voice) {
    return (
      <Screen back title={t('adhan.title')} testID="adhan-detail">
        <EmptyState title={t('errors.notFound')} />
      </Screen>
    );
  }
  return <VoiceDetail voice={voice} />;
}

function VoiceDetail({ voice }: { voice: AdhanVoice }) {
  const { t, lang } = useI18n();
  const fmt = useFormat();
  const adhan = useAdhan();
  const st = useAdhanState();
  const manager = useDownloadManager();
  const [settings, update] = useSettings();
  const vs = useVoiceSettings();
  const [confirm, setConfirm] = useState(false);
  const { available, state } = useVoiceInstall(voice);
  const used = prayersUsing(voice.id, vs);
  const c = voice.credit;
  const tier = tierOf(voice);
  const a = voice.audio;
  const fullPlaying = st.id === voice.id && st.mode === 'preview' && st.playing;
  const sub = [voice.place?.[lang], voice.style?.[lang]].filter(Boolean).join(' · ');
  const size = voice.delivery === 'download' && voice.direct ? voice.direct.bytes : voice.bytes;

  return (
    <Screen back title={voice.name[lang]} subtitle={sub || undefined} large testID="adhan-detail">
      <Card tone="primary" style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <PreviewButton voice={voice} size={72} testID="adhan-detail-preview" />
          <View style={{ flex: 1, gap: space.xs }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {voice.kind === 'fajr' ? <Badge label={t('adhan.fajrBadge')} tone="accent" /> : null}
              <Badge
                label={voice.delivery === 'bundled' ? t('adhan.bundled') : available ? t('adhan.downloaded') : t('adhan.download', { size: fmt.bytes(size) })}
                tone={available ? 'success' : 'muted'}
              />
              {available ? <Badge label={t('adhan.offlineBadge')} tone="success" /> : null}
            </View>
            {voice.performer ? (
              <Text variant="callout" testID="adhan-muezzin">
                {t('adhan.muezzin')}: {voice.performer.name}
              </Text>
            ) : null}
            <Text variant="footnote" color="textMuted">
              {t('adhan.recordedBy', { name: c.recordist })}
            </Text>
          </View>
        </View>
        {available ? (
          <Button
            label={fullPlaying ? t('adhan.stop') : t('adhan.previewFull')}
            variant="secondary"
            onPress={() => adhan.preview(voice.id, true)}
            testID="adhan-play-full"
          />
        ) : null}
        <VoiceDownload voice={voice} />
      </Card>

      {available ? (
        <>
          <SectionHeader title={t('adhan.yourAdhan')} />
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {voice.kind === 'adhan' ? (
                <Chip
                  label={t('adhan.useAsDefault')}
                  selected={settings.adhan.voice === voice.id}
                  onPress={() => update({ adhan: { voice: voice.id } })}
                  testID="adhan-use-default"
                />
              ) : null}
              {PRAYERS.filter((p) => voiceFitsPrayer(voice, p)).map((p) => (
                <Chip
                  key={p}
                  label={t('adhan.useForPrayer', { prayer: t(`prayers.${p}` as TKey) })}
                  selected={settings.adhan.byPrayer[p] === voice.id}
                  onPress={() =>
                    update({ adhan: { byPrayer: { ...settings.adhan.byPrayer, [p]: settings.adhan.byPrayer[p] === voice.id ? null : voice.id } } })
                  }
                  testID={`adhan-use-${p}`}
                />
              ))}
            </View>
            {used.length ? (
              <Text variant="footnote" color="textMuted">
                {t('adhan.usedFor', { list: used.map((p) => t(`prayers.${p}` as TKey)).join(lang === 'ar' ? '، ' : ', ') })}
              </Text>
            ) : null}
          </Card>
        </>
      ) : (
        <View style={{ marginTop: space.md }}>
          <Notice tone="accent" icon={Info} text={t('adhan.needsDownload')} />
        </View>
      )}

      <SectionHeader title={t('adhan.details')} />
      <ListGroup>
        {voice.durationSec > 0 ? (
          <ListRow title={t('adhan.duration')} trailing={<Text variant="callout">{fmt.digits(displayDuration(voice.durationSec))}</Text>} chevron={false} />
        ) : null}
        <ListRow title={t('adhan.size')} trailing={<Text variant="callout">{fmt.bytes(size)}</Text>} chevron={false} />
        <ListRow
          title={t('adhan.format')}
          trailing={
            <Text variant="callout">
              {voice.delivery === 'download' && voice.direct
                ? voice.direct.format.toUpperCase()
                : voice.delivery === 'local'
                  ? voice.format.toUpperCase()
                  : 'AAC'}
            </Text>
          }
          chevron={false}
          last
        />
      </ListGroup>
      <SectionHeader title={t('adhan.quality')} />
      <ListGroup>
        <ListRow title={t('adhan.loudness')} trailing={<Text variant="callout">{ltr(`${fmt.digits(a.lufs.toFixed(0))} LUFS`)}</Text>} chevron={false} />
        {a.noiseFloorDb != null ? (
          <ListRow
            title={t('adhan.noiseFloor')}
            trailing={<Text variant="callout">{ltr(`${fmt.digits(a.noiseFloorDb.toFixed(0))} dB`)}</Text>}
            chevron={false}
          />
        ) : null}
        <ListRow
          title={t('adhan.sampleRate')}
          trailing={<Text variant="callout">{ltr(`${fmt.digits((a.sampleRateHz / 1000).toFixed(1))} kHz`)}</Text>}
          chevron={false}
          last
        />
      </ListGroup>

      <SectionHeader title={t('adhan.licence')} />
      <Card style={{ gap: space.sm }} testID="adhan-attribution">
        <Text variant="callout">
          {t('adhan.credit')}: {c.recordist}
        </Text>
        <Text variant="footnote" color="textMuted">
          {t('adhan.licence')}: {c.licence}
        </Text>
        {tier === 'licensed' ? (
          <>
            <Text variant="footnote" color="textMuted">
              {t('adhan.changes')}: {t('adhan.changesBody')}
            </Text>
            <Text variant="footnote" color="textMuted">
              {c.shareAlike ? t('adhan.shareAlike') : t('adhan.freeUse')}
            </Text>
          </>
        ) : tier === 'personal' ? (
          <Text variant="footnote" color="textMuted" testID="adhan-personal-note">
            {t('adhanPick.personalNote')}
          </Text>
        ) : null}
      </Card>
      <View style={{ marginTop: space.sm }}>
        <ListGroup>
          {c.licenceUrl ? (
            <ListRow
              icon={ExternalLink}
              iconTone="muted"
              title={t('adhan.licence')}
              subtitle={c.licenceUrl}
              onPress={() => void Linking.openURL(c.licenceUrl!)}
            />
          ) : null}
          <ListRow
            icon={ExternalLink}
            iconTone="muted"
            title={t('adhan.source')}
            subtitle={c.sourceTitle}
            onPress={() => void Linking.openURL(c.sourceUrl)}
            last
          />
        </ListGroup>
      </View>

      {voice.delivery === 'download' && state.status === 'installed' ? (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {confirm ? (
            <Card tone="muted" style={{ gap: space.sm }}>
              <Text variant="headline">{t('adhan.deleteTitle')}</Text>
              <Text variant="footnote" color="textMuted">
                {t('adhan.deleteBody', { size: fmt.bytes(state.bytesTotal) })}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  label={t('adhan.delete')}
                  variant="danger"
                  size="sm"
                  testID="adhan-confirm-delete"
                  onPress={async () => {
                    adhan.dismiss();
                    await manager.remove(voicePackageId(voice.id));
                    router.back();
                  }}
                />
                <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => setConfirm(false)} />
              </View>
            </Card>
          ) : (
            <Button label={t('adhan.delete')} icon={Trash2} variant="ghost" onPress={() => setConfirm(true)} testID="adhan-delete" />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
