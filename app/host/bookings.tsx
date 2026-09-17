import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Booking } from '@/lib/api';
import { Screen, Card, EmptyState, StatusBadge, ErrorBanner, Reveal, AnimatedPressable, SkeletonListItem } from '@/components/ui';
import { STATUS_LABELS, STATUS_TONE } from '@/lib/status';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

/**
 * All cleaning/maintenance jobs across every property — no longer a bottom
 * tab (Calendar and each Property's own detail are the everyday way to see
 * what's scheduled; this is the flat "everything, unfiltered" list for when
 * that's genuinely what's needed), reached from the More menu instead. See
 * darclean-mobile-status.md Part 31 for why the tab bar changed.
 */
export default function HostBookingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const list = await api.bookings.listMine(session.accessToken);
      setBookings(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your bookings.');
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

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'All bookings', headerBackTitle: 'More' }} />
      <Reveal>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h1}>Bookings</Text>
            <Text style={[typography.bodyMuted, { marginTop: 2 }]}>Across all your properties</Text>
          </View>
          <AnimatedPressable scaleTo={0.9} onPress={() => router.push('/host/booking/new')} style={styles.addButton}>
            <Ionicons name="add" size={22} color={colors.white} />
          </AnimatedPressable>
        </View>
      </Reveal>

      {error && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      )}

      {isLoading ? (
        <View style={styles.listContent}>
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              message="No bookings yet."
              actionLabel="Request a cleaning or service"
              onAction={() => router.push('/host/booking/new')}
              icon="clipboard-outline"
            />
          }
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 6) * 40}>
              <Card style={{ marginBottom: spacing.sm }} onPress={() => router.push(`/host/booking/${item.id}`)}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={typography.h3}>{item.service.name}</Text>
                      {item.urgency === 'URGENT' && (
                        <View style={styles.urgentBadge}>
                          <Ionicons name="flash" size={11} color="#B45309" />
                          <Text style={styles.urgentText}>Urgent</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
                      <Text style={typography.bodyMuted}>{item.property.name}</Text>
                    </View>
                    <Text style={typography.caption}>
                      {new Date(item.scheduledDate).toLocaleDateString()} at {item.scheduledTime}
                    </Text>
                  </View>
                  <StatusBadge label={STATUS_LABELS[item.status]} tone={STATUS_TONE[item.status]} />
                </View>
              </Card>
            </Reveal>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  urgentText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
});
