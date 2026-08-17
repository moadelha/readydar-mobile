import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, Service } from '@/lib/api';
import { Screen, TextField, Chip, SegmentedControl } from '@/components/ui';
import { PropertySelect } from '@/components/PropertySelect';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewBookingScreen() {
  const { propertyId: preselectedPropertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(preselectedPropertyId ?? null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState(todayIso());
  const [scheduledTime, setScheduledTime] = useState('14:00');
  const [urgency, setUrgency] = useState<'STANDARD' | 'URGENT'>('STANDARD');
  const [specialRequests, setSpecialRequests] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session) return;
    Promise.all([api.properties.listMine(session.accessToken), api.services.list()]).then(
      ([propertyList, serviceList]) => {
        setProperties(propertyList);
        setServices(serviceList);
        if (!propertyId && propertyList[0]) setPropertyId(propertyList[0].id);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const cleaningServices = useMemo(() => services.filter((s) => s.category === 'CLEANING'), [services]);
  const maintenanceServices = useMemo(() => services.filter((s) => s.category === 'MAINTENANCE'), [services]);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!propertyId) return setError('Choose a property.');
    if (!serviceType) return setError('Choose a service.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return setError('Date must be in YYYY-MM-DD format.');
    if (!/^\d{2}:\d{2}$/.test(scheduledTime)) return setError('Time must be in HH:mm format.');

    setIsSubmitting(true);
    try {
      const booking = await api.bookings.create(
        {
          propertyId,
          serviceType,
          scheduledDate,
          scheduledTime,
          urgency,
          specialRequests: specialRequests || undefined,
          budget: budget ? Number(budget) : undefined,
        },
        session.accessToken,
      );
      router.replace(`/host/booking/${booking.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this booking.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Request a service', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>Request a service</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          We'll match you with a nearby verified cleaner or specialist automatically.
        </Text>

        <Text style={styles.sectionLabel}>Property</Text>
        <PropertySelect properties={properties} value={propertyId} onChange={setPropertyId} />

        <Text style={styles.sectionLabel}>Cleaning</Text>
        <View style={styles.chipRow}>
          {cleaningServices.map((s) => (
            <Chip
              key={s.id}
              label={`${s.name} · ${Number(s.basePrice).toFixed(0)} MAD`}
              active={serviceType === s.type}
              onPress={() => setServiceType(s.type)}
            />
          ))}
        </View>

        {maintenanceServices.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Maintenance</Text>
            <View style={styles.chipRow}>
              {maintenanceServices.map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.name} · ${Number(s.basePrice).toFixed(0)} MAD`}
                  active={serviceType === s.type}
                  onPress={() => setServiceType(s.type)}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="Date (YYYY-MM-DD)" value={scheduledDate} onChangeText={setScheduledDate} placeholder="2026-08-20" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Time (HH:mm)" value={scheduledTime} onChangeText={setScheduledTime} placeholder="14:00" />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Urgency</Text>
          <SegmentedControl
            value={urgency}
            onChange={setUrgency}
            options={[
              { value: 'STANDARD', label: 'Standard' },
              { value: 'URGENT', label: 'Urgent' },
            ]}
          />

          <View style={{ marginTop: spacing.md }}>
            <TextField
              label="Special requests (optional)"
              value={specialRequests}
              onChangeText={setSpecialRequests}
              multiline
              numberOfLines={3}
              placeholder="Anything the cleaner should know…"
            />
            <TextField
              label="Budget in MAD (optional)"
              value={budget}
              onChangeText={setBudget}
              keyboardType="number-pad"
              placeholder="e.g. 250"
            />
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button label={isSubmitting ? 'Requesting…' : 'Request service'} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionLabel: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  fieldLabel: { ...typography.bodyMuted, fontWeight: '600', marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
