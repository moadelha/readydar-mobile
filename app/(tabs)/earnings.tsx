import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, EarningsSummary, CommissionStatus } from '@/lib/api';
import { Screen, Card, EmptyState, ErrorBanner, Reveal, AnimatedNumber, SkeletonStat, SkeletonListItem } from '@/components/ui';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function EarningsScreen() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [commission, setCommission] = useState<CommissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [res, commissionRes] = await Promise.all([
        api.cleaners.getEarnings(session.accessToken),
        api.cleaners.getCommission(session.accessToken).catch(() => null),
      ]);
      setSummary(res);
      setCommission(commissionRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your earnings.');
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

  if (isLoading || !summary) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={{ width: 140, height: 26, borderRadius: 6, backgroundColor: 'rgba(27,31,35,0.08)' }} />
          <View style={styles.statsRow}>
            <SkeletonStat style={styles.statCard} />
            <SkeletonStat style={styles.statCard} />
          </View>
          <SkeletonListItem style={{ marginTop: spacing.xl }} />
          <SkeletonListItem />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Reveal>
          <Text style={typography.h1}>{t.earnings.title}</Text>
        </Reveal>

        {error && <ErrorBanner message={error} onRetry={load} />}

        <View style={styles.statsRow}>
          <Reveal delay={40} style={styles.statCard}>
            <Card style={styles.statCardInner}>
              <Ionicons name="wallet-outline" size={18} color={colors.primary} />
              <Text style={styles.statLabel}>{t.earnings.thisMonth}</Text>
              <View style={styles.statValueRow}>
                <AnimatedNumber value={Math.round(summary.totalThisMonth)} style={styles.statValue} />
                <Text style={styles.statValueSuffix}> MAD</Text>
              </View>
            </Card>
          </Reveal>
          <Reveal delay={80} style={styles.statCard}>
            <Card style={styles.statCardInner}>
              <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
              <Text style={styles.statLabel}>{t.earnings.allTime}</Text>
              <View style={styles.statValueRow}>
                <AnimatedNumber value={Math.round(summary.totalAllTime)} style={styles.statValue} />
                <Text style={styles.statValueSuffix}> MAD</Text>
              </View>
            </Card>
          </Reveal>
        </View>

        {commission && commission.totalOwed > 0 && (
          <Reveal delay={120}>
            <Card style={[styles.commissionCard, commission.isBlocked && styles.commissionCardBlocked]}>
              <View style={styles.commissionTitleRow}>
                <Ionicons
                  name={commission.isBlocked ? 'lock-closed' : 'information-circle-outline'}
                  size={16}
                  color={commission.isBlocked ? '#B91C1C' : '#B45309'}
                />
                <Text style={[styles.commissionTitle, commission.isBlocked && styles.commissionTitleBlocked]}>
                  {t.earnings.commissionOwed}
                </Text>
              </View>
              <Text style={styles.commissionAmount}>{commission.totalOwed.toFixed(0)} MAD</Text>
              <Text style={styles.commissionNote}>
                {t.earnings.commissionNoteBase}
                {commission.overdueAmount > 0
                  ? t.earnings.commissionOverdue(commission.overdueAmount.toFixed(0))
                  : t.earnings.commissionPaySoon}
                {t.earnings.commissionContact}
              </Text>
            </Card>
          </Reveal>
        )}

        <Text style={styles.sectionTitle}>{t.earnings.history}</Text>
        {summary.entries.length === 0 ? (
          <EmptyState message={t.earnings.emptyNoJobs} icon="cash-outline" />
        ) : (
          summary.entries.map((e, index) => (
            <Reveal key={e.id} delay={Math.min(index, 6) * 40}>
              <Card style={{ marginBottom: spacing.sm }}>
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
            </Reveal>
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
  statCardInner: { alignItems: 'flex-start' },
  statLabel: { ...typography.bodyMuted, marginTop: spacing.xs },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  statValue: { ...typography.h1, fontSize: 22 },
  statValueSuffix: { ...typography.h1, fontSize: 13, color: colors.inkMuted },
  sectionTitle: { ...typography.h2, marginTop: spacing.lg, marginBottom: spacing.sm },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryAmount: { color: colors.primary, fontWeight: '700' },
  commissionCard: { marginTop: spacing.md, backgroundColor: '#FEF3C7' },
  commissionCardBlocked: { backgroundColor: '#FEE2E2' },
  commissionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  commissionTitle: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  commissionTitleBlocked: { color: '#B91C1C' },
  commissionAmount: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 4 },
  commissionNote: { fontSize: 12.5, color: colors.inkMuted, marginTop: 4, lineHeight: 17 },
});
