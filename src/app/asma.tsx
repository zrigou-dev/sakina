import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ASMA_AL_HUSNA } from '@/content/asma/asma.generated';
import { Notice } from '@/design-system/components';
import { Header } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { MAX_READING_WIDTH, radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useTheme } from '@/runtime/AppProvider';

export default function Asma() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const fmt = useFormat();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="asma-screen">
      <View style={{ paddingTop: insets.top }}>
        <Header back title={t('asma.title')} />
      </View>
      <FlatList
        data={ASMA_AL_HUSNA as (typeof ASMA_AL_HUSNA)[number][]}
        keyExtractor={(n) => String(n.number)}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{
          padding: space.gutter,
          gap: space.md,
          paddingBottom: insets.bottom + space.xxl,
          width: '100%',
          maxWidth: MAX_READING_WIDTH + space.gutter * 2,
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Notice text={t('asma.note')} />
            {lang === 'fr' ? <Notice text={t('asma.meaningUnavailable')} /> : null}
          </View>
        }
        ListFooterComponent={
          <Text variant="caption" color="textFaint" align="center" style={{ marginTop: space.lg }}>
            {t('asma.source')}
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: space.lg,
              alignItems: 'center',
              gap: space.xs,
              minHeight: 150,
            }}
          >
            <Text variant="caption" color="accent" fixedSize>
              {fmt.digits(item.number)}
            </Text>
            <Text script="arabic" variant="title2" align="center" style={{ fontFamily: 'Amiri_700Bold', color: colors.primary, lineHeight: 52 }}>
              {item.arabic}
            </Text>
            <Text variant="footnote" script="latin" align="center" style={{ fontStyle: 'italic' }}>
              {item.transliteration}
            </Text>
            {lang !== 'ar' ? (
              <Text variant="caption" color="textMuted" script="latin" align="center">
                {item.meaningEn}
              </Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
