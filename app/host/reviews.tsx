import { useCallback, useMemo, useRef, useState, type ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Image, PixelRatio, useWindowDimensions } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, LoadingScreen, ErrorBanner, EmptyState } from '@/components/ui';
import { ReviewCard, TrendChip, TrendText } from '@/components/review-card';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, GuestReview, GuestReviewPropertyOverview, ReviewAiAvailability, resolveThumbnailUrl } from '@/lib/api';
import { usePlanConsole } from '@/lib/plan-console';
import { useHostAccess } from '@/lib/access';
import { useReviewsStrings } from '@/lib/i18n/reviews-strings';
import { useReviewInsightsStrings } from '@/lib/i18n/review-insights-strings';
import { useRedesignStrings } from '@/lib/i18n/redesign-strings';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDay } from '@/lib/dates';
import { scoreStats, overallStats, propertyStats, formatScore, REVIEWS_LISTED, ScoreStats } from '@/lib/review-stats';
import { rtlFlip } from '@/lib/rtl';
import { colors, radius, spacing, typography } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** The short version of a property's stored AI analysis, whichever API gave it. */
interface PropertyInsight {
  generatedAt: string;
  newSince: number;
  complaints: { title: string; category: string; mentions: number }[];
  fixes: { title: string; action: string; category: string }[];
  keep: { title: string; mentions: number } | null;
}

const CATEGORY_ICON: Record<string, IconName> = {
  NOISE: 'volume-high-outline',
  CLEANLINESS: 'sparkles-outline',
  CHECK_IN: 'key-outline',
  COMMUNICATION: 'chatbubbles-outline',
  LOCATION: 'location-outline',
  COMFORT: 'bed-outline',
  AMENITIES: 'construct-outline',
  VALUE: 'pricetag-outline',
  STAFF: 'people-outline',
  FOOD: 'restaurant-outline',
  SAFETY: 'shield-checkmark-outline',
};

/**
 * Reviews, at a glance: the score over three months (from the guests' own
 * ratings, no AI), what guests complain about most across every property
 * (added up from the stored AI analyses — no extra AI call), one card per
 * property with the first thing to fix, and the latest reviews to answer.
 * Each property opens its full analysis (review-property/[id]).
 */
