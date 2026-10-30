import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/text';
import { Link } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { TextField } from '@/components/ui';
import { AuthShell, authStyles } from '@/components/auth-shell';
import { Button } from '@/components/Button';
import { spacing, typography } from '@/theme';
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
    <AuthShell>
      <Text style={authStyles.title}>{t.login.title}</Text>
      <Text style={authStyles.subtitle}>{t.login.subtitle}</Text>

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
