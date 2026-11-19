import Constants from 'expo-constants';
import { router } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import Compass from 'lucide-react-native/icons/compass';
import Download from 'lucide-react-native/icons/download';
import HardDriveDownload from 'lucide-react-native/icons/hard-drive-download';
import Info from 'lucide-react-native/icons/info';
import MapPin from 'lucide-react-native/icons/map-pin';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Trash2 from 'lucide-react-native/icons/trash';
import Upload from 'lucide-react-native/icons/upload';
import Volume2 from 'lucide-react-native/icons/volume-2';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ListGroup, ListRow, Notice, SectionHeader, SegmentedControl, Stepper, Switch, TextField } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { LANGUAGE_INFO, LANGUAGES } from '@/localization/languages';
import { bumpDataVersion, replaceSettings, useDbs, useI18n, useSettings } from '@/runtime/AppProvider';
import { BackupError, deleteAllUserData, exportUserData, importUserData, parseBackup, settingsFromBackup } from '@/services/backup/backup';
import { pickBackupFile, saveBackupFile } from '@/services/backup/io';
import { RECITERS } from '@/services/downloads/catalogue';
import { useDownloadManager } from '@/services/downloads/DownloadProvider';
import { deleteAllPackages } from '@/services/downloads/fs';
import { hadithRepo, translationRepo } from '@/database/repositories/content';
import { DEFAULT_SETTINGS, FONT_SCALE_RANGE, type ThemePreference } from '@/state/settings';

