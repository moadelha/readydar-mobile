import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Pressable, Alert, RefreshControl, Image } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { Stack, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Card, LoadingScreen, ErrorBanner, EmptyState, Checkbox } from '@/components/ui';
import { Button } from '@/components/Button';
import { ChannelMark } from '@/components/channel-mark';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, GuestReview, GuestReviewPropertyOverview, resolveThumbnailUrl } from '@/lib/api';
import { usePlanConsole } from '@/lib/plan-console';
import { useToast } from '@/lib/toast';
import { useReviewsStrings } from '@/lib/i18n/reviews-strings';
import { providerName } from '@/lib/i18n/messages-strings';
import { colors, radius, spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDay } from '@/lib/dates';

/**
 * Guest reviews for every property, newest first, with a per-property
 * summary to filter by. Every host can read them; Pro hosts (and co-hosts
 * with MESSAGES, the same gate as the inbox) can post the one public reply
 * a channel allows, and on Airbnb review the guest back.
 */
export default function ReviewsScreen() {
  const { session } = useAuth();
  const r = useReviewsStrings();
  const insets = useSafeAreaInsets();
  const { isPro, canMessages } = usePlanConsole();
  const token = session?.accessToken;

  const [overview, setOverview] = useState<GuestReviewPropertyOverview[] | null>(null);
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [o, list] = await Promise.all([api.guestReviews.overview(token), api.guestReviews.listAll(token)]);
      setOverview(o);
      setReviews(list);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : r.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const visible = propertyId ? reviews.filter((x) => x.propertyId === propertyId) : reviews;

  const header = (
    <View>
      <Text style={typography.bodyMuted}>{isPro ? r.subtitle : r.subtitleLight}</Text>
      {error && <ErrorBanner message={error} onRetry={load} />}
      {overview.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyRow}>
          <PropertyChip label={r.allProperties} active={propertyId === null} onPress={() => setPropertyId(null)} />
          {overview.map((p) => (
            <PropertyChip
              key={p.id}
              label={p.name}
              photoUrl={p.photoUrl}
              detail={p.averageRating !== null ? `★ ${p.averageRating.toFixed(1)} · ${r.reviewsCount(p.reviewCount)}` : r.noRating}
              active={propertyId === p.id}
              onPress={() => setPropertyId((prev) => (prev === p.id ? null : p.id))}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: r.title }} />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl * 2 + insets.bottom }]}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState icon="star-outline" message={overview.length === 0 ? r.noProperties : r.noReviews} />
          </View>
        }
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            token={token!}
            canReply={canMessages && !!item.canReply}
            canReviewGuest={canMessages && !!item.canReviewGuest}
            onPatch={(patch) => patchReview(item.id, patch)}
          />
        )}
      />
    </Screen>
  );
}

function PropertyChip({
  label,
  detail,
  photoUrl,
  active,
  onPress,
}: {
  label: string;
  detail?: string;
  photoUrl?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.propertyChip, active && styles.propertyChipActive]}>
      {photoUrl ? <Image source={{ uri: resolveThumbnailUrl(photoUrl, 96) }} style={styles.propertyThumb} /> : null}
      <View style={{ maxWidth: 170 }}>
        <Text style={[styles.propertyName, active && { color: colors.primary }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={typography.caption} numberOfLines={1}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Booking.com reviews carry their own score out of 10 — shown as is rather than squeezed into five stars. */
function scoreOutOf10(review: GuestReview): number | null {
  const d = review.detailedRatings as { scale?: number; overall?: number | null } | null | undefined;
  return d && d.scale === 10 && typeof d.overall === 'number' ? d.overall : null;
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(rating) ? colors.accent : colors.border} />
      ))}
    </View>
  );
}

