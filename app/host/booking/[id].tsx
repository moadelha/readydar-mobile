import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Booking, resolveUploadUrl, resolveThumbnailUrl } from '@/lib/api';
import { Screen, Card, LoadingScreen, StatusBadge, TextField, PhotoViewerModal } from '@/components/ui';
import { Button } from '@/components/Button';
import { STATUS_LABELS, STATUS_TONE } from '@/lib/status';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function HostBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !id) return;
    const data = await api.bookings.get(id, session.accessToken);
    setBooking(data);
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Returns true on success, false on failure (error state is already set). */
  async function withAction(fn: () => Promise<void>): Promise<boolean> {
    setError(null);
    setIsActing(true);
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      return false;
    } finally {
      setIsActing(false);
    }
  }

  async function handleConfirm() {
    if (!session || !id) return;
    await withAction(() => api.bookings.confirm(id, session.accessToken).then(() => {}));
  }

  async function handleApprove() {
    if (!session || !id) return;
    await withAction(() => api.bookings.approve(id, session.accessToken).then(() => {}));
  }

  async function handleCancel() {
    if (!session || !id) return;
    const ok = await withAction(() => api.bookings.cancel(id, cancelReason, session.accessToken).then(() => {}));
    if (ok) {
      setCancelOpen(false);
      setCancelReason('');
    }
  }

  async function handleDispute() {
    if (!session || !id) return;
    if (disputeReason.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters.');
      return;
    }
    const ok = await withAction(() => api.bookings.openDispute(id, disputeReason, session.accessToken).then(() => {}));
    if (ok) {
      setDisputeOpen(false);
      setDisputeReason('');
    }
  }

  async function handleSubmitReview() {
    if (!session || !id) return;
    await withAction(() =>
      api.reviews.create({ bookingId: id, rating, comment: reviewComment || undefined }, session.accessToken).then(() => {}),
    );
  }

  if (!booking) return <LoadingScreen />;

  const beforePhotos = booking.photos?.filter((p) => p.type === 'BEFORE_PHOTO') ?? [];
  const afterPhotos = booking.photos?.filter((p) => p.type === 'AFTER_PHOTO') ?? [];
  const canCancel = booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED';
  const canDispute = booking.status !== 'CANCELLED' && booking.status !== 'DISPUTED';

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: booking.service.name, headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h1}>{booking.property.name}</Text>
            <Text style={typography.bodyMuted}>
              {booking.property.addressLine}, {booking.property.city.name}
            </Text>
            <Text style={typography.caption}>
              {new Date(booking.scheduledDate).toLocaleDateString()} at {booking.scheduledTime}
              {booking.urgency === 'URGENT' ? ' · Urgent' : ''}
            </Text>
          </View>
          <StatusBadge label={STATUS_LABELS[booking.status]} tone={STATUS_TONE[booking.status]} />
        </View>

        {booking.status === 'PENDING_MATCH' && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={typography.bodyMuted}>We're finding a nearby verified cleaner for this job.</Text>
          </Card>
        )}

        {booking.specialRequests && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={typography.bodyMuted}>&ldquo;{booking.specialRequests}&rdquo;</Text>
          </Card>
        )}

        {booking.status === 'MATCHED' && booking.agreedPrice ? (
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.accentBg, borderColor: 'transparent' }}>
            <Text style={styles.proposedTitle}>Cleaner proposed {Number(booking.agreedPrice).toFixed(0)} MAD</Text>
            {booking.budget && Number(booking.agreedPrice) !== Number(booking.budget) && (
              <Text style={typography.bodyMuted}>Your budget was {Number(booking.budget).toFixed(0)} MAD</Text>
            )}
            <Text style={[typography.caption, { marginTop: spacing.xs }]}>
              Confirming below accepts this price. Prefer to negotiate first? Contact the cleaner, or cancel and request again.
            </Text>
          </Card>
        ) : (
          (booking.budget || booking.agreedPrice) && (
            <Text style={styles.budget}>
              {booking.agreedPrice ? `${Number(booking.agreedPrice).toFixed(0)} MAD agreed` : `${Number(booking.budget).toFixed(0)} MAD budget`}
            </Text>
          )
        )}

        {booking.cleaner && (
          <>
            <Text style={styles.sectionTitle}>Cleaner</Text>
            <Card>
              <View style={styles.metaRow}>
                <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
                <Text style={typography.body}>
                  {booking.cleaner.user.firstName} {booking.cleaner.user.lastName}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="star" size={14} color={colors.accent} />
                <Text style={typography.bodyMuted}>{booking.cleaner.averageRating.toFixed(1)} average rating</Text>
              </View>
            </Card>
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {booking.status === 'MATCHED' && (
            <Button label="Confirm cleaner" onPress={handleConfirm} loading={isActing} />
          )}
          {booking.status === 'AWAITING_APPROVAL' && (
            <Button label="Approve & release payment" onPress={handleApprove} loading={isActing} />
          )}
        </View>

        {booking.checklist && booking.checklist.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Checklist</Text>
            <Card>
              {booking.checklist.map((item, i) => (
                <View key={item.id} style={[styles.checklistRow, i > 0 && styles.checklistRowBorder]}>
                  <Ionicons
                    name={item.isDone ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.isDone ? colors.primary : colors.border}
                  />
                  <Text style={[typography.body, item.isDone && styles.checklistDone]}>{item.label}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
          <View style={styles.photoSection}>
            {beforePhotos.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={typography.h3}>Before photos</Text>
                <View style={styles.photoGrid}>
                  {beforePhotos.map((p) => (
                    <Pressable key={p.id} onPress={() => setViewerUrl(resolveUploadUrl(p.url))}>
                      <Image source={{ uri: resolveThumbnailUrl(p.url, 150) }} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {afterPhotos.length > 0 && (
              <View>
                <Text style={typography.h3}>After photos</Text>
                <View style={styles.photoGrid}>
                  {afterPhotos.map((p) => (
                    <Pressable key={p.id} onPress={() => setViewerUrl(resolveUploadUrl(p.url))}>
                      <Image source={{ uri: resolveThumbnailUrl(p.url, 150) }} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <PhotoViewerModal uri={viewerUrl} onClose={() => setViewerUrl(null)} />

        {booking.status === 'COMPLETED' && (
          <>
            <Text style={styles.sectionTitle}>Review</Text>
            {booking.review ? (
              <Card>
                <View style={styles.metaRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= booking.review!.rating ? 'star' : 'star-outline'}
                      size={16}
                      color={colors.accent}
                    />
                  ))}
                </View>
                {booking.review.comment && (
                  <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{booking.review.comment}</Text>
                )}
              </Card>
            ) : (
              <Card>
                <Text style={typography.bodyMuted}>How was this cleaning?</Text>
                <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRating(n)}>
                      <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={26} color={colors.accent} />
                    </Pressable>
                  ))}
                </View>
                <View style={{ marginTop: spacing.sm }}>
                  <TextField
                    label="Comment (optional)"
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline
                    numberOfLines={2}
                  />
                </View>
                <Button label="Submit review" onPress={handleSubmitReview} loading={isActing} />
              </Card>
            )}
          </>
        )}

        <View style={styles.footerActions}>
          {canDispute && (
            <>
              {!disputeOpen ? (
                <Pressable onPress={() => setDisputeOpen(true)} style={styles.linkAction}>
                  <Ionicons name="warning-outline" size={14} color={colors.danger} />
                  <Text style={styles.disputeText}>Raise a dispute</Text>
                </Pressable>
              ) : (
                <Card style={{ marginTop: spacing.sm }}>
                  <TextField
                    label="What went wrong? (min 10 characters)"
                    value={disputeReason}
                    onChangeText={setDisputeReason}
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.row}>
                    <Button label="Submit dispute" onPress={handleDispute} loading={isActing} variant="danger" style={{ flex: 1 }} />
                    <Button label="Cancel" onPress={() => setDisputeOpen(false)} variant="outline" style={{ flex: 1 }} />
                  </View>
                </Card>
              )}
            </>
          )}

          {canCancel && (
            <>
              {!cancelOpen ? (
                <Pressable onPress={() => setCancelOpen(true)} style={styles.linkAction}>
                  <Ionicons name="close-circle-outline" size={14} color={colors.inkFaint} />
                  <Text style={styles.cancelText}>Cancel this booking</Text>
                </Pressable>
              ) : (
                <Card style={{ marginTop: spacing.sm }}>
                  <TextField label="Reason (optional)" value={cancelReason} onChangeText={setCancelReason} multiline numberOfLines={2} />
                  <View style={styles.row}>
                    <Button label="Confirm cancel" onPress={handleCancel} loading={isActing} variant="danger" style={{ flex: 1 }} />
                    <Button label="Keep booking" onPress={() => setCancelOpen(false)} variant="outline" style={{ flex: 1 }} />
                  </View>
                </Card>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  budget: { marginTop: spacing.sm, color: colors.primary, fontWeight: '600', fontSize: 13 },
  proposedTitle: { ...typography.h3, marginBottom: 2 },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  checklistRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  checklistDone: { color: colors.inkMuted, textDecorationLine: 'line-through' },
  photoSection: { marginTop: spacing.lg },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  photo: { width: 72, height: 72, borderRadius: radius.sm },
  footerActions: { marginTop: spacing.xl, gap: spacing.sm },
  linkAction: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: spacing.sm },
  disputeText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  cancelText: { color: colors.inkFaint, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
