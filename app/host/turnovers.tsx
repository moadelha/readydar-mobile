import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Linking } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, PendingTurnoverItem } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

type Kind = 'checkin' | 'reservation';
interface Row {
  kind: Kind;
  item: PendingTurnoverItem;
}

function guestLabel(item: PendingTurnoverItem) {
  if (item.guestFirstName) return `${item.guestFirstName} ${item.guestLastName ?? ''}`.trim();
  return item.source ? `${item.source === 'AIRBNB' ? 'Airbnb' : 'Booking.com'} guest` : 'Guest';
}

export default function TurnoversScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [needsConfirmation, setNeedsConfirmation] = useState<Row[]>([]);
  const [readyToSend, setReadyToSend] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const data = await api.turnovers.listPending(session.accessToken);
      setNeedsConfirmation([
        ...data.needsConfirmation.guestCheckIns.map((item) => ({ kind: 'checkin' as const, item })),
        ...data.needsConfirmation.externalReservations.map((item) => ({ kind: 'reservation' as const, item })),
      ]);
      setReadyToSend([
        ...data.readyToSend.guestCheckIns.map((item) => ({ kind: 'checkin' as const, item })),
        ...data.readyToSend.externalReservations.map((item) => ({ kind: 'reservation' as const, item })),
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load pending turnovers.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleConfirm(row: Row) {
    if (!session) return;
    setError(null);
    setBusyId(row.item.id);
    try {
      const { whatsapp } =
        row.kind === 'checkin'
          ? await api.turnovers.confirmCheckIn(row.item.id, session.accessToken)
          : await api.turnovers.confirmReservation(row.item.id, session.accessToken);
      if (!whatsapp.sent && whatsapp.waLink) {
        await Linking.openURL(whatsapp.waLink);
        if (row.kind === 'checkin') await api.turnovers.acknowledgeCheckIn(row.item.id, session.accessToken);
        else await api.turnovers.acknowledgeReservation(row.item.id, session.accessToken);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not notify the cleaning contact.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenReady(row: Row) {
    if (!session || !row.item.turnoverWaLink) return;
    setError(null);
    setBusyId(row.item.id);
    try {
      await Linking.openURL(row.item.turnoverWaLink);
      if (row.kind === 'checkin') await api.turnovers.acknowledgeCheckIn(row.item.id, session.accessToken);
      else await api.turnovers.acknowledgeReservation(row.item.id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open WhatsApp.');
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <LoadingScreen />;

  const isEmpty = needsConfirmation.length === 0 && readyToSend.length === 0;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Turnovers', headerBackTitle: 'Back' }} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={typography.bodyMuted}>
          Alerts to your cleaning contact after a guest checks out — needs a default contact set per property.
        </Text>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {isEmpty ? (
          <Card style={{ marginTop: spacing.lg }}>
            <EmptyState
              message="No turnovers pending right now. They'll show up here as checkouts approach."
              actionLabel="Set up cleaning contacts"
              onAction={() => router.push('/host/cleaning-contacts')}
            />
          </Card>
        ) : (
          <>
            {needsConfirmation.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Needs your confirmation</Text>
                {needsConfirmation.map((row) => (
                  <Card key={row.item.id} style={{ marginBottom: spacing.sm }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h3}>{guestLabel(row.item)}</Text>
                        <Text style={typography.bodyMuted}>{row.item.property.name}</Text>
                        <Text style={typography.caption}>
                          Checkout {new Date((row.item.expectedCheckOut ?? row.item.checkOut)!).toLocaleDateString()}
                        </Text>
                        {!row.item.property.defaultCleaningContact && (
                          <Text style={[typography.caption, { color: colors.danger, marginTop: 2 }]}>
                            No default cleaning contact set for this property
                          </Text>
                        )}
                      </View>
                    </View>
                    <Button
                      label={busyId === row.item.id ? 'Notifying…' : 'Confirm & notify cleaner'}
                      onPress={() => handleConfirm(row)}
                      loading={busyId === row.item.id}
                      disabled={!row.item.property.defaultCleaningContact}
                      style={{ marginTop: spacing.sm }}
                    />
                  </Card>
                ))}
              </>
            )}

            {readyToSend.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Ready to send</Text>
                {readyToSend.map((row) => (
                  <Card key={row.item.id} style={{ marginBottom: spacing.sm }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h3}>{guestLabel(row.item)}</Text>
                        <Text style={typography.bodyMuted}>{row.item.property.name}</Text>
                      </View>
                    </View>
                    <Button
                      label={busyId === row.item.id ? 'Opening…' : 'Open WhatsApp'}
                      onPress={() => handleOpenReady(row)}
                      loading={busyId === row.item.id}
                      variant="secondary"
                      style={{ marginTop: spacing.sm }}
                    />
                  </Card>
                ))}
              </>
            )}

            <Pressable onPress={() => router.push('/host/cleaning-contacts')} style={styles.linkAction}>
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              <Text style={styles.linkText}>Manage cleaning contacts</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionTitle: { ...typography.h2, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  linkAction: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: spacing.xl },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
