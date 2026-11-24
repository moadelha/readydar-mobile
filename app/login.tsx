import { useState } from 'react';
import { View, Linking } from 'react-native';
import { Text } from '@/components/text';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { TextField } from '@/components/ui';
import { AuthShell, authStyles } from '@/components/auth-shell';
import { ConfirmEmail } from '@/components/confirm-email';
import { Button } from '@/components/Button';
import { spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { authErrorMessage, useSetupStrings } from '@/lib/i18n/setup-strings';
import { WEB_URL } from '@/lib/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const s = useSetupStrings();
  /** The password was right but the address isn't confirmed: the confirm step replaces the form. */
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      if ((await login(email.trim(), password)) === 'CONFIRM_EMAIL') setUnconfirmed(true);
    } catch (err) {
      setError(authErrorMessage(err, s, t.login.genericError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (unconfirmed) {
    return (
      <AuthShell>
        <ConfirmEmail email={email.trim()} password={password} justSignedUp={false} onBack={() => setUnconfirmed(false)} />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Text style={authStyles.title}>{t.login.title}</Text>
      <Text style={authStyles.subtitle}>{s.auth.subtitle}</Text>

      <View style={{ marginTop: spacing.xl }}>
        <TextField
          label={t.login.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder={t.login.emailPlaceholder}
        />
        <TextField
          label={t.login.password}
          value={password}
          onChangeText={setPassword}
          isPassword
          autoComplete="current-password"
          textContentType="password"
          placeholder={t.login.passwordPlaceholder}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />
        {/* The reset page lives on the website. It also lets someone who
            signed up there with Google set a password to use in the app. */}
        <Text
          style={[typography.bodyMuted, authStyles.link, { alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.md }]}
          onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)}
          accessibilityRole="link"
          suppressHighlighting
        >
          {t.login.forgotPassword}
        </Text>
      </View>

      {error && (
        <View style={authStyles.errorBox}>
          <Text style={authStyles.errorText}>{error}</Text>
        </View>
      )}

      <Button
        label={isSubmitting ? t.login.loggingIn : t.login.logIn}
        onPress={handleSubmit}
        loading={isSubmitting}
        style={{ marginTop: spacing.xs }}
      />

      <View style={authStyles.switchRow}>
        <Text style={typography.bodyMuted}>{t.login.noAccount}</Text>
        <Link href="/register">
          <Text style={[typography.bodyMuted, authStyles.link]}>{t.login.signUp}</Text>
        </Link>
      </View>
    </AuthShell>
  );
}
