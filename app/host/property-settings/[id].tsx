import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, CleaningContact, Service, AutomationMode } from '@/lib/api';
import { Screen, TextField, Chip, SegmentedControl, ErrorBanner, LoadingScreen } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';

const MODE_OPTIONS: { value: AutomationMode; label: string }[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'MANUAL_CONFIRM', label: 'Review first' },
  { value: 'AUTO', label: 'Automatic' },
];

const TEMPLATE_VARIABLES =
  '{{guestName}} {{propertyName}} {{checkInDate}} {{checkOutDate}} {{checkInTime}} {{checkOutTime}} ' +
  '{{mapsLink}} {{doorPhotos}} {{gateCode}} {{apartmentNumber}} {{accessCode}} {{houseRules}}';

export default function PropertySettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [contacts, setContacts] = useState<CleaningContact[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [guestWelcomeMode, setGuestWelcomeMode] = useState<AutomationMode>('OFF');
  const [guestWelcomeTemplate, setGuestWelcomeTemplate] = useState('');
  const [automationMode, setAutomationMode] = useState<AutomationMode>('OFF');
  const [defaultCleaningContactId, setDefaultCleaningContactId] = useState<string | null>(null);
  const [defaultServiceType, setDefaultServiceType] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id) return;
    setError(null);
    try {
      const [propertyData, contactList, serviceList] = await Promise.all([
        api.properties.getOne(id, session.accessToken),
        api.cleaningContacts.list(session.accessToken),
        api.services.list(),
      ]);
      setProperty(propertyData);
      setContacts(contactList);
      setServices(serviceList);
      setGuestWelcomeMode(propertyData.guestWelcomeMode ?? 'OFF');
      setGuestWelcomeTemplate(propertyData.guestWelcomeTemplate ?? '');
      setAutomationMode(propertyData.automationMode ?? 'OFF');
      setDefaultCleaningContactId(propertyData.defaultCleaningContactId ?? null);
      setDefaultServiceType(propertyData.defaultServiceType ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this property.');
    }
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSave() {
    if (!session || !id) return;
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      await api.automation.setGuestWelcome(
        id,
        { guestWelcomeMode, guestWelcomeTemplate: guestWelcomeTemplate.trim() || undefined },
        session.accessToken,
      );
      await api.automation.setForProperty(
        id,
        {
          automationMode,
          defaultCleaningContactId,
          defaultServiceType: defaultServiceType ?? undefined,
        },
        session.accessToken,
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these settings.');
    } finally {
      setIsSaving(false);
    }
  }

  const cleaningServices = services.filter((s) => s.category === 'CLEANING');

  if (!property) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Automation settings', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>{property.name}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Control what happens automatically around a guest's stay.
        </Text>

        {error && <ErrorBanner message={error} onRetry={load} />}
        {saved && !error && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Saved.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Guest welcome message</Text>
        <Text style={typography.bodyMuted}>
          Sent to the guest once they complete online check-in — access info, door photos, house rules.
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <SegmentedControl value={guestWelcomeMode} onChange={setGuestWelcomeMode} options={MODE_OPTIONS} />
        </View>
        {guestWelcomeMode !== 'OFF' && (
          <View style={{ marginTop: spacing.md }}>
            <TextField
              label="Message template (optional)"
              value={guestWelcomeTemplate}
              onChangeText={setGuestWelcomeTemplate}
              multiline
              numberOfLines={6}
              placeholder="Leave blank to use the default template"
            />
            <Text style={typography.caption}>Available variables: {TEMPLATE_VARIABLES}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Cleaning turnover alerts</Text>
        <Text style={typography.bodyMuted}>
          Notify a cleaning contact via WhatsApp after the guest checks out.
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <SegmentedControl value={automationMode} onChange={setAutomationMode} options={MODE_OPTIONS} />
        </View>

        {automationMode !== 'OFF' && (
          <>
            <Text style={styles.fieldLabel}>Default cleaning contact</Text>
            {contacts.length === 0 ? (
              <Text style={typography.bodyMuted}>
                No cleaning contacts yet — add one from the Turnovers screen to enable this.
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {contacts.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    active={defaultCleaningContactId === c.id}
                    onPress={() => setDefaultCleaningContactId(defaultCleaningContactId === c.id ? null : c.id)}
                  />
                ))}
              </View>
            )}

            {cleaningServices.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Default service (for company-account contacts)</Text>
                <View style={styles.chipRow}>
                  {cleaningServices.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      active={defaultServiceType === s.type}
                      onPress={() => setDefaultServiceType(defaultServiceType === s.type ? null : s.type)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <Button label={isSaving ? 'Saving…' : 'Save settings'} onPress={handleSave} loading={isSaving} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionTitle: { ...typography.h2, marginTop: spacing.xl, marginBottom: spacing.xs },
  fieldLabel: { ...typography.bodyMuted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  successBox: { backgroundColor: colors.successBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  successText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
