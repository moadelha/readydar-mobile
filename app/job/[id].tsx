import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Booking, PickedFile, resolveUploadUrl, resolveThumbnailUrl } from '@/lib/api';
import {
  Screen,
  Card,
  StatusBadge,
  PhotoViewerModal,
  ErrorBanner,
  Reveal,
  AnimatedPressable,
  Skeleton,
} from '@/components/ui';
import { Button } from '@/components/Button';
import { useToast } from '@/lib/toast';
import { STATUS_TONE } from '@/lib/status';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const toast = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function withAction(fn: () => Promise<void>, successMessage?: string) {
    setError(null);
    setIsActing(true);
    try {
      await fn();
      await load();
      if (successMessage) toast.show(successMessage, 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.jobDetail.genericError);
    } finally {
      setIsActing(false);
    }
  }

  async function handleCheckIn() {
    if (!session || !id) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.jobDetail.locationNeededTitle, t.jobDetail.locationNeededMessage);
      return;
    }
    await withAction(async () => {
      const pos = await Location.getCurrentPositionAsync({});
      await api.jobActions.checkIn(id, pos.coords.latitude, pos.coords.longitude, session.accessToken);
    }, t.jobDetail.checkedInSuccess);
  }

  async function handleStart() {
    if (!session || !id) return;
    await withAction(() => api.jobActions.start(id, session.accessToken).then(() => {}), t.jobDetail.startedSuccess);
  }

  async function handleComplete() {
    if (!session || !id) return;
    await withAction(() => api.jobActions.complete(id, session.accessToken).then(() => {}), t.jobDetail.completedSuccess);
  }

  async function handleToggleChecklist(itemId: string, isDone: boolean) {
    if (!session || !id) return;
    await withAction(() => api.jobActions.toggleChecklistItem(id, itemId, isDone, session.accessToken).then(() => {}));
  }

  async function handleUploadPhoto(type: 'before' | 'after') {
    if (!session || !id) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const file: PickedFile = { uri: asset.uri, name: `${type}.jpg`, type: 'image/jpeg' };
    await withAction(() => api.jobActions.uploadPhoto(id, type, file, session.accessToken).then(() => {}));
  }

  function handleNavigate() {
    if (!booking?.property.latitude) return;
    const { latitude, longitude } = booking.property;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  }

  function handleCallHost() {
    if (!booking?.hostContact?.phone) return;
    Linking.openURL(`tel:${booking.hostContact.phone}`);
  }

  function handleWhatsAppHost() {
    if (!booking?.hostContact?.phone) return;
    const digits = booking.hostContact.phone.replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${digits}`);
  }

  if (!booking) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={22} />
              <Skeleton width="80%" height={13} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={64} height={22} radius={11} />
          </View>
          <Skeleton width={120} height={30} radius={radius.full} style={{ marginTop: spacing.sm }} />
          <View style={[styles.card, { marginTop: spacing.md, gap: 8 }]}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="70%" height={13} />
          </View>
          <Skeleton height={48} radius={radius.sm} style={{ marginTop: spacing.md }} />
        </View>
      </Screen>
    );
  }

  const beforePhotos = booking.photos?.filter((p) => p.type === 'BEFORE_PHOTO') ?? [];
  const afterPhotos = booking.photos?.filter((p) => p.type === 'AFTER_PHOTO') ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: booking.service.name, headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Reveal>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h1}>{booking.property.name}</Text>
              <Text style={typography.bodyMuted}>
                {booking.property.addressLine}, {booking.property.city.name}
              </Text>
              <Text style={typography.caption}>
                {new Date(booking.scheduledDate).toLocaleDateString()} at {booking.scheduledTime}
              </Text>
            </View>
            <StatusBadge label={t.bookingStatus[booking.status]} tone={STATUS_TONE[booking.status]} />
          </View>
        </Reveal>

        <Reveal delay={40}>
          <AnimatedPressable onPress={handleNavigate} scaleTo={0.95} style={styles.navigateButton}>
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
            <Text style={styles.navigateText}>{t.jobDetail.navigate}</Text>
          </AnimatedPressable>
        </Reveal>

        {booking.specialRequests && (
          <Reveal delay={80}>
            <Card style={{ marginTop: spacing.md }}>
              <Text style={typography.bodyMuted}>&ldquo;{booking.specialRequests}&rdquo;</Text>
            </Card>
          </Reveal>
        )}

        {booking.hostContact && (
          <Reveal delay={120}>
            <Card style={{ marginTop: spacing.md }}>
              <Text style={typography.h3}>{booking.hostContact.name}</Text>
              <Text style={typography.bodyMuted}>{t.jobDetail.hostLabel}</Text>
              {booking.hostContact.phone ? (
                <View style={styles.contactRow}>
                  <AnimatedPressable onPress={handleCallHost} scaleTo={0.95} style={styles.contactButton}>
                    <Ionicons name="call-outline" size={16} color={colors.primary} />
                    <Text style={styles.contactButtonText}>{t.jobDetail.call}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable onPress={handleWhatsAppHost} scaleTo={0.95} style={styles.contactButton}>
                    <Ionicons name="logo-whatsapp" size={16} color={colors.primary} />
                    <Text style={styles.contactButtonText}>{t.jobDetail.whatsapp}</Text>
                  </AnimatedPressable>
                </View>
              ) : (
                <Text style={[typography.caption, { marginTop: spacing.xs }]}>{t.jobDetail.noPhoneOnFile}</Text>
              )}
            </Card>
          </Reveal>
        )}

        {error && <ErrorBanner message={error} />}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {(booking.status === 'CONFIRMED' || booking.status === 'CLEANER_EN_ROUTE') && (
            <Button label={t.jobDetail.checkInButton} onPress={handleCheckIn} loading={isActing} />
          )}
          {booking.status === 'CHECKED_IN' && <Button label={t.jobDetail.startCleaning} onPress={handleStart} loading={isActing} />}
          {booking.status === 'IN_PROGRESS' && <Button label={t.jobDetail.markComplete} onPress={handleComplete} loading={isActing} />}
        </View>

        {booking.checklist && booking.checklist.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t.jobDetail.checklist}</Text>
            <Card>
              {booking.checklist.map((item, i) => (
                <AnimatedPressable
                  key={item.id}
                  onPress={() => handleToggleChecklist(item.id, !item.isDone)}
                  disabled={isActing || !['CHECKED_IN', 'IN_PROGRESS'].includes(booking.status)}
                  scaleTo={0.98}
                  style={[styles.checklistRow, i > 0 && styles.checklistRowBorder]}
                >
                  <Ionicons
                    name={item.isDone ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.isDone ? colors.primary : colors.border}
                  />
                  <Text style={[typography.body, item.isDone && styles.checklistDone]}>{item.label}</Text>
                </AnimatedPressable>
              ))}
            </Card>
          </>
        )}

        {['CHECKED_IN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETED'].includes(booking.status) && (
          <View style={styles.photoSection}>
            <PhotoBlock
              title={t.jobDetail.beforePhotos}
              photos={beforePhotos}
              disabled={isActing || booking.status === 'COMPLETED'}
              onUpload={() => handleUploadPhoto('before')}
            />
            <PhotoBlock
              title={t.jobDetail.afterPhotos}
              photos={afterPhotos}
              disabled={isActing || booking.status === 'COMPLETED'}
              onUpload={() => handleUploadPhoto('after')}
            />
            <View style={styles.disclaimerBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.inkMuted} />
              <Text style={styles.disclaimerText}>{t.jobDetail.photoDisclaimer}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function PhotoBlock({
  title,
  photos,
  disabled,
  onUpload,
}: {
  title: string;
  photos: { id: string; url: string }[];
  disabled: boolean;
  onUpload: () => void;
}) {
  const { t } = useLanguage();
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={typography.h3}>{title}</Text>
      <View style={styles.photoGrid}>
        {photos.map((p) => (
          <AnimatedPressable key={p.id} onPress={() => setViewerUrl(resolveUploadUrl(p.url))} scaleTo={0.94}>
            <Image source={{ uri: resolveThumbnailUrl(p.url, 150) }} style={styles.photo} />
          </AnimatedPressable>
        ))}
      </View>
      {!disabled && (
        <AnimatedPressable onPress={onUpload} scaleTo={0.97} style={styles.uploadRow}>
          <Ionicons name="camera-outline" size={16} color={colors.inkMuted} />
          <Text style={styles.uploadRowText}>{t.jobDetail.takePhoto}</Text>
        </AnimatedPressable>
      )}
      <PhotoViewerModal uri={viewerUrl} onClose={() => setViewerUrl(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  navigateText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  contactRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  contactButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  disclaimerBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: colors.inkMuted, lineHeight: 17 },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  checklistRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  checklistDone: { color: colors.inkMuted, textDecorationLine: 'line-through' },
  photoSection: { marginTop: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  photo: { width: 72, height: 72, borderRadius: radius.sm },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  uploadRowText: { fontSize: 12, color: colors.inkMuted },
});
