import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, LoadingScreen, ErrorBanner, StatusBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, Entitlements, PlanFeature, WEB_URL } from '@/lib/api';
import { usePlanStrings } from '@/lib/i18n/plan-strings';

/**
 * Plans v2 — read-only view of the host's plan, usage and features. No
 * purchases in the app (store policy): every change happens on the website,
 * which this screen links to.
 */

/** Features not built yet — shown as "Coming soon" when the plan includes them. */
const NOT_BUILT: PlanFeature[] = ['aiReplies', 'aiReviewAnalysis', 'dynamicPricing', 'ownerPortal'];
/** Need Channex in production — "Coming soon" until the app is built with EXPO_PUBLIC_CHANNEX_ENABLED=true. */
const CHANNEX_LIVE = process.env.EXPO_PUBLIC_CHANNEX_ENABLED === 'true';
const NEEDS_CHANNEX: PlanFeature[] = ['inbox', 'priceEditor'];
const FEATURE_ORDER: PlanFeature[] = ['cleaningReports', 'ttlock', 'inbox', 'priceEditor', 'aiReviewAnalysis', 'aiReplies', 'dynamicPricing', 'ownerPortal'];

export default function PlanScreen() {
  const { session } = useAuth();
  const s = usePlanStrings();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setEnt(await api.billing.getEntitlements(session.accessToken));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openBilling = () => Linking.openURL(`${WEB_URL}/host/billing`);

  if (!ent && !error) return <LoadingScreen />;

  const features = ent?.features;
  const limit = ent?.propertyLimit ?? ent?.maxProperties ?? null;
  const used = ent?.propertiesUsed ?? 0;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: s.title }} />
      <ScrollView contentContainerStyle={styles.container}>
        {error && <ErrorBanner message={error} onRetry={load} />}
        {ent && (
          <>
            <Card>
              <Text style={styles.line}>{ent.line === 'PRO' ? s.pro : s.light}</Text>
              <Text style={typography.h1}>{ent.planName ?? s.freePlan}</Text>
              {ent.isTrial && ent.trialEndsAt ? (
                <Text style={typography.bodyMuted}>{s.trialUntil(new Date(ent.trialEndsAt).toLocaleDateString())}</Text>
              ) : ent.planCode === 'FREE' ? (
                <Text style={typography.bodyMuted}>{s.freePlan}</Text>
              ) : null}

              <Usage label={s.properties} used={used} limit={limit} s={s} />
              {!!ent.extraProperties && <Text style={[typography.bodyMuted, { marginTop: 4 }]}>{s.extraProperties(ent.extraProperties)}</Text>}
              <Usage label={s.team} used={ent.teamMembersUsed ?? 0} limit={ent.maxTeamMembers ?? null} s={s} />
            </Card>

            {features && (
              <Card style={{ marginTop: spacing.md }}>
                <Text style={typography.h3}>{s.included}</Text>
                {FEATURE_ORDER.map((key) => {
                  const on = features[key];
                  const soon = on && (NOT_BUILT.includes(key) || (NEEDS_CHANNEX.includes(key) && !CHANNEX_LIVE));
                  return (
                    <View key={key} style={styles.featureRow}>
                      <Ionicons name={on ? 'checkmark-circle' : 'remove-circle-outline'} size={18} color={on ? colors.primary : colors.inkFaint} />
                      <Text style={[typography.body, { flex: 1, color: on ? colors.ink : colors.inkFaint }]}>{s.features[key as keyof typeof s.features]}</Text>
                      {soon && <StatusBadge label={s.comingSoon} tone="accent" />}
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}

        <Pressable onPress={openBilling} style={styles.button} accessibilityRole="link">
          <Ionicons name="open-outline" size={16} color={colors.white} />
          <Text style={styles.buttonText}>{s.manageOnWeb}</Text>
        </Pressable>
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm, textAlign: 'center' }]}>{s.webNote}</Text>
      </ScrollView>
    </Screen>
  );
}

function Usage({ label, used, limit, s }: { label: string; used: number; limit: number | null; s: ReturnType<typeof usePlanStrings> }) {
  const pct = limit ? Math.min(100, Math.round((used / Math.max(1, limit)) * 100)) : 0;
  const full = limit != null && used >= limit;
  return (
    <View style={{ marginTop: spacing.md }}>
      <View style={styles.usageHeader}>
        <Text style={typography.bodyMuted}>{label}</Text>
        <Text style={[typography.body, full && { color: colors.danger }]}>{limit == null ? s.usedUnlimited(used) : s.usedOf(used, limit)}</Text>
      </View>
      {limit != null && (
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: full ? colors.accent : colors.primary }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  line: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.5, marginBottom: 2 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  button: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
  },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
});
