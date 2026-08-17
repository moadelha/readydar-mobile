import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, PropertyStatusItem, Booking } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, StatusBadge, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONE, STATUS_LABELS, STATUS_TONE } from '@/lib/status';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function HostDashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<PropertyStatusItem[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPropertyId, setBusyPropertyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [statusList, upcomingList] = await Promise.all([
        api.properties.getStatusOverview(session.accessToken),
        api.properties.getUpcomingBookings(session.accessToken),
      ]);
      setOverview(statusList);
      setUpcoming(upcomingList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your dashboard.');
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

  async function handleMarkReady(propertyId: string) {
    if (!session) return;
    setError(null);
    setBusyPropertyId(propertyId);
    try {
      await api.properties.markReady(propertyId, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the property.');
    } finally {
      setBusyPropertyId(null);
    }
  }

  if (isLoading) return <LoadingScreen />;

  const needsAttention = overview.filter((o) => o.status === 'NEEDS_CLEANING' || o.status === 'IN_PROGRESS');
  const readyCount = overview.filter((o) => o.status === 'READY').length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={typography.h1}>
          {session?.user.firstName ? `Hi ${session.user.firstName}` : 'Your properties'}
        </Text>
        <Text style={[typography.bodyMuted, { marginTop: 2 }]}>Here's what's happening across your properties.</Text>

        {overview.length === 0 ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={typography.h3}>Add your first property</Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
              Once it's added you can request cleanings and track turnovers here.
            </Text>
            <Button
              label="Add property"
              onPress={() => router.push('/host/property/new')}
              style={{ marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: spacing.lg }}
            />
          </Card>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Ionicons name="business-outline" size={18} color={colors.primary} />
                <Text style={styles.statLabel}>Properties</Text>
                <Text style={styles.statValue}>{overview.length}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                <Text style={styles.statLabel}>Ready</Text>
                <Text style={styles.statValue}>{readyCount}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
                <Text style={styles.statLabel}>Needs attention</Text>
                <Text style={styles.statValue}>{needsAttention.length}</Text>
              </Card>
            </View>

            <View style={styles.quickActionsRow}>
              <Pressable style={styles.quickAction} onPress={() => router.push('/host/booking/new')}>
                <View style={styles.quickActionIcon}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Request cleaning</Text>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => router.push('/host/expense/new')}>
                <View style={styles.quickActionIcon}>
                  <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Log expense</Text>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => router.push('/host/checkin/new')}>
                <View style={styles.quickActionIcon}>
                  <Ionicons name="key-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Guest check-in</Text>
              </Pressable>
            </View>

            {error && <ErrorBanner message={error} onRetry={load} />}

            {needsAttention.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Needs attention</Text>
                {needsAttention.map((item) => (
                  <Card key={item.property.id} style={{ marginBottom: spacing.sm }}>
                    <Pressable onPress={() => router.push(`/host/property/${item.property.id}`)}>
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={typography.h3}>{item.property.name}</Text>
                          <Text style={typography.bodyMuted}>{item.property.city.name}</Text>
                        </View>
                        <StatusBadge label={PROPERTY_STATUS_LABELS[item.status]} tone={PROPERTY_STATUS_TONE[item.status]} />
                      </View>
                    </Pressable>
                    {item.status === 'NEEDS_CLEANING' && (
                      <View style={styles.actionRow}>
                        <Button
                          label="Request cleaning"
                          onPress={() =>
                            router.push({ pathname: '/host/booking/new', params: { propertyId: item.property.id } })
                          }
                          style={{ flex: 1 }}
                        />
                        <Button
                          label={busyPropertyId === item.property.id ? '…' : 'Mark ready'}
                          onPress={() => handleMarkReady(item.property.id)}
                          loading={busyPropertyId === item.property.id}
                          variant="outline"
                          style={{ flex: 1 }}
                        />
                      </View>
                    )}
                    {item.status === 'IN_PROGRESS' && item.activeBooking && (
                      <View style={styles.actionRow}>
                        <Button
                          label={`View job — ${STATUS_LABELS[item.activeBooking.status]}`}
                          onPress={() => router.push(`/host/booking/${item.activeBooking!.id}`)}
                          variant="outline"
                          style={{ flex: 1 }}
                        />
                      </View>
                    )}
                  </Card>
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>Upcoming bookings</Text>
            {upcoming.length === 0 ? (
              <EmptyState
                message="Nothing scheduled."
                actionLabel="Request a cleaning"
                onAction={() => router.push('/host/booking/new')}
              />
            ) : (
              upcoming.map((b) => (
                <Pressable key={b.id} onPress={() => router.push(`/host/booking/${b.id}`)}>
                  <Card style={{ marginBottom: spacing.sm }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h3}>{b.service.name}</Text>
                        <Text style={typography.bodyMuted}>{b.property.name}</Text>
                        <Text style={typography.caption}>
                          {new Date(b.scheduledDate).toLocaleDateString()} at {b.scheduledTime}
                        </Text>
                      </View>
                      <StatusBadge label={STATUS_LABELS[b.status]} tone={STATUS_TONE[b.status]} />
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  statCard: { flex: 1 },
  statLabel: { ...typography.bodyMuted, marginTop: spacing.xs, fontSize: 12 },
  statValue: { ...typography.h1, fontSize: 22, marginTop: 2 },
  sectionTitle: { ...typography.h2, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickAction: { flex: 1, alignItems: 'center', gap: spacing.xs },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: colors.inkMuted, textAlign: 'center' },
});
