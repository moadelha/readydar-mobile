import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { Screen, TextField, Chip, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, DeskGuest, PickedFile } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useDeskStrings } from '@/lib/i18n/desk-strings';
import { useLargeTitle } from '@/lib/large-title';
import { useToast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';

type Draft = DeskGuest & { photo: PickedFile | null };

const blank = (): Draft => ({ firstName: '', lastName: '', nationality: '', idType: 'passport', idNumber: '', photo: null });

/**
 * Hostels: staff register a stay's guests at the desk — the same record the
 * guests' own online check-in fills (police register, check-in PDF). One
 * card per guest with a photo of their passport or ID card, taken with the
 * phone's camera. Registering marks the stay arrived. A group can be done
 * bit by bit: each send adds to the guests already registered.
 */
export default function RegisterGuestsScreen() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const s = useDeskStrings();
  const toast = useToast();
  const params = useLocalSearchParams<{ checkInId: string; name?: string; count?: string }>();
  const first = (params.name ?? '').trim().split(/\s+/);
  const [guests, setGuests] = useState<Draft[]>(() => {
    const n = Math.min(10, Math.max(1, Number(params.count) || 1));
    const list = Array.from({ length: n }, blank);
    // The booking's name is usually the first guest's.
    if (first[0]) list[0] = { ...list[0], firstName: first[0], lastName: first.slice(1).join(' ') };
    return list;
  });
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = (i: number, patch: Partial<Draft>) => setGuests((list) => list.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  async function takePhoto(i: number) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(s.cameraDenied);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    change(i, { photo: { uri: a.uri, name: a.fileName || `id-${i + 1}.jpg`, type: a.mimeType || 'image/jpeg' } });
  }

  async function submit() {
    if (!session || !params.checkInId) return;
    setError(null);
    const missing = guests.findIndex((g) => !g.firstName.trim() || !g.lastName.trim() || !g.nationality.trim() || !g.idNumber.trim() || !g.photo);
    if (missing >= 0) {
      setError(s.guestIncomplete(missing + 1));
      return;
    }
    setBusy(true);
    try {
      await api.frontDesk.registerGuests(
        params.checkInId,
        guests.map(({ photo: _photo, ...g }) => ({ ...g, firstName: g.firstName.trim(), lastName: g.lastName.trim(), nationality: g.nationality.trim(), idNumber: g.idNumber.trim() })),
        guests.map((g) => g.photo!),
        phone.trim() || undefined,
        session.accessToken,
      );
      toast.show(s.registered);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.registerError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.registerTitle), headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" {...largeTitle.scrollProps}>
        <Text style={typography.h1}>{s.registerTitle}</Text>
        {params.name ? <Text style={[typography.h3, { marginTop: spacing.xs }]}>{params.name}</Text> : null}
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>{s.registerIntro}</Text>

        {guests.map((g, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={typography.h3}>{s.guestN(i + 1)}</Text>
              {guests.length > 1 && (
                <Pressable
                  onPress={() => setGuests((list) => list.filter((_, j) => j !== i))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={s.removeGuest}
                >
                  <Ionicons name="close" size={20} color={colors.inkMuted} />
                </Pressable>
              )}
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextField label={s.firstName} value={g.firstName} onChangeText={(v) => change(i, { firstName: v })} autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={s.lastName} value={g.lastName} onChangeText={(v) => change(i, { lastName: v })} autoCapitalize="words" />
              </View>
            </View>
            <TextField
              label={s.nationality}
              value={g.nationality}
              onChangeText={(v) => change(i, { nationality: v })}
              placeholder={s.nationalityPlaceholder}
              autoCapitalize="words"
            />
            <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
              <Chip label={s.passport} active={g.idType === 'passport'} onPress={() => change(i, { idType: 'passport' })} />
              <Chip label={s.nationalId} active={g.idType === 'national_id'} onPress={() => change(i, { idType: 'national_id' })} />
            </View>
            <TextField label={s.idNumber} value={g.idNumber} onChangeText={(v) => change(i, { idNumber: v })} autoCapitalize="characters" />

            {g.photo ? (
              <View style={styles.photoRow}>
                <Image source={{ uri: g.photo.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
                <Pressable onPress={() => takePhoto(i)} style={styles.retake} accessibilityRole="button" hitSlop={6}>
                  <Ionicons name="camera-reverse-outline" size={16} color={colors.green700} />
                  <Text style={styles.retakeText}>{s.retake}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => takePhoto(i)} style={styles.photoButton} accessibilityRole="button">
                <Ionicons name="camera-outline" size={22} color={colors.green700} />
                <Text style={styles.photoText}>{s.idPhoto}</Text>
              </Pressable>
            )}
          </View>
        ))}

        {guests.length < 30 && (
          <Pressable onPress={() => setGuests((list) => [...list, blank()])} style={styles.addGuest} accessibilityRole="button">
            <Ionicons name="add" size={18} color={colors.green700} />
            <Text style={styles.addGuestText}>{s.addGuest}</Text>
          </Pressable>
        )}

        <TextField label={s.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={40} />

        {error && <ErrorBanner message={error} />}
        <Button label={busy ? s.registering : s.registerSubmit(guests.length)} onPress={submit} loading={busy} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
  },
  photoText: { fontSize: 15, fontWeight: '600', color: colors.green700 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 96, height: 64, borderRadius: radius.sm, backgroundColor: colors.surface2 },
  retake: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  retakeText: { fontSize: 14, fontWeight: '500', color: colors.green700 },
  addGuest: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginBottom: spacing.md },
  addGuestText: { fontSize: 15, fontWeight: '600', color: colors.green700 },
});
