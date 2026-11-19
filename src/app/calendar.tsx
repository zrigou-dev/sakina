import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Sparkles from 'lucide-react-native/icons/sparkles';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { logsRepo, type FastingKind } from '@/database/repositories/user';
import { Badge, Card, Chip, IconButton, Notice, SectionHeader, Sheet, Stepper } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useSettings, useTheme, type TKey } from '@/runtime/AppProvider';
import { addHijriMonths, hijriMonthGrid, isSupportedHijriYear, toHijri } from '@/services/hijri/hijri';
import { dayTags, upcomingOccasions } from '@/services/hijri/occasions';
import { isSameDay, toISODate } from '@/utils/date';

const KINDS: FastingKind[] = ['ramadan', 'voluntary', 'makeup', 'missed'];

export default function CalendarScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [settings, update] = useSettings();
  const dbs = useDbs();
  const fmt = useFormat();
  const today = new Date();
  const todayH = toHijri(today, settings.hijriOffset);
  const [month, setMonth] = useState({ year: todayH.year, month: todayH.month });
  const [selected, setSelected] = useState<Date | null>(null);
  const grid = useMemo(() => hijriMonthGrid(month.year, month.month, settings.hijriOffset), [month, settings.hijriOffset]);
  const first = grid.days[0]!.gregorian;
  const last = grid.days[grid.days.length - 1]!.gregorian;
  const fasts = useLoader(() => logsRepo.fastsBetween(dbs.user, first, last), [dbs, first.getTime(), last.getTime()]);
  const fastMap = useMemo(() => new Map((fasts.data ?? []).map((f) => [f.date, f.kind])), [fasts.data]);
  const summary = useLoader(() => logsRepo.fastingSummary(dbs.user), [dbs]);
  const occasions = upcomingOccasions(today, settings.hijriOffset, 365);

  const cells: ({ hijriDay: number; gregorian: Date } | null)[] = [...Array.from({ length: grid.firstWeekday }, () => null), ...grid.days];
  while (cells.length % 7) cells.push(null);

  const go = (n: number) => {
    const next = addHijriMonths(month, n);
    if (isSupportedHijriYear(next.year)) setMonth(next);
  };

  return (
    <Screen back title={t('calendar.title')} large subtitle={`${fmt.hijri(today)} · ${fmt.gregorian(today, false)}`} testID="calendar-screen">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <IconButton icon={ChevronLeft} label={t('calendar.previousMonth')} onPress={() => go(-1)} directional testID="cal-prev" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="title3" align="center" testID="cal-month">
              {fmt.hijriMonth(month.month)} {fmt.digits(month.year)}
            </Text>
            <Text variant="caption" color="textMuted" align="center">
              {t(`months.m${first.getMonth() + 1}` as TKey)} – {t(`months.m${last.getMonth() + 1}` as TKey)} {fmt.digits(last.getFullYear())}
            </Text>
          </View>
          <IconButton icon={ChevronRight} label={t('calendar.nextMonth')} onPress={() => go(1)} directional testID="cal-next" />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, d) => (
            <Text key={d} variant="caption" color="textMuted" align="center" style={{ flex: 1 }}>
              {t(`weekdaysShort.d${d}` as TKey)}
            </Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {cells.slice(row * 7, row * 7 + 7).map((c, i) => {
              if (!c) return <View key={i} style={{ flex: 1, aspectRatio: 0.85 }} />;
              const tags = dayTags(c.gregorian, settings.hijriOffset);
              const isToday = isSameDay(c.gregorian, today);
              const fast = fastMap.get(toISODate(c.gregorian));
              const occasion = tags.find((x) => x !== 'white_day' && x !== 'monday' && x !== 'thursday');
              return (
                <PressableScale
                  key={i}
                  onPress={() => setSelected(c.gregorian)}
                  testID={`cal-day-${c.hijriDay}`}
                  accessibilityLabel={`${c.hijriDay} ${fmt.hijriMonth(month.month)}, ${fmt.gregorian(c.gregorian)}${occasion ? `, ${t(`occasions.${occasion}` as TKey)}` : ''}${fast ? `, ${t(`calendar.fastKinds.${fast}` as TKey)}` : ''}`}
                  style={{
                    flex: 1,
                    aspectRatio: 0.85,
                    margin: 2,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isToday ? colors.primary : occasion ? colors.accentSoft : 'transparent',
                    borderWidth: tags.includes('white_day') ? 1 : 0,
                    borderColor: colors.borderStrong,
                  }}
                >
                  <Text variant="callout" weight={isToday ? 'bold' : 'medium'} align="center" color={isToday ? 'primaryInk' : 'text'} fixedSize>
                    {fmt.digits(c.hijriDay)}
                  </Text>
                  <Text variant="caption" align="center" color={isToday ? 'primaryInk' : 'textFaint'} fixedSize style={{ fontSize: 10, lineHeight: 12 }}>
                    {fmt.digits(c.gregorian.getDate())}
                  </Text>
                  {fast ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: fast === 'missed' ? colors.warning : colors.success,
                      }}
                    />
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        ))}
      </Card>
      <View style={{ marginTop: space.md, gap: space.sm }}>
        <Notice text={t('calendar.sightingNote')} />
        <Text variant="footnote" color="textMuted">
          {t('calendar.fastingHint')}
        </Text>
      </View>

      <SectionHeader title={t('calendar.occasions')} />
      <Card padded={false}>
        {occasions.map((o, i) => (
          <View
            key={`${o.id}-${o.hijri.year}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              padding: space.lg,
              borderBottomWidth: i < occasions.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <Icon icon={Sparkles} size={18} color={o.major ? 'accent' : 'textMuted'} />
            <View style={{ flex: 1 }}>
              <Text variant="callout">{t(`occasions.${o.id}` as TKey)}</Text>
              <Text variant="footnote" color="textMuted">
                {fmt.digits(o.hijri.day)} {fmt.hijriMonth(o.hijri.month)} · {fmt.gregorian(o.start)}
              </Text>
            </View>
            <Badge label={t('home.daysUntil', { count: o.daysUntil })} tone={o.daysUntil <= 7 ? 'accent' : 'muted'} />
          </View>
        ))}
      </Card>

      <SectionHeader title={t('calendar.hijriAdjust')} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="callout">{t('calendar.adjustDays', { count: settings.hijriOffset })}</Text>
          <Stepper
            label={t('calendar.hijriAdjust')}
            value={settings.hijriOffset}
            min={-2}
            max={2}
            onChange={(v) => update({ hijriOffset: v })}
            format={(v) => fmt.digits(v > 0 ? `+${v}` : v)}
            testID="hijri-offset"
          />
        </View>
        <Text variant="footnote" color="textMuted" style={{ marginTop: space.sm }}>
          {t('calendar.hijriAdjustHelp')}
        </Text>
      </Card>

      <SectionHeader title={`${t('calendar.fasting')} · ${t('calendar.summary')}`} />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {KINDS.map((k) => (
            <View key={k} style={{ minWidth: '40%', flexGrow: 1 }}>
              <Text variant="title3">{fmt.digits(summary.data?.[k] ?? 0)}</Text>
              <Text variant="footnote" color="textMuted">
                {t(`calendar.fastKinds.${k}` as TKey)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected ? `${fmt.hijri(selected)}` : ''} testID="day-sheet">
        {selected ? (
          <View style={{ gap: space.md }}>
            <Text variant="subhead" color="textMuted">
              {fmt.gregorian(selected)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {dayTags(selected, settings.hijriOffset).map((tag) => (
                <Badge
                  key={tag}
                  tone="accent"
                  label={
                    tag === 'white_day'
                      ? t('calendar.whiteDays')
                      : tag === 'monday'
                        ? t('calendar.monday')
                        : tag === 'thursday'
                          ? t('calendar.thursday')
                          : t(`occasions.${tag}` as TKey)
                  }
                />
              ))}
            </View>
            <Text variant="headline">{t('calendar.fasting')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {KINDS.map((k) => (
                <Chip
                  key={k}
                  label={t(`calendar.fastKinds.${k}` as TKey)}
                  selected={fastMap.get(toISODate(selected)) === k}
                  testID={`fast-${k}`}
                  onPress={async () => {
                    await logsRepo.setFast(dbs.user, selected, k);
                    bumpDataVersion();
                    setSelected(null);
                  }}
                />
              ))}
              <Chip
                label={t('calendar.clearFast')}
                onPress={async () => {
                  await logsRepo.setFast(dbs.user, selected, null);
                  bumpDataVersion();
                  setSelected(null);
                }}
              />
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
