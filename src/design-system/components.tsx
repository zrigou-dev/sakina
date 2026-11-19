import type { LucideIcon } from 'lucide-react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-exclamation-point';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { useI18n, useTheme } from '@/runtime/AppProvider';

import { EightPointStar } from './GeometricBackdrop';
import { Icon } from './Icon';
import { duration, easing, STAGGER_MS } from './motion';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { MIN_TOUCH, radius, space, type ColorTokens } from './tokens';

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
  tone = 'surface',
  padded = true,
  onPress,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'muted' | 'accent' | 'primary';
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, scheme } = useTheme();
  const bg = { surface: colors.surface, muted: colors.surfaceMuted, accent: colors.accentSoft, primary: colors.primarySoft }[tone];
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.lg,
    padding: padded ? space.lg : 0,
    borderWidth: scheme === 'dark' || tone !== 'surface' ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.border,
    ...(scheme === 'light' && tone === 'surface'
      ? Platform.select({
          ios: { shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
          android: { elevation: 2 },
          default: { boxShadow: '0 6px 20px rgba(74, 59, 31, 0.08)' } as ViewStyle,
        })
      : null),
  };
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[base, style]} accessibilityLabel={accessibilityLabel} testID={testID}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={[base, style]} testID={testID}>
      {children}
    </View>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  size = 'md',
  style,
  testID,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: keyof ColorTokens; border?: string }> = {
    primary: { bg: colors.primary, fg: 'primaryInk' },
    secondary: { bg: colors.surfaceMuted, fg: 'text', border: colors.border },
    ghost: { bg: 'transparent', fg: 'primary' },
    danger: { bg: colors.dangerSoft, fg: 'danger' },
  };
  const p = palette[variant];
  const height = { sm: 40, md: 50, lg: 56 }[size];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic="light"
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!(disabled || loading)}
      aria-busy={!!loading}
      style={[
        {
          minHeight: Math.max(height, MIN_TOUCH),
          paddingHorizontal: size === 'sm' ? space.lg : space.xl,
          borderRadius: radius.pill,
          backgroundColor: p.bg,
          borderWidth: p.border ? StyleSheet.hairlineWidth : 0,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
        },
        style,
      ]}
    >
      {loading ? <Spinner color={p.fg} /> : icon ? <Icon icon={icon} size={size === 'sm' ? 18 : 20} color={p.fg} /> : null}
      <Text variant={size === 'sm' ? 'callout' : 'headline'} color={p.fg} align="center" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color = 'text',
  tone = 'plain',
  size = 22,
  directional,
  testID,
  selected,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  color?: keyof ColorTokens;
  tone?: 'plain' | 'filled';
  size?: number;
  directional?: boolean;
  testID?: string;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      aria-selected={selected}
      testID={testID}
      hitSlop={8}
      haptic="selection"
      style={{
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'filled' ? colors.surfaceMuted : 'transparent',
      }}
    >
      <Icon icon={icon} size={size} color={color} directional={directional} />
    </PressableScale>
  );
}

// ─── Chip & segmented control ────────────────────────────────────────────────
export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      aria-selected={!!selected}
      style={{
        minHeight: 36,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        backgroundColor: selected ? colors.primary : colors.surfaceMuted,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      {icon ? <Icon icon={icon} size={16} color={selected ? 'primaryInk' : 'textMuted'} /> : null}
      <Text variant="footnote" weight="medium" color={selected ? 'primaryInk' : 'text'}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 3, gap: 2 }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={o.label}
            style={{
              flex: 1,
              minHeight: 38,
              paddingVertical: 4,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.sm,
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            <Text variant="footnote" weight={selected ? 'semibold' : 'regular'} color={selected ? 'text' : 'textMuted'} align="center" numberOfLines={2}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── List rows ────────────────────────────────────────────────────────────────
export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'primary',
  trailing,
  onPress,
  chevron = !!onPress,
  testID,
  accessibilityLabel,
  first,
  last,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconTone?: 'primary' | 'accent' | 'muted' | 'danger';
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  first?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const toneBg = { primary: colors.primarySoft, accent: colors.accentSoft, muted: colors.surfaceMuted, danger: colors.dangerSoft }[iconTone];
  const toneFg: keyof ColorTokens = ({ primary: 'primary', accent: 'accent', muted: 'textMuted', danger: 'danger' } as const)[iconTone];
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: toneBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} size={19} color={toneFg} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout">{title}</Text>
        {subtitle ? (
          <Text variant="footnote" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon icon={ChevronRight} size={18} color="textFaint" directional /> : null}
    </View>
  );
  const border = !last ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null;
  if (!onPress) return <View style={[{ paddingHorizontal: space.lg }, border, first ? { paddingTop: space.xs } : null]}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? title}
      scaleTo={0.99}
      style={[{ paddingHorizontal: space.lg }, border]}
    >
      {content}
    </PressableScale>
  );
}

