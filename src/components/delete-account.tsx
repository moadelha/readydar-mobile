import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/text';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, WEB_URL } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDay } from '@/lib/dates';
import { colors, spacing } from '@/theme';

/**
 * "Delete account" on the Profile screens. The App Store requires that a
 * user can start deleting their account inside the app, not only by email
 * (guideline 5.1.1(v)). This sends the same request the delete-account page
 * asks people to email: support deletes the account and its data within
 * 30 days and emails them. Quiet on purpose — a text link under Log out,
 * behind a confirmation that says what happens.
 */
export function DeleteAccountLink() {
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!session) return;
    setBusy(true);
    try {
      const res = await api.users.requestDeletion(session.accessToken);
      Alert.alert(t.common.deleteAccountSentTitle, t.common.deleteAccountSentBody(formatDay(res.requestedAt, lang, { weekday: false })));
    } catch (err) {
      // An API from before this endpoint: the website's page still lets them ask.
      if (err instanceof ApiError && err.status === 404) {
        void Linking.openURL(`${WEB_URL}/delete-account`);
        return;
      }
      Alert.alert(t.common.error, err instanceof ApiError ? err.message : t.common.deleteAccountError);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    Alert.alert(t.common.deleteAccountTitle, t.common.deleteAccountBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.deleteAccountConfirm, style: 'destructive', onPress: send },
    ]);
  }

  return (
    <Pressable onPress={confirm} disabled={busy} hitSlop={8} style={styles.link} accessibilityRole="button">
      <Text style={styles.text}>{busy ? '…' : t.common.deleteAccount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', marginTop: spacing.md, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  text: { fontSize: 14, fontWeight: '500', color: colors.danger },
});
