import MapPin from 'lucide-react-native/icons/map-pin';
import Search from 'lucide-react-native/icons/search';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card, ListRow, TextField, Button } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useI18n } from '@/runtime/AppProvider';
import { searchCities, type City } from '@/services/location/cities';
import { isValidCoordinate } from '@/services/prayer/times';
import type { SavedLocation } from '@/state/settings';

export function cityToLocation(c: City): SavedLocation {
  return { source: 'city', latitude: c.lat, longitude: c.lng, name: c.name, nameAr: c.nameAr, country: c.country, timezone: c.tz };
}

/** Offline city search over the bundled GeoNames list, plus manual coordinates. */
export function CityPicker({ onSelect }: { onSelect: (loc: SavedLocation) => void }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const results = useMemo(() => searchCities(query, 30), [query]);

  if (manual) {
    return (
      <View style={{ gap: space.md }}>
        <Text variant="headline">{t('city.manualTitle')}</Text>
        <TextField label={t('city.manualName')} value={name} onChangeText={setName} testID="manual-name" />
        <TextField
          label={t('city.latitude')}
          value={lat}
          onChangeText={setLat}
          keyboardType="numbers-and-punctuation"
          inputMode="decimal"
          testID="manual-lat"
        />
        <TextField
          label={t('city.longitude')}
          value={lng}
          onChangeText={setLng}
          keyboardType="numbers-and-punctuation"
          inputMode="decimal"
          testID="manual-lng"
          error={error}
        />
        <Button
          label={t('common.save')}
          testID="manual-save"
          onPress={() => {
            const la = Number(lat.replace(',', '.'));
            const lo = Number(lng.replace(',', '.'));
            if (!lat.trim() || !lng.trim() || !isValidCoordinate(la, lo)) {
              setError(t('city.invalid'));
              return;
            }
            onSelect({
              source: 'manual',
              latitude: la,
              longitude: lo,
              name: name.trim() || `${la.toFixed(2)}, ${lo.toFixed(2)}`,
              nameAr: null,
              country: null,
              timezone: null,
            });
          }}
        />
        <Button label={t('common.back')} variant="ghost" onPress={() => setManual(false)} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <View>
        <TextField placeholder={t('city.placeholder')} value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" testID="city-search" />
        <View pointerEvents="none" style={{ position: 'absolute', end: space.md, top: 14 }}>
          <Icon icon={Search} size={20} color="textFaint" />
        </View>
      </View>
      {query.trim().length < 2 ? (
        <Text variant="footnote" color="textMuted">
          {t('city.hint')}
        </Text>
      ) : results.length === 0 ? (
        <Text variant="footnote" color="textMuted">
          {t('city.empty', { query: query.trim() })}
        </Text>
      ) : (
        <Card padded={false}>
          {results.map((c, i) => {
            const title = lang === 'ar' && c.nameAr ? c.nameAr : c.name;
            const country = lang === 'ar' && c.countryNameAr ? c.countryNameAr : c.countryName;
            return (
              <ListRow
                key={c.id}
                icon={MapPin}
                iconTone="muted"
                title={title}
                subtitle={country}
                onPress={() => onSelect(cityToLocation(c))}
                testID={`city-result-${c.id}`}
                chevron={false}
                last={i === results.length - 1}
              />
            );
          })}
        </Card>
      )}
      <Button label={t('city.manualTitle')} variant="ghost" size="sm" onPress={() => setManual(true)} testID="city-manual" />
      <Text variant="caption" color="textFaint">
        {t('city.attribution')}
      </Text>
    </View>
  );
}
