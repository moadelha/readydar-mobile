import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, PixelRatio, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, LoadingScreen, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { ReviewCard, TrendChip } from '@/components/review-card';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, GuestReview, GuestReviewPropertyOverview, ReviewInsightState, ReviewTranslation, resolveThumbnailUrl } from '@/lib/api';
import { usePlanConsole } from '@/lib/plan-console';
import { useReviewsStrings } from '@/lib/i18n/reviews-strings';
import { useReviewInsightsStrings } from '@/lib/i18n/review-insights-strings';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDay } from '@/lib/dates';
import { scoreStats, subRatings, formatScore, hasText } from '@/lib/review-stats';
import { rtlFlip } from '@/lib/rtl';
import { colors, elevation, radius, spacing, typography } from '@/theme';

const HERO_HEIGHT = 220;
const PRIORITY_COLOR: Record<string, string> = { HIGH: colors.danger, MEDIUM: colors.warning, LOW: colors.surface2 };

/**
 * One property's reviews: the score from the guests' own ratings (split by
 * stars and by category, no AI), the stored AI analysis — the gist, what to
 * fix in order with the reviews behind each point, what guests love — and
 * the reviews themselves, translated on Pro. Pro (and hostel plans) can
 * update the analysis now; Light gets it refreshed at the start of each month.
 */
