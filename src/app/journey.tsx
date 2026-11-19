import NotebookPen from 'lucide-react-native/icons/notebook-pen';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash';
import { useState } from 'react';
import { View } from 'react-native';

import { logsRepo, notesRepo, readingRepo, type Note } from '@/database/repositories/user';
import { Button, Card, EmptyState, FadeIn, IconButton, SectionHeader, Sheet, Stepper, Switch, TextField } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useSettings, useTheme, type TKey } from '@/runtime/AppProvider';
import { addDays, toISODate } from '@/utils/date';

export default function Journey() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [settings, update] = useSettings();
  const dbs = useDbs();
  const fmt = useFormat();
  const [editing, setEditing] = useState<Partial<Note> | null>(null);
  const today = new Date();
  const week = useLoader(async () => {
    const [reading, prayers, fasts, notes] = await Promise.all([
      readingRepo.history(dbs.user, 7),
      logsRepo.prayerHistory(dbs.user, addDays(today, -6)),
      logsRepo.fastsBetween(dbs.user, addDays(today, -6), today),
      notesRepo.list(dbs.user),
    ]);
    return { reading, prayers, fasts, notes };
  }, [dbs]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const readMap = new Map((week.data?.reading ?? []).map((r) => [r.date, r.ayahs]));
  const max = Math.max(1, settings.goals.quranAyahs, ...readMap.values());
  const g = settings.goals;

  return (
    <Screen back title={t('journey.title')} subtitle={t('journey.intro')} large testID="journey-screen">
      <FadeIn index={0}>
        <SectionHeader title={t('journey.goals')} style={{ marginTop: 0 }} />
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="callout" style={{ flex: 1 }}>
              {t('journey.goalQuran', { count: g.quranAyahs })}
            </Text>
            <Stepper
              label={t('journey.goalQuran', { count: g.quranAyahs })}
              value={g.quranAyahs}
              min={0}
              max={300}
              step={5}
              onChange={(v) => update({ goals: { quranAyahs: v } })}
              format={(v) => fmt.digits(v)}
              testID="goal-quran-stepper"
            />
          </View>
          {(
            [
              ['morning', 'journey.goalMorning'],
              ['evening', 'journey.goalEvening'],
              ['prayers', 'journey.goalPrayers'],
            ] as ['morning' | 'evening' | 'prayers', TKey][]
          ).map(([k, label]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="callout">{t(label)}</Text>
              <Switch value={g[k]} onValueChange={(v) => update({ goals: { [k]: v } })} label={t(label)} />
            </View>
          ))}
          <Text variant="footnote" color="accent">
            {t('journey.encouragement')}
          </Text>
        </Card>
      </FadeIn>

      <FadeIn index={1}>
        <SectionHeader title={t('journey.week')} />
        <Card>
          <Text variant="footnote" color="textMuted">
            {t('journey.ayahsRead')}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: 120, marginTop: space.md }}
            accessibilityLabel={t('journey.ayahsRead')}
          >
            {days.map((d) => {
              const v = readMap.get(toISODate(d)) ?? 0;
              return (
                <View key={d.toISOString()} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Text variant="caption" color="textMuted" fixedSize>
                    {v ? fmt.digits(v) : ''}
                  </Text>
                  <View
                    style={{
                      width: '70%',
                      height: Math.max(4, (v / max) * 84),
                      borderRadius: radius.sm,
                      backgroundColor: v >= g.quranAyahs && g.quranAyahs > 0 ? colors.accent : v ? colors.primary : colors.surfaceMuted,
                    }}
                  />
                  <Text variant="caption" color="textFaint" fixedSize>
                    {t(`weekdaysShort.d${d.getDay()}` as TKey)}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', marginTop: space.lg, gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="title3">{fmt.digits((week.data?.prayers ?? []).reduce((s, p) => s + p.done, 0))}</Text>
              <Text variant="footnote" color="textMuted">
                {t('journey.prayersLogged')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title3">{fmt.digits(week.data?.fasts.length ?? 0)}</Text>
              <Text variant="footnote" color="textMuted">
                {t('journey.fasts')}
              </Text>
            </View>
          </View>
        </Card>
      </FadeIn>

      <FadeIn index={2}>
        <SectionHeader title={t('journey.reflections')} action={t('journey.newReflection')} onAction={() => setEditing({ title: '', body: '' })} />
        {week.data?.notes.length ? (
          <View style={{ gap: space.sm }}>
            {week.data.notes.map((n) => (
              <Card key={n.id} onPress={() => setEditing(n)} testID={`note-${n.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
                    {n.title || n.body.slice(0, 40)}
                  </Text>
                  <IconButton
                    icon={Trash2}
                    label={t('common.delete')}
                    size={18}
                    color="textMuted"
                    onPress={async () => {
                      await notesRepo.remove(dbs.user, n.id);
                      bumpDataVersion();
                    }}
                  />
                </View>
                <Text variant="subhead" color="textMuted" numberOfLines={3}>
                  {n.body}
                </Text>
                <Text variant="caption" color="textFaint" style={{ marginTop: space.xs }}>
                  {fmt.gregorian(new Date(n.updatedAt), false)}
                </Text>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={NotebookPen}
            title={t('journey.noReflections')}
            action={t('journey.newReflection')}
            onAction={() => setEditing({ title: '', body: '' })}
          />
        )}
      </FadeIn>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={t('journey.reflections')}>
        {editing ? (
          <View style={{ gap: space.md }}>
            <TextField
              placeholder={t('journey.titlePlaceholder')}
              value={editing.title ?? ''}
              onChangeText={(v) => setEditing({ ...editing, title: v })}
              testID="note-title"
            />
            <TextField
              placeholder={t('journey.bodyPlaceholder')}
              value={editing.body ?? ''}
              onChangeText={(v) => setEditing({ ...editing, body: v })}
              multiline
              style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: space.md }}
              testID="note-body"
            />
            <Button
              label={t('common.save')}
              icon={Plus}
              disabled={!editing.body?.trim() && !editing.title?.trim()}
              testID="note-save"
              onPress={async () => {
                await notesRepo.save(dbs.user, { id: editing.id, title: editing.title?.trim() ?? '', body: editing.body?.trim() ?? '' });
                bumpDataVersion();
                setEditing(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
