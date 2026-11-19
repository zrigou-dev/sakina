import Download from 'lucide-react-native/icons/download';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Trash2 from 'lucide-react-native/icons/trash';
import X from 'lucide-react-native/icons/x';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, ProgressBar } from '@/design-system/components';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, type TKey } from '@/runtime/AppProvider';
import type { PackageManifest } from '@/services/downloads/catalogue';
import { useDownloadManager, usePackageState } from '@/services/downloads/DownloadProvider';
import { progressFraction } from '@/services/downloads/state';

const ERROR_KEYS: Record<string, TKey> = {
  network: 'library.errorNetwork',
  integrity: 'library.errorIntegrity',
  space: 'library.noSpace',
  wifi: 'library.wifiRequired',
  offline: 'library.offline',
  generic: 'library.errorGeneric',
  interrupted: 'library.errorNetwork',
};

/** Status, progress and the actions valid for the package's current state. */
export function PackageActions({ manifest, compact }: { manifest: PackageManifest; compact?: boolean }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const manager = useDownloadManager();
  const state = usePackageState(manifest.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const s = state.status;
  const name = manifest.name[useI18n().lang];
  const active = s === 'queued' || s === 'downloading' || s === 'verifying' || s === 'installing';
  const err: string | null = ('errorCode' in state && typeof state.errorCode === 'string' ? state.errorCode : null) ?? state.error;

  return (
    <View style={{ gap: space.sm }} testID={`pkg-${manifest.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Badge label={t(`library.statuses.${s}` as TKey)} tone={s === 'installed' ? 'success' : s === 'failed' ? 'danger' : active ? 'primary' : 'muted'} />
        {s === 'installed' ? <Badge label={t('library.verified')} tone="success" /> : null}
        {!compact ? (
          <Text variant="caption" color="textMuted">
            {t('library.size', { size: fmt.bytes(manifest.approxBytes) })}
          </Text>
        ) : null}
      </View>
      {active || s === 'paused' ? <ProgressBar progress={progressFraction(state)} color={s === 'paused' ? 'textMuted' : 'primary'} /> : null}
      {s === 'failed' && err ? (
        <Text variant="footnote" color="danger" testID={`pkg-error-${manifest.id}`}>
          {t(ERROR_KEYS[err] ?? 'library.errorGeneric')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {s === 'not_installed' ? (
          <Button label={t('library.download')} icon={Download} size="sm" onPress={() => manager.download(manifest.id)} testID={`download-${manifest.id}`} />
        ) : null}
        {s === 'downloading' || s === 'queued' ? (
          <Button
            label={t('library.pause')}
            icon={Pause}
            size="sm"
            variant="secondary"
            onPress={() => manager.pause(manifest.id)}
            testID={`pause-${manifest.id}`}
          />
        ) : null}
        {s === 'paused' ? (
          <Button label={t('library.resume')} icon={Play} size="sm" onPress={() => manager.download(manifest.id)} testID={`resume-${manifest.id}`} />
        ) : null}
        {s === 'failed' ? (
          <Button label={t('library.retry')} icon={RotateCcw} size="sm" onPress={() => manager.download(manifest.id)} testID={`retry-${manifest.id}`} />
        ) : null}
        {s === 'downloading' || s === 'queued' || s === 'paused' || s === 'failed' ? (
          <Button label={t('library.cancel')} icon={X} size="sm" variant="ghost" onPress={() => manager.cancel(manifest.id)} testID={`cancel-${manifest.id}`} />
        ) : null}
        {s === 'installed' && !confirmDelete ? (
          <Button label={t('library.delete')} icon={Trash2} size="sm" variant="ghost" onPress={() => setConfirmDelete(true)} testID={`delete-${manifest.id}`} />
        ) : null}
      </View>
      {confirmDelete ? (
        <View style={{ gap: space.sm }}>
          <Text variant="footnote">{t('library.deleteConfirm', { name })}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              label={t('common.delete')}
              variant="danger"
              size="sm"
              testID={`confirm-delete-${manifest.id}`}
              onPress={async () => {
                setConfirmDelete(false);
                await manager.remove(manifest.id);
              }}
            />
            <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => setConfirmDelete(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
