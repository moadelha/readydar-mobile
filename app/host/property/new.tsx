import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, City, PropertyType } from '@/lib/api';
import { Screen, TextField, Chip } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useLargeTitle } from '@/lib/large-title';
import { useLanguage } from '@/lib/i18n/language-context';
import { useSetupStrings } from '@/lib/i18n/setup-strings';
import { currencyForCountry, defaultCountry, phoneTimezone } from '@/lib/where';

const TYPES: PropertyType[] = ['APARTMENT', 'VILLA', 'RIAD', 'STUDIO', 'HOUSE', 'OTHER'];
/** A city's name in the app's language. */
function cityLabel(c: City, lang: string) {
  return (lang === 'AR' ? c.nameAr : lang === 'FR' ? c.nameFr : null) || c.name;
}

/**
 * Name, city and address are all it takes to start; the rest is folded away
 * and editable later. Any city works — the known ones are only suggestions
 * (the API adds a new one by name).
 */
export default function AddPropertyScreen() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const s = useSetupStrings().addProperty;
  const [country] = useState(defaultCountry);
  const [cities, setCities] = useState<City[]>([]);
  const [type, setType] = useState<PropertyType>('APARTMENT');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [maxGuests, setMaxGuests] = useState('2');
  const [currency, setCurrency] = useState(() => currencyForCountry(country));
  const [nightlyRate, setNightlyRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Suggestions only: the form works without them.
    api.cities.list().then(setCities).catch(() => {});
  }, []);

  const typed = city.trim().toLowerCase();
  const known = cities.find((c) => [c.name, c.nameFr, c.nameAr].some((n) => n?.trim().toLowerCase() === typed));
  const suggestions = known
    ? []
    : cities.filter((c) => !typed || [c.name, c.nameFr, c.nameAr].some((n) => n?.trim().toLowerCase().startsWith(typed))).slice(0, 6);

  async function handleSubmit() {
    if (!session) return;
    setError(null);
    if (!name.trim() || !addressLine.trim() || !city.trim()) {
      setError(s.required);
      return;
    }
    setIsSubmitting(true);
    try {
      const rate = Number(nightlyRate.replace(',', '.'));
      const created = await api.properties.create(
        {
          type,
          name: name.trim(),
          ...(known ? { cityId: known.id } : { cityName: city.trim() }),
          addressLine: addressLine.trim(),
          bedrooms: Math.max(0, Math.round(Number(bedrooms)) || 0),
          bathrooms: Math.max(0, Math.round(Number(bathrooms)) || 0),
          maxGuests: Math.max(1, Math.round(Number(maxGuests)) || 1),
          nightlyRate: rate > 0 ? rate : undefined,
          currency,
          country,
          timezone: phoneTimezone(),
        },
        session.accessToken,
      );
      // Straight to the new property, where its check-in links are made.
      router.replace(`/host/property/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.title), headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" {...largeTitle.scrollProps}>
        <Text style={typography.h1}>{s.title}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>{s.intro}</Text>

        <TextField label={s.name} value={name} onChangeText={setName} placeholder={s.namePlaceholder} autoCapitalize="words" />
        <TextField label={s.city} value={city} onChangeText={setCity} placeholder={s.cityPlaceholder} autoCapitalize="words" maxLength={80} />
        {suggestions.length > 0 && (
          <View style={[styles.chipRow, styles.suggestions]}>
            {suggestions.map((c) => (
              <Chip key={c.id} label={cityLabel(c, lang)} active={false} onPress={() => setCity(cityLabel(c, lang))} />
            ))}
          </View>
        )}
        <TextField label={s.address} value={addressLine} onChangeText={setAddressLine} placeholder={s.addressPlaceholder} autoCapitalize="sentences" />

        <Pressable
          onPress={() => setShowMore((v) => !v)}
          style={styles.moreRow}
          accessibilityRole="button"
          accessibilityState={{ expanded: showMore }}
        >
          <Text style={styles.moreText}>{s.more}</Text>
          <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkMuted} />
        </Pressable>

        {showMore && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>{s.type}</Text>
            <View style={styles.chipRow}>
              {TYPES.map((key) => (
                <Chip key={key} label={s.types[key]} active={type === key} onPress={() => setType(key)} />
              ))}
            </View>
            <View style={[styles.row, { marginTop: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <TextField label={s.bedrooms} value={bedrooms} onChangeText={setBedrooms} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={s.bathrooms} value={bathrooms} onChangeText={setBathrooms} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={s.maxGuests} value={maxGuests} onChangeText={setMaxGuests} keyboardType="number-pad" />
              </View>
            </View>
            <Text style={styles.label}>{s.currency}</Text>
            <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
              {[...new Set([currencyForCountry(country), 'MAD', 'EUR', 'USD', 'GBP'])].map((c) => (
                <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </View>
            <TextField label={s.rate(currency)} value={nightlyRate} onChangeText={setNightlyRate} keyboardType="decimal-pad" placeholder={s.ratePlaceholder} />
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button label={isSubmitting ? s.submitting : s.submit} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.ink, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestions: { marginTop: -spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  moreText: { fontSize: 15, fontWeight: '500', color: colors.ink },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
