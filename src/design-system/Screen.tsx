import { router } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { useState, type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n, useTheme } from '@/runtime/AppProvider';

import { IconButton } from './components';
import { GeometricBackdrop } from './GeometricBackdrop';
import { Text } from './Text';
import { MAX_READING_WIDTH, space } from './tokens';

export interface HeaderProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly back?: boolean;
  readonly actions?: ReactNode;
  readonly large?: boolean;
}

export function Header({ title, subtitle, back, actions, large }: HeaderProps) {
  const { t } = useI18n();
  return (
    <View style={{ paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: large ? space.md : space.sm, gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.xs }}>
        {back ? (
          <View style={{ marginStart: -space.sm }}>
            <IconButton
              icon={ArrowLeft}
              label={t('common.back')}
              directional
              testID="header-back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          </View>
        ) : null}
        {!large && title ? (
          <Text variant="headline" numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {actions ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>{actions}</View> : null}
      </View>
      {large && title ? (
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {large && subtitle ? (
        <Text variant="subhead" color="textMuted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export interface ScreenProps extends HeaderProps {
  readonly children: ReactNode;
  /** Wraps children in a ScrollView (default true). Pass false for virtualised lists. */
  readonly scroll?: boolean;
  readonly backdrop?: boolean;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly scrollProps?: ScrollViewProps;
  readonly header?: boolean;
  readonly testID?: string;
  /** Extra bottom space so content clears the tab bar. */
  readonly tabBarInset?: boolean;
}

export function Screen({
  children,
  scroll = true,
  backdrop = true,
  contentStyle,
  scrollProps,
  header = true,
  testID,
  tabBarInset,
  ...headerProps
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [collapsed, setCollapsed] = useState(false);
  const bottom = insets.bottom + (tabBarInset ? 112 : space.xxl);
  const { title, subtitle, large } = headerProps;
  // Large titles scroll with the content; a compact title appears in the bar once scrolled past.
  const inlineTitle = scroll && large && !!title;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID={testID}>
      {backdrop ? <GeometricBackdrop /> : null}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: inlineTitle && collapsed ? colors.bgElevated : 'transparent',
          borderBottomWidth: inlineTitle && collapsed ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        {header ? (
          <Header
            {...headerProps}
            large={inlineTitle ? false : large}
            title={inlineTitle ? (collapsed ? title : undefined) : title}
            subtitle={inlineTitle ? undefined : subtitle}
          />
        ) : null}
      </View>
      {scroll ? (
        <ScrollView
          {...scrollProps}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={(e) => {
            const next = e.nativeEvent.contentOffset.y > 56;
            if (next !== collapsed) setCollapsed(next);
            scrollProps?.onScroll?.(e);
          }}
          contentContainerStyle={[
            { paddingHorizontal: space.gutter, paddingBottom: bottom, width: '100%', maxWidth: MAX_READING_WIDTH + space.gutter * 2, alignSelf: 'center' },
            contentStyle,
          ]}
        >
          {inlineTitle ? (
            <View style={{ gap: space.xs, paddingBottom: space.lg }}>
              <Text variant="title1" accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="subhead" color="textMuted">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </View>
  );
}
