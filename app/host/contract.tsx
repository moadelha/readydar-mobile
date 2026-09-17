import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Screen, Card, ErrorBanner, LoadingScreen, TextField, Reveal } from '@/components/ui';
import { Button } from '@/components/Button';
import { useToast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';

const TEMPLATE_VARIABLES =
  '{{hostName}} {{guestName}} {{propertyName}} {{propertyAddress}} {{checkInDate}} {{checkOutDate}} {{guestCount}} {{totalPrice}}';

export default function ContractSettingsScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [required, setRequired] = useState(false);
  const [template, setTemplate] = useState('');
  const [defaultTemplate, setDefaultTemplate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const contract = await api.properties.getContract(session.accessToken);
      setRequired(contract.contractSigningRequired);
      setTemplate(contract.contractTemplate ?? '');
      // The first template we ever see (usually the backend's own default,
      // since it's populated the moment signing is first turned on) is what
      // "Restore default" below resets to — there's no separate endpoint
      // for the bare default text, so this is captured opportunistically.
      setDefaultTemplate((prev) => prev || contract.contractTemplate || prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your contract settings.');
    } finally {
      setLoaded(true);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSave() {
    if (!session) return;
    setError(null);
    setIsSaving(true);
    try {
      const updated = await api.properties.setContract(
        { contractSigningRequired: required, contractTemplate: template.trim() || undefined },
        session.accessToken,
      );
      setTemplate(updated.contractTemplate ?? '');
      toast.show('Contract settings saved', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these settings.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!loaded) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Rental contract', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Reveal>
          <Text style={typography.h1}>Rental contract</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
            One shared setting for your whole account — applies to every property, not just one.
          </Text>
        </Reveal>

        {error && <ErrorBanner message={error} onRetry={load} />}

        <Reveal delay={40}>
          <Card style={{ marginTop: spacing.lg }}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={typography.h3}>Require a signed contract</Text>
                <Text style={[typography.bodyMuted, { marginTop: 2 }]}>
                  Guests sign this rental agreement as the last step of online check-in, before they can submit.
                </Text>
              </View>
              <Switch
                value={required}
                onValueChange={setRequired}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </Card>
        </Reveal>

        {required && (
          <Reveal delay={80}>
            <Card style={{ marginTop: spacing.md }}>
              <Text style={typography.h3}>Contract text</Text>
              <Text style={[typography.bodyMuted, { marginTop: 2, marginBottom: spacing.sm }]}>
                Shown to the guest exactly as written here, with the variables below filled in for their stay.
              </Text>
              <TextField
                label="Contract template"
                value={template}
                onChangeText={setTemplate}
                multiline
                numberOfLines={14}
                placeholder="Leave blank to use the default rental agreement"
              />
              <Text style={typography.caption}>Available variables: {TEMPLATE_VARIABLES}</Text>
              {defaultTemplate.length > 0 && template !== defaultTemplate && (
                <Button
                  label="Restore default template"
                  onPress={() => setTemplate(defaultTemplate)}
                  variant="outline"
                  style={{ marginTop: spacing.sm }}
                />
              )}
            </Card>
          </Reveal>
        )}

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            This template is a starting draft, not verified legal advice. Review and adapt it for your own situation
            and local requirements before relying on it.
          </Text>
        </View>

        <Button
          label={isSaving ? 'Saving…' : 'Save settings'}
          onPress={handleSave}
          loading={isSaving}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disclaimerBox: {
    backgroundColor: 'rgba(27,31,35,0.05)',
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  disclaimerText: { fontSize: 12, color: colors.inkMuted, lineHeight: 17 },
});
