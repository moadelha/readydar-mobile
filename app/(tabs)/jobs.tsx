import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Booking } from '@/lib/api';
import { Screen, Card, EmptyState, StatusBadge, ErrorBanner, Reveal, SkeletonListItem } from '@/components/ui';
import { STATUS_TONE } from '@/lib/status';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function MyJobsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const list = await api.cleaners.getMyJobs(session.accessToken);
      setJobs(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your jobs.');
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
      <Reveal>
        <View style={styles.header}>
          <Text style={typography.h1}>{t.myJobs.title}</Text>
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
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState message={t.myJobs.emptyMessage} icon="briefcase-outline" />}
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 6) * 40}>
              <Card style={{ marginBottom: spacing.sm }} onPress={() => router.push(`/job/${item.id}`)}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={typography.h3}>{item.service.name}</Text>
                      {item.urgency === 'URGENT' && (
                        <View style={styles.urgentBadge}>
                          <Ionicons name="alert-circle" size={11} color={colors.white} />
                          <Text style={styles.urgentBadgeText}>{t.jobDetail.urgentBadge}</Text>
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.danger,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  urgentBadgeText: { fontSize: 9, fontWeight: '700', color: colors.white },
});
