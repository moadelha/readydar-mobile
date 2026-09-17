import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, City, PropertyType } from '@/lib/api';
import { Screen, TextField, Chip } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'RIAD', label: 'Riad' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'HOUSE', label: 'House' },
  { value: 'OTHER', label: 'Other' },
];

export default function AddPropertyScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [type, setType] = useState<PropertyType>('APARTMENT');
  const [name, setName] = useState('');
  const [cityId, setCityId] = useState<string | null>(null);
  const [addressLine, setAddressLine] = useState('');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [maxGuests, setMaxGuests] = useState('2');
  const [nightlyRate, setNightlyRate] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [wifiInfo, setWifiInfo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.cities.list().then((list) => {
      setCities(list);
      if (list[0]) setCityId(list[0].id);
    });
  }, []);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!name.trim() || !addressLine.trim() || !cityId) {
      setError('Name, city, and address are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.properties.create(
        {
          type,
          name: name.trim(),
          cityId,
          addressLine: addressLine.trim(),
          bedrooms: Number(bedrooms) || 0,
          bathrooms: Number(bathrooms) || 0,
          maxGuests: Number(maxGuests) || 1,
          nightlyRate: nightlyRate ? Number(nightlyRate) : undefined,
          accessInstructions: accessInstructions || undefined,
          wifiInfo: wifiInfo || undefined,
        },
        session.accessToken,
      );
      router.replace('/(host-tabs)/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this property.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Add property', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={typography.h1}>Add a property</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          You can fine-tune automation, guest welcome messages, and iCal sync later from the web dashboard.
        </Text>

        <Text style={styles.sectionLabel}>Property type</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} active={type === opt.value} onPress={() => setType(opt.value)} />
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <TextField label="Property name" value={name} onChangeText={setName} placeholder="e.g. Riad Jasmine" />
        </View>

        <Text style={styles.sectionLabel}>City</Text>
        <View style={styles.chipRow}>
          {cities.map((c) => (
            <Chip key={c.id} label={c.name} active={cityId === c.id} onPress={() => setCityId(c.id)} />
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <TextField label="Address" value={addressLine} onChangeText={setAddressLine} placeholder="Street, neighborhood" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="Bedrooms" value={bedrooms} onChangeText={setBedrooms} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Bathrooms" value={bathrooms} onChangeText={setBathrooms} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Max guests" value={maxGuests} onChangeText={setMaxGuests} keyboardType="number-pad" />
            </View>
          </View>
          <TextField
            label="Nightly rate in MAD (optional)"
            value={nightlyRate}
            onChangeText={setNightlyRate}
            keyboardType="number-pad"
            placeholder="e.g. 600"
          />
          <TextField
            label="Access instructions (optional)"
            value={accessInstructions}
            onChangeText={setAccessInstructions}
            multiline
            numberOfLines={3}
            placeholder="How the cleaner gets in — gate code, key location…"
          />
          <TextField
            label="Wifi info (optional)"
            value={wifiInfo}
            onChangeText={setWifiInfo}
            placeholder="Network name / password"
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button label={isSubmitting ? 'Adding…' : 'Add property'} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionLabel: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
