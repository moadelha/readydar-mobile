import { View, StyleSheet, Linking } from 'react-native';
import { Text } from '@/components/text';
import { WEB_URL } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, spacing, typography } from '@/theme';

/**
 * Privacy Policy · Terms links, shown at the bottom of both profile screens.
 * Google Play requires the privacy policy to be reachable from inside the
 * app, not only from the store listing. Both pages live on the website.
 */
export function LegalLinks() {
  const { t } = useLanguage();
  return (
    <View style={styles.row}>
      <Text style={styles.link} onPress={() => Linking.openURL(`${WEB_URL}/privacy`)} accessibilityRole="link">
        {t.common.privacyPolicy}
      </Text>
      <Text style={styles.dot}>·</Text>
      <Text style={styles.link} onPress={() => Linking.openURL(`${WEB_URL}/terms`)} accessibilityRole="link">
        {t.common.terms}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  link: { ...typography.bodyMuted, color: colors.primary, textDecorationLine: 'underline' },
  dot: { ...typography.bodyMuted },
});
