import { useMemo } from 'react';

import type { SurahMeta } from '@/content/quran/types';
import { formatBytes, formatNumber, formatTime, localizeDigits } from '@/localization/format';
import { useI18n, useSettings, type TKey } from '@/runtime/AppProvider';
import { toHijri } from '@/services/hijri/hijri';
import type { SavedLocation } from '@/state/settings';
import { METHODS, type MethodId, type MethodParam } from '@/services/prayer/methods';

/** Formatting helpers bound to the current language and preferences. */
export function useFormat() {
  const i18n = useI18n();
  const [settings] = useSettings();
  const { t, lang } = i18n;
  const timeFormat = settings.prayer.timeFormat;
  const hijriOffset = settings.hijriOffset;
  return useMemo(
    () => ({
      time: (d: Date) => formatTime(d, lang, timeFormat),
      number: (n: number, digits = 2) => formatNumber(n, lang, digits),
      digits: (s: string | number) => localizeDigits(s, lang),
      bytes: (b: number) => formatBytes(b, lang),
      hijriMonth: (m: number) => t(`hijriMonths.m${m}` as TKey),
      hijri: (d: Date) => {
        const h = toHijri(d, hijriOffset);
        return t('dates.hijri', { day: h.day, month: t(`hijriMonths.m${h.month}` as TKey), year: h.year });
      },
      gregorian: (d: Date, withWeekday = true) => {
        const s = t('dates.gregorian', {
          weekday: withWeekday ? t(`weekdays.d${d.getDay()}` as TKey) : '',
          day: d.getDate(),
          month: t(`months.m${d.getMonth() + 1}` as TKey),
          year: d.getFullYear(),
        });
        return s.trim();
      },
      surahName: (s: SurahMeta) => (lang === 'ar' ? `سورة ${s.nameArabic}` : s.nameTransliterated),
      surahShort: (s: SurahMeta) => (lang === 'ar' ? s.nameArabic : s.nameTransliterated),
      methodName: (id: MethodId) => t(`methods.${id}` as TKey),
      methodAngles: (id: MethodId) => {
        const p = (m: MethodParam) =>
          m.kind === 'angle'
            ? `${localizeDigits(m.value, lang)}°`
            : m.kind === 'minutes'
              ? t('common.minutesShort', { count: m.value })
              : t('methods.seasonal');
        return t('methods.angles', { fajr: p(METHODS[id].fajr), isha: p(METHODS[id].isha) });
      },
      placeName: (loc: SavedLocation | null) => (!loc ? '' : lang === 'ar' && loc.nameAr ? loc.nameAr : loc.name),
    }),
    [lang, t, timeFormat, hijriOffset],
  );
}
