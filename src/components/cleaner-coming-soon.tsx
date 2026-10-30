import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/text';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n/language-context';
import { Screen } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';

/**
 * Full-screen replacement for the cleaner tab group (feed/jobs/earnings/
 * profile) when the cleaner's city doesn't have `cleanersEnabled` yet —
 * see isCleanerLocationEnabled() in lib/api.ts and CleanerLocationGuard on
 * the backend, which enforces the same rule server-side on the job feed
 * and job-accept endpoints.
 *
 * Rendered by app/(tabs)/_layout.tsx in place of <Tabs>, so it carries its
 * own way out: "Edit profile" (to pick a different city — /onboarding is
 * a sibling route, unaffected by this gate) and log out.
 */
export function CleanerComingSoon() {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="location-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[typography.h2, styles.title]}>{t.cleanerComingSoon.title}</Text>
        <Text style={[typography.bodyMuted, styles.body]}>{t.cleanerComingSoon.body}</Text>
        <View style={styles.actions}>
          <Button label={t.cleanerComingSoon.editProfile} onPress={() => router.push('/onboarding')} />
          <View style={{ height: spacing.sm }} />
          <Button label={t.cleanerComingSoon.logOut} onPress={() => logout()} variant="outline" />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginTop: spacing.sm },
  actions: { marginTop: spacing.xl, width: '100%' },
});
