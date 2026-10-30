import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui';
import { Button } from '@/components/Button';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, spacing, typography } from '@/theme';

/**
 * Rendered in place of a screen the current co-host isn't allowed to use.
 *
 * Menus already hide these entries (see useHostAccess), so the only way to
 * land here is a stale route, a deep link, or a role that changed while the
 * app was open. Without this, those cases fell through to the real screen:
 * a STAFF co-host saw the contract form, or an editable settings page whose
 * Save then failed with a raw 403.
 */
export function NoAccess() {
  const { t } = useLanguage();
  const router = useRouter();
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: t.noAccess.back }} />
      <View style={styles.wrap}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed-outline" size={26} color={colors.inkFaint} />
        </View>
        <Text style={[typography.h2, styles.center]}>{t.noAccess.title}</Text>
        <Text style={[typography.bodyMuted, styles.center, { marginTop: spacing.sm }]}>{t.noAccess.body}</Text>
        <Button
          label={t.noAccess.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          variant="outline"
          style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  center: { textAlign: 'center' },
});