export default function ReviewPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const r = useReviewsStrings();
  const s = useReviewInsightsStrings();
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { canMessages } = usePlanConsole();
  const token = session?.accessToken;

  const [property, setProperty] = useState<GuestReviewPropertyOverview | null>(null);
  const [reviews, setReviews] = useState<GuestReview[] | null>(null);
  const [state, setState] = useState<ReviewInsightState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  /** Review ids behind one piece of advice, when the host asked to read them. */
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const [shown, setShown] = useState(8);
  const scrollRef = useRef<ScrollView>(null);
  const reviewsY = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  const loadInsight = useCallback(async () => {
    if (!token || !id) return null;
    const st = await api.guestReviews.insight(id, lang, token).catch(() => null);
    if (alive.current) setState(st);
    return st;
  }, [token, id, lang]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [overview, list, st] = await Promise.all([
        api.guestReviews.overview(token, lang),
        api.guestReviews.listAll(token, { propertyId: id, lang }),
        loadInsight(),
      ]);
      setProperty(overview.find((p) => p.id === id) ?? null);
      // The older API ignores propertyId; narrowed here either way.
      const mine = list.filter((x) => x.propertyId === id);
      setReviews(mine);
      setError(null);
      if (st?.running) void poll();

      // Pro: translate what isn't yet (up to 20; stored ones are reused, no AI).
      const onDemand = st ? st.onDemand ?? st.onPlan : false;
      const todo = mine.filter((x) => x.translation == null && hasText(x)).slice(0, 20);
      if (onDemand && todo.length) {
        const done = await api.guestReviews.translate(todo.map((x) => x.id), lang, token).catch(() => null);
        if (alive.current && Array.isArray(done) && done.length) {
          const byId = new Map<string, ReviewTranslation>(done.map((t) => [t.reviewId, t]));
          setReviews((prev) => prev?.map((x) => (byId.has(x.id) ? { ...x, translation: byId.get(x.id) } : x)) ?? prev);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : r.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, lang]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Waits for a background analysis: checks every 4 s, gives up after 3 minutes. */
  async function poll() {
    setAnalysing(true);
    for (let i = 0; i < 45 && alive.current; i++) {
      await new Promise((res) => setTimeout(res, 4000));
      const st = await loadInsight();
      if (st && !st.running) break;
    }
    if (alive.current) setAnalysing(false);
  }

  async function analyse() {
    if (!token || !id || analysing) return;
    setAnalysing(true);
    setError(null);
    try {
      const res = await api.guestReviews.analyse(id, lang, token);
      if (res.status === 'READY') {
        await loadInsight();
        setAnalysing(false);
      } else {
        await poll();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.analysisError);
      setAnalysing(false);
    }
  }

  const stats = useMemo(() => scoreStats(reviews ?? []), [reviews]);
  const categories = useMemo(() => subRatings(reviews ?? []), [reviews]);

  if (!reviews) {
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

  const insight = state?.insight ?? null;
  const onPlan = !!state?.onPlan;
  const onDemand = state ? state.onDemand ?? state.onPlan : false;
  const score = stats.score90 ?? stats.overall;
  const photo = property?.photoUrl ? resolveThumbnailUrl(property.photoUrl, PixelRatio.getPixelSizeForLayoutSize(width)) : null;
  const name = property?.name ?? reviews[0]?.property.name ?? '';

  const focused = focusIds ? reviews.filter((x) => focusIds.includes(x.id)) : reviews;
  const visible = focused.slice(0, shown);

  function readReviews(ids: string[]) {
    setFocusIds(ids);
    setShown(ids.length);
    scrollRef.current?.scrollTo({ y: reviewsY.current - 8, animated: true });
  }

  const updatedLine = insight
    ? [
        s.analysedOn(formatDay(insight.generatedAt, lang, { weekday: false })),
        state?.newReviews ? s.newSince(state.newReviews) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: spacing.xl * 2 + insets.bottom }}>
        <View style={{ height: HERO_HEIGHT + insets.top }}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface2 }]} />
          )}
          <Pressable
            onPress={() => router.back()}
            style={[styles.back, { top: insets.top + spacing.sm }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={r.cancel}
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} style={rtlFlip} />
          </Pressable>
        </View>

        <View style={styles.page}>
          {/* Score: the guests' own ratings, no AI. */}
          <View style={styles.scoreCard}>
            <View>
              <Text style={styles.title}>{name}</Text>
              <Text style={typography.caption}>
                {[property?.city, r.reviewsCount(reviews.length)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.scoreRow}>
              <View style={{ width: 112, gap: 6 }}>
                <Text style={styles.bigScore}>{score !== null ? formatScore(score, lang) : '—'}</Text>
                {stats.trend !== null && Math.abs(stats.trend) >= 0.01 && (
                  <View style={{ alignSelf: 'flex-start' }}>
                    <TrendChip delta={stats.trend} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 5 }} accessible accessibilityLabel={stats.distribution.map((v, i) => `${5 - i}: ${Math.round(v * 100)} %`).join(', ')}>
                {stats.distribution.map((share, i) => (
                  <View key={i} style={styles.distRow}>
                    <Text style={styles.distLabel}>{5 - i}</Text>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.fill,
                          { width: `${Math.round(share * 100)}%`, backgroundColor: i === 0 ? colors.primary : i === 1 ? colors.green500 : i === 2 ? colors.primaryLight : colors.lineStrong },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
            {categories.length > 0 && (
              <View style={styles.catGrid}>
                {categories.map((c) => {
                  const weak = c.score < 4.2;
                  return (
                    <View key={c.key} style={styles.catCell}>
                      <View style={styles.catHead}>
                        <Text style={[styles.catLabel, weak && { color: colors.danger }]}>{s.subRatings[c.key] ?? c.key}</Text>
                        <Text style={[styles.catValue, weak && { color: colors.danger }]}>{formatScore(c.score, lang, 1)}</Text>
                      </View>
                      <View style={[styles.track, { height: 4 }]}>
                        <View style={[styles.fill, { height: 4, width: `${Math.min(100, (c.score / 5) * 100)}%`, backgroundColor: weak ? colors.danger : colors.green500 }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {error && <ErrorBanner message={error} onRetry={load} />}

          {/* The AI analysis, as far as the plan allows. */}
          {!onPlan ? (
            state && (
              <Pressable onPress={() => router.push('/host/plan')} style={styles.planCard} accessibilityRole="button">
                <Ionicons name="sparkles-outline" size={18} color={colors.green500} />
                <Text style={[typography.bodyMuted, { flex: 1 }]}>{s.notOnPlan}</Text>
                <Text style={styles.link}>{s.seePlans}</Text>
              </Pressable>
            )
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.h2Row}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.green500} />
                  <Text style={styles.h2}>{s.inBrief}</Text>
                </View>
                {onDemand && insight && !state?.otherLanguage && (
                  <Pressable onPress={analyse} disabled={analysing} style={styles.smallButton} accessibilityRole="button">
                    {analysing ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="refresh" size={14} color={colors.ink} />}
                    <Text style={styles.smallButtonText}>{analysing ? s.updating : s.update}</Text>
                  </Pressable>
                )}
              </View>
              {insight ? (
                <>
                  <Text style={styles.summary}>{insight.summary}</Text>
                  {!!updatedLine && <Text style={typography.caption}>{updatedLine}</Text>}
                  {state?.otherLanguage && (
                    <Button label={analysing ? s.updating : s.translateAnalysis} onPress={analyse} loading={analysing} variant="outline" style={{ marginTop: spacing.sm }} />
                  )}
                </>
              ) : (state?.reviewsWithText ?? 0) === 0 ? (
                <Text style={typography.bodyMuted}>{s.noWrittenReviews}</Text>
              ) : onDemand ? (
                <Button label={analysing ? s.updating : s.analyse} onPress={analyse} loading={analysing} style={{ marginTop: spacing.xs }} />
              ) : (
                <Text style={typography.bodyMuted}>{s.firstAnalysisLight}</Text>
              )}
            </View>
          )}

          {insight && insight.improvements.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.h2}>{s.toFix}</Text>
              {insight.improvements.map((fix, i) => {
                const quote = insight.complaints.find((c) => c.category === fix.category)?.quote;
                const low = fix.priority === 'LOW';
                return (
                  <View key={`${fix.title}-${i}`} style={styles.fixCard}>
                    <View style={styles.fixHead}>
                      <View style={[styles.rank, { backgroundColor: PRIORITY_COLOR[fix.priority] ?? colors.surface2 }]}>
                        <Text style={[styles.rankText, low && { color: colors.inkMuted }]}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.fixTitle}>{fix.title}</Text>
                        <Text style={typography.caption}>
                          {[s.priority[fix.priority], s.effort[fix.effort], fix.reviews.length ? r.reviewsCount(fix.reviews.length) : null].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.fixBody}>
                      <Text style={styles.fixAction}>{fix.action}</Text>
                      {!!quote && (
                        <View style={styles.quote}>
                          <Text style={styles.quoteMark}>“</Text>
                          <Text style={styles.quoteText}>{quote}</Text>
                        </View>
                      )}
                      {fix.reviews.length > 0 && (
                        <Pressable onPress={() => readReviews(fix.reviews)} hitSlop={6} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
                          <Text style={styles.link}>{`${s.readReviews(fix.reviews.length)} ${lang === 'AR' ? '←' : '→'}`}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {insight && insight.praises.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.h2}>{s.loved}</Text>
              <View style={styles.chips}>
                {insight.praises.map((p, i) => (
                  <Pressable
                    key={`${p.title}-${i}`}
                    onPress={() => p.reviews.length > 0 && readReviews(p.reviews)}
                    style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipText}>{p.title}</Text>
                    {p.mentions > 0 && <Text style={styles.chipCount}>{p.mentions}</Text>}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View
            style={styles.section}
            onLayout={(e) => {
              reviewsY.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.sectionHead}>
              <Text style={styles.h2}>{focusIds ? s.behindAdvice : s.latestReviews}</Text>
              {focusIds && (
                <Pressable
                  onPress={() => {
                    setFocusIds(null);
                    setShown(8);
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>{s.showAll}</Text>
                </Pressable>
              )}
            </View>
            {visible.length === 0 ? (
              <Text style={typography.bodyMuted}>{r.noReviews}</Text>
            ) : (
              visible.map((item) => (
                <ReviewCard
                  key={item.id}
                  review={item}
                  token={token!}
                  showProperty={false}
                  canReply={canMessages && !!item.canReply}
                  canReviewGuest={canMessages && !!item.canReviewGuest}
                  onPatch={(patch) => setReviews((prev) => prev?.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) ?? prev)}
                />
              ))
            )}
            {focused.length > shown && (
              <Pressable onPress={() => setShown((n) => n + 10)} style={{ alignSelf: 'center', paddingVertical: spacing.md }} accessibilityRole="button">
                <Text style={styles.link}>{s.showAll}</Text>
              </Pressable>
            )}
          </View>

          {insight && <Text style={styles.aiNote}>{s.basedOn(insight.reviewCount)}</Text>}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    start: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: { paddingHorizontal: spacing.md },
  scoreCard: {
    marginTop: -48,
    padding: 20,
    gap: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...elevation.high,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3, color: colors.ink },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  bigScore: { fontSize: 44, lineHeight: 48, fontWeight: '600', letterSpacing: -1.2, color: colors.ink, ...typography.number },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distLabel: { width: 10, fontSize: 11, color: colors.inkMuted, ...typography.number },
  track: { flex: 1, height: 6, borderRadius: radius.full, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.full },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 20, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  catCell: { width: '45%', flexGrow: 1, gap: 5 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between' },
  catLabel: { fontSize: 13, color: colors.inkMuted },
  catValue: { fontSize: 13, fontWeight: '600', color: colors.ink, ...typography.number },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 28,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  section: { marginTop: 28, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  h2Row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.ink },
  summary: { fontSize: 16, lineHeight: 25, color: colors.ink },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
  },
  smallButtonText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  link: { fontSize: 13, fontWeight: '500', color: colors.green700 },
  fixCard: { padding: spacing.md, gap: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  fixHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rank: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary },
  fixTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  fixBody: { marginStart: 40, gap: 10 },
  fixAction: { fontSize: 14, lineHeight: 20, color: colors.ink },
  quote: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.sand },
  quoteMark: { fontSize: 22, lineHeight: 22, fontWeight: '600', color: colors.primaryLight },
  quoteText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.successBg,
  },
  chipText: { fontSize: 14, fontWeight: '500', color: colors.green700 },
  chipCount: { fontSize: 12, color: colors.inkMuted, ...typography.number },
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
