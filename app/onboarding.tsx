import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, City, PickedFile } from '@/lib/api';
import { Screen, TextField } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/lib/i18n/language-context';

export default function OnboardingScreen() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [activeDays, setActiveDays] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true, 5: true });
  const [profilePhoto, setProfilePhoto] = useState<PickedFile | null>(null);
  const [idPhoto, setIdPhoto] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.cities.list().then(setCities);
  }, []);

  function toggleCity(id: string) {
    setSelectedCityIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function pickImage(setter: (f: PickedFile) => void) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setter({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' });
    }
  }

  async function handleSubmit() {
    if (!session) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const token = session.accessToken;
      await api.cleaners.updateProfile({ bio, yearsExperience: Number(yearsExperience) || 0 }, token);
      await api.cleaners.setCities(selectedCityIds, token);
      await api.cleaners.setAvailability(
        Object.entries(activeDays)
          .filter(([, active]) => active)
          .map(([day]) => ({ dayOfWeek: Number(day), startTime: '09:00', endTime: '18:00' })),
        token,
      );
      if (profilePhoto) await api.cleaners.uploadDocument(profilePhoto, 'profile_picture', token);
      if (idPhoto) await api.cleaners.uploadDocument(idPhoto, 'id_card', token);
      router.replace('/(tabs)/feed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.onboarding.genericError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>{t.onboarding.title}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{t.onboarding.subtitle}</Text>

        <TextField
          label={t.onboarding.aboutYou}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          placeholder={t.onboarding.aboutYouPlaceholder}
        />
        <TextField
          label={t.onboarding.yearsExperience}
          value={yearsExperience}
          onChangeText={setYearsExperience}
          keyboardType="number-pad"
        />

        <Text style={styles.sectionLabel}>{t.onboarding.citiesYouCover}</Text>
        <View style={styles.chipRow}>
          {cities.map((c) => (
            <Pressable key={c.id} onPress={() => toggleCity(c.id)} style={[styles.chip, selectedCityIds.includes(c.id) && styles.chipActive]}>
              <Text style={[styles.chipText, selectedCityIds.includes(c.id) && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t.onboarding.weeklyAvailability}</Text>
        {t.days.map((label, i) => (
          <View key={i} style={styles.dayRow}>
            <Text style={typography.body}>{label}</Text>
            <Switch
              value={!!activeDays[i]}
              onValueChange={(v) => setActiveDays((prev) => ({ ...prev, [i]: v }))}
              trackColor={{ true: colors.primaryLight, false: colors.border }}
              thumbColor={activeDays[i] ? colors.primary : '#fff'}
            />
          </View>
        ))}

        <Text style={styles.sectionLabel}>{t.onboarding.documents}</Text>
        <View style={styles.uploadRow}>
          <Pressable style={styles.uploadBox} onPress={() => pickImage(setProfilePhoto)}>
            <Ionicons name="camera-outline" size={22} color={colors.inkFaint} />
            <Text style={styles.uploadText}>{profilePhoto ? t.onboarding.photoSelected : t.onboarding.profilePicture}</Text>
          </Pressable>
          <Pressable style={styles.uploadBox} onPress={() => pickImage(setIdPhoto)}>
            <Ionicons name="card-outline" size={22} color={colors.inkFaint} />
            <Text style={styles.uploadText}>{idPhoto ? t.onboarding.photoSelected : t.onboarding.idCard}</Text>
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          label={isSubmitting ? t.onboarding.savingProfile : t.onboarding.saveProfile}
          onPress={handleSubmit}
          loading={isSubmitting}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionLabel: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.successBg, borderColor: colors.primary },
  chipText: { color: colors.inkMuted, fontWeight: '500', fontSize: 13 },
  chipTextActive: { color: colors.primary },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  uploadRow: { flexDirection: 'row', gap: spacing.sm },
  uploadBox: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadText: { fontSize: 12, color: colors.inkMuted, textAlign: 'center' },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
