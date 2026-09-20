import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, Service } from '@/lib/api';
import { Screen, TextField, Chip, SegmentedControl, Checkbox } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { estimatePrice, isRoomScaledService } from '@/lib/pricing';
import { Ionicons } from '@expo/vector-icons';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewBookingScreen() {
  // `date` arrives from Home's tomorrow-checkout card ("Request cleaning for
  // this turnover") — pre-filling the checkout date it's already showing
  // saves re-typing something the host is looking straight at.
  const { propertyId: preselectedPropertyId, date: preselectedDate } = useLocalSearchParams<{
    propertyId?: string;
    date?: string;
  }>();
  const { session } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(preselectedPropertyId ?? null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState(preselectedDate ?? todayIso());
  const [scheduledTime, setScheduledTime] = useState('14:00');
  const [urgency, setUrgency] = useState<'STANDARD' | 'URGENT'>('STANDARD');
  const [specialRequests, setSpecialRequests] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [shareAccessDetails, setShareAccessDetails] = useState(true);
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

  const selectedProperty = useMemo(() => properties.find((p) => p.id === propertyId) ?? null, [properties, propertyId]);
  const selectedService = useMemo(() => services.find((s) => s.type === serviceType) ?? null, [services, serviceType]);

  // The cleaner sees this address on the job feed and job detail before
  // deciding whether to accept — a missing or too-short one makes it hard
  // for them to judge distance/travel time, so flag it here up front.
  const addressLooksIncomplete = !selectedProperty || (selectedProperty.addressLine ?? '').trim().length < 8;

  const estimate = useMemo(() => {
    if (!selectedService || !isRoomScaledService(serviceType)) return null;
    return estimatePrice({
      basePrice: Number(selectedService.basePrice),
      serviceType,
      propertyType: selectedProperty?.type,
      bedrooms: selectedProperty?.bedrooms,
      bathrooms: selectedProperty?.bathrooms,
    });
  }, [selectedService, selectedProperty, serviceType]);

  // Pre-fill the budget field with the suggested price whenever the
  // property or service changes — but only until the host types their own
  // number, so we never clobber a manual edit.
  useEffect(() => {
    if (estimate && !budgetTouched) setBudget(String(estimate.amount));
  }, [estimate, budgetTouched]);

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
          shareAccessDetails,
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={typography.h1}>Request a service</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          We'll match you with a nearby verified cleaner or specialist automatically.
        </Text>

        <Text style={styles.sectionLabel}>Property</Text>
        <View style={styles.chipRow}>
          {properties.map((p) => (
            <Chip key={p.id} label={p.name} active={propertyId === p.id} onPress={() => setPropertyId(p.id)} />
          ))}
        </View>

        {selectedProperty && (
          addressLooksIncomplete ? (
            <View style={styles.addressWarning}>
              <Ionicons name="warning-outline" size={16} color={colors.danger} />
              <Text style={styles.addressWarningText}>
                This property doesn't have a full address on file. Cleaners see the address before
                accepting a job — without one, they can't judge distance or travel time.
              </Text>
            </View>
          ) : (
            <View style={styles.addressNote}>
              <Ionicons name="location-outline" size={14} color={colors.inkFaint} />
              <Text style={styles.addressNoteText}>
                Cleaners will see: {selectedProperty.addressLine}, {selectedProperty.city.name}
              </Text>
            </View>
          )
        )}

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
              onChangeText={(v) => {
                setBudgetTouched(true);
                setBudget(v);
              }}
              keyboardType="number-pad"
              placeholder="e.g. 250"
            />
            {estimate && (
              <View style={styles.estimateRow}>
                <Text style={styles.estimateText}>
                  Suggested: {estimate.amount} MAD · {estimate.reason}
                </Text>
                {budgetTouched && (
                  <Pressable
                    onPress={() => {
                      setBudget(String(estimate.amount));
                      setBudgetTouched(false);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.estimateUse}>Use this</Text>
                  </Pressable>
                )}
              </View>
            )}

            <Pressable style={styles.shareRow} onPress={() => setShareAccessDetails(!shareAccessDetails)}>
              <Checkbox checked={shareAccessDetails} onChange={setShareAccessDetails} />
              <Text style={styles.shareText}>
                Share my phone number and property access details with the cleaner once matched
              </Text>
            </Pressable>

            <View style={styles.paymentNote}>
              <Ionicons name="cash-outline" size={15} color={colors.inkMuted} />
              <Text style={styles.paymentNoteText}>
                Payment: cash on delivery. Pay the cleaner directly at the property once the job is done.
              </Text>
            </View>
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
  addressNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  addressNoteText: { fontSize: 12, color: colors.inkFaint, flex: 1 },
  addressWarning: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  addressWarningText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17 },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  estimateText: { fontSize: 12, color: colors.inkMuted },
  estimateUse: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  shareText: { ...typography.bodyMuted, flex: 1, fontSize: 13 },
  paymentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  paymentNoteText: { ...typography.bodyMuted, flex: 1, fontSize: 12.5 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
