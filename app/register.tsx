import { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text } from '@/components/text';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { TextField, Checkbox } from '@/components/ui';
import { AuthShell, authStyles } from '@/components/auth-shell';
import { ConfirmEmail } from '@/components/confirm-email';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { authErrorMessage, useSetupStrings } from '@/lib/i18n/setup-strings';
import { WEB_URL } from '@/lib/api';

/** Creates a host account, then waits on "check your email": it can't sign in until the address is confirmed. */
export default function RegisterScreen() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const s = useSetupStrings();
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
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!acceptedTerms) {
      setError(t.register.termsRequired);
      return;
    }
    setIsSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        acceptedTerms,
      });
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, s, t.register.genericError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <ConfirmEmail email={email.trim()} password={password} justSignedUp onBack={() => setSent(false)} />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Text style={authStyles.title}>{t.register.title}</Text>
      <Text style={authStyles.subtitle}>{s.auth.subtitle}</Text>

      <View style={{ marginTop: spacing.lg }}>
        <TextField label={t.register.firstName} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" />
        <TextField label={t.register.lastName} value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" />
        <TextField label={t.register.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <TextField
          label={t.register.phone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder={t.register.phonePlaceholder}
        />
        <TextField
          label={t.register.password}
          value={password}
          onChangeText={setPassword}
          isPassword
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={t.register.passwordPlaceholder}
        />
      </View>

      <View style={styles.termsRow}>
        <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms} label={`${t.register.termsPrefix}${t.register.termsLink}${t.register.termsSuffix}${t.register.privacyLink}`} />
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
