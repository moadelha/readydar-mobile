import { View, StyleSheet, ScrollView, Image, Pressable, Linking } from 'react-native';
import { Text } from '@/components/text';
import { Screen } from '@/components/ui';
import { WEB_URL } from '@/lib/api';
import { useLanguage, Lang } from '@/lib/i18n/language-context';
import { colors, radius, spacing, typography } from '@/theme';

const LANGS: Lang[] = ['EN', 'FR', 'AR'];

/**
 * The frame for the signed-out screens (log in, sign up), the app twin of
 * the web's AuthShell: logo and a compact EN/FR/AR switch on top, the form
 * in the middle, legal links at the foot. Nothing else — the form is the
 * whole point of the screen.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <View style={styles.brand}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} />
            <Text style={styles.brandName}>ReadyDar</Text>
          </View>
          <View style={styles.langs} accessibilityRole="radiogroup" accessibilityLabel={t.common.language}>
            {LANGS.map((opt) => {
              const active = opt === lang;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setLang(opt)}
                  hitSlop={4}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.lang, active && styles.langActive]}
                >
                  <Text style={[styles.langText, active && styles.langTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.form}>{children}</View>
        </View>

        <View style={styles.foot}>
          <Text style={styles.footText}>© {new Date().getFullYear()} ReadyDar</Text>
          <View style={styles.footLinks}>
            <Text style={styles.footText} onPress={() => Linking.openURL(`${WEB_URL}/terms`)} accessibilityRole="link">
              {t.common.terms}
            </Text>
            <Text style={styles.footText} onPress={() => Linking.openURL(`${WEB_URL}/privacy`)} accessibilityRole="link">
              {t.common.privacyPolicy}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Shared pieces of the auth forms, so log in and sign up can't drift apart. */
export const authStyles = StyleSheet.create({
  title: { ...typography.h1 },
  subtitle: { ...typography.bodyMuted, fontSize: 15, lineHeight: 22, marginTop: 6 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg },
  link: { color: colors.green700, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 28, height: 28, borderRadius: 7 },
  brandName: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, color: colors.ink },
  langs: {
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  lang: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  langActive: { backgroundColor: colors.sand },
  langText: { fontSize: 12, fontWeight: '500', color: colors.inkFaint },
  langTextActive: { color: colors.ink },
  body: { flex: 1, justifyContent: 'center', paddingVertical: 40 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footLinks: { flexDirection: 'row', gap: spacing.md },
  footText: { fontSize: 12, color: colors.inkFaint },
});
