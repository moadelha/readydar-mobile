import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, ExpenseCategory, propertyCoverUrl } from '@/lib/api';
import { Screen, TextField, Chip, SegmentedControl } from '@/components/ui';
import { PropertyThumb } from '@/components/host-ui';
import { Button } from '@/components/Button';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/status';
import { propertyColor } from '@/lib/property-colors';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

const CATEGORY_OPTIONS = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

type ScopeMode = 'SINGLE' | 'MULTIPLE' | 'BUSINESS';
type SplitMode = 'EQUAL' | 'CUSTOM';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayIso() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

/** Split a whole-MAD total evenly across `ids`, distributing the leftover
 * MAD (from integer division) one-by-one so every property gets a share and
 * the shares always sum back to exactly `total`. */
function equalSplit(total: number, ids: string[]): Record<string, number> {
  const n = ids.length;
  if (n === 0) return {};
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const shares: Record<string, number> = {};
  ids.forEach((id, i) => {
    shares[id] = base + (i < remainder ? 1 : 0);
  });
  return shares;
}

export default function NewExpenseScreen() {
  const { propertyId: preselectedPropertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [properties, setProperties] = useState<Property[]>([]);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('SINGLE');
  const [propertyId, setPropertyId] = useState<string | null>(preselectedPropertyId ?? null);
  const [multiPropertyIds, setMultiPropertyIds] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>('EQUAL');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session) return;
    api.properties.listMine(session.accessToken).then(setProperties);
  }, [session]);

  const amountNumber = Number(amount);
  const isValidAmount = amount.length > 0 && !Number.isNaN(amountNumber) && amountNumber >= 0;

  function toggleMultiProperty(id: string) {
    setMultiPropertyIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const equalShares = useMemo(
    () => (isValidAmount ? equalSplit(Math.round(amountNumber), multiPropertyIds) : {}),
    [isValidAmount, amountNumber, multiPropertyIds],
  );

  const customSum = useMemo(
    () => multiPropertyIds.reduce((sum, id) => sum + (Number(customAmounts[id]) || 0), 0),
    [multiPropertyIds, customAmounts],
  );
  const customMatchesTotal = isValidAmount && Math.round(amountNumber) === customSum;

  async function handleSubmit() {
    if (!session) return;
    setError(null);

    if (!isValidAmount) return setError(t.expenseNew.errorInvalidAmount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError(t.expenseNew.errorDateFormat);
    if (scopeMode === 'MULTIPLE') {
      if (multiPropertyIds.length === 0) return setError(t.expenseNew.errorSelectProperty);
      if (splitMode === 'CUSTOM' && !customMatchesTotal) return setError(t.expenseNew.errorSplitMismatch);
    }

    setIsSubmitting(true);
    try {
      if (scopeMode === 'SINGLE') {
        await api.expenses.create(
          { category, amount: amountNumber, date, propertyId, note: note || undefined },
          session.accessToken,
        );
      } else if (scopeMode === 'BUSINESS') {
        await api.expenses.create(
          { category, amount: amountNumber, date, propertyId: null, note: note || undefined },
          session.accessToken,
        );
      } else {
        // The backend models one expense per property — a "multiple
        // properties" entry becomes one create call per selected property,
        // each carrying its share of the total.
        const shares = splitMode === 'EQUAL' ? equalShares : Object.fromEntries(multiPropertyIds.map((id) => [id, Number(customAmounts[id]) || 0]));
        for (const id of multiPropertyIds) {
          await api.expenses.create(
            { category, amount: shares[id] ?? 0, date, propertyId: id, note: note || undefined },
            session.accessToken,
          );
        }
      }
      router.replace('/(host-tabs)/expenses');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.expenseNew.errorCreate);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t.expenseNew.headerTitle, headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>{t.expenseNew.propertyLabel}</Text>
        <SegmentedControl
          value={scopeMode}
          onChange={(v) => setScopeMode(v)}
          options={[
            { value: 'SINGLE', label: t.expenseNew.scopeSingle },
            { value: 'MULTIPLE', label: t.expenseNew.scopeMultiple },
            { value: 'BUSINESS', label: t.expenseNew.scopeBusiness },
          ]}
        />

        {scopeMode === 'SINGLE' && (
          <View style={styles.optionList}>
            {properties.map((p) => {
              const selected = propertyId === p.id;
              return (
                <Pressable key={p.id} style={styles.optionRow} onPress={() => setPropertyId(p.id)}>
                  <View style={[styles.radio, selected && styles.radioActive]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <View>
                    <PropertyThumb photoUrl={propertyCoverUrl(p, 120)} size={38} />
                    <View style={[styles.propertyDot, { backgroundColor: propertyColor(p.id) }]} />
                  </View>
                  <Text style={[typography.body, { flex: 1 }]} numberOfLines={2}>{p.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {scopeMode === 'MULTIPLE' && (
          <View style={styles.optionList}>
            {properties.map((p) => {
              const selected = multiPropertyIds.includes(p.id);
              return (
                <Pressable key={p.id} style={styles.optionRow} onPress={() => toggleMultiProperty(p.id)}>
                  <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                    {selected && <Ionicons name="checkmark" size={13} color={colors.white} />}
                  </View>
                  <View>
                    <PropertyThumb photoUrl={propertyCoverUrl(p, 120)} size={38} />
                    <View style={[styles.propertyDot, { backgroundColor: propertyColor(p.id) }]} />
                  </View>
                  <Text style={[typography.body, { flex: 1 }]} numberOfLines={2}>{p.name}</Text>
                </Pressable>
              );
            })}

            {multiPropertyIds.length > 0 && (
              <View style={styles.splitBox}>
                <SegmentedControl
                  value={splitMode}
                  onChange={setSplitMode}
                  options={[
                    { value: 'EQUAL', label: t.expenseNew.splitEqual },
                    { value: 'CUSTOM', label: t.expenseNew.splitCustom },
                  ]}
                />

                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  {multiPropertyIds.map((id) => {
                    const p = properties.find((pr) => pr.id === id);
                    if (!p) return null;
                    return (
                      <View key={id} style={styles.splitRow}>
                        <PropertyThumb photoUrl={propertyCoverUrl(p, 90)} size={26} />
                        <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                        {splitMode === 'EQUAL' ? (
                          <Text style={typography.bodyMuted}>{equalShares[id] ?? 0} MAD</Text>
                        ) : (
                          <View style={styles.splitInputWrap}>
                            <TextInput
                              value={customAmounts[id] ?? ''}
                              onChangeText={(v) => setCustomAmounts((prev) => ({ ...prev, [id]: v }))}
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor={colors.inkFaint}
                              style={styles.splitInput}
                            />
                            <Text style={typography.caption}>MAD</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {splitMode === 'CUSTOM' && isValidAmount && (
                  <Text style={[typography.caption, { marginTop: spacing.sm, color: customMatchesTotal ? colors.primary : colors.danger }]}>
                    {t.expenseNew.splitAllocated(customSum, Math.round(amountNumber))}
                    {customMatchesTotal ? t.expenseNew.splitMatches : ''}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {scopeMode === 'BUSINESS' && (
          <View style={styles.businessNote}>
            <Ionicons name="briefcase-outline" size={16} color={colors.inkMuted} />
            <Text style={[typography.bodyMuted, { flex: 1 }]}>{t.expenseNew.businessNote}</Text>
          </View>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <TextField
            label={t.expenseNew.amountLabel}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t.expenseNew.amountPlaceholder}
          />
        </View>

        <Text style={styles.sectionLabel}>{t.expenseNew.categoryLabel}</Text>
        <View style={styles.chipRow}>
          {CATEGORY_OPTIONS.map((c) => (
            <Chip key={c} label={t.expenses.categoryLabels[c]} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t.expenseNew.dateLabel}</Text>
        <View style={styles.chipRow}>
          <Chip label={t.expenseNew.dateToday} active={date === todayIso()} onPress={() => setDate(todayIso())} />
          <Chip label={t.expenseNew.dateYesterday} active={date === yesterdayIso()} onPress={() => setDate(yesterdayIso())} />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <TextField label={t.expenseNew.dateFormatLabel} value={date} onChangeText={setDate} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <TextField
            label={t.expenseNew.descriptionLabel}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
            placeholder={t.expenseNew.descriptionPlaceholder}
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          label={isSubmitting ? t.expenseNew.saving : t.expenseNew.save}
          onPress={handleSubmit}
          loading={isSubmitting}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionLabel: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionList: { marginTop: spacing.md, gap: spacing.sm },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  /**
   * The per-property colour, kept as a second identity cue now that the
   * photo leads — two properties can look alike in a thumbnail, and this is
   * the same colour they carry on the Calendar and the Expenses breakdown.
   * Clipped to the thumbnail's corner rather than sitting beside it, with a
   * white ring so it reads against a dark photo.
   */
  propertyDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.white,
  },
  splitBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(27,31,35,0.03)',
  },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  splitInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 90 },
  splitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.white,
    textAlign: 'right',
  },
  businessNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(27,31,35,0.03)',
  },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