function ReviewCard({
  review,
  token,
  canReply,
  canReviewGuest,
  onPatch,
}: {
  review: GuestReview;
  token: string;
  canReply: boolean;
  canReviewGuest: boolean;
  onPatch: (patch: Partial<GuestReview>) => void;
}) {
  const r = useReviewsStrings();
  const { lang } = useLanguage();
  const toast = useToast();
  const [isReplying, setIsReplying] = useState(false);
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const score10 = scoreOutOf10(review);
  const channel = providerName(review.platform);

  function postReply() {
    const text = draft.trim();
    if (!text || isPosting) return;
    Alert.alert(r.replyConfirm(channel), undefined, [
      { text: r.cancel, style: 'cancel' },
      {
        text: r.replyPost,
        onPress: async () => {
          setIsPosting(true);
          try {
            const res = await api.guestReviews.reply(review.id, text, token);
            onPatch({ responseText: res.responseText, respondedAt: res.respondedAt, canReply: false });
            setIsReplying(false);
            toast.show(r.replyPosted);
          } catch (err) {
            toast.show(err instanceof ApiError ? err.message : r.replyError, 'error');
          } finally {
            setIsPosting(false);
          }
        },
      },
    ]);
  }

  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={styles.cardHeader}>
        <ChannelMark provider={review.platform} size={32} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={typography.h3} numberOfLines={1}>
            {review.guestName || r.guestFallback}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {review.property.name}
            {review.submittedAt ? ` · ${formatDay(review.submittedAt, lang, { weekday: false })}` : ''}
          </Text>
        </View>
        {score10 !== null && review.platform === 'BOOKING_COM' ? (
          <Text style={styles.score10}>{r.outOf10(score10.toFixed(1))}</Text>
        ) : review.rating !== null && review.rating !== undefined ? (
          <Stars rating={review.rating} />
        ) : (
          <Text style={typography.caption}>{r.noRating}</Text>
        )}
      </View>

      {!review.visible && (
        <View style={styles.hiddenTag}>
          <Ionicons name="eye-off-outline" size={11} color={colors.inkMuted} />
          <Text style={styles.hiddenText}>{r.hidden}</Text>
        </View>
      )}
      {!!review.publicText?.trim() && <Text style={[typography.body, { marginTop: spacing.sm }]}>{review.publicText}</Text>}
      {!!review.privateText?.trim() && (
        <View style={styles.privateBox}>
          <View style={styles.boxLabelRow}>
            <Ionicons name="lock-closed-outline" size={11} color={colors.inkMuted} />
            <Text style={styles.boxLabel}>{r.privateFeedback}</Text>
          </View>
          <Text style={typography.bodyMuted}>{review.privateText}</Text>
        </View>
      )}

      {!!review.responseText && (
        <View style={styles.replyBox}>
          <View style={styles.boxLabelRow}>
            <Ionicons name="chatbubble-outline" size={11} color={colors.primary} />
            <Text style={[styles.boxLabel, { color: colors.primary }]}>{r.hostReply}</Text>
          </View>
          <Text style={typography.bodyMuted}>{review.responseText}</Text>
        </View>
      )}

      {!!review.guestReviewSubmittedAt && (
        <View style={[styles.boxLabelRow, { marginTop: spacing.sm }]}>
          <Ionicons name="person-circle-outline" size={13} color={colors.inkMuted} />
          <Text style={typography.caption}>{r.guestReviewed}</Text>
        </View>
      )}

      {canReviewGuest && (
        <GuestReviewForm review={review} token={token} onDone={(at) => onPatch({ canReviewGuest: false, guestReviewSubmittedAt: at })} />
      )}

      {canReply && !review.responseText && (
        isReplying ? (
          <View style={{ marginTop: spacing.sm }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={r.replyPlaceholder}
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={2000}
              autoFocus
              style={styles.textArea}
              textAlignVertical="top"
            />
            <View style={styles.formActions}>
              <Button label={r.cancel} onPress={() => setIsReplying(false)} variant="outline" style={{ flex: 1 }} />
              <Button label={r.replyPost} onPress={postReply} loading={isPosting} disabled={!draft.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setIsReplying(true)} style={({ pressed }) => [styles.pillButton, pressed && { opacity: 0.6 }]}>
            <Ionicons name="chatbubble-outline" size={13} color={colors.primary} />
            <Text style={styles.pillText}>{r.replyButton}</Text>
          </Pressable>
        )
      )}
    </Card>
  );
}

