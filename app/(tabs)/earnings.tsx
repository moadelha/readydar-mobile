import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, EarningsSummary } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function EarningsScreen() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await api.cleaners.getEarnings(session.accessToken);
    setSummary(res);
    setIsLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (isLoading || !summary) return <LoadingScreen />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={typography.h1}>Earnings</Text>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <Text style={styles.statLabel}>This month</Text>
            <Text style={styles.statValue}>{summary.totalThisMonth.toFixed(0)} MAD</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
            <Text style={styles.statLabel}>All time</Text>
            <Text style={styles.statValue}>{summary.totalAllTime.toFixed(0)} MAD</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>History</Text>
        {summary.entries.length === 0 ? (
          <EmptyState message="No completed jobs yet." />
        ) : (
          summary.entries.map((e) => (
            <Card key={e.id} style={{ marginBottom: spacing.sm }}>
              <View style={styles.entryRow}>
                <View>
                  <Text style={typography.body}>{e.booking.service.name}</Text>
                  <Text style={typography.caption}>
                    {e.booking.property.name} · {new Date(e.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.entryAmount}>+{Number(e.amount).toFixed(0)} MAD</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: { flex: 1 },
  statLabel: { ...typography.bodyMuted, marginTop: spacing.xs },
  statValue: { ...typography.h1, fontSize: 22, marginTop: 2 },
  sectionTitle: { ...typography.h2, marginTop: spacing.lg, marginBottom: spacing.sm },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryAmount: { color: colors.primary, fontWeight: '700' },
});
