import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Booking } from '@/lib/api';
import { Screen, Card, EmptyState, StatusBadge, ErrorBanner, Reveal, AnimatedPressable, SkeletonListItem } from '@/components/ui';
import { STATUS_TONE } from '@/lib/status';
import { colors, radius, spacing, typography } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatJobSlot } from '@/lib/dates';

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
  const { t, lang } = useLanguage();
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
      setError(err instanceof ApiError ? err.message : t.bookingsList.errorLoad);
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
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: t.bookingsList.headerBack }} />
      <Reveal>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h1}>{t.bookingsList.title}</Text>
            <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{t.bookingsList.subtitle}</Text>
          </View>
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
              message={t.bookingsList.emptyMessage}
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
                          <Ionicons name="flash" size={11} color={colors.warning} />
                          <Text style={styles.urgentText}>{t.bookingsList.urgent}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
                      <Text style={typography.bodyMuted}>{item.property.name}</Text>
                    </View>
                    <Text style={typography.caption}>
                      {formatJobSlot(item.scheduledDate, item.scheduledTime, lang)}
                    </Text>
                  </View>
                  <StatusBadge label={t.bookingStatus[item.status]} tone={STATUS_TONE[item.status]} />
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
    borderRadius: radius.sm,
  },
  urgentText: { fontSize: 10, fontWeight: '700', color: colors.warning },
});
