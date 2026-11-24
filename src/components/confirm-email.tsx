import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/text';
import { authStyles } from '@/components/auth-shell';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n/language-context';
import { authErrorMessage, useSetupStrings } from '@/lib/i18n/setup-strings';
import { spacing, typography } from '@/theme';

const RESEND_WAIT = 30;

/**
 * "Check your email", after signing up and when signing in before the
 * address is confirmed. The link opens the website; coming back here,
 * "I've confirmed" signs in with the password just typed (kept in memory
 * only, never stored).
 */
export function ConfirmEmail({
  email,
  password,
  justSignedUp,
  onBack,
}: {
  email: string;
  password: string;
  justSignedUp: boolean;
  onBack: () => void;
}) {
  const { login } = useAuth();
  const { t } = useLanguage();
  const s = useSetupStrings();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Signing up has just sent one; the first resend waits too.
  const [wait, setWait] = useState(justSignedUp ? RESEND_WAIT : 0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function handleContinue() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if ((await login(email, password)) === 'CONFIRM_EMAIL') setError(s.auth.notYet);
    } catch (err) {
      setError(authErrorMessage(err, s, t.login.genericError));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNote(null);
    setWait(RESEND_WAIT);
    try {
      await api.auth.resendVerification(email);
      setNote(s.auth.resent);
    } catch {
      setError(s.auth.resendError);
    }
  }

  return (
    <View>
      <Text style={authStyles.title}>{s.auth.confirmTitle}</Text>
      <Text style={authStyles.subtitle}>{justSignedUp ? s.auth.confirmBody(email) : s.auth.unconfirmedBody(email)}</Text>

      <View style={{ marginTop: spacing.lg }}>
        {error && (
          <View style={authStyles.errorBox}>
            <Text style={authStyles.errorText}>{error}</Text>
          </View>
        )}
        <Button label={busy ? s.auth.checking : s.auth.confirmed} onPress={handleContinue} loading={busy} />
        <Button
          label={wait > 0 ? s.auth.resendIn(wait) : s.auth.resend}
          onPress={handleResend}
          disabled={wait > 0}
          variant="outline"
          style={{ marginTop: spacing.sm }}
        />
        {note && <Text style={[typography.bodyMuted, { marginTop: spacing.sm, textAlign: 'center' }]}>{note}</Text>}
      </View>

      <View style={authStyles.switchRow}>
        <Text style={[typography.bodyMuted, authStyles.link]} onPress={onBack} accessibilityRole="button" suppressHighlighting>
          {s.auth.otherEmail}
        </Text>
      </View>
    </View>
  );
}
