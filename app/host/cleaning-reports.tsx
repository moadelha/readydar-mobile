import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, CleaningReport } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner, StatusBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

/**
 * One property's cleaning reports (proof-of-cleaning walkthroughs), newest
 * first. Tapping "+" starts a brand-new report and jumps straight into its
 * capture screen — a report documents one specific walkthrough, so there's
 * no "resume the last one" shortcut, only "continue this one" from its own
 * detail screen while it's still IN_PROGRESS.
 */
export default function CleaningReportsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [reports, setReports] = useState<CleaningReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !propertyId) return;
    setError(null);
    try {
      const [p, list] = await Promise.all([
        api.properties.getOne(propertyId, session.accessToken),
        api.cleaningReports.listForProperty(propertyId, session.accessToken),
      ]);
      setProperty(p);
      setReports(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load cleaning reports.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, propertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleStartNew() {
    if (!session || !propertyId || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const report = await api.cleaningReports.create(propertyId, session.accessToken);
      router.push(`/host/cleaning-report/${report.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start a new report.');
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Cleaning Reports', headerBackTitle: 'Back' }} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h1}>Cleaning Reports</Text>
          {property && (
            <Text style={[typography.bodyMuted, { marginTop: 2 }]} numberOfLines={1}>
              {property.name}
            </Text>
          )}
        </View>
        <Pressable onPress={handleStartNew} style={styles.addButton} disabled={isCreating} hitSlop={8}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {error && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      )}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            message="No cleaning reports yet."
            actionLabel="Start a report"
            onAction={handleStartNew}
            icon="camera-outline"
          />
        }
        renderItem={({ item }) => {
          const photoCount = item._count?.photos ?? 0;
          return (
            <Pressable onPress={() => router.push(`/host/cleaning-report/${item.id}`)}>
              <Card style={{ marginBottom: spacing.md }}>
                <View style={styles.cardRow}>
                  <StatusBadge
                    label={item.status === 'COMPLETED' ? 'Completed' : 'In progress'}
                    tone={item.status === 'COMPLETED' ? 'primary' : 'accent'}
                  />
                  <Text style={typography.caption}>
                    {photoCount} photo{photoCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={[typography.bodyMuted, { marginTop: 6 }]}>
                  Started {new Date(item.startedAt).toLocaleDateString()}
                </Text>
              </Card>
            </Pressable>
          );
        }}
      />
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
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
