import { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text } from '@/components/text';
import { Link } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { TextField, SegmentedControl, Checkbox } from '@/components/ui';
import { AuthShell, authStyles } from '@/components/auth-shell';
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
    <AuthShell>
        <Text style={authStyles.title}>{t.register.title}</Text>
        <Text style={authStyles.subtitle}>
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
            <Text style={styles.termsLink} onPress={() => Linking.openURL(`${WEB_URL}/privacy`)}>
              {t.register.privacyLink}
            </Text>
            .
          </Text>
        </View>

        {error && (
          <View style={authStyles.errorBox}>
            <Text style={authStyles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          label={isSubmitting ? t.register.creatingAccount : t.register.createAccount}
          onPress={handleSubmit}
          loading={isSubmitting}
        />

        <View style={authStyles.switchRow}>
          <Text style={typography.bodyMuted}>{t.register.haveAccount}</Text>
          <Link href="/login">
            <Text style={[typography.bodyMuted, authStyles.link]}>{t.register.logIn}</Text>
          </Link>
        </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  termsText: { ...typography.bodyMuted, flex: 1, lineHeight: 20 },
  termsLink: { color: colors.green700, fontWeight: '500' },
});
