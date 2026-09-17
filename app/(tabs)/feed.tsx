import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, LayoutAnimation } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, JobFeedItem, CommissionStatus } from '@/lib/api';
import { Screen, Card, EmptyState, TextField, ErrorBanner, Reveal, AnimatedPressable, SkeletonListItem } from '@/components/ui';
import { Button } from '@/components/Button';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, spacing, typography, radius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

/** Smoothly animates the height/opacity change of the inline offer form
 * opening or closing, instead of it instantly popping in/out — built on
 * React Native's own `LayoutAnimation`, no extra dependency. */
function animateNextLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}

export default function JobFeedScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerOpenId, setOfferOpenId] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [commissionStatus, setCommissionStatus] = useState<CommissionStatus | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [list, commission] = await Promise.all([
      api.cleaners.getJobFeed(session.accessToken),
      api.cleaners.getCommission(session.accessToken).catch(() => null),
    ]);
    setJobs(list);
    setCommissionStatus(commission);
    setIsLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleAccept(bookingId: string, proposedPrice?: number) {
    if (!session) return;
    setError(null);
    setAcceptingId(bookingId);
    try {
      await api.jobActions.accept(bookingId, session.accessToken, proposedPrice);
      router.push(`/job/${bookingId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.jobFeed.acceptError);
      load();
    } finally {
      setAcceptingId(null);
      animateNextLayout();
      setOfferOpenId(null);
      setOfferPrice('');
    }
  }

  const isBlocked = !!commissionStatus?.isBlocked;

  return (
    <Screen>
      <Reveal>
        <View style={styles.header}>
          <Text style={typography.h1}>{t.jobFeed.title}</Text>
          <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{t.jobFeed.subtitle}</Text>
        </View>
      </Reveal>

      {isBlocked && (
        <Reveal delay={40}>
          <View style={styles.blockedBox}>
            <View style={styles.blockedTitleRow}>
              <Ionicons name="lock-closed" size={15} color="#B91C1C" />
              <Text style={styles.blockedTitle}>{t.jobFeed.accountOnHold}</Text>
            </View>
            <Text style={styles.blockedText}>
              {t.jobFeed.overdueMessage((commissionStatus?.overdueAmount ?? 0).toFixed(0))}
            </Text>
          </View>
        </Reveal>
      )}

      {error && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ErrorBanner message={error} />
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
          ListEmptyComponent={<EmptyState message={t.jobFeed.emptyMessage} icon="list-outline" />}
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 6) * 40}>
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={typography.h3}>{item.service.name}</Text>
                      {item.urgency === 'URGENT' && (
                        <View style={styles.urgentBadge}>
                          <Ionicons name="flash" size={11} color="#B45309" />
                          <Text style={styles.urgentText}>{t.jobFeed.urgent}</Text>
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
                    <Text style={styles.address} numberOfLines={2}>
                      {item.property.addressLine}
                    </Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={13} color={colors.inkFaint} />
                      <Text style={typography.caption}>
                        {new Date(item.scheduledDate).toLocaleDateString()} at {item.scheduledTime}
                      </Text>
                    </View>
                    {item.budget && <Text style={styles.budget}>{item.budget} {t.jobFeed.budgetSuffix}</Text>}
                  </View>
                </View>

                {offerOpenId === item.id ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <TextField
                      label={t.jobFeed.yourPrice}
                      value={offerPrice}
                      onChangeText={setOfferPrice}
                      keyboardType="number-pad"
                      placeholder={item.budget ? String(item.budget) : t.jobFeed.offerPlaceholder}
                    />
                    <View style={styles.buttonRow}>
                      <Button
                        label={acceptingId === item.id ? t.jobFeed.sending : t.jobFeed.sendOffer}
                        onPress={() => handleAccept(item.id, offerPrice ? Number(offerPrice) : undefined)}
                        loading={acceptingId === item.id}
                        disabled={isBlocked}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={t.common.cancel}
                        variant="outline"
                        onPress={() => {
                          animateNextLayout();
                          setOfferOpenId(null);
                          setOfferPrice('');
                        }}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                    <Button
                      label={acceptingId === item.id ? t.jobFeed.accepting : t.jobFeed.accept}
                      onPress={() => handleAccept(item.id)}
                      loading={acceptingId === item.id}
                      disabled={isBlocked}
                    />
                    <AnimatedPressable
                      onPress={() => {
                        if (isBlocked) return;
                        animateNextLayout();
                        setOfferOpenId(item.id);
                        setOfferPrice('');
                      }}
                      scaleTo={0.95}
                      style={styles.offerLink}
                      disabled={isBlocked}
                    >
                      <Text style={[styles.offerLinkText, isBlocked && styles.offerLinkTextDisabled]}>
                        {t.jobFeed.offerDifferentPrice}
                      </Text>
                    </AnimatedPressable>
                  </View>
                )}
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
  row: { flexDirection: 'row' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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
  address: { fontSize: 12, color: colors.inkFaint, marginTop: 2, marginLeft: 18 },
  budget: { marginTop: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: 13 },
  offerLink: { alignSelf: 'center', paddingVertical: spacing.xs },
  offerLinkText: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  offerLinkTextDisabled: { color: colors.inkFaint },
  blockedBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  blockedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  blockedTitle: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  blockedText: { color: '#B91C1C', fontSize: 12.5, lineHeight: 17 },
});
