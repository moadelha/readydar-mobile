import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { Link } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { TextField, Screen, SegmentedControl, Checkbox } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { WEB_URL } from '@/lib/api';

export default function RegisterScreen() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const [role, setRole] = useState<'HOST' | 'CLEANER'>('CLEANER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  // Deliberately unchecked by default — mirrors the web app's registration
  // form (see Terms section 46: "The acceptance box must not be
  // pre-selected"). The backend hard-rejects registration without this.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!acceptedTerms) {
      setError(t.register.termsRequired);
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ email, password, firstName, lastName, role, phone: phone || undefined, acceptedTerms });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.register.genericError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>ReadyDar</Text>
        <Text style={styles.title}>{t.register.title}</Text>
        <Text style={styles.subtitle}>
          {role === 'HOST' ? t.register.subtitleHost : t.register.subtitleCleaner}
        </Text>

        <View style={{ marginTop: spacing.lg }}>
          <SegmentedControl
            value={role}
            onChange={setRole}
            options={[
              { value: 'HOST', label: t.register.imHost },
              { value: 'CLEANER', label: t.register.imCleaner },
            ]}
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <TextField label={t.register.firstName} value={firstName} onChangeText={setFirstName} />
          <TextField label={t.register.lastName} value={lastName} onChangeText={setLastName} />
          <TextField label={t.register.email} value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField
            label={t.register.phone}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t.register.phonePlaceholder}
          />
          <TextField
            label={t.register.password}
            value={password}
            onChangeText={setPassword}
            isPassword
            placeholder={t.register.passwordPlaceholder}
          />
        </View>

        <View style={styles.termsRow}>
          <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms} />
          <Text style={styles.termsText}>
            {t.register.termsPrefix}
            <Text style={styles.termsLink} onPress={() => Linking.openURL(`${WEB_URL}/terms`)}>
              {t.register.termsLink}
            </Text>
            {t.register.termsSuffix}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          label={isSubmitting ? t.register.creatingAccount : t.register.createAccount}
          onPress={handleSubmit}
          loading={isSubmitting}
        />

        <View style={styles.footer}>
          <Text style={typography.bodyMuted}>{t.register.haveAccount}</Text>
          <Link href="/login">
            <Text style={styles.link}>{t.register.logIn}</Text>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  brand: { fontSize: 24, fontWeight: '700', color: colors.primary, marginBottom: spacing.xl },
  title: { ...typography.h1 },
  subtitle: { ...typography.bodyMuted, marginTop: spacing.xs },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  link: { color: colors.primary, fontWeight: '600' },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  termsText: { ...typography.bodyMuted, flex: 1, lineHeight: 19 },
  termsLink: { color: colors.primary, fontWeight: '600' },
});
