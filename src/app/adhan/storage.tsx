import Trash2 from 'lucide-react-native/icons/trash';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, IconButton, ListGroup, ListRow, Notice, ProgressBar, SectionHeader } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n } from '@/runtime/AppProvider';
import { useAdhan } from '@/services/adhan/AdhanProvider';
import { useVoices } from '@/features/adhan/hooks';
import { voicePackageId } from '@/services/adhan/voices';
import { useDownloadManager, usePackageStates } from '@/services/downloads/DownloadProvider';
import { availableSpace } from '@/services/downloads/fs';

export default function AdhanStorage() {
  const { t, lang } = useI18n();
  const fmt = useFormat();
  const manager = useDownloadManager();
  const adhan = useAdhan();
  const states = usePackageStates();
  const [confirmAll, setConfirmAll] = useState(false);

  const voices = useVoices();
  const downloaded = voices.filter((v) => v.delivery === 'download' && states[voicePackageId(v.id)]?.status === 'installed');
  const bundled = voices.filter((v) => v.delivery === 'bundled');
  const downloadedBytes = downloaded.reduce((n, v) => n + (states[voicePackageId(v.id)]?.bytesTotal ?? 0), 0);
  const bundledBytes = bundled.reduce((n, v) => n + v.bytes, 0);
  const free = availableSpace();

  const remove = async (id: string) => {
    adhan.dismiss();
    await manager.remove(voicePackageId(id));
  };

  return (
    <Screen back title={t('adhan.storage')} subtitle={t('adhan.storageBody')} large testID="adhan-storage">
      <Card style={{ gap: space.md }} testID="adhan-storage-summary">
        <Text variant="title2" testID="adhan-storage-used">
          {fmt.bytes(downloadedBytes)}
        </Text>
        <Text variant="footnote" color="textMuted">
          {t('adhan.storageUsed', { size: fmt.bytes(downloadedBytes) })}
        </Text>
        <ProgressBar progress={downloadedBytes + bundledBytes > 0 ? downloadedBytes / (downloadedBytes + bundledBytes) : 0} color="accent" />
        <Text variant="caption" color="textFaint">
          {t('adhan.storageIncluded', { size: fmt.bytes(bundledBytes) })}
          {free !== null ? ` · ${t('adhan.storageFree', { size: fmt.bytes(free) })}` : ''}
        </Text>
      </Card>

      <SectionHeader title={t('adhan.filterDownloaded')} />
      {downloaded.length === 0 ? (
        <Notice text={t('adhan.storageEmpty')} />
      ) : (
        <ListGroup>
          {downloaded.map((v, i) => (
            <ListRow
              key={v.id}
              title={v.name[lang]}
              subtitle={fmt.bytes(states[voicePackageId(v.id)]?.bytesTotal ?? 0)}
              chevron={false}
              last={i === downloaded.length - 1}
              trailing={
                <IconButton
                  icon={Trash2}
                  label={`${t('adhan.delete')} — ${v.name[lang]}`}
                  color="danger"
                  onPress={() => void remove(v.id)}
                  testID={`storage-delete-${v.id}`}
                />
              }
            />
          ))}
        </ListGroup>
      )}

      <SectionHeader title={t('adhan.bundled')} />
      <ListGroup>
        {bundled.map((v, i) => (
          <ListRow key={v.id} title={v.name[lang]} subtitle={fmt.bytes(v.bytes)} chevron={false} last={i === bundled.length - 1} />
        ))}
      </ListGroup>

      {downloaded.length > 0 ? (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {confirmAll ? (
            <Card tone="muted" style={{ gap: space.sm }}>
              <Text variant="footnote" color="textMuted">
                {t('adhan.deleteBody', { size: fmt.bytes(downloadedBytes) })}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  label={t('adhan.deleteAll')}
                  variant="danger"
                  size="sm"
                  testID="storage-confirm-delete-all"
                  onPress={async () => {
                    setConfirmAll(false);
                    adhan.dismiss();
                    for (const v of downloaded) await manager.remove(voicePackageId(v.id));
                  }}
                />
                <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => setConfirmAll(false)} />
              </View>
            </Card>
          ) : (
            <Button label={t('adhan.deleteAll')} icon={Trash2} variant="ghost" onPress={() => setConfirmAll(true)} testID="storage-delete-all" />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
