import { useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, TextInput } from '@/components/text';
import { Card, Checkbox } from '@/components/ui';
import { Button } from '@/components/Button';
import { ApiError } from '@/lib/auth-context';
import { api, GuestReview } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useReviewsStrings } from '@/lib/i18n/reviews-strings';
import { useReviewInsightsStrings } from '@/lib/i18n/review-insights-strings';
import { providerName } from '@/lib/i18n/messages-strings';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDay } from '@/lib/dates';
import { formatScore } from '@/lib/review-stats';
import { colors, radius, spacing, typography } from '@/theme';

/** Booking.com reviews carry their own score out of 10 — shown as is rather than squeezed into five stars. */
function scoreOutOf10(review: GuestReview): number | null {
  const d = review.detailedRatings as { scale?: number; overall?: number | null } | null | undefined;
  return d && d.scale === 10 && typeof d.overall === 'number' ? d.overall : null;
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const s = useReviewInsightsStrings();
  const n = Math.round(rating);
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessible accessibilityLabel={s.starsAria(n)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={size} color={i <= n ? colors.ink : colors.border} />
      ))}
    </View>
  );
}

/** The score's change over three months, as a small tinted tag. */
export function TrendChip({ delta }: { delta: number }) {
  const s = useReviewInsightsStrings();
  const { lang } = useLanguage();
  const up = delta >= 0;
  return (
    <View style={[chipStyles.trendChip, { backgroundColor: up ? colors.successBg : colors.dangerBg }]}>
      <Text style={[chipStyles.trendChipText, { color: up ? colors.success : colors.danger }]}>
        {(up ? s.trendUp : s.trendDown)(formatScore(Math.abs(delta), lang))}
      </Text>
    </View>
  );
}

export function TrendText({ delta }: { delta: number }) {
  const s = useReviewInsightsStrings();
  const { lang } = useLanguage();
  const up = delta >= 0;
  return (
    <Text style={{ fontSize: 12, fontWeight: '600', color: up ? colors.success : colors.danger }}>
      {(up ? s.trendUp : s.trendDown)(formatScore(Math.abs(delta), lang))}
    </Text>
  );
}

const chipStyles = StyleSheet.create({
  trendChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm },
  trendChipText: { fontSize: 13, fontWeight: '600', ...typography.number },
});

/** The guest's initial in a soft circle — warmer than a channel logo at the head of a review. */
function Initial({ name }: { name: string }) {
  return (
    <View style={styles.initial}>
      <Text style={styles.initialText}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

/**
 * One guest review: who, when, the score, what they wrote (translated by AI
 * when a translation is stored, with the original a tap away), the host's
 * reply, and the actions the channel allows — the one public reply and, on
 * Airbnb, reviewing the guest back.
 */
export function ReviewCard({
  review,
  token,
  canReply,
  canReviewGuest,
  onPatch,
  showProperty = true,
}: {
  review: GuestReview;
  token: string;
  canReply: boolean;
  canReviewGuest: boolean;
  onPatch: (patch: Partial<GuestReview>) => void;
  showProperty?: boolean;
}) {
  const r = useReviewsStrings();
  const s = useReviewInsightsStrings();
  const { lang } = useLanguage();
  const toast = useToast();
  const [isReplying, setIsReplying] = useState(false);
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const score10 = scoreOutOf10(review);
  const channel = providerName(review.platform);
  const name = review.guestName || r.guestFallback;

  const tr = review.translation && !review.translation.sameLanguage ? review.translation : null;
  const translated = !!tr && !showOriginal;
  const publicText = translated ? tr!.publicText || review.publicText : review.publicText;
  const privateText = translated ? tr!.privateText || review.privateText : review.privateText;
  const responseText = translated ? tr!.responseText || review.responseText : review.responseText;

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
    <Card style={styles.card}>
      <View style={styles.header}>
        <Initial name={name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.channelDot, { backgroundColor: review.platform === 'BOOKING_COM' ? colors.channel.booking : colors.channel.airbnb }]} />
            <Text style={typography.caption} numberOfLines={1}>
              {[channel, showProperty ? review.property.name : null, review.submittedAt ? formatDay(review.submittedAt, lang, { weekday: false }) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        {score10 !== null && review.platform === 'BOOKING_COM' ? (
          <Text style={styles.score10}>{r.outOf10(score10.toFixed(1))}</Text>
        ) : review.rating !== null && review.rating !== undefined ? (
          <Stars rating={review.rating} />
        ) : null}
      </View>

      {!review.visible && (
        <View style={styles.hiddenTag}>
          <Ionicons name="eye-off-outline" size={11} color={colors.inkMuted} />
          <Text style={styles.hiddenText}>{r.hidden}</Text>
        </View>
      )}
      {!!publicText?.trim() && <Text style={styles.body}>{publicText}</Text>}
      {!!privateText?.trim() && (
        <View style={styles.privateBox}>
          <View style={styles.boxLabelRow}>
            <Ionicons name="lock-closed-outline" size={11} color={colors.inkMuted} />
            <Text style={styles.boxLabel}>{r.privateFeedback}</Text>
          </View>
          <Text style={typography.bodyMuted}>{privateText}</Text>
        </View>
      )}
      {tr && (
        <Pressable onPress={() => setShowOriginal((v) => !v)} hitSlop={6} style={styles.translatedRow} accessibilityRole="button">
          <Ionicons name="language-outline" size={13} color={colors.inkMuted} />
          <Text style={typography.caption}>
            {translated ? `${s.translatedByAi} · ` : ''}
            <Text style={styles.linkSmall}>{translated ? s.showOriginal : s.showTranslation}</Text>
          </Text>
        </Pressable>
      )}

      {!!responseText && (
        <View style={styles.replyBox}>
          <View style={styles.boxLabelRow}>
            <Ionicons name="chatbubble-outline" size={11} color={colors.primary} />
            <Text style={[styles.boxLabel, { color: colors.primary }]}>{r.hostReply}</Text>
          </View>
          <Text style={typography.bodyMuted}>{responseText}</Text>
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
          <Button label={`${r.replyButton} · ${name}`} onPress={() => setIsReplying(true)} style={{ marginTop: spacing.md }} />
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
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.pillButton, pressed && { opacity: 0.6 }]} accessibilityRole="button">
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
  card: { marginTop: spacing.sm, borderRadius: radius.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  initial: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  channelDot: { width: 6, height: 6, borderRadius: 3 },
  body: { ...typography.body, marginTop: spacing.sm + 4 },
  score10: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 13,
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
  translatedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm, alignSelf: 'flex-start' },
  linkSmall: { fontSize: 12, fontWeight: '500', color: colors.green700 },
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
  boxLabel: { fontSize: 11, fontWeight: '600', color: colors.inkMuted },
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
