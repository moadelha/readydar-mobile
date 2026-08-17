import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '@/lib/auth-context';
import { api, CleanerProfile } from '@/lib/api';
import { Screen, Card, LoadingScreen, LanguagePicker } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/lib/i18n/language-context';

export default function ProfileScreen() {
  const { session, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [profile, setProfile] = useState<CleanerProfile | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    api.cleaners.getProfile(session.accessToken).then(setProfile);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleUpdateLocation() {
    if (!session) return;
    setIsUpdatingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.profileCleaner.locationPermissionTitle, t.profileCleaner.locationPermissionMessage);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      await api.cleaners.updateLocation(pos.coords.latitude, pos.coords.longitude, session.accessToken);
      load();
    } catch {
      Alert.alert(t.profileCleaner.locationErrorTitle, t.profileCleaner.locationErrorMessage);
    } finally {
      setIsUpdatingLocation(false);
    }
  }

  if (!profile) return <LoadingScreen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>
          {profile.user.firstName} {profile.user.lastName}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color={colors.accent} />
          <Text style={typography.bodyMuted}>
            {profile.averageRating.toFixed(1)} · {profile.totalJobsCompleted} {t.profileCleaner.jobsCompleted}
          </Text>
        </View>

        <View style={styles.verifiedBadge}>
          <Ionicons
            name={profile.isVerified ? 'shield-checkmark' : 'alert-circle-outline'}
            size={14}
            color={profile.isVerified ? colors.primary : '#B45309'}
          />
          <Text style={[styles.verifiedText, { color: profile.isVerified ? colors.primary : '#B45309' }]}>
            {profile.isVerified ? t.profileCleaner.verified : t.profileCleaner.verificationPending}
          </Text>
        </View>

        {profile.bio && <Text style={[typography.body, { marginTop: spacing.md }]}>{profile.bio}</Text>}

        <Text style={styles.sectionTitle}>{t.profileCleaner.citiesCovered}</Text>
        <View style={styles.chipRow}>
          {profile.cities.length === 0 && <Text style={typography.bodyMuted}>{t.profileCleaner.noneSetYet}</Text>}
          {profile.cities.map((c) => (
            <View key={c.city.id} style={styles.chip}>
              <Ionicons name="location-outline" size={12} color={colors.primary} />
              <Text style={styles.chipText}>{c.city.name}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t.profileCleaner.availability}</Text>
        {profile.availability.length === 0 && <Text style={typography.bodyMuted}>{t.profileCleaner.noneSetYet}</Text>}
        {profile.availability
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map((a) => (
            <Text key={a.id} style={[typography.bodyMuted, { marginTop: 2 }]}>
              {t.days[a.dayOfWeek]}: {a.startTime} – {a.endTime}
            </Text>
          ))}

        <Text style={styles.sectionTitle}>{t.profileCleaner.currentLocation}</Text>
        <Text style={typography.bodyMuted}>
          {profile.location
            ? `${profile.location.latitude.toFixed(4)}, ${profile.location.longitude.toFixed(4)}`
            : t.profileCleaner.locationNotSet}
        </Text>
        <Button
          label={isUpdatingLocation ? t.profileCleaner.updatingLocation : t.profileCleaner.updateLocation}
          onPress={handleUpdateLocation}
          loading={isUpdatingLocation}
          variant="outline"
          style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md }}
        />

        <Card style={{ marginTop: spacing.xl }}>
          <LanguagePicker />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Button label={t.profileCleaner.editProfile} onPress={() => router.push('/onboarding')} variant="outline" />
          <View style={{ height: spacing.sm }} />
          <Button label={t.profileCleaner.logOut} onPress={() => logout()} variant="danger" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  verifiedText: { fontSize: 12, fontWeight: '700' },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
