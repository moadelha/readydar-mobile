import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, GuestCheckIn, resolveUploadUrl, resolveCheckInUrl } from '@/lib/api';
import { Screen, Card, LoadingScreen, StatusBadge, TextField, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

const CHECKIN_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting guest',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Expired',
};
const CHECKIN_STATUS_TONE: Record<string, 'neutral' | 'primary' | 'accent' | 'success'> = {
  PENDING: 'accent',
  SUBMITTED: 'success',
  EXPIRED: 'neutral',
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [checkIns, setCheckIns] = useState<GuestCheckIn[]>([]);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expandedCheckInId, setExpandedCheckInId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [welcomeBusyId, setWelcomeBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !id) return;
    setError(null);
    try {
      const [propertyData, checkInList] = await Promise.all([
        api.properties.getOne(id, session.accessToken),
        api.checkins.listForProperty(id, session.accessToken),
      ]);
      setProperty(propertyData);
      setCheckIns(checkInList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this property.');
    }
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleMarkReady() {
    if (!session || !id) return;
    setError(null);
    setIsMarkingReady(true);
    try {
      await api.properties.markReady(id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the property.');
    } finally {
      setIsMarkingReady(false);
    }
  }

  async function handleShareCheckIn(checkIn: GuestCheckIn) {
    setSharingId(checkIn.id);
    try {
      const url = resolveCheckInUrl(checkIn.token);
      const text = `Hi! Please complete your online check-in${property ? ` for ${property.name}` : ''} here: ${url}`;
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } finally {
      setSharingId(null);
    }
  }

  async function handleExpandWelcome(checkIn: GuestCheckIn) {
    if (!session) return;
    if (expandedCheckInId === checkIn.id) {
      setExpandedCheckInId(null);
      return;
    }
    setExpandedCheckInId(checkIn.id);
    setError(null);
    setIsPreviewLoading(true);
    try {
      const { text } = await api.guestWelcome.preview(checkIn.id, session.accessToken);
      setPreviewText(text);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the message preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleSendWelcome(checkIn: GuestCheckIn) {
    if (!session) return;
    setError(null);
    setWelcomeBusyId(checkIn.id);
    try {
      const { whatsapp } = await api.guestWelcome.send(checkIn.id, previewText, session.accessToken);
      if (!whatsapp.sent && whatsapp.waLink) {
        await Linking.openURL(whatsapp.waLink);
        await api.guestWelcome.acknowledge(checkIn.id, session.accessToken);
      }
      setExpandedCheckInId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the welcome message.');
    } finally {
      setWelcomeBusyId(null);
    }
  }

  async function handleOpenReadyWelcome(checkIn: GuestCheckIn) {
    if (!session || !checkIn.welcomeWaLink) return;
    setError(null);
    setWelcomeBusyId(checkIn.id);
    try {
      await Linking.openURL(checkIn.welcomeWaLink);
      await api.guestWelcome.acknowledge(checkIn.id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open WhatsApp.');
    } finally {
      setWelcomeBusyId(null);
    }
  }

  if (!property) return <LoadingScreen />;

  const doorPhotos = property.photos?.filter((p) => p.type === 'DOOR_PHOTO') ?? [];

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: property.name,
          headerBackTitle: 'Back',
          headerRight: () => (
            <Pressable onPress={() => router.push(`/host/property-settings/${property.id}`)} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>{property.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
          <Text style={typography.bodyMuted}>
            {property.addressLine}, {property.city.name}
          </Text>
        </View>
        <Text style={typography.caption}>
          {property.bedrooms} bed · {property.bathrooms} bath · up to {property.maxGuests} guests
        </Text>
        {property.nightlyRate && <Text style={styles.rate}>{Number(property.nightlyRate).toFixed(0)} MAD / night</Text>}

        {error && <ErrorBanner message={error} onRetry={load} />}

        <View style={styles.actionRow}>
          <Button
            label="Request a cleaning"
            onPress={() => router.push({ pathname: '/host/booking/new', params: { propertyId: property.id } })}
            style={{ flex: 1 }}
          />
          <Button
            label={isMarkingReady ? '…' : 'Mark ready'}
            onPress={handleMarkReady}
            loading={isMarkingReady}
            variant="outline"
            style={{ flex: 1 }}
          />
        </View>

        <Button
          label="Log an expense for this property"
          onPress={() => router.push({ pathname: '/host/expense/new', params: { propertyId: property.id } })}
          variant="outline"
          style={{ marginTop: spacing.sm }}
        />

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Guest check-ins</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/host/checkin/new', params: { propertyId: property.id } })}
            style={styles.addButton}
          >
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        </View>

        {checkIns.length === 0 ? (
          <Card>
            <Text style={typography.bodyMuted}>
              No check-in links yet. Add one to collect the guest's arrival details and ID before you meet them.
            </Text>
          </Card>
        ) : (
          checkIns.map((c) => (
            <Card key={c.id} style={{ marginBottom: spacing.sm }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>
                    {c.guestFirstName ? `${c.guestFirstName} ${c.guestLastName ?? ''}`.trim() : c.guestNameHint || 'Guest'}
                  </Text>
                  <Text style={typography.bodyMuted}>
                    {new Date(c.expectedCheckIn).toLocaleDateString()} → {new Date(c.expectedCheckOut).toLocaleDateString()}
                    {c.guestCount > 1 ? ` · ${c.guestCount} guests` : ''}
                  </Text>
                </View>
                <StatusBadge label={CHECKIN_STATUS_LABEL[c.status] ?? c.status} tone={CHECKIN_STATUS_TONE[c.status] ?? 'neutral'} />
              </View>

              {c.status === 'SUBMITTED' && (
                <View style={{ marginTop: spacing.sm }}>
                  {c.guestPhone && <Text style={styles.detailLine}>Phone: {c.guestPhone}</Text>}
                  {c.nationality && (
                    <Text style={styles.detailLine}>
                      {c.nationality} · {c.idType === 'passport' ? 'Passport' : 'National ID'} {c.idNumber}
                    </Text>
                  )}

                  {c.welcomeWhatsappSent ? (
                    <View style={styles.welcomeStatusRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                      <Text style={typography.caption}>Welcome message sent</Text>
                    </View>
                  ) : c.welcomeNotifiedAt && c.welcomeWaLink ? (
                    <Button
                      label={welcomeBusyId === c.id ? 'Opening…' : 'Open WhatsApp — welcome message ready'}
                      onPress={() => handleOpenReadyWelcome(c)}
                      loading={welcomeBusyId === c.id}
                      variant="secondary"
                      style={{ marginTop: spacing.sm }}
                    />
                  ) : (
                    <>
                      <Pressable onPress={() => handleExpandWelcome(c)} style={styles.welcomeStatusRow}>
                        <Ionicons
                          name={expandedCheckInId === c.id ? 'chevron-up' : 'chatbubble-ellipses-outline'}
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                          {expandedCheckInId === c.id ? 'Hide welcome message' : 'Send welcome message'}
                        </Text>
                      </Pressable>

                      {expandedCheckInId === c.id && (
                        <View style={{ marginTop: spacing.sm }}>
                          {isPreviewLoading ? (
                            <Text style={typography.bodyMuted}>Loading preview…</Text>
                          ) : (
                            <>
                              <TextField
                                label="Message (edit if needed)"
                                value={previewText}
                                onChangeText={setPreviewText}
                                multiline
                                numberOfLines={6}
                              />
                              <Button
                                label={welcomeBusyId === c.id ? 'Sending…' : 'Send via WhatsApp'}
                                onPress={() => handleSendWelcome(c)}
                                loading={welcomeBusyId === c.id}
                              />
                            </>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {c.status === 'PENDING' && (
                <Button
                  label={sharingId === c.id ? 'Opening…' : 'Share via WhatsApp'}
                  onPress={() => handleShareCheckIn(c)}
                  loading={sharingId === c.id}
                  variant="outline"
                  style={{ marginTop: spacing.sm }}
                />
              )}
            </Card>
          ))
        )}

        {(property.checkInTime || property.checkOutTime) && (
          <>
            <Text style={styles.sectionTitle}>Check-in / check-out</Text>
            <Card>
              <Text style={typography.body}>
                Check-in {property.checkInTime ?? '—'} · Check-out {property.checkOutTime ?? '—'}
              </Text>
            </Card>
          </>
        )}

        {(property.gateCode || property.doorAccessCode || property.apartmentNumber || property.accessInstructions) && (
          <>
            <Text style={styles.sectionTitle}>Access details</Text>
            <Card>
              {property.apartmentNumber && <Text style={styles.detailLine}>Unit / apartment: {property.apartmentNumber}</Text>}
              {property.gateCode && <Text style={styles.detailLine}>Gate code: {property.gateCode}</Text>}
              {property.doorAccessCode && <Text style={styles.detailLine}>Door code: {property.doorAccessCode}</Text>}
              {property.accessInstructions && (
                <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{property.accessInstructions}</Text>
              )}
            </Card>
          </>
        )}

        {property.wifiInfo && (
          <>
            <Text style={styles.sectionTitle}>Wifi</Text>
            <Card>
              <Text style={typography.body}>{property.wifiInfo}</Text>
            </Card>
          </>
        )}

        {property.houseRules && (
          <>
            <Text style={styles.sectionTitle}>House rules</Text>
            <Card>
              <Text style={typography.body}>{property.houseRules}</Text>
            </Card>
          </>
        )}

        {doorPhotos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Door / access photos</Text>
            <View style={styles.photoGrid}>
              {doorPhotos.map((p) => (
                <Image key={p.id} source={{ uri: resolveUploadUrl(p.url) }} style={styles.photo} />
              ))}
            </View>
          </>
        )}

        <Button
          label="Automation settings"
          onPress={() => router.push(`/host/property-settings/${property.id}`)}
          variant="outline"
          style={{ marginTop: spacing.xl }}
        />

        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
          <Text style={[typography.bodyMuted, { flex: 1 }]}>
            iCal sync and general property photos are managed from the DarClean web dashboard for now.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  rate: { marginTop: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  detailLine: { ...typography.body, marginBottom: 2 },
  welcomeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photo: { width: 84, height: 84, borderRadius: radius.sm },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.xl },
});