export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Card padded={false} style={[{ overflow: 'hidden' }, style]}>
      {children}
    </Card>
  );
}

/**
 * Direction-aware animated switch (the platform Switch renders inconsistently in RTL on web).
 * accessibilityRole "switch" with checked state; 51×31 visual, 44pt+ touch target.
 */
export function Switch({ value, onValueChange, label, testID }: { value: boolean; onValueChange: (v: boolean) => void; label: string; testID?: string }) {
  const { colors, reducedMotion } = useTheme();
  const { isRTL } = useI18n();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = reducedMotion ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: duration.quick, easing: easing.standard });
  }, [value, reducedMotion, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: (isRTL ? -1 : 1) * x.value * 20 }] }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={value}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={{ width: 51, height: 31, borderRadius: 16, padding: 2, justifyContent: 'center', backgroundColor: value ? colors.primary : colors.borderStrong }}
    >
      <Animated.View
        style={[
          {
            width: 27,
            height: 27,
            borderRadius: 14,
            backgroundColor: colors.surface,
            alignSelf: 'flex-start',
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
              android: { elevation: 2 },
              default: { boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
            }),
          },
          thumb,
        ]}
      />
    </Pressable>
  );
}

// ─── Headers & text blocks ───────────────────────────────────────────────────
export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }, style]}>
      <Text variant="overline" color="textMuted" accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <PressableScale onPress={onAction} hitSlop={10} accessibilityLabel={action}>
          <Text variant="footnote" weight="semibold" color="primary">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'primary' | 'warning' | 'danger' | 'success' }) {
  const { colors } = useTheme();
  const bg = {
    muted: colors.surfaceMuted,
    accent: colors.accentSoft,
    primary: colors.primarySoft,
    warning: colors.warningSoft,
    danger: colors.dangerSoft,
    success: colors.successSoft,
  }[tone];
  const fg: keyof ColorTokens = (
    { muted: 'textMuted', accent: 'accent', primary: 'primary', warning: 'warning', danger: 'danger', success: 'success' } as const
  )[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 }}>
      <Text variant="caption" color={fg}>
        {label}
      </Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

export function Notice({ text, tone = 'muted', icon = AlertTriangle }: { text: string; tone?: 'muted' | 'warning' | 'accent'; icon?: LucideIcon }) {
  const { colors } = useTheme();
  const bg = { muted: colors.surfaceMuted, warning: colors.warningSoft, accent: colors.accentSoft }[tone];
  const fg: keyof ColorTokens = ({ muted: 'textMuted', warning: 'warning', accent: 'accent' } as const)[tone];
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, backgroundColor: bg, borderRadius: radius.md, padding: space.md, alignItems: 'flex-start' }}>
      <Icon icon={icon} size={18} color={fg} />
      <Text variant="footnote" color={tone === 'muted' ? 'textMuted' : fg} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ProgressRing = memo(function ProgressRing({
  progress,
  size = 64,
  stroke = 6,
  color = 'primary',
  track = 'surfaceMuted',
  children,
  accessibilityLabel,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: keyof ColorTokens;
  track?: keyof ColorTokens;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors, reducedMotion } = useTheme();
  const { t } = useI18n();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, progress));
  useEffect(() => {
    value.value = reducedMotion ? clamped : withTiming(clamped, { duration: duration.slow, easing: easing.emphasized });
  }, [clamped, reducedMotion, value]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - value.value) }));
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('a11y.progress', { value: Math.round(clamped * 100) })}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors[track]} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors[color]}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
});

