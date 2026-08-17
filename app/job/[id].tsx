import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Booking, PickedFile, resolveUploadUrl } from '@/lib/api';
import { Screen, Card, LoadingScreen, StatusBadge } from '@/components/ui';
import { Button } from '@/components/Button';
import { STATUS_LABELS, STATUS_TONE } from '@/lib/status';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
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

  async function withAction(fn: () => Promise<void>) {
    setError(null);
    setIsActing(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsActing(false);
    }
  }

  async function handleCheckIn() {
    if (!session || !id) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Enable location access to check in.');
      return;
    }
    await withAction(async () => {
      const pos = await Location.getCurrentPositionAsync({});
      await api.jobActions.checkIn(id, pos.coords.latitude, pos.coords.longitude, session.accessToken);
    });
  }

  async function handleStart() {
    if (!session || !id) return;
    await withAction(() => api.jobActions.start(id, session.accessToken).then(() => {}));
  }

  async function handleComplete() {
    if (!session || !id) return;
    await withAction(() => api.jobActions.complete(id, session.accessToken).then(() => {}));
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

  if (!booking) return <LoadingScreen />;

  const beforePhotos = booking.photos?.filter((p) => p.type === 'BEFORE_PHOTO') ?? [];
  const afterPhotos = booking.photos?.filter((p) => p.type === 'AFTER_PHOTO') ?? [];

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
            </Text>
          </View>
          <StatusBadge label={STATUS_LABELS[booking.status]} tone={STATUS_TONE[booking.status]} />
        </View>

        <Pressable onPress={handleNavigate} style={styles.navigateButton}>
          <Ionicons name="navigate-outline" size={16} color={colors.primary} />
          <Text style={styles.navigateText}>Navigate</Text>
        </Pressable>

        {booking.specialRequests && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={typography.bodyMuted}>&ldquo;{booking.specialRequests}&rdquo;</Text>
          </Card>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {(booking.status === 'CONFIRMED' || booking.status === 'CLEANER_EN_ROUTE') && (
            <Button label="Check in (uses your location)" onPress={handleCheckIn} loading={isActing} />
          )}
          {booking.status === 'CHECKED_IN' && <Button label="Start cleaning" onPress={handleStart} loading={isActing} />}
          {booking.status === 'IN_PROGRESS' && <Button label="Mark job complete" onPress={handleComplete} loading={isActing} />}
        </View>

        {booking.checklist && booking.checklist.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Checklist</Text>
            <Card>
              {booking.checklist.map((item, i) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleToggleChecklist(item.id, !item.isDone)}
                  disabled={isActing || !['CHECKED_IN', 'IN_PROGRESS'].includes(booking.status)}
                  style={[styles.checklistRow, i > 0 && styles.checklistRowBorder]}
                >
                  <Ionicons
                    name={item.isDone ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.isDone ? colors.primary : colors.border}
                  />
                  <Text style={[typography.body, item.isDone && styles.checklistDone]}>{item.label}</Text>
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {['CHECKED_IN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETED'].includes(booking.status) && (
          <View style={styles.photoSection}>
            <PhotoBlock
              title="Before photos"
              photos={beforePhotos}
              disabled={isActing || booking.status === 'COMPLETED'}
              onUpload={() => handleUploadPhoto('before')}
            />
            <PhotoBlock
              title="After photos"
              photos={afterPhotos}
              disabled={isActing || booking.status === 'COMPLETED'}
              onUpload={() => handleUploadPhoto('after')}
            />
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
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={typography.h3}>{title}</Text>
      <View style={styles.photoGrid}>
        {photos.map((p) => (
          <Image key={p.id} source={{ uri: resolveUploadUrl(p.url) }} style={styles.photo} />
        ))}
      </View>
      {!disabled && (
        <Pressable onPress={onUpload} style={styles.uploadRow}>
          <Ionicons name="camera-outline" size={16} color={colors.inkMuted} />
          <Text style={styles.uploadRowText}>Take photo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
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
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
