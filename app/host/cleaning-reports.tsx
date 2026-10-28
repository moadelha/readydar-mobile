import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, CleaningReport, WEB_URL } from '@/lib/api';
import { usePlanStrings } from '@/lib/i18n/plan-strings';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner, StatusBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/lib/i18n/language-context';

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
  const planStrings = usePlanStrings();
  const router = useRouter();
  const { t } = useLanguage();

  const [property, setProperty] = useState<Property | null>(null);
  const [reports, setReports] = useState<CleaningReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The property screen's button already blocks navigation here for plans
  // without the feature, but this screen is also reachable by deep link —
  // and without this the "+" would just surface CleaningReportsService's
  // raw BadRequestException as an error banner. Fail open on a failed
  // fetch; the server is still the real gate either way.
  const [cleaningReportsEnabled, setCleaningReportsEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    api.billing
      .getEntitlements(session.accessToken)
      .then((e) => { if (!cancelled) setCleaningReportsEnabled(e.cleaningReportsEnabled); })
      .catch(() => { if (!cancelled) setCleaningReportsEnabled(true); });
    return () => { cancelled = true; };
  }, [session]);

  const load = useCallback(async () => {
    if (!session || !propertyId) return;
    setError(null);
    try {
      const [p, list] = await Promise.all([
        // A co-host can have CLEANING_REPORTS without also having CALENDAR
        // (see HostTeamPermission's doc comment) — that 403s here, but it's
        // only used for the property name in the header, not for anything
        // this screen actually needs to function. Tolerated so a co-host
        // with just report access isn't blocked from using it.
        api.properties.getOne(propertyId, session.accessToken).catch(() => null),
        api.cleaningReports.listForProperty(propertyId, session.accessToken),
      ]);
      setProperty(p);
      setReports(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cleaningReports.loadError);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, propertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleStartNew() {
    if (!session || !propertyId || isCreating) return;
    if (cleaningReportsEnabled === false) {
      // Plans are bought on the website (no in-app purchase) — the button opens it.
      Alert.alert(t.cleaningReports.upgradeTitle, t.cleaningReports.upgradeBody, [
        { text: t.cleaningReports.back, style: 'cancel' },
        { text: planStrings.seePlans, onPress: () => Linking.openURL(`${WEB_URL}/host/billing#addons`) },
      ]);
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const report = await api.cleaningReports.create(propertyId, session.accessToken);
      router.push(`/host/cleaning-report/${report.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cleaningReports.startError);
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen
        options={{ headerShown: true, title: t.cleaningReports.title, headerBackTitle: t.cleaningReports.back }}
      />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h1}>{t.cleaningReports.title}</Text>
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
            message={t.cleaningReports.emptyMessage}
            actionLabel={t.cleaningReports.startAction}
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
                    label={
                      item.status === 'COMPLETED'
                        ? t.cleaningReports.statusCompleted
                        : t.cleaningReports.statusInProgress
                    }
                    tone={item.status === 'COMPLETED' ? 'primary' : 'accent'}
                  />
                  <Text style={typography.caption}>{t.cleaningReports.photoCount(photoCount)}</Text>
                </View>
                <Text style={[typography.bodyMuted, { marginTop: 6 }]}>
                  {t.cleaningReports.startedOn(new Date(item.startedAt).toLocaleDateString())}
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