/** Airbnb: the host's review of the guest — three 1–5 scores, a public review, an optional private note. */
function GuestReviewForm({ review, token, onDone }: { review: GuestReview; token: string; onDone: (at: string) => void }) {
  const r = useReviewsStrings();
  const w = r.guestReview;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState({ cleanliness: 5, communication: 5, houseRules: 5 });
  const [publicReview, setPublicReview] = useState('');
  const [privateReview, setPrivateReview] = useState('');
  const [recommend, setRecommend] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  function submit() {
    if (!publicReview.trim() || isPosting) return;
    Alert.alert(w.confirm(review.guestName || r.guestFallback), undefined, [
      { text: r.cancel, style: 'cancel' },
      {
        text: w.submit,
        onPress: async () => {
          setIsPosting(true);
          try {
            const res = await api.guestReviews.reviewGuest(
              review.id,
              { ...scores, publicReview: publicReview.trim(), privateReview: privateReview.trim() || undefined, recommend },
              token,
            );
            toast.show(w.done);
            onDone(res.guestReviewSubmittedAt);
          } catch (err) {
            toast.show(err instanceof ApiError ? err.message : w.error, 'error');
          } finally {
            setIsPosting(false);
          }
        },
      },
    ]);
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.pillButton, pressed && { opacity: 0.6 }]}>
        <Ionicons name="person-outline" size={13} color={colors.primary} />
        <Text style={styles.pillText}>{w.button}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.guestForm}>
      <Text style={typography.caption}>{w.intro}</Text>
      {(['cleanliness', 'communication', 'houseRules'] as const).map((key) => (
        <View key={key} style={styles.scoreRow}>
          <Text style={[typography.body, { flex: 1 }]}>{w.categories[key]}</Text>
          <View style={{ flexDirection: 'row' }} accessibilityRole="radiogroup" accessibilityLabel={w.categories[key]}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setScores((s) => ({ ...s, [key]: n }))}
                hitSlop={4}
                style={{ padding: 3 }}
                accessibilityRole="radio"
                accessibilityState={{ checked: scores[key] === n }}
                accessibilityLabel={String(n)}
              >
                <Ionicons name={n <= scores[key] ? 'star' : 'star-outline'} size={24} color={n <= scores[key] ? colors.accent : colors.inkFaint} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <TextInput
        value={publicReview}
        onChangeText={setPublicReview}
        placeholder={w.publicPlaceholder}
        placeholderTextColor={colors.inkFaint}
        multiline
        maxLength={2000}
        style={styles.textArea}
        textAlignVertical="top"
      />
      <TextInput
        value={privateReview}
        onChangeText={setPrivateReview}
        placeholder={w.privatePlaceholder}
        placeholderTextColor={colors.inkFaint}
        multiline
        maxLength={2000}
        style={[styles.textArea, { minHeight: 70 }]}
        textAlignVertical="top"
      />
      <Pressable onPress={() => setRecommend((v) => !v)} style={styles.recommendRow}>
        <Checkbox checked={recommend} onChange={setRecommend} />
        <Text style={[typography.body, { flex: 1 }]}>{w.recommend}</Text>
      </Pressable>
      <View style={styles.formActions}>
        <Button label={r.cancel} onPress={() => setOpen(false)} variant="outline" style={{ flex: 1 }} />
        <Button label={w.submit} onPress={submit} loading={isPosting} disabled={!publicReview.trim()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  propertyRow: { gap: spacing.sm, paddingVertical: spacing.md },
  propertyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  propertyChipActive: { borderColor: colors.primary, backgroundColor: colors.successBg },
  propertyThumb: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.border },
  propertyName: { fontSize: 13, fontWeight: '600', color: colors.ink },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  score10: {
    backgroundColor: colors.channel.booking,
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  hiddenTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  hiddenText: { fontSize: 11, color: colors.inkMuted },
  privateBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    gap: 4,
  },
  replyBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.successBg, gap: 4 },
  boxLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  boxLabel: { fontSize: 11, fontWeight: '700', color: colors.inkMuted },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryLight,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  textArea: {
    minHeight: 96,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.sand,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  guestForm: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    gap: 4,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  recommendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