export default function SettingsScreen() {
  const { t, lang } = useI18n();
  const [settings, update] = useSettings();
  const dbs = useDbs();
  const fmt = useFormat();
  const manager = useDownloadManager();
  const [message, setMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const doExport = async () => {
    const backup = await exportUserData(dbs.user);
    await saveBackupFile(JSON.stringify(backup));
    setMessage(t('settings.exportDone'));
  };

  const doPickImport = async () => {
    setMessage(null);
    try {
      const raw = await pickBackupFile();
      if (raw === null) return;
      setPendingImport(parseBackup(raw));
    } catch (e) {
      setMessage(e instanceof BackupError ? t('settings.importInvalid') : t('common.errorBody'));
    }
  };

  const doImport = async () => {
    if (!pendingImport) return;
    await importUserData(dbs.user, pendingImport);
    replaceSettings(settingsFromBackup(pendingImport));
    setPendingImport(null);
    bumpDataVersion();
    setMessage(t('settings.importDone'));
  };

  const doDeleteAll = async () => {
    for (const id of Object.keys(manager.store.get())) await manager.remove(id).catch(() => undefined);
    for (const e of await translationRepo.editions(dbs.content)) await translationRepo.remove(dbs.content, e.id);
    for (const b of await hadithRepo.books(dbs.content)) if (!b.bundled) await hadithRepo.remove(dbs.content, b.id);
    deleteAllPackages();
    await deleteAllUserData(dbs.user);
    replaceSettings(DEFAULT_SETTINGS);
    bumpDataVersion();
    router.replace('/onboarding');
  };

  return (
    <Screen back title={t('settings.title')} large testID="settings-screen">
      {message ? <Notice tone="accent" text={message} /> : null}

      <SectionHeader title={t('settings.general')} style={{ marginTop: message ? space.lg : 0 }} />
      <Card style={{ gap: space.md }}>
        <Text variant="callout">{t('settings.language')}</Text>
        <SegmentedControl
          testID="settings-language"
          value={settings.language}
          onChange={(v) => update({ language: v })}
          options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_INFO[l].nativeName }))}
        />
        <TextField
          label={t('settings.name')}
          placeholder={t('settings.namePlaceholder')}
          value={settings.displayName}
          onChangeText={(v) => update({ displayName: v })}
          maxLength={40}
          testID="settings-name"
        />
      </Card>

      <SectionHeader title={t('settings.appearance')} />
      <Card style={{ gap: space.md }}>
        <Text variant="callout">{t('settings.theme')}</Text>
        <SegmentedControl<ThemePreference>
          testID="settings-theme"
          value={settings.theme}
          onChange={(v) => update({ theme: v })}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="callout">{t('settings.textSize')}</Text>
          <Stepper
            testID="settings-font-scale"
            label={t('settings.textSize')}
            value={settings.fontScale}
            min={FONT_SCALE_RANGE[0]}
            max={FONT_SCALE_RANGE[1]}
            step={0.05}
            format={(v) => `${fmt.digits(Math.round(v * 100))}${lang === 'ar' ? '٪' : '%'}`}
            onChange={(v) => update({ fontScale: Math.round(v * 100) / 100 })}
          />
        </View>
        <Text variant="footnote" color="textMuted">
          {t('settings.textSizeHelp')}
        </Text>
        <Text variant="footnote" color="textFaint">
          {t('settings.reducedMotion')}
        </Text>
      </Card>

      <SectionHeader title={t('settings.prayer')} />
      <ListGroup>
        <ListRow
          icon={Compass}
          title={t('prayer.settings')}
          subtitle={fmt.methodName(settings.prayer.method)}
          onPress={() => router.push('/settings/prayer')}
          testID="settings-prayer"
        />
        <ListRow
          icon={MapPin}
          title={t('prayer.location')}
          subtitle={fmt.placeName(settings.location) || '—'}
          onPress={() => router.push('/settings/location')}
          testID="settings-location"
        />
        <ListRow
          icon={Bell}
          iconTone="accent"
          title={t('settings.notifications')}
          onPress={() => router.push('/settings/notifications')}
          testID="settings-notifications"
        />
        <ListRow icon={Volume2} title={t('adhan.title')} subtitle={t('adhan.library')} onPress={() => router.push('/adhan')} testID="settings-adhan" />
        <ListRow icon={Sparkles} iconTone="accent" title={t('reminders.title')} onPress={() => router.push('/reminders')} testID="settings-reminders" last />
      </ListGroup>

      <SectionHeader title={t('settings.quran')} />
      <Card style={{ gap: space.md }}>
        <Text variant="callout">{t('settings.reciter')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {RECITERS.map((r) => (
            <Chip
              key={r.id}
              label={lang === 'ar' ? r.nameAr : r.nameLatin}
              selected={settings.quran.reciter === r.id}
              onPress={() => update({ quran: { reciter: r.id } })}
            />
          ))}
        </View>
      </Card>

      <SectionHeader title={t('settings.downloads')} />
      <ListGroup>
        <ListRow
          title={t('library.wifiOnly')}
          trailing={
            <Switch
              value={settings.downloads.wifiOnly}
              onValueChange={(v) => update({ downloads: { wifiOnly: v } })}
              label={t('library.wifiOnly')}
              testID="settings-wifi"
            />
          }
        />
        <ListRow icon={HardDriveDownload} title={t('more.library')} onPress={() => router.push('/library')} last />
      </ListGroup>

      <SectionHeader title={t('settings.privacy')} />
      <Card style={{ gap: space.md }}>
        <Text variant="subhead" color="textMuted">
          {t('settings.privacyBody')}
        </Text>
        <Button label={t('settings.exportData')} icon={Download} variant="secondary" onPress={doExport} testID="export-backup" />
        <Text variant="footnote" color="textMuted">
          {t('settings.exportHelp')}
        </Text>
        <Button label={t('settings.importData')} icon={Upload} variant="secondary" onPress={doPickImport} testID="import-backup" />
        <Text variant="footnote" color="textMuted">
          {t('settings.importHelp')}
        </Text>
        {pendingImport ? (
          <View style={{ gap: space.sm }}>
            <Notice tone="warning" text={t('settings.importConfirm')} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label={t('common.continue')} onPress={doImport} size="sm" testID="confirm-import" />
              <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => setPendingImport(null)} />
            </View>
          </View>
        ) : null}
        <Button label={t('settings.deleteAll')} icon={Trash2} variant="danger" onPress={() => setShowDelete((v) => !v)} testID="delete-all" />
        {showDelete ? (
          <View style={{ gap: space.sm }}>
            <Notice tone="warning" text={t('settings.deleteAllHelp')} />
            <TextField
              label={t('settings.deleteAllConfirm')}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              testID="delete-confirm-input"
            />
            <Button
              label={t('settings.deleteAllButton')}
              variant="danger"
              disabled={confirmText.trim() !== 'DELETE'}
              onPress={doDeleteAll}
              testID="delete-all-confirm"
            />
          </View>
        ) : null}
      </Card>

      <SectionHeader title={t('settings.about')} />
      <ListGroup>
        <ListRow icon={Info} iconTone="muted" title={t('more.about')} onPress={() => router.push('/about')} />
        <ListRow
          icon={RotateCcw}
          iconTone="muted"
          title={t('settings.resetOnboarding')}
          onPress={async () => {
            await update({ onboardingComplete: false });
            router.replace('/onboarding');
          }}
          last
        />
      </ListGroup>
      <Text variant="caption" color="textFaint" align="center" style={{ marginTop: space.lg }}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
      </Text>
    </Screen>
  );
}
