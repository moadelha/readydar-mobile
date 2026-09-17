import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Screen, TextField, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { spacing, typography } from '@/theme';

export default function NewCleaningContactScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!name.trim()) return setError('Enter a name.');
    if (!whatsappNumber.trim()) return setError('Enter a WhatsApp number, with country code (e.g. +212600000000).');
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
      setError(err instanceof ApiError ? err.message : 'Could not add this contact.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Add cleaning contact', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>Add a cleaning contact</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Set as a property's default contact to get notified automatically after every guest checkout.
        </Text>

        <View style={{ marginTop: spacing.lg }}>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Fatima's Cleaning" />
          <TextField
            label="WhatsApp number"
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            keyboardType="phone-pad"
            placeholder="+212 6XX XXX XXX"
          />
        </View>

        {error && <ErrorBanner message={error} />}

        <Button label={isSubmitting ? 'Adding…' : 'Add contact'} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
});
