import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import BookOpen from 'lucide-react-native/icons/book-open';
import FileUp from 'lucide-react-native/icons/file-up';
import HardDriveDownload from 'lucide-react-native/icons/hard-drive-download';
import Languages from 'lucide-react-native/icons/languages';
import LibraryIcon from 'lucide-react-native/icons/library';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Volume2 from 'lucide-react-native/icons/volume-2';
import { useState } from 'react';
import { View } from 'react-native';

import { hadithRepo } from '@/database/repositories/content';
import { Button, Card, FadeIn, ListGroup, ListRow, Notice, SectionHeader } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { hadithBookName } from '@/features/hadith/HadithCard';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime } from '@/runtime/AppProvider';
import { contentPackagesRepo, parseContentPackage, type Section } from '@/services/content/packages';

async function readPicked(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (process.env.EXPO_OS === 'web') return a.file ? a.file.text() : (await fetch(a.uri)).text();
  return new File(a.uri).text();
}

const SECTIONS: Section[] = ['library', 'academy', 'guides', 'family'];

/** The Islamic library: hadith collections, Quran resources, adhan recordings and imported books. */
export default function LibraryScreen() {
  const { t } = useI18n();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const [message, setMessage] = useState<{ tone: 'accent' | 'warning'; text: string } | null>(null);
  const data = useLoader(async () => {
    if (quranStatus !== 'ready') return null;
    const books = await hadithRepo.books(dbs.content);
    const imported = (await Promise.all(SECTIONS.map((s) => contentPackagesRepo.list(dbs.content, s)))).flat();
    return { books, imported };
  }, [quranStatus]);

  return (
    <Screen back title={t('learn.library')} subtitle={t('libraryMore.hadithBody')} large testID="learn-library">
      <FadeIn index={0}>
        <SectionHeader title={t('hadith.title')} style={{ marginTop: 0 }} />
        <ListGroup>
          {(data.data?.books ?? []).map((b) => (
            <ListRow
              key={b.id}
              icon={BookOpen}
              title={hadithBookName(t, b.id)}
              subtitle={t('hadith.count', { count: b.hadithCount })}
              onPress={() => router.push(`/hadith/${b.id}`)}
            />
          ))}
          <ListRow
            icon={LibraryIcon}
            iconTone="accent"
            title={t('hadith.collections')}
            subtitle={t('libraryMore.hadithBody')}
            onPress={() => router.push('/hadith')}
            testID="library-hadith"
            last
          />
        </ListGroup>
      </FadeIn>
      <FadeIn index={1}>
        <SectionHeader title={t('libraryMore.quranResources')} />
        <ListGroup>
          <ListRow
            icon={Languages}
            title={t('libraryMore.quranResources')}
            subtitle={t('libraryMore.quranResourcesBody')}
            onPress={() => router.push('/library')}
          />
          <ListRow icon={Volume2} iconTone="accent" title={t('adhan.library')} subtitle={t('libraryMore.adhanBody')} onPress={() => router.push('/adhan')} />
          <ListRow icon={Sparkles} title={t('learn.asma')} subtitle={t('learn.asmaBody')} onPress={() => router.push('/asma')} />
          <ListRow
            icon={HardDriveDownload}
            iconTone="muted"
            title={t('more.library')}
            subtitle={t('library.intro')}
            onPress={() => router.push('/library')}
            last
          />
        </ListGroup>
      </FadeIn>

      {data.data?.imported.length ? (
        <>
          <SectionHeader title={t('libraryMore.importAdvanced')} />
          <ListGroup>
            {data.data.imported.map((p, i, all) => (
              <ListRow
                key={p.id}
                icon={BookOpen}
                title={p.title}
                subtitle={`${p.sourceName} · ${t('learn.lessons', { count: p.itemCount })}`}
                last={i === all.length - 1}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

      <SectionHeader title={t('libraryMore.importAdvanced')} />
      <Card style={{ gap: space.md }}>
        {message ? <Notice tone={message.tone} text={message.text} /> : null}
        <Text variant="footnote" color="textMuted">
          {t('learn.importHelp')}
        </Text>
        <Button
          label={t('learn.importPackage')}
          icon={FileUp}
          variant="secondary"
          size="sm"
          testID="import-content-package"
          onPress={async () => {
            setMessage(null);
            try {
              const raw = await readPicked();
              if (!raw) return;
              const pkg = parseContentPackage(raw);
              await contentPackagesRepo.install(dbs.content, pkg);
              bumpDataVersion();
              setMessage({ tone: 'accent', text: t('learn.importDone', { name: pkg.title }) });
            } catch {
              setMessage({ tone: 'warning', text: t('learn.importInvalid') });
            }
          }}
        />
      </Card>
      <View style={{ height: space.md }} />
    </Screen>
  );
}
