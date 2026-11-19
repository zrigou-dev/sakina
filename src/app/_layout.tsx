import { Amiri_400Regular } from '@expo-google-fonts/amiri/400Regular';
import { Amiri_700Bold } from '@expo-google-fonts/amiri/700Bold';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran/400Regular';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_400Regular_Italic } from '@expo-google-fonts/ibm-plex-sans/400Regular_Italic';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BootError, BootSplash } from '@/features/shell/BootViews';
import { NotificationScheduler } from '@/features/shell/NotificationScheduler';
import { AppOverlays } from '@/features/shell/Overlays';
import { AdhanProvider } from '@/services/adhan/AdhanProvider';
import { AudioProvider } from '@/services/audio/AudioProvider';
import { DownloadProvider } from '@/services/downloads/DownloadProvider';
import { AppProvider, useI18n, useTheme } from '@/runtime/AppProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = { anchor: '(tabs)' };

function ThemedRoot() {
  const { colors, scheme } = useTheme();
  const { dir, isRTL, lang } = useI18n();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
    if (process.env.EXPO_OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }, [colors.bg, dir, lang]);

  return (
    <View style={{ flex: 1, direction: dir, backgroundColor: colors.bg, overflow: 'hidden' }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: isRTL ? 'slide_from_left' : 'slide_from_right',
          animationDuration: 280,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <NotificationScheduler />
      <AppOverlays />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AmiriQuran_400Regular,
    Amiri_400Regular,
    Amiri_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_400Regular_Italic,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    Fraunces_400Regular,
    Fraunces_600SemiBold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider fallback={<BootSplash />} errorView={(e, retry) => <BootError error={e} onRetry={retry} />}>
          <DownloadProvider>
            <AudioProvider>
              <AdhanProvider>
                <ThemedRoot />
              </AdhanProvider>
            </AudioProvider>
          </DownloadProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
