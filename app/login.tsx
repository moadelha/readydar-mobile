import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { TextField, Screen, LanguagePicker } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';

export default function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.login.genericError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.langRow}>
          <LanguagePicker />
        </View>

        <Text style={styles.brand}>ReadyDar</Text>
        <Text style={styles.title}>{t.login.title}</Text>
        <Text style={styles.subtitle}>{t.login.subtitle}</Text>

        <View style={{ marginTop: spacing.lg }}>
          <TextField
            label={t.login.email}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder={t.login.emailPlaceholder}
          />
          <TextField
            label={t.login.password}
            value={password}
            onChangeText={setPassword}
            isPassword
            placeholder={t.login.passwordPlaceholder}
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          label={isSubmitting ? t.login.loggingIn : t.login.logIn}
          onPress={handleSubmit}
          loading={isSubmitting}
        />

        <View style={styles.footer}>
          <Text style={typography.bodyMuted}>{t.login.noAccount}</Text>
          <Link href="/register">
            <Text style={styles.link}>{t.login.signUp}</Text>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  langRow: {
    marginBottom: spacing.xl,
  },
  brand: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.bodyMuted,
    marginTop: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
