import Download from 'lucide-react-native/icons/download';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import X from 'lucide-react-native/icons/x';
import { View } from 'react-native';

import { Button, ProgressBar, Spinner } from '@/design-system/components';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, type TKey } from '@/runtime/AppProvider';
import { useDownloadManager } from '@/services/downloads/DownloadProvider';
import { progressFraction } from '@/services/downloads/state';
import { downloadSize, isLocalVoice, voicePackageId, type AdhanVoice } from '@/services/adhan/voices';

import { useVoiceInstall } from './hooks';

const ERRORS: Record<string, TKey> = {
  network: 'adhan.errorNetwork',
  offline: 'adhan.errorNetwork',
  interrupted: 'adhan.errorNetwork',
  integrity: 'adhan.errorIntegrity',
  space: 'adhan.errorSpace',
  wifi: 'adhan.errorWifi',
  generic: 'adhan.errorGeneric',
};

/** The download lifecycle of one voice: start, progress, pause/resume, cancel, verification and clear errors. */
export function VoiceDownload({ voice }: { voice: AdhanVoice }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const manager = useDownloadManager();
  const { state, canDownload } = useVoiceInstall(voice);
  const id = voicePackageId(voice.id);
  const s = state.status;
  if (isLocalVoice(voice) || s === 'installed') return null;

  if (!canDownload) {
    return (
      <Text variant="footnote" color="textMuted">
        {t('adhan.webDownloads')}
      </Text>
    );
  }

  const percent = Math.round(progressFraction(state) * 100);
  const code = state.errorCode ?? state.error ?? 'generic';

  return (
    <View style={{ gap: space.sm }} testID={`voice-download-${voice.id}`}>
      {s === 'not_installed' ? (
        <Button
          label={t('adhan.download', { size: fmt.bytes(downloadSize(voice)) })}
          icon={Download}
          size="sm"
          onPress={() => manager.download(id)}
          testID={`download-${id}`}
        />
      ) : null}

      {s === 'queued' || s === 'downloading' || s === 'paused' ? (
        <View style={{ gap: space.xs }}>
          <ProgressBar progress={progressFraction(state)} color={s === 'paused' ? 'textMuted' : 'accent'} />
          <Text variant="footnote" color="textMuted" testID={`download-status-${id}`}>
            {s === 'queued' ? t('adhan.queued') : t('adhan.downloading', { percent: `${fmt.digits(percent)}%` })}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {s === 'paused' ? (
              <Button label={t('adhan.resume')} icon={Play} size="sm" onPress={() => manager.download(id)} testID={`resume-${id}`} />
            ) : (
              <Button label={t('adhan.pause')} icon={Pause} size="sm" variant="secondary" onPress={() => manager.pause(id)} testID={`pause-${id}`} />
            )}
            <Button label={t('adhan.cancel')} icon={X} size="sm" variant="ghost" onPress={() => manager.cancel(id)} testID={`cancel-${id}`} />
          </View>
        </View>
      ) : null}

      {s === 'verifying' || s === 'installing' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Spinner color="accent" />
          <Text variant="footnote" color="textMuted">
            {t('adhan.verifying')}
          </Text>
        </View>
      ) : null}

      {s === 'failed' ? (
        <View style={{ gap: space.sm }}>
          <Text variant="footnote" color="danger" testID={`download-error-${id}`}>
            {t(ERRORS[code] ?? 'adhan.errorGeneric')}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label={t('adhan.retry')} icon={RotateCcw} size="sm" onPress={() => manager.download(id)} testID={`retry-${id}`} />
            <Button label={t('adhan.cancel')} icon={X} size="sm" variant="ghost" onPress={() => manager.cancel(id)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
