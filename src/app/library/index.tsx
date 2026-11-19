import { router } from 'expo-router';
import Headphones from 'lucide-react-native/icons/headphones';
import LibraryIcon from 'lucide-react-native/icons/library';
import Volume2 from 'lucide-react-native/icons/volume-2';
import { View } from 'react-native';

import { packagesRepo } from '@/database/repositories/user';
import { Badge, Card, FadeIn, ListGroup, ListRow, SectionHeader, Switch } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { PackageActions } from '@/features/library/PackageActions';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useSettings } from '@/runtime/AppProvider';
import { bundledCatalogue, CATALOGUE_URL, type PackageKind, type PackageManifest } from '@/services/downloads/catalogue';
import { usePackageStates } from '@/services/downloads/DownloadProvider';
import { availableSpace } from '@/services/downloads/fs';

function PackageCard({ m }: { m: PackageManifest }) {
  const { t, lang } = useI18n();
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="headline">{m.name[lang]}</Text>
      <Text variant="footnote" color="textMuted">
        {m.description[lang]}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        <Badge label={m.author} />
        <Badge
          label={
            m.licence.status === 'pending'
              ? t('library.licencePending')
              : m.licence.status === 'verified'
                ? t('library.licenceVerified')
                : t('library.licenceAttribution')
          }
          tone={m.licence.status === 'pending' ? 'warning' : 'muted'}
        />
      </View>
      <Text variant="caption" color="textFaint">
        {t('common.source')}: {m.source.name} · {t('common.licence')}: {m.licence.text}
      </Text>
      <PackageActions manifest={m} />
    </Card>
  );
}

export default function Library() {
  const { t } = useI18n();
  const [settings, update] = useSettings();
  const dbs = useDbs();
  const fmt = useFormat();
  const states = usePackageStates();
  const catalogue = bundledCatalogue();
  const used = useLoader(() => packagesRepo.totalInstalledBytes(dbs.user), [dbs, Object.values(states).filter((s) => s.status === 'installed').length]);
  const free = availableSpace();
  const recitationsDone = Object.entries(states).filter(([id, s]) => id.startsWith(`recitation.${settings.quran.reciter}.`) && s.status === 'installed').length;
  const byKind = (k: PackageKind) => catalogue.packages.filter((p) => p.kind === k);

  return (
    <Screen back title={t('library.title')} subtitle={t('library.intro')} large testID="library-screen">
      <FadeIn index={0}>
        <Card style={{ gap: space.sm }}>
          <Text variant="headline">{t('library.storage')}</Text>
          <Text variant="subhead" color="textMuted" testID="storage-used">
            {t('library.storageUsed', { size: fmt.bytes(used.data ?? 0) })}
          </Text>
          {free !== null ? (
            <Text variant="subhead" color="textMuted">
              {t('library.freeSpace', { size: fmt.bytes(free) })}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
            <Text variant="callout" style={{ flex: 1 }}>
              {t('library.wifiOnly')}
            </Text>
            <Switch
              value={settings.downloads.wifiOnly}
              onValueChange={(v) => update({ downloads: { wifiOnly: v } })}
              label={t('library.wifiOnly')}
              testID="library-wifi"
            />
          </View>
          {CATALOGUE_URL === null ? (
            <Text variant="caption" color="textFaint">
              {t('library.catalogueSnapshot')}
            </Text>
          ) : null}
          {process.env.EXPO_OS === 'web' ? (
            <Text variant="caption" color="textFaint">
              {t('library.webNote')}
            </Text>
          ) : null}
        </Card>
      </FadeIn>

      <SectionHeader title={t('library.translations')} />
      <View style={{ gap: space.md }}>
        {byKind('translation').map((m) => (
          <PackageCard key={m.id} m={m} />
        ))}
      </View>

      <SectionHeader title={t('library.tafsir')} />
      <View style={{ gap: space.md }}>
        {byKind('tafsir').map((m) => (
          <PackageCard key={m.id} m={m} />
        ))}
      </View>

      <SectionHeader title={t('library.recitations')} />
      <ListGroup>
        <ListRow
          icon={Headphones}
          title={t('library.recitations')}
          subtitle={t('library.surahsDownloaded', { done: fmt.digits(recitationsDone) })}
          onPress={() => router.push('/library/recitations')}
          testID="library-recitations"
          last
        />
      </ListGroup>

      <SectionHeader title={t('hadith.collections')} />
      <ListGroup>
        <ListRow
          icon={LibraryIcon}
          iconTone="accent"
          title={t('hadith.title')}
          subtitle={t('libraryMore.hadithBody')}
          onPress={() => router.push('/hadith')}
          testID="library-hadith"
        />
        <ListRow
          icon={Volume2}
          title={t('adhan.library')}
          subtitle={t('libraryMore.adhanBody')}
          onPress={() => router.push('/adhan')}
          testID="library-adhan"
          last
        />
      </ListGroup>
    </Screen>
  );
}
