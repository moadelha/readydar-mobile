import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, GuestCheckIn, CheckInLanguage, resolveCheckInUrl } from '@/lib/api';
import { Screen, Card, TextField, SegmentedControl } from '@/components/ui';
import { PropertySelect } from '@/components/PropertySelect';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function NewCheckInScreen() {
  const { propertyId: preselectedPropertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(preselectedPropertyId ?? null);
  const [property, setProperty] = useState<Property | null>(null);
  const [expectedCheckIn, setExpectedCheckIn] = useState(addDaysIso(0));
  const [expectedCheckOut, setExpectedCheckOut] = useState(addDaysIso(1));
  const [guestNameHint, setGuestNameHint] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [language, setLanguage] = useState<CheckInLanguage>('EN');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<GuestCheckIn | null>(null);

  useEffect(() => {
    if (!session) return;
    if (!preselectedPropertyId) {
      api.properties.listMine(session.accessToken).then((list) => {
        setProperties(list);
        if (!propertyId && list[0]) setPropertyId(list[0].id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session || !propertyId) return;
    api.properties.getOne(propertyId, session.accessToken).then(setProperty).catch(() => {});
  }, [session, propertyId]);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!propertyId) return setError('Choose a property.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCheckIn)) return setError('Check-in date must be in YYYY-MM-DD format.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCheckOut)) return setError('Check-out date must be in YYYY-MM-DD format.');

    setIsSubmitting(true);
    try {
      const checkIn = await api.checkins.createLink(
        propertyId,
        {
          expectedCheckIn,
          expectedCheckOut,
          guestNameHint: guestNameHint || undefined,
          guestCount: Number(guestCount) || 1,
          language,
        },
        session.accessToken,
      );
      setCreated(checkIn);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the check-in link.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShareWhatsApp() {
    if (!created) return;
    const url = resolveCheckInUrl(created.token);
    const text = `Hi! Please complete your online check-in${property ? ` for ${property.name}` : ''} here: ${url}`;
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

  async function handleShareOther() {
    if (!created) return;
    const url = resolveCheckInUrl(created.token);
    const message = `Hi! Please complete your online check-in${property ? ` for ${property.name}` : ''} here: ${url}`;
    try {
      await Share.share({ message });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Guest online check-in', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        {created ? (
          <>
            <Text style={typography.h1}>Check-in link ready</Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
              Send this to your guest — they'll fill in their details and ID before arrival.
            </Text>

            <Card style={{ marginTop: spacing.lg }}>
              <Text style={typography.caption}>Guest link</Text>
              <Text style={[typography.body, { marginTop: spacing.xs }]} selectable>
                {resolveCheckInUrl(created.token)}
              </Text>
            </Card>

            <Button label="Share via WhatsApp" onPress={handleShareWhatsApp} style={{ marginTop: spacing.lg }} />
            <Button label="Share another way" onPress={handleShareOther} variant="outline" style={{ marginTop: spacing.sm }} />
            <Button
              label="Done"
              onPress={() => router.replace(propertyId ? `/host/property/${propertyId}` : '/(host-tabs)/properties')}
              variant="outline"
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : (
          <>
            <Text style={typography.h1}>Guest online check-in</Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
              Generate a link so your guest can submit their arrival details and ID before you meet them — and get
              access-info sent to them automatically once they do.
            </Text>

            {!preselectedPropertyId && (
              <>
                <Text style={styles.sectionLabel}>Property</Text>
                <PropertySelect properties={properties} value={propertyId} onChange={setPropertyId} />
              </>
            )}

            <View style={{ marginTop: spacing.lg }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <TextField label="Check-in (YYYY-MM-DD)" value={expectedCheckIn} onChangeText={setExpectedCheckIn} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Check-out (YYYY-MM-DD)" value={expectedCheckOut} onChangeText={setExpectedCheckOut} />
                </View>
              </View>
              <TextField
                label="Guest name (optional)"
                value={guestNameHint}
                onChangeText={setGuestNameHint}
                placeholder="e.g. Ahmed B."
              />
              <TextField label="Number of guests" value={guestCount} onChangeText={setGuestCount} keyboardType="number-pad" />

              <Text style={styles.fieldLabel}>Check-in form language</Text>
              <SegmentedControl
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'EN', label: 'English' },
                  { value: 'FR', label: 'Français' },
                  { value: 'AR', label: 'العربية' },
                ]}
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button label={isSubmitting ? 'Creating…' : 'Create check-in link'} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.lg }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionLabel: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  fieldLabel: { ...typography.bodyMuted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
