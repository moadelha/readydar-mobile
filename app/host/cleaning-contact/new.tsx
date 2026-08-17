import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Screen, TextField, SegmentedControl, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { spacing, typography } from '@/theme';

type ContactType = 'EXTERNAL' | 'COMPANY_ACCOUNT';

export default function NewCleaningContactScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [type, setType] = useState<ContactType>('EXTERNAL');
  const [cleanerAccountEmail, setCleanerAccountEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!name.trim()) return setError('Enter a name.');
    if (!whatsappNumber.trim()) return setError('Enter a WhatsApp number, with country code (e.g. +212600000000).');
    if (type === 'COMPANY_ACCOUNT' && !cleanerAccountEmail.trim()) {
      return setError('Enter the email of the enrolled DarClean cleaner company account.');
    }

    setIsSubmitting(true);
    try {
      await api.cleaningContacts.create(
        {
          name: name.trim(),
          whatsappNumber: whatsappNumber.trim(),
          type,
          cleanerAccountEmail: type === 'COMPANY_ACCOUNT' ? cleanerAccountEmail.trim() : undefined,
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
          <Text style={styles.fieldLabel}>Contact type</Text>
          <SegmentedControl
            value={type}
            onChange={setType}
            options={[
              { value: 'EXTERNAL', label: 'External / own staff' },
              { value: 'COMPANY_ACCOUNT', label: 'DarClean company' },
            ]}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Fatima's Cleaning" />
          <TextField
            label="WhatsApp number"
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            keyboardType="phone-pad"
            placeholder="+212 6XX XXX XXX"
          />
          {type === 'COMPANY_ACCOUNT' && (
            <TextField
              label="Their DarClean account email"
              value={cleanerAccountEmail}
              onChangeText={setCleanerAccountEmail}
              keyboardType="email-address"
              placeholder="company@example.com"
            />
          )}
        </View>

        {error && <ErrorBanner message={error} />}

        <Button label={isSubmitting ? 'Adding…' : 'Add contact'} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  fieldLabel: { ...typography.bodyMuted, fontWeight: '600', marginBottom: spacing.xs },
});