export default function ReviewsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const r = useReviewsStrings();
  const s = useReviewInsightsStrings();
  const rds = useRedesignStrings().reviews;
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isPro } = usePlanConsole();
  const { has } = useHostAccess();
  // What the API checks: replying is Pro and needs the Reviews permission.
  const mayReply = isPro && has('REVIEWS');
  const token = session?.accessToken;

  const [overview, setOverview] = useState<GuestReviewPropertyOverview[] | null>(null);
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [ai, setAi] = useState<ReviewAiAvailability | null>(null);
  const [insights, setInsights] = useState<Record<string, PropertyInsight>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'toAnswer'>('all');
  const [shown, setShown] = useState(10);
  const scrollRef = useRef<ScrollView>(null);
  const latestY = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [o, list, availability] = await Promise.all([
        api.guestReviews.overview(token, lang),
        api.guestReviews.listAll(token, { lang }),
        // Needs the Reviews permission; a co-host without it still reads reviews.
        api.guestReviews.aiStatus(token).catch(() => null),
      ]);
      setOverview(o);
      setReviews(list);
      setAi(availability);
      setError(null);

      // The newer API puts each property's analysis in the overview; with the
      // older one, read the stored analyses (never runs the AI).
      const next: Record<string, PropertyInsight> = {};
      const withReviews = o.filter((p) => p.reviewCount > 0);
      if (withReviews.some((p) => p.insight !== undefined)) {
        for (const p of withReviews) {
          if (!p.insight) continue;
          next[p.id] = {
            generatedAt: p.insight.generatedAt,
            newSince: p.insight.newSince,
            complaints: p.insight.complaints,
            fixes: p.insight.fix ? [p.insight.fix] : [],
            keep: p.insight.keep,
          };
        }
      } else if (availability?.onPlan) {
        const states = await Promise.all(
          withReviews.slice(0, 30).map((p) => api.guestReviews.insight(p.id, lang, token).then((st) => [p.id, st] as const).catch(() => null)),
        );
        for (const entry of states) {
          if (!entry || !entry[1].insight) continue;
          const [id, st] = entry;
          const i = st.insight!;
          next[id] = {
            generatedAt: i.generatedAt,
            newSince: st.newReviews ?? 0,
            complaints: i.complaints.map((c) => ({ title: c.title, category: c.category, mentions: c.mentions })),
            fixes: i.improvements.map((f) => ({ title: f.title, action: f.action, category: f.category })),
            keep: i.praises[0] ? { title: i.praises[0].title, mentions: i.praises[0].mentions } : null,
          };
        }
      }
      setInsights(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : r.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, lang]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function patchReview(id: string, patch: Partial<GuestReview>) {
    setReviews((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  const all = useMemo(() => overallStats(scoreStats(reviews), overview ?? [], reviews.length), [reviews, overview]);
  const perProperty = useMemo(() => {
    const map: Record<string, ScoreStats> = {};
    for (const p of overview ?? []) map[p.id] = propertyStats(scoreStats(reviews.filter((x) => x.propertyId === p.id)), p);
    return map;
  }, [overview, reviews]);

  /** The complaints added up across properties by category, most mentioned first. */
  const topIssues = useMemo(() => {
    const byCategory = new Map<string, { title: string; best: number; mentions: number; properties: string[]; fix: string | null }>();
    for (const p of overview ?? []) {
      const i = insights[p.id];
      if (!i) continue;
      for (const c of i.complaints) {
        const e = byCategory.get(c.category) ?? { title: c.title, best: 0, mentions: 0, properties: [], fix: null };
        e.mentions += c.mentions;
        e.properties.push(p.name);
        if (c.mentions > e.best) {
          e.best = c.mentions;
          e.title = c.title;
          const fix = i.fixes.find((f) => f.category === c.category);
          if (fix) e.fix = fix.action || fix.title;
        }
        byCategory.set(c.category, e);
      }
    }
    return [...byCategory.entries()]
      .map(([category, e]) => ({ category, ...e }))
      .filter((e) => e.mentions > 0)
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 3);
  }, [overview, insights]);

  if (!overview) {
    if (error) {
      return (
        <Screen>
          <Stack.Screen options={{ headerShown: true, title: r.title }} />
          <View style={{ padding: spacing.lg }}>
            <ErrorBanner message={error} onRetry={load} />
          </View>
        </Screen>
      );
    }
    return <LoadingScreen />;
  }

  const reviewed = overview.filter((p) => p.reviewCount > 0);
  const slippingCount = reviewed.filter((p) => (perProperty[p.id]?.trend ?? 0) < -0.05).length;
  // Counted only for someone who can answer them: the band led to reviews with no Reply button.
  const unanswered = mayReply ? reviews.filter((x) => x.canReply && !x.responseText) : [];
  const unansweredCount = mayReply && reviews.length >= REVIEWS_LISTED ? Math.max(unanswered.length, reviewed.reduce((n, p) => n + (p.unanswered ?? 0), 0)) : unanswered.length;

  const sorted = [...reviewed].sort((a, b) => (perProperty[a.id]?.trend ?? 9) - (perProperty[b.id]?.trend ?? 9));

  // The analysis date line: the newest analysis, and on Light the next monthly run.
  const latestAnalysis = Object.values(insights).reduce<string | null>((acc, i) => (!acc || i.generatedAt > acc ? i.generatedAt : acc), null);
  const onDemand = ai ? ai.onDemand ?? ai.onPlan : false;
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  const updatedLine = !ai?.onPlan
    ? null
    : latestAnalysis
      ? onDemand
        ? s.analysedOn(formatDay(latestAnalysis, lang, { weekday: false }))
        : `${s.analysedOn(formatDay(latestAnalysis, lang, { weekday: false }))} · ${s.nextOn(formatDay(nextMonth.toISOString(), lang, { weekday: false }))}`
      : null;

  const visibleReviews = (filter === 'toAnswer' ? unanswered : reviews).slice(0, shown);
  const heroWidth = width - spacing.lg * 2;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: r.title }} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl * 2 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {!!updatedLine && <Text style={styles.updatedLine}>{updatedLine}</Text>}
        {error && <ErrorBanner message={error} onRetry={load} />}

        {reviewed.length === 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState icon="star-outline" message={overview.length === 0 ? r.noProperties : r.noReviews} />
          </View>
        ) : (
          <>
            {/* Score: the guests' own ratings, no AI. */}
            <View style={styles.scoreCard}>
              <View style={styles.scoreTop}>
                <View style={{ gap: 6, flex: 1 }}>
                  <Text style={typography.label}>{s.scoreTitle}</Text>
                  <View style={styles.scoreRow}>
                    <Text style={styles.bigScore}>{all.score90 !== null ? formatScore(all.score90, lang) : all.overall !== null ? formatScore(all.overall, lang) : '—'}</Text>
                    {all.trend !== null && Math.abs(all.trend) >= 0.01 && <TrendChip delta={all.trend} />}
                  </View>
                </View>
                <MonthBars values={all.monthly} />
              </View>
              <View style={styles.statRow}>
                <Stat value={String(all.reviews30)} label={s.thisMonth} />
                <Stat value={all.fiveStarShare !== null ? `${Math.round(all.fiveStarShare * 100)} %` : '—'} label={s.fiveStar} divider />
                <Stat value={String(slippingCount)} label={s.slipping} divider danger={slippingCount > 0} />
              </View>
              {unanswered.length > 0 && (
                <Pressable
                  onPress={() => {
                    setFilter('toAnswer');
                    setShown(10);
                    scrollRef.current?.scrollTo({ y: latestY.current - 8, animated: true });
                  }}
                  style={({ pressed }) => [styles.replyBand, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                >
                  <View style={styles.replyIcon}>
                    <Ionicons name="chatbubble-outline" size={15} color={colors.onPrimary} />
                  </View>
                  <Text style={styles.replyText}>{s.awaitingReply(unansweredCount)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.green700} style={rtlFlip} />
                </Pressable>
              )}
            </View>

            {/* Plan: AI advice is on the paid plans. */}
            {ai && !ai.onPlan && (
              <Pressable onPress={() => router.push('/host/plan')} style={styles.planCard} accessibilityRole="button">
                <Ionicons name="sparkles-outline" size={18} color={colors.green500} />
                <Text style={[typography.bodyMuted, { flex: 1 }]}>{s.notOnPlan}</Text>
                <Text style={styles.link}>{s.seePlans}</Text>
              </Pressable>
            )}

            {topIssues.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.h2}>{s.topIssues}</Text>
                <Text style={styles.sub}>{s.topIssuesSub}</Text>
                <View style={[styles.listCard, { marginTop: spacing.md }]}>
                  {topIssues.map((issue, i) => (
                    <View key={issue.category} style={[styles.issueRow, i > 0 && styles.divider]}>
                      <Text style={styles.issueTitle}>{issue.title}</Text>
                      <Text style={typography.caption} numberOfLines={1}>
                        {s.issueMeta(issue.mentions, [...new Set(issue.properties)].join(', '))}
                      </Text>
                      {!!issue.fix && <Text style={styles.issueFixText}>{`${lang === 'AR' ? '←' : '→'} ${issue.fix}`}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.h2}>{s.byProperty}</Text>
              <Text style={styles.sub}>{rds.byPropertySub}</Text>
              <View style={[styles.listCard, { marginTop: spacing.md }]}>
                {sorted.map((p, index) => {
                  const st = perProperty[p.id];
                  const i = insights[p.id];
                  const score = st?.score90 ?? st?.overall ?? p.averageRating;
                  const meta = [r.reviewsCount(p.reviewCount), i?.newSince ? s.newReviews(i.newSince) : null].filter(Boolean).join(' · ');
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => router.push(`/host/review-property/${p.id}`)}
                      style={({ pressed }) => [styles.propRow, index > 0 && styles.divider, pressed && { backgroundColor: colors.surface2 }]}
                      accessibilityRole="button"
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{p.name}</Text>
                        <Text style={typography.caption} numberOfLines={1}>{meta}</Text>
                        {i?.fixes[0] ? (
                          <Text style={styles.propFix} numberOfLines={2}>{`${s.first} · ${i.fixes[0].action || i.fixes[0].title}`}</Text>
                        ) : null}
                      </View>
                      {score !== null && score !== undefined && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.rowScore}>{formatScore(score, lang)}</Text>
                          {st?.trend !== null && st?.trend !== undefined && Math.abs(st.trend) >= 0.01 ? <TrendText delta={st.trend} /> : null}
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} style={rtlFlip} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View
              style={styles.section}
              onLayout={(e) => {
                latestY.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.h2}>{s.latestReviews}</Text>
              <View style={styles.sortRow}>
                {(
                  [
                    ['all', s.all],
                    ...(mayReply ? [['toAnswer', `${s.toAnswer}${unanswered.length ? ` · ${unanswered.length}` : ''}`]] : []),
                  ] as ['all' | 'toAnswer', string][]
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setFilter(key);
                      setShown(10);
                    }}
                    style={[styles.sortChip, filter === key && styles.sortChipActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: filter === key }}
                  >
                    <Text style={[styles.sortText, filter === key && styles.sortTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {visibleReviews.length === 0 ? (
                <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>{r.noReviews}</Text>
              ) : (
                visibleReviews.map((item) => (
                  <ReviewCard
                    key={item.id}
                    review={item}
                    token={token!}
                    canReply={mayReply && !!item.canReply}
                    canReviewGuest={mayReply && !!item.canReviewGuest}
                    onPatch={(patch) => patchReview(item.id, patch)}
                  />
                ))
              )}
              {(filter === 'toAnswer' ? unanswered : reviews).length > shown && (
                <Pressable onPress={() => setShown((n) => n + 10)} style={styles.more} accessibilityRole="button">
                  <Text style={styles.link}>{s.showAll}</Text>
                </Pressable>
              )}
            </View>

            {ai?.onPlan && <Text style={styles.aiNote}>{s.aiNote}</Text>}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label, divider, danger }: { value: string; label: string; divider?: boolean; danger?: boolean }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={[styles.statValue, danger && { color: colors.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Six small columns, one per month: the average score's shape at a glance. */
function MonthBars({ values }: { values: (number | null)[] }) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const min = Math.min(...known, 4) - 0.2;
  const max = 5;
  return (
    <View style={styles.bars} accessible accessibilityLabel={known.map((v) => v.toFixed(2)).join(', ')}>
      {values.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: v === null ? 3 : Math.max(4, ((v - min) / (max - min)) * 44),
              backgroundColor: v === null ? colors.border : i === values.length - 1 ? colors.primary : colors.green100,
            },
          ]}
        />
      ))}
    </View>
  );
}

function Advice({ tag, text, tone }: { tag: string; text: string; tone: 'fix' | 'keep' }) {
  return (
    <View style={styles.adviceRow}>
      <Text style={[styles.adviceTag, tone === 'fix' ? styles.adviceFix : styles.adviceKeep]}>{tag}</Text>
      <Text style={[typography.body, { flex: 1, fontSize: 14, lineHeight: 20 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.md },
  updatedLine: { ...typography.bodyMuted, fontSize: 13, marginBottom: spacing.md },
  scoreCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  scoreTop: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, padding: 20, paddingBottom: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // The screen's one saffron (DESIGN.md: at most once).
  bigScore: { fontSize: 44, lineHeight: 50, fontWeight: '600', letterSpacing: -1.2, color: colors.saffronText, ...typography.number },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 48 },
  bar: { width: 10, borderRadius: 3 },
  statRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: colors.ink, ...typography.number },
  statLabel: { fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  replyBand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: colors.successBg },
  replyIcon: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  replyText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.ink },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  link: { fontSize: 14, fontWeight: '500', color: colors.green700 },
  section: { marginTop: 28 },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.ink },
  sub: { ...typography.bodyMuted, fontSize: 13, marginTop: 2 },
  listCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  issueRow: { padding: 14, gap: 3 },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 14 },
  propFix: { fontSize: 13, lineHeight: 18, color: colors.green700, marginTop: 2 },
  issueHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  issueIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  issueIconRed: { backgroundColor: colors.dangerBg },
  issueIconAmber: { backgroundColor: colors.warningBg },
  issueTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  issueFix: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  issueFixText: { fontSize: 13, lineHeight: 18, color: colors.green700, marginTop: 4 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 12, marginBottom: 4 },
  sortChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  sortTextActive: { color: colors.onPrimary },
  bigCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  bigPhoto: { width: '100%', height: 132 },
  photoScore: {
    position: 'absolute',
    start: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  photoScoreText: { fontSize: 18, fontWeight: '600', color: colors.ink, ...typography.number },
  photoNew: { position: 'absolute', end: 12, top: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.white },
  photoNewText: { fontSize: 12, fontWeight: '500', color: colors.green700 },
  bigTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  bigTitle: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '600', color: colors.ink },
  adviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  adviceTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 1,
  },
  adviceFix: { color: colors.saffronText, backgroundColor: colors.accentBg },
  adviceKeep: { color: colors.green700, backgroundColor: colors.successBg },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm,
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  rowPhoto: { width: 56, height: 56, borderRadius: radius.md },
  rowTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  rowScore: { fontSize: 14, fontWeight: '600', color: colors.ink, ...typography.number },
  more: { alignSelf: 'center', paddingVertical: spacing.md },
  aiNote: {
    marginTop: 28,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
  },
});
