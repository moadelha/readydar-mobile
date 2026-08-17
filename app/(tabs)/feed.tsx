import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, JobFeedItem } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography, radius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function JobFeedScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const list = await api.cleaners.getJobFeed(session.accessToken);
    setJobs(list);
    setIsLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleAccept(bookingId: string) {
    if (!session) return;
    setError(null);
    setAcceptingId(bookingId);
    try {
      await api.jobActions.accept(bookingId, session.accessToken);
      router.push(`/job/${bookingId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept — it may already be taken.');
      load();
    } finally {
      setAcceptingId(null);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h1}>Job feed</Text>
        <Text style={[typography.bodyMuted, { marginTop: 2 }]}>Nearby jobs, closest first.</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState message="No jobs available right now. Make sure you've set your covered cities in your profile." />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
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
                  <Text style={typography.bodyMuted}>
                    {item.property.name}, {item.property.city.name}
                    {item.distanceKm !== null ? ` · ${item.distanceKm.toFixed(1)} km` : ''}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={colors.inkFaint} />
                  <Text style={typography.caption}>
                    {new Date(item.scheduledDate).toLocaleDateString()} at {item.scheduledTime}
                  </Text>
                </View>
                {item.budget && <Text style={styles.budget}>{item.budget} MAD budget</Text>}
              </View>
            </View>
            <Button
              label={acceptingId === item.id ? 'Accepting…' : 'Accept'}
              onPress={() => handleAccept(item.id)}
              loading={acceptingId === item.id}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row' },
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
  budget: { marginTop: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: 13 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  errorText: { color: colors.danger, fontSize: 13 },
});
