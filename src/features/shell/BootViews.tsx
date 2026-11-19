import Constants from 'expo-constants';
import { Linking, Platform, useColorScheme, View, Text as RNText, Pressable } from 'react-native';

import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { DARK, LIGHT, fontFamilies } from '@/design-system/tokens';
import { crashMailto } from '@/services/feedback/mailto';

/**
 * Shown before settings are loaded, so it cannot use the i18n/theme providers.
 * Bilingual by design.
 */
export function BootSplash() {
  const c = useColorScheme() === 'dark' ? DARK : LIGHT;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }} accessibilityLabel="SAKINA">
      <EightPointStar size={56} color={c.accent} />
      <RNText style={{ fontFamily: fontFamilies.arabicDisplay, fontSize: 32, color: c.text }}>سكينة</RNText>
    </View>
  );
}

export function BootError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const c = useColorScheme() === 'dark' ? DARK : LIGHT;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
      <EightPointStar size={48} color={c.danger} />
      <RNText style={{ fontFamily: fontFamilies.arabicSemiBold, fontSize: 18, color: c.text, textAlign: 'center', writingDirection: 'rtl' }}>
        تعذّر على سكينة فتح قاعدة بياناتها المحلية.
      </RNText>
      <RNText style={{ fontFamily: fontFamilies.latinMedium, fontSize: 15, color: c.textMuted, textAlign: 'center' }}>
        SAKINA could not open its local database.
      </RNText>
      <RNText selectable style={{ fontFamily: fontFamilies.latinBody, fontSize: 12, color: c.textFaint, textAlign: 'center' }}>
        {String(error instanceof Error ? error.message : error).slice(0, 300)}
      </RNText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={{ marginTop: 8, backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' }}
      >
        <RNText style={{ fontFamily: fontFamilies.latinSemiBold, color: c.primaryInk, fontSize: 16 }}>إعادة المحاولة · Retry</RNText>
      </Pressable>
      <Pressable
        onPress={() => {
          const info = { appVersion: Constants.expoConfig?.version ?? 'dev', platform: Platform.OS, osVersion: String(Platform.Version), language: '-' };
          Linking.openURL(crashMailto(String(error instanceof Error ? error.message : error), info)).catch(() => undefined);
        }}
        accessibilityRole="link"
        testID="boot-report"
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <RNText style={{ fontFamily: fontFamilies.latinMedium, color: c.accent, fontSize: 14, textDecorationLine: 'underline' }}>
          الإبلاغ عن المشكلة · Report this problem
        </RNText>
      </Pressable>
    </View>
  );
}
