import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { LucideIcon } from 'lucide-react-native';
import BookOpen from 'lucide-react-native/icons/book-open';
import Compass from 'lucide-react-native/icons/compass';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import House from 'lucide-react-native/icons/house';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import { forwardRef, useEffect, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design-system/Icon';
import { duration, easing } from '@/design-system/motion';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useI18n, useTheme, type TKey } from '@/runtime/AppProvider';

export interface TabItem {
  readonly name: string;
  readonly href: '/' | '/prayer' | '/quran' | '/learn' | '/more';
  readonly label: TKey;
  readonly icon: LucideIcon;
}

export const TAB_ITEMS: readonly TabItem[] = [
  { name: 'index', href: '/', label: 'tabs.home', icon: House },
  { name: 'prayer', href: '/prayer', label: 'tabs.prayer', icon: Compass },
  { name: 'quran', href: '/quran', label: 'tabs.quran', icon: BookOpen },
  { name: 'learn', href: '/learn', label: 'tabs.learn', icon: GraduationCap },
  { name: 'more', href: '/more', label: 'tabs.more', icon: LayoutGrid },
];

/** Floating, softly elevated tab bar. Row order follows the root direction, so it mirrors in RTL. */
export const SakinaTabBar = forwardRef<ComponentRef<typeof View>, ViewProps & { children: ReactNode }>(function SakinaTabBar(
  { children, style, ...rest },
  ref,
) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      ref={ref}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom, space.sm) + space.xs,
        alignItems: 'center',
        paddingHorizontal: space.md,
      }}
    >
      <View
        {...rest}
        accessibilityRole="tablist"
        style={[
          {
            width: '100%',
            maxWidth: 560,
            flexDirection: 'row',
            backgroundColor: colors.bgElevated,
            borderRadius: radius.xl,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: space.xs,
            paddingVertical: space.xs,
            ...(scheme === 'light'
              ? Platform.select({
                  ios: { shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
                  android: { elevation: 8 },
                  default: { boxShadow: '0 10px 30px rgba(74, 59, 31, 0.14)' },
                })
              : null),
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
});

type TabButtonProps = TabTriggerSlotProps & { item: TabItem };

export const TabButton = forwardRef<ComponentRef<typeof Pressable>, TabButtonProps>(function TabButton({ item, isFocused, ...props }, ref) {
  const { colors, reducedMotion } = useTheme();
  const { t } = useI18n();
  const focus = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    focus.value = reducedMotion ? (isFocused ? 1 : 0) : withTiming(isFocused ? 1 : 0, { duration: duration.quick, easing: easing.standard });
  }, [isFocused, reducedMotion, focus]);
  const pill = useAnimatedStyle(() => ({ opacity: focus.value, transform: [{ scale: 0.85 + 0.15 * focus.value }] }));
  const label = t(item.label);
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      aria-selected={!!isFocused}
      testID={`tab-${item.name}`}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, paddingVertical: space.xs, gap: 2 }}
    >
      <View style={{ width: 52, height: 30, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius.pill, backgroundColor: colors.primarySoft }, pill]} />
        <Icon icon={item.icon} size={21} color={isFocused ? 'primary' : 'textMuted'} strokeWidth={isFocused ? 2.1 : 1.75} />
      </View>
      <Text variant="caption" color={isFocused ? 'primary' : 'textMuted'} align="center" numberOfLines={1} weight={isFocused ? 'semibold' : 'medium'}>
        {label}
      </Text>
    </Pressable>
  );
});
