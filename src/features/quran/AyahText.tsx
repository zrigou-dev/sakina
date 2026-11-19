import { memo } from 'react';
import { Text as RNText, type TextStyle } from 'react-native';

import { fontFamilies } from '@/design-system/tokens';
import { localizeDigits } from '@/localization/format';
import { useTheme } from '@/runtime/AppProvider';

/**
 * Renders verified Quran text in Amiri Quran. The text itself is never altered; the
 * end-of-ayah marker (U+06DD + Arabic-Indic number) is a separate, presentational span.
 * Always RTL, independent of the interface language.
 */
export const AyahText = memo(function AyahText({
  text,
  ayah,
  size,
  color,
  align = 'right',
  highlight,
  selectable,
  numberOfLines,
}: {
  text: string;
  ayah?: number;
  size: number;
  color?: string;
  align?: 'right' | 'center' | 'justify';
  highlight?: boolean;
  selectable?: boolean;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const style: TextStyle = {
    fontFamily: fontFamilies.quran,
    fontSize: size,
    lineHeight: Math.round(size * 2.05),
    color: color ?? colors.pageInk,
    textAlign: align,
    writingDirection: 'rtl',
    backgroundColor: highlight ? colors.accentSoft : undefined,
  };
  return (
    <RNText style={style} selectable={selectable} numberOfLines={numberOfLines} allowFontScaling={false}>
      {text}
      {ayah ? <RNText style={{ color: colors.ayahMarker }}>{` ۝${localizeDigits(ayah, 'ar')}`}</RNText> : null}
    </RNText>
  );
});
