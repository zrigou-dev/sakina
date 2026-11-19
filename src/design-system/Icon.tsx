import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useI18n, useTheme } from '@/runtime/AppProvider';

import type { ColorTokens } from './tokens';

export interface IconProps {
  readonly icon: LucideIcon;
  readonly size?: number;
  readonly color?: keyof ColorTokens;
  /** Mirror in RTL (chevrons, arrows, "back"). */
  readonly directional?: boolean;
  readonly strokeWidth?: number;
}

export function Icon({ icon: IconComponent, size = 22, color = 'text', directional, strokeWidth = 1.75 }: IconProps) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();
  return (
    <View
      style={directional && isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <IconComponent size={size} color={colors[color]} strokeWidth={strokeWidth} />
    </View>
  );
}
