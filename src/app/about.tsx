import { View } from 'react-native';

import Heart from 'lucide-react-native/icons/heart';
import MessageCircleHeart from 'lucide-react-native/icons/message-circle-heart';
import { router } from 'expo-router';

import { Badge, Card, ListGroup, ListRow, SectionHeader } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useI18n, useTheme, type TKey } from '@/runtime/AppProvider';
import { allVoices } from '@/services/adhan/voices';

interface SourceRow {
  readonly name: string;
  readonly detail: string;
  readonly licence: string;
  readonly status: 'bundled' | 'download' | 'pending' | 'none';
  readonly verification?: string;
}

/** Mirrors CONTENT_POLICY.md's content register. */
const SOURCES: readonly SourceRow[] = [
  {
    name: 'Tanzil Project — Quran text (Uthmani v1.1, XML export)',
    detail: 'tanzil.net',
    licence: 'CC BY 3.0 (verbatim)',
    status: 'bundled',
    verification: 'SHA-256 203f0f1b…e0fd · 114 surahs · 6236 ayahs · Basmala structure',
  },
  {
    name: 'Tanzil Project — Quran text (Simple Clean), search index only',
    detail: 'tanzil.net',
    licence: 'CC BY 3.0 (verbatim)',
    status: 'bundled',
    verification: 'SHA-256 140787b7…b1fe',
  },
  {
    name: 'Tanzil Project — Quran metadata',
    detail: 'tanzil.net/res/text/metadata',
    licence: 'CC BY',
    status: 'bundled',
    verification: '114 / 30 / 240 / 604 / 556',
  },
  {
    name: 'AlQuran Cloud — translations & tafsir',
    detail: 'api.alquran.cloud (Islamic Network)',
    licence: 'Per edition, attribution',
    status: 'download',
    verification: '6236 ayahs, ordering',
  },
  {
    name: 'Islamic Network CDN — recitations',
    detail: 'cdn.islamic.network',
    licence: 'Reciter rights',
    status: 'download',
    verification: 'MP3 header + SHA-256 recorded',
  },
  {
    name: 'Ḥiṣn al-Muslim — Saʿīd ibn ʿAlī ibn Wahf al-Qaḥṭānī (132 chapters, 267 adhkār)',
    detail: 'Dataset: github.com/YousefAsalya/Islamic-Pro-azkar-API',
    licence: 'Dataset MIT · book text by its author, widely distributed free of charge',
    status: 'bundled',
    verification: 'Arabic text, counts and English verbatim from the dataset; reference = book chapter',
  },
  {
    name: 'Morning & Evening Adhkar DB',
    detail: 'github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    licence: 'MIT',
    status: 'bundled',
    verification: '34 adhkār with counts, virtues and takhrīj (incl. al-Albānī gradings) as published',
  },
  {
    name: 'hadith-api — Forty Nawawi (42) & Forty Qudsi (40), Arabic/English/French',
    detail: 'github.com/fawazahmed0/hadith-api',
    licence: 'The Unlicense (dataset); translators named per edition',
    status: 'bundled',
    verification: 'Counts checked; gradings shown exactly as published with the grader’s name',
  },
  {
    name: 'hadith-api — Bukhārī, Muslim, Abū Dāwūd, Tirmidhī, Nasāʾī, Ibn Mājah, Mālik',
    detail: 'cdn.jsdelivr.net/gh/fawazahmed0/hadith-api',
    licence: 'The Unlicense (dataset)',
    status: 'download',
    verification: 'Structure, numbering and sections validated before activation',
  },
  { name: 'AlAdhan API — Asma al-Husna', detail: 'api.aladhan.com', licence: 'Public API, attribution', status: 'bundled', verification: '99 entries' },
  { name: 'GeoNames — cities', detail: 'geonames.org', licence: 'CC BY 4.0', status: 'bundled' },
  ...allVoices().map((v): SourceRow => ({
    name: `Adhan — ${v.name.en}`,
    detail: `${v.credit.recordist} · ${v.credit.sourceUrl.replace('https://', '')}`,
    licence: `${v.credit.licence}${v.credit.shareAlike ? ' (share-alike)' : ''}`,
    status: v.delivery === 'bundled' ? 'bundled' : 'download',
    verification: `Licence verified ${v.credit.verifiedOn} · ${v.credit.modified}`,
  })),
];

export default function About() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Screen back title={t('about.title')} large testID="about-screen">
      <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
        <EightPointStar size={56} color={colors.accent} />
        <Text variant="title1" script="arabic" align="center" style={{ fontFamily: 'Amiri_700Bold', color: colors.primary }}>
          سكينة
        </Text>
        <Text variant="subhead" color="textMuted" align="center">
          {t('about.mission')}
        </Text>
      </View>
      <ListGroup>
        <ListRow
          icon={Heart}
          iconTone="accent"
          title={t('sadaqah.title')}
          subtitle={t('sadaqah.rowSubtitle')}
          onPress={() => router.push('/sadaqah')}
          testID="about-sadaqah"
        />
        <ListRow
          icon={MessageCircleHeart}
          iconTone="muted"
          title={t('contact.title')}
          subtitle={t('contact.rowSubtitle')}
          onPress={() => router.push('/contact')}
          testID="about-contact"
          last
        />
      </ListGroup>
      <SectionHeader title={t('about.sources')} />
      <View style={{ gap: space.sm }}>
        {SOURCES.map((s) => (
          <Card key={s.name} style={{ gap: space.xs }}>
            <Text variant="callout" script="latin">
              {s.name}
            </Text>
            <Text variant="caption" color="textMuted" script="latin">
              {s.detail} · {s.licence}
            </Text>
            {s.verification ? (
              <Text variant="caption" color="textFaint" script="latin">
                {t('about.verification')}: {s.verification}
              </Text>
            ) : null}
            <Badge
              label={t(`about.statuses.${s.status}` as TKey)}
              tone={s.status === 'bundled' ? 'success' : s.status === 'download' ? 'primary' : s.status === 'pending' ? 'warning' : 'muted'}
            />
          </Card>
        ))}
      </View>
      <SectionHeader title={t('about.review')} />
      <Card tone="muted">
        <Text variant="subhead" color="textMuted">
          {t('about.reviewBody')}
        </Text>
      </Card>
      <SectionHeader title={t('about.fonts')} />
      <Card tone="muted">
        <Text variant="subhead" color="textMuted">
          {t('about.fontsBody')}
        </Text>
      </Card>
      <SectionHeader title={t('about.libraries')} />
      <Card tone="muted">
        <Text variant="subhead" color="textMuted">
          {t('about.librariesBody')}
        </Text>
      </Card>
    </Screen>
  );
}
