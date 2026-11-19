import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, SegmentedControl, Sheet, TextField } from '@/design-system/components';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n } from '@/runtime/AppProvider';
import { getSurah, hizbStart, isValidVerse, pageStart } from '@/services/quran/navigation';
import { parseAmount } from '@/utils/number';

type Mode = 'page' | 'hizb' | 'ayah';

/** Jump to a mushaf page (1–604), a hizb (1–60) or a surah:ayah, using Tanzil boundaries. */
export function JumpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [mode, setMode] = useState<Mode>('page');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    const n1 = parseAmount(a);
    const n2 = parseAmount(b);
    let target: { surah: number; ayah: number } | null = null;
    if (mode === 'page' && n1 && Number.isInteger(n1) && n1 >= 1 && n1 <= 604) target = pageStart(n1);
    if (mode === 'hizb' && n1 && Number.isInteger(n1) && n1 >= 1 && n1 <= 60) target = hizbStart(n1);
    if (mode === 'ayah' && n1 && n2 && isValidVerse({ surah: n1, ayah: n2 })) target = { surah: n1, ayah: n2 };
    if (!target) {
      setError(t('zakat.invalid'));
      return;
    }
    setError(null);
    onClose();
    router.push(`/quran/${target.surah}?ayah=${target.ayah}`);
  };

  const preview = (() => {
    const n1 = parseAmount(a);
    try {
      if (mode === 'page' && n1) return pageStart(n1);
      if (mode === 'hizb' && n1) return hizbStart(n1);
    } catch {
      return null;
    }
    return null;
  })();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('quran.jumpTo')} testID="jump-sheet">
      <View style={{ gap: space.md }}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setA('');
            setB('');
            setError(null);
          }}
          options={[
            { value: 'page', label: t('quran.pageN', { n: '' }).trim() },
            { value: 'hizb', label: t('quran.hizbN', { n: '' }).trim() },
            { value: 'ayah', label: t('quran.goToAyah') },
          ]}
        />
        {mode === 'ayah' ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('quran.surahN', { n: '' }).trim()}
                value={a}
                onChangeText={setA}
                inputMode="numeric"
                keyboardType="number-pad"
                placeholder="1–114"
                testID="jump-a"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={t('quran.goToAyah')} value={b} onChangeText={setB} inputMode="numeric" keyboardType="number-pad" testID="jump-b" />
            </View>
          </View>
        ) : (
          <TextField
            label={mode === 'page' ? t('quran.pageN', { n: '1–604' }) : t('quran.hizbN', { n: '1–60' })}
            value={a}
            onChangeText={setA}
            inputMode="numeric"
            keyboardType="number-pad"
            testID="jump-a"
          />
        )}
        {preview ? (
          <Text variant="footnote" color="textMuted">
            → {fmt.surahName(getSurah(preview.surah))} · {fmt.digits(preview.surah)}:{fmt.digits(preview.ayah)}
          </Text>
        ) : null}
        {error ? (
          <Text variant="footnote" color="danger">
            {error}
          </Text>
        ) : null}
        <Button label={t('common.open')} onPress={go} testID="jump-go" />
      </View>
    </Sheet>
  );
}
