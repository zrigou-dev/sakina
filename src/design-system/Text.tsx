import { memo } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useI18n, useTheme } from '@/runtime/AppProvider';

import { arabicAdjust, fontFamilies, typeScale, type ColorTokens, type RoleSpec, type TextRole } from './tokens';

export type Script = 'auto' | 'arabic' | 'latin';

export interface TextProps extends RNTextProps {
  readonly variant?: TextRole;
  readonly color?: keyof ColorTokens;
  /** Force a script's typography (e.g. an Arabic surah name inside an English screen). */
  readonly script?: Script;
  readonly align?: 'start' | 'center' | 'end';
  readonly weight?: RoleSpec['weight'];
  /** Disable user font scaling (only for decorative glyphs). */
  readonly fixedSize?: boolean;
}

const ARABIC_FONT: Record<RoleSpec['weight'], string> = {
  regular: fontFamilies.arabicBody,
  medium: fontFamilies.arabicMedium,
  semibold: fontFamilies.arabicSemiBold,
  bold: fontFamilies.arabicBold,
};
const LATIN_FONT: Record<RoleSpec['weight'], string> = {
  regular: fontFamilies.latinBody,
  medium: fontFamilies.latinMedium,
  semibold: fontFamilies.latinSemiBold,
  bold: fontFamilies.latinBold,
};

export function resolveTextStyle(role: TextRole, arabic: boolean, fontScale: number, weightOverride?: RoleSpec['weight']): TextStyle {
  const base = typeScale[role];
  const spec = arabic ? arabicAdjust(base) : base;
  const weight = weightOverride ?? spec.weight;
  const fontFamily = spec.display ? (arabic ? fontFamilies.arabicDisplay : fontFamilies.latinDisplay) : arabic ? ARABIC_FONT[weight] : LATIN_FONT[weight];
  return {
    fontFamily,
    fontSize: Math.round(spec.size * fontScale),
    lineHeight: Math.round(spec.lineHeight * fontScale),
    letterSpacing: spec.letterSpacing,
    textTransform: spec.uppercase ? 'uppercase' : 'none',
    fontVariant: spec.tabular ? ['tabular-nums'] : undefined,
  };
}

/** Direction-aware, role-based text. Never use RN <Text> directly in screens. */
export const Text = memo(function Text({ variant = 'body', color = 'text', script = 'auto', align = 'start', weight, fixedSize, style, ...rest }: TextProps) {
  const { colors, fontScale } = useTheme();
  const { isRTL, lang } = useI18n();
  const arabic = script === 'arabic' || (script === 'auto' && lang === 'ar');
  const rtlText = script === 'arabic' ? true : script === 'latin' ? false : isRTL;
  const textAlign: TextStyle['textAlign'] = align === 'center' ? 'center' : (align === 'start') === rtlText ? 'right' : 'left';
  return (
    <RNText
      allowFontScaling={!fixedSize}
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        resolveTextStyle(variant, arabic, fixedSize ? 1 : fontScale, weight),
        { color: colors[color], textAlign, writingDirection: rtlText ? 'rtl' : 'ltr' },
        style,
      ]}
    />
  );
});
