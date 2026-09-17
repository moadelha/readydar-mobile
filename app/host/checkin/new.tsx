import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, GuestCheckIn, CheckInLanguage, resolveCheckInUrl } from '@/lib/api';
import { Screen, Card, TextField, Chip, SegmentedControl } from '@/components/ui';
import { Button } from '@/components/Button';
import { useLanguage } from '@/lib/i18n/language-context';
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
  const { t } = useLanguage();

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(preselectedPropertyId ?? null);
  const [property, setProperty] = useState<Property | null>(null);
  const [expectedCheckIn, setExpectedCheckIn] = useState(addDaysIso(0));
  const [expectedCheckOut, setExpectedCheckOut] = useState(addDaysIso(1));
  const [guestNameHint, setGuestNameHint] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [nightlyRate, setNightlyRate] = useState('');
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
    api.properties.getOne(propertyId, session.accessToken).then((p) => {
      setProperty(p);
      setNightlyRate(p.nightlyRate != null ? String(p.nightlyRate) : '');
    }).catch(() => {});
  }, [session, propertyId]);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!propertyId) return setError(t.checkinNew.errorChooseProperty);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCheckIn)) return setError(t.checkinNew.errorCheckInFormat);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCheckOut)) return setError(t.checkinNew.errorCheckOutFormat);

    const trimmedRate = nightlyRate.trim();
    const parsedRate = trimmedRate === '' ? undefined : Number(trimmedRate);
    if (parsedRate !== undefined && (Number.isNaN(parsedRate) || parsedRate < 0)) {
      return setError(t.checkinNew.errorInvalidRate);
    }

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
          nightlyRate: parsedRate,
        },
        session.accessToken,
      );
      setCreated(checkIn);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.checkinNew.errorCreate);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShareWhatsApp() {
    if (!created) return;
    const url = resolveCheckInUrl(created.token);
    const text = t.checkinNew.shareMessage(property?.name ?? null, url);
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

  async function handleShareOther() {
    if (!created) return;
    const url = resolveCheckInUrl(created.token);
    const message = t.checkinNew.shareMessage(property?.name ?? null, url);
    try {
      await Share.share({ message });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t.checkinNew.headerTitle, headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {created ? (
          <>
            <Text style={typography.h1}>{t.checkinNew.readyTitle}</Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{t.checkinNew.readySubtitle}</Text>

            <Card style={{ marginTop: spacing.lg }}>
              <Text style={typography.caption}>{t.checkinNew.guestLink}</Text>
              <Text style={[typography.body, { marginTop: spacing.xs }]} selectable>
                {resolveCheckInUrl(created.token)}
              </Text>
            </Card>

            <Button label={t.checkinNew.shareWhatsApp} onPress={handleShareWhatsApp} style={{ marginTop: spacing.lg }} />
            <Button label={t.checkinNew.shareOther} onPress={handleShareOther} variant="outline" style={{ marginTop: spacing.sm }} />
            <Button
              label={t.checkinNew.done}
              onPress={() => router.replace(propertyId ? `/host/property/${propertyId}` : '/(host-tabs)/properties')}
              variant="outline"
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : (
          <>
            <Text style={typography.h1}>{t.checkinNew.headerTitle}</Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{t.checkinNew.subtitle}</Text>

            {!preselectedPropertyId && (
              <>
                <Text style={styles.sectionLabel}>{t.checkinNew.property}</Text>
                <View style={styles.chipRow}>
                  {properties.map((p) => (
                    <Chip key={p.id} label={p.name} active={propertyId === p.id} onPress={() => setPropertyId(p.id)} />
                  ))}
                </View>
              </>
            )}

            <View style={{ marginTop: spacing.lg }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <TextField label={t.checkinNew.checkInDate} value={expectedCheckIn} onChangeText={setExpectedCheckIn} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label={t.checkinNew.checkOutDate} value={expectedCheckOut} onChangeText={setExpectedCheckOut} />
                </View>
              </View>
              <TextField
                label={t.checkinNew.guestName}
                value={guestNameHint}
                onChangeText={setGuestNameHint}
                placeholder={t.checkinNew.guestNamePlaceholder}
              />
              <TextField label={t.checkinNew.guestCount} value={guestCount} onChangeText={setGuestCount} keyboardType="number-pad" />
              <TextField
                label={t.checkinNew.nightlyRate}
                value={nightlyRate}
                onChangeText={setNightlyRate}
                keyboardType="numeric"
                placeholder={t.checkinNew.nightlyRatePlaceholder}
              />

              <Text style={styles.fieldLabel}>{t.checkinNew.formLanguage}</Text>
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

            <Button
              label={isSubmitting ? t.checkinNew.creating : t.checkinNew.createLink}
              onPress={handleSubmit}
              loading={isSubmitting}
              style={{ marginTop: spacing.lg }}
            />
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
