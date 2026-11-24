import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Screen, TextField, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { spacing, typography } from '@/theme';
import { useHostAccess } from '@/lib/access';
import { NoAccess } from '@/components/no-access';
import { useLargeTitle } from '@/lib/large-title';
import { useLanguage } from '@/lib/i18n/language-context';
import { useSetupStrings } from '@/lib/i18n/setup-strings';

function NewCleaningContactInner() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const s = useSetupStrings().contacts;

  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!name.trim()) return setError(s.nameRequired);
    if (!whatsappNumber.trim()) return setError(s.whatsappRequired);
    setIsSubmitting(true);
    try {
      await api.cleaningContacts.create(
        {
          name: name.trim(),
          whatsappNumber: whatsappNumber.trim(),
          type: 'EXTERNAL',
        },
        session.accessToken,
      );
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.addError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.addTitle), headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} {...largeTitle.scrollProps}>
        <Text style={typography.h1}>{s.addTitle}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          {s.addIntro}
        </Text>

        <View style={{ marginTop: spacing.lg }}>
          <TextField label={s.name} value={name} onChangeText={setName} placeholder={s.namePlaceholder} autoCapitalize="words" />
          <TextField
            label={s.whatsapp}
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            keyboardType="phone-pad"
            placeholder="+212 6XX XXX XXX"
          />
        </View>

        {error && <ErrorBanner message={error} />}

        <Button label={isSubmitting ? s.submitting : s.submit} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
});

// Cleaning contacts are @MinHostRole('MANAGER') on the API.
// Wrapped rather than early-returned so the real screen's hooks and
// API calls never run for someone without access.
export default function NewCleaningContactScreen() {
  const { isManager } = useHostAccess();
  return isManager ? <NewCleaningContactInner /> : <NoAccess />;
}
