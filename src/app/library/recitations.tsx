import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Notice } from '@/design-system/components';
import { Header } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { MAX_READING_WIDTH, space } from '@/design-system/tokens';
import { PackageActions } from '@/features/library/PackageActions';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useSettings, useTheme } from '@/runtime/AppProvider';
import { recitationPackages, RECITERS } from '@/services/downloads/catalogue';
import { supportsFileDownloads } from '@/services/downloads/fs';
import { getSurah } from '@/services/quran/navigation';

export default function Recitations() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const [settings, update] = useSettings();
  const fmt = useFormat();
  const insets = useSafeAreaInsets();
  const packages = useMemo(() => recitationPackages(settings.quran.reciter), [settings.quran.reciter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="recitations-screen">
      <View style={{ paddingTop: insets.top }}>
        <Header back title={t('library.recitations')} />
      </View>
      <FlatList
        data={packages}
        keyExtractor={(p) => p.id}
        initialNumToRender={10}
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.xxl,
          width: '100%',
          maxWidth: MAX_READING_WIDTH + space.gutter * 2,
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingBottom: space.md }}>
            <Text variant="callout">{t('library.reciter')}</Text>
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
            {!supportsFileDownloads ? <Notice text={`${t('library.webNote')} ${t('audio.streaming')}.`} /> : null}
          </View>
        }
        renderItem={({ item }) => {
          const s = getSurah(item.payload.type === 'ayah-audio' ? item.payload.surah : 1);
          return (
            <View style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: space.sm }}>
              <Text variant="headline">
                {fmt.digits(s.number)}. {fmt.surahShort(s)}
              </Text>
              <Text variant="caption" color="textMuted">
                {t('common.ayahs', { count: s.ayahCount })} · {t('library.size', { size: fmt.bytes(item.approxBytes) })}
              </Text>
              {supportsFileDownloads ? <PackageActions manifest={item} compact /> : null}
            </View>
          );
        }}
      />
    </View>
  );
}
