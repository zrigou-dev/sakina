import { router } from 'expo-router';
import Heart from 'lucide-react-native/icons/heart';
import MessageCircleHeart from 'lucide-react-native/icons/message-circle-heart';
import Share2 from 'lucide-react-native/icons/share-2';
import { Share, View } from 'react-native';

import SADAQAH from '@/content/sadaqah/hadith.generated.json';
import type { Ayah } from '@/content/quran/types';
import { quranRepo } from '@/database/repositories/content';
import { Badge, Button, Card, FadeIn, IconButton, ListGroup, ListRow, SectionHeader, Skeleton } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { AyahText } from '@/features/quran/AyahText';
import { PARENT_DUA_REFS } from '@/features/sadaqah/refs';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';
import { getSurah } from '@/services/quran/navigation';

/** Typography only: the source text has no space after the colon in the English narration line. */
const tidy = (s: string) => s.replace(/:(?=[A-Za-z])/g, ': ');

export default function Sadaqah() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const fmt = useFormat();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const ayahs = useLoader<Ayah[]>(async () => {
    if (quranStatus !== 'ready') return [];
    const rows = await Promise.all(PARENT_DUA_REFS.map(([s, a]) => quranRepo.ayah(dbs.content, s, a)));
    return rows.filter((r): r is Ayah => r !== null);
  }, [quranStatus]);

  const translation = lang === 'fr' ? SADAQAH.fr : lang === 'en' ? tidy(SADAQAH.en) : null;

  return (
    <Screen back title={t('sadaqah.title')} subtitle={t('sadaqah.subtitle')} large testID="sadaqah-screen">
      <FadeIn index={0}>
        <View
          style={{ backgroundColor: colors.heroFrom, borderRadius: radius.xl, padding: space.xl, gap: space.md, alignItems: 'center' }}
          testID="sadaqah-hero"
        >
          <EightPointStar size={64} color="#E3BC70" />
          <Text variant="body" align="center" style={{ color: colors.heroInk }} testID="sadaqah-message-1">
            {t('sadaqah.message1')}
          </Text>
        </View>
      </FadeIn>

      <FadeIn index={1}>
        <Card tone="accent" style={{ marginTop: space.md, gap: space.md }} testID="sadaqah-request">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Heart size={22} color={colors.accent} fill={colors.accent} />
          </View>
          <Text variant="title3" style={{ lineHeight: 30 }}>
            {t('sadaqah.message2')}
          </Text>
          <Text variant="callout" color="textMuted">
            {t('sadaqah.message3')}
          </Text>
        </Card>
      </FadeIn>

      <FadeIn index={2}>
        <SectionHeader title={t('sadaqah.hadithTitle')} />
        <Card style={{ gap: space.md }} testID="sadaqah-hadith">
          <Text script="arabic" selectable style={{ fontFamily: 'Amiri_400Regular', fontSize: 25, lineHeight: 46, textAlign: 'right', color: colors.text }}>
            {SADAQAH.ar}
          </Text>
          {translation ? (
            <Text script="latin" variant="subhead" color="textMuted" selectable>
              {translation}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Badge label={t('sadaqah.hadithRef')} tone="success" />
            <View style={{ flex: 1 }} />
            <IconButton
              icon={Share2}
              label={t('share.share')}
              size={18}
              color="textMuted"
              onPress={() =>
                Share.share({ message: `${SADAQAH.ar}\n\n${translation ? `${translation}\n\n` : ''}— ${t('sadaqah.hadithRef')}\n${t('share.via')}` }).catch(
                  () => undefined,
                )
              }
            />
          </View>
          <Text variant="caption" color="textFaint">
            {t('sadaqah.hadithNote')}
          </Text>
        </Card>
      </FadeIn>

      <FadeIn index={3}>
        <SectionHeader title={t('sadaqah.duaTitle')} />
        <Text variant="footnote" color="textMuted" style={{ marginBottom: space.md }}>
          {t('sadaqah.duaIntro')}
        </Text>
        <View style={{ gap: space.md }}>
          {ayahs.loading && !ayahs.data ? (
            <Skeleton height={120} />
          ) : (
            (ayahs.data ?? []).map((a) => (
              <Card key={a.id} style={{ gap: space.md }} testID={`sadaqah-ayah-${a.surah}-${a.ayah}`}>
                <AyahText text={a.text} size={27} align="center" selectable />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                  <Text variant="footnote" color="textMuted">
                    {fmt.surahName(getSurah(a.surah))} · {fmt.digits(`${a.surah}:${a.ayah}`)}
                  </Text>
                  <Button label={t('sadaqah.openInReader')} variant="ghost" size="sm" onPress={() => router.push(`/quran/${a.surah}?ayah=${a.ayah}`)} />
                </View>
              </Card>
            ))
          )}
        </View>
      </FadeIn>

      <FadeIn index={4}>
        <View style={{ marginTop: space.xl }}>
          <ListGroup>
            <ListRow
              icon={MessageCircleHeart}
              iconTone="accent"
              title={t('sadaqah.contactRow')}
              subtitle={t('sadaqah.contactCta')}
              onPress={() => router.push('/contact')}
              testID="sadaqah-contact-row"
              last
            />
          </ListGroup>
        </View>
      </FadeIn>
    </Screen>
  );
}
