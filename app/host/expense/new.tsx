import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, ExpenseCategory } from '@/lib/api';
import { Screen, TextField, Chip } from '@/components/ui';
import { PropertySelect } from '@/components/PropertySelect';
import { Button } from '@/components/Button';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/status';
import { colors, spacing, typography } from '@/theme';

const CATEGORY_OPTIONS = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewExpenseScreen() {
  const { propertyId: preselectedPropertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [propertyId, setPropertyId] = useState<string | null>(preselectedPropertyId ?? null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session) return;
    api.properties.listMine(session.accessToken).then(setProperties);
  }, [session]);

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    const amountNumber = Number(amount);
    if (!amount || Number.isNaN(amountNumber) || amountNumber < 0) return setError('Enter a valid amount.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date must be in YYYY-MM-DD format.');

    setIsSubmitting(true);
    try {
      await api.expenses.create(
        {
          category,
          amount: amountNumber,
          date,
          propertyId,
          note: note || undefined,
        },
        session.accessToken,
      );
      router.replace('/host/expenses');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log this expense.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Log an expense', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>Log an expense</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Bills, supplies, one-off maintenance — anything worth tracking against a property.
        </Text>

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORY_OPTIONS.map((c) => (
            <Chip key={c} label={EXPENSE_CATEGORY_LABELS[c]} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <TextField label="Amount in MAD" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 150" />
          <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        </View>

        <Text style={styles.sectionLabel}>Property (optional)</Text>
        <PropertySelect
          properties={properties}
          value={propertyId}
          onChange={setPropertyId}
          extraOptions={[{ value: '__NONE__', label: 'General (no property)' }]}
        />

        <View style={{ marginTop: spacing.lg }}>
          <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline numberOfLines={2} placeholder="What was it for?" />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button label={isSubmitting ? 'Saving…' : 'Log expense'} onPress={handleSubmit} loading={isSubmitting} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionLabel: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