export function ProgressBar({ progress, color = 'primary', height = 6 }: { progress: number; color?: keyof ColorTokens; height?: number }) {
  const { colors, reducedMotion } = useTheme();
  const { isRTL } = useI18n();
  const v = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, progress));
  useEffect(() => {
    v.value = reducedMotion ? clamped : withTiming(clamped, { duration: duration.base, easing: easing.standard });
  }, [clamped, reducedMotion, v]);
  const style = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: isRTL ? 'flex-end' : 'flex-start' }}
    >
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: colors[color] }, style]} />
    </View>
  );
}

export function Spinner({ color = 'primary', size = 20 }: { color?: keyof ColorTokens; size?: number }) {
  const { colors, reducedMotion } = useTheme();
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = reducedMotion ? 0 : withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [reducedMotion, rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 360}deg` }] }));
  return (
    <Animated.View style={style} accessibilityRole="progressbar" accessibilityLabel="loading">
      <EightPointStar size={size} color={colors[color]} />
    </Animated.View>
  );
}

// ─── Stepper & text field ────────────────────────────────────────────────────
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  label,
  testID,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  label: string;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }} accessibilityLabel={label} testID={testID}>
      <IconButton icon={Minus} label={`${t('a11y.decrease')} ${label}`} tone="filled" size={18} onPress={() => onChange(Math.max(min, value - step))} />
      <Text variant="numeric" align="center" style={{ minWidth: 56 }}>
        {format ? format(value) : String(value)}
      </Text>
      <IconButton icon={Plus} label={`${t('a11y.increase')} ${label}`} tone="filled" size={18} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

export function TextField({ label, error, style, ...rest }: TextInputProps & { label?: string; error?: string | null }) {
  const { colors, fontScale } = useTheme();
  const { isRTL, lang } = useI18n();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Text variant="footnote" color="textMuted">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label ?? rest.placeholder}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          {
            minHeight: 50,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : focused ? colors.primary : 'transparent',
            color: colors.text,
            fontFamily: lang === 'ar' ? 'IBMPlexSansArabic_400Regular' : 'IBMPlexSans_400Regular',
            fontSize: 16 * fontScale,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="footnote" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────
export function EmptyState({
  title,
  body,
  action,
  onAction,
  icon,
}: {
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.md }}>
      <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
        <EightPointStar size={72} color={colors.accent} />
        {icon ? (
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={icon} size={24} color="accent" />
            </View>
          </View>
        ) : null}
      </View>
      <Text variant="headline" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="subhead" color="textMuted" align="center" style={{ maxWidth: 420 }}>
          {body}
        </Text>
      ) : null}
      {action && onAction ? <Button label={action} onPress={onAction} variant="secondary" size="sm" /> : null}
    </View>
  );
}

export function ErrorState({ title, body, onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title ?? t('common.errorTitle')}
      body={body ?? t('common.errorBody')}
      action={onRetry ? t('common.retry') : undefined}
      onAction={onRetry}
    />
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const { colors, reducedMotion } = useTheme();
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.value = reducedMotion ? 0.7 : withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reducedMotion, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }, anim, style]} />;
}

/** Staggered entrance for cards and list items. Instant when reduced motion is on. */
export function FadeIn({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reducedMotion } = useTheme();
  if (reducedMotion) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      entering={FadeInDown.duration(duration.base)
        .delay(Math.min(index, 8) * STAGGER_MS)
        .easing(easing.emphasized)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ─── Bottom sheet ────────────────────────────────────────────────────────────
export function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}) {
  const { colors, reducedMotion } = useTheme();
  const { t, dir } = useI18n();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(1);
  useEffect(() => {
    if (visible) y.value = reducedMotion ? 0 : withTiming(0, { duration: duration.base, easing: easing.emphasized });
    else y.value = 1;
  }, [visible, reducedMotion, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 420 }] }));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', direction: dir }} testID={testID}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel={t('common.close')} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              backgroundColor: colors.bgElevated,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: space.gutter,
              paddingTop: space.md,
              paddingBottom: Math.max(insets.bottom, space.lg) + space.sm,
              maxHeight: '88%',
              width: '100%',
              maxWidth: 720,
              alignSelf: 'center',
            },
            anim,
          ]}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.md }} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
              <Text variant="title3" style={{ flex: 1 }} accessibilityRole="header">
                {title}
              </Text>
              <IconButton icon={X} label={t('common.close')} onPress={onClose} tone="filled" size={18} testID="sheet-close" />
            </View>
          ) : null}
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: space.sm }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
