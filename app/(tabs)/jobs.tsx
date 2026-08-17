import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, Booking } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, StatusBadge } from '@/components/ui';
import { STATUS_LABELS, STATUS_TONE } from '@/lib/status';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function MyJobsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const list = await api.cleaners.getMyJobs(session.accessToken);
    setJobs(list);
    setIsLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h1}>My jobs</Text>
      </View>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState message="No jobs yet. Check the Job Feed tab for nearby work." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/job/${item.id}`)}>
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{item.service.name}</Text>
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
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
});
