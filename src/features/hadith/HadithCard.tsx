import Bookmark from 'lucide-react-native/icons/bookmark';
import BookmarkCheck from 'lucide-react-native/icons/bookmark-check';
import Share2 from 'lucide-react-native/icons/share-2';
import { memo } from 'react';
import { Share, View } from 'react-native';

import type { HadithRow } from '@/database/repositories/content';
import { Badge, Card, IconButton } from '@/design-system/components';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, type TKey } from '@/runtime/AppProvider';

export const SAHIH_BOOKS = new Set(['bukhari', 'muslim']);

export function hadithBookName(t: (k: TKey) => string, book: string): string {
  return t(`hadith.books.${book}` as TKey);
}

function gradeTone(grade: string): 'success' | 'warning' | 'danger' | 'muted' {
  const g = grade.toLowerCase();
  if (/sahih|صحيح/.test(g)) return 'success';
  if (/hasan|حسن/.test(g)) return 'success';
  if (/da.?if|ضعيف|maudu|mawdu|موضوع|munkar|منكر/.test(g)) return 'danger';
  return 'muted';
}

/** Arabic text, translation for the UI language, reference, and gradings exactly as published. */
export const HadithCard = memo(function HadithCard({
  h,
  bookmarked,
  onBookmark,
  compact,
  actions = true,
  testID,
}: {
  h: HadithRow;
  bookmarked?: boolean;
  onBookmark?: () => void;
  compact?: boolean;
  /** Hide share/bookmark (e.g. when the whole card is itself a link). */
  actions?: boolean;
  testID?: string;
}) {
  const { t, lang } = useI18n();
  const fmt = useFormat();
  const translation = lang === 'fr' ? (h.textFr ?? h.textEn) : lang === 'en' ? (h.textEn ?? h.textFr) : null;
  const ref = `${hadithBookName(t, h.book)} · ${t('hadith.hadithN', { n: fmt.digits(h.number) })}`;
  return (
    <Card testID={testID ?? `hadith-${h.book}-${h.number}`} style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Text variant="caption" color="accent" weight="semibold" style={{ flex: 1 }}>
          {ref}
        </Text>
        {actions ? (
          <IconButton
            icon={Share2}
            label={t('share.share')}
            size={18}
            color="textMuted"
            onPress={() =>
              Share.share({ message: `${h.textAr}\n\n${translation ? `${translation}\n\n` : ''}— ${ref}\n${t('share.via')}` }).catch(() => undefined)
            }
          />
        ) : null}
        {actions && onBookmark ? (
          <IconButton
            icon={bookmarked ? BookmarkCheck : Bookmark}
            label={t('quran.bookmark')}
            size={18}
            color={bookmarked ? 'accent' : 'textMuted'}
            onPress={onBookmark}
            selected={bookmarked}
            testID={`hadith-bookmark-${h.book}-${h.number}`}
          />
        ) : null}
      </View>
      <Text
        script="arabic"
        variant="body"
        selectable
        numberOfLines={compact ? 6 : undefined}
        style={{ fontFamily: 'Amiri_400Regular', fontSize: 20, lineHeight: 38 }}
      >
        {h.textAr}
      </Text>
      {translation ? (
        <Text script="latin" variant="subhead" color="textMuted" selectable numberOfLines={compact ? 5 : undefined}>
          {translation}
        </Text>
      ) : null}
      {!compact && (h.grades.length || SAHIH_BOOKS.has(h.book)) ? (
        <View style={{ gap: space.xs }}>
          <Text variant="overline" color="textMuted">
            {t('hadith.grades')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {h.grades.length ? (
              h.grades.map((g) => (
                <Badge key={`${g.name}-${g.grade}`} label={t('hadith.gradeBy', { grade: g.grade, name: g.name })} tone={gradeTone(g.grade)} />
              ))
            ) : (
              <Badge label={t('hadith.sahihCollection')} tone="success" />
            )}
          </View>
        </View>
      ) : null}
    </Card>
  );
});
