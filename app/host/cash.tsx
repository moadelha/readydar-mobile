import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Text } from '@/components/text';
import { Screen, TextField, Chip, ErrorBanner, SkeletonListItem } from '@/components/ui';
import { Button } from '@/components/Button';
import { PropertySelect } from '@/components/PropertySelect';
import { AmountLine } from '@/components/desk-ui';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CashInCategory, CashMethod, CashOutCategory, CashStatus, Property } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useDeskStrings, formatMad } from '@/lib/i18n/desk-strings';
import { useLargeTitle } from '@/lib/large-title';
import { useToast } from '@/lib/toast';
import { dateLocale } from '@/lib/calendar-visuals';
import { colors, radius, spacing, typography } from '@/theme';

type Form = { kind: 'in' | 'out' | 'end' } | null;
const IN_CATEGORIES: CashInCategory[] = ['ROOM', 'TOURIST_TAX', 'EXTRA', 'OTHER_IN'];
const OUT_CATEGORIES: CashOutCategory[] = ['EXPENSE', 'DROP', 'OTHER_OUT'];
const IN_METHODS: CashMethod[] = ['CASH', 'CARD', 'TRANSFER'];

const toNumber = (v: string) => Number(v.replace(',', '.').replace(/\s/g, ''));

/**
 * Hostels: the cash drawer. A shift starts by counting the drawer and ends
 * by counting it again; in between the screen shows what should be in it.
 * Money in and out (a purchase, cash taken to the safe) is recorded here;
 * payments for a stay are taken from the Desk. Closing the day and
 * reopening it stay on the website, with the day's report.
 */
export default function CashScreen() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const s = useDeskStrings();
  const toast = useToast();
  const locale = dateLocale(lang);

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [status, setStatus] = useState<CashStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<Form>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<CashMethod>('CASH');
  const [inCategory, setInCategory] = useState<CashInCategory>('ROOM');
  const [outCategory, setOutCategory] = useState<CashOutCategory>('EXPENSE');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const list = properties.length ? properties : await api.properties.listMine(session.accessToken);
      if (!properties.length) setProperties(list);
      const id = propertyId ?? list[0]?.id ?? null;
      if (!propertyId && id) setPropertyId(id);
      if (id) setStatus(await api.cashDesk.status(id, session.accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.cashError);
    } finally {
      setRefreshing(false);
    }
  }, [session, properties, propertyId, s.cashError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const money = (n: number) => formatMad(n, lang);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  function openForm(kind: 'in' | 'out' | 'end') {
    setForm({ kind });
    setAmount('');
    setNote('');
    setMethod('CASH');
    setError(null);
  }

  async function run(action: () => Promise<unknown>, after?: (res: unknown) => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      after?.(res);
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.cashActionError);
    } finally {
      setBusy(false);
    }
  }

  function startShift() {
    if (!session || !propertyId) return;
    const value = toNumber(amount);
    if (!(value >= 0) || amount.trim() === '') {
      setError(s.amountInvalid);
      return;
    }
    run(() => api.cashDesk.openShift(propertyId, value, session.accessToken), () => {
      setAmount('');
      setLastResult(null);
    });
  }

  function saveEntry() {
    if (!session || !propertyId || !form) return;
    const value = toNumber(amount);
    if (!(value > 0)) {
      setError(s.amountInvalid);
      return;
    }
    const out = form.kind === 'out';
    run(
      () =>
        api.cashDesk.record(
          propertyId,
          {
            direction: out ? 'OUT' : 'IN',
            method: out ? 'CASH' : method,
            category: out ? outCategory : inCategory,
            amount: Math.round(value * 100) / 100,
            ...(note.trim() ? { note: note.trim() } : {}),
          },
          session.accessToken,
        ),
      () => toast.show(s.saved),
    );
  }

  function endShift() {
    if (!session || !status?.shift) return;
    const value = toNumber(amount);
    if (!(value >= 0) || amount.trim() === '') {
      setError(s.amountInvalid);
      return;
    }
    run(
      () => api.cashDesk.closeShift(status.shift!.id, value, note.trim() || undefined, session.accessToken),
      (res) => {
        const diff = (res as { difference: number | null }).difference ?? 0;
        setLastResult(s.shiftEnded(Math.abs(diff) < 0.005 ? s.balanced : diff > 0 ? s.over(money(diff)) : s.short(money(-diff))));
      },
    );
  }

  const shift = status?.shift ?? null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.cashTitle), headerBackTitle: t.common.back }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        {...largeTitle.scrollProps}
      >
        <Text style={typography.h1}>{s.cashTitle}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>{s.cashIntro}</Text>

        {properties.length > 1 && (
          <View style={{ marginBottom: spacing.md }}>
            <PropertySelect
              properties={properties}
              value={propertyId}
              onChange={(id) => {
                if (!id) return;
                setPropertyId(id);
                setStatus(null);
              }}
            />
          </View>
        )}

        {lastResult && (
          <View style={styles.resultBox}>
            <Text style={{ color: colors.success, fontWeight: '600' }}>{lastResult}</Text>
          </View>
        )}

        {!status ? (
          error ? <ErrorBanner message={error} onRetry={load} /> : <SkeletonListItem />
        ) : (
          <>
            {status.dayClosed && (
              <View style={styles.warnBox}>
                <Text style={{ color: colors.warning, fontSize: 14 }}>{s.dayClosed}</Text>
              </View>
            )}

            {!shift ? (
              <View style={styles.card}>
                <Text style={typography.h3}>{s.noShift}</Text>
                <Text style={[typography.bodyMuted, { marginTop: 4 }]}>{s.noShiftHint}</Text>
                {status.lastCount && (
                  <Text style={[typography.caption, { marginTop: spacing.sm }]}>
                    {s.lastCount(money(status.lastCount.counted), status.lastCount.closedByName ?? '')}
                  </Text>
                )}
                <View style={{ marginTop: spacing.md }}>
                  <TextField
                    label={s.drawerNow}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder={status.lastCount ? String(status.lastCount.counted) : '0'}
                  />
                  {error && <ErrorBanner message={error} />}
                  <Button label={s.openShift} onPress={startShift} loading={busy} disabled={status.dayClosed} />
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={[typography.caption, { marginBottom: spacing.sm }]}>{s.shiftOpen(shift.openedByName, time(shift.openedAt))}</Text>
                <AmountLine label={s.openingFloat} value={money(shift.openingFloat)} />
                <AmountLine label={s.cashIn} value={`+ ${money(shift.cashIn)}`} />
                <AmountLine label={s.cashOut} value={`− ${money(shift.cashOut)}`} />
                <View style={styles.rule} />
                <AmountLine label={s.expected} value={money(shift.expected)} strong />
              </View>
            )}

            {shift && !form && (
              <View style={[styles.row, { marginTop: spacing.md }]}>
                <Button label={s.moneyIn} variant="outline" onPress={() => openForm('in')} style={{ flex: 1 }} disabled={status.dayClosed} />
                <Button label={s.moneyOut} variant="outline" onPress={() => openForm('out')} style={{ flex: 1 }} disabled={status.dayClosed} />
              </View>
            )}

            {shift && form && (
              <View style={[styles.card, { marginTop: spacing.md }]}>
                <Text style={[typography.h3, { marginBottom: spacing.md }]}>
                  {form.kind === 'in' ? s.moneyIn : form.kind === 'out' ? s.moneyOut : s.endShift}
                </Text>
                {form.kind === 'end' && <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>{s.countNow}</Text>}
                <TextField label={s.amount('MAD')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
                {form.kind === 'in' && (
                  <>
                    <Text style={styles.label}>{s.method}</Text>
                    <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
                      {IN_METHODS.map((m) => (
                        <Chip key={m} label={s.methods[m]} active={method === m} onPress={() => setMethod(m)} />
                      ))}
                    </View>
                    <Text style={styles.label}>{s.category}</Text>
                    <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
                      {IN_CATEGORIES.map((c) => (
                        <Chip key={c} label={s.inCategories[c as keyof typeof s.inCategories]} active={inCategory === c} onPress={() => setInCategory(c)} />
                      ))}
                    </View>
                  </>
                )}
                {form.kind === 'out' && (
                  <>
                    <Text style={styles.label}>{s.category}</Text>
                    <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
                      {OUT_CATEGORIES.map((c) => (
                        <Chip key={c} label={s.outCategories[c as keyof typeof s.outCategories]} active={outCategory === c} onPress={() => setOutCategory(c)} />
                      ))}
                    </View>
                  </>
                )}
                <TextField label={s.note} value={note} onChangeText={setNote} maxLength={300} autoCapitalize="sentences" />
                {error && <ErrorBanner message={error} />}
                <View style={styles.row}>
                  <Button label={s.cancel} variant="outline" onPress={() => setForm(null)} style={{ flex: 1 }} />
                  <Button
                    label={form.kind === 'end' ? s.confirmEnd : s.save}
                    onPress={form.kind === 'end' ? endShift : saveEntry}
                    loading={busy}
                    variant={form.kind === 'end' ? 'danger' : 'primary'}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}

            <View style={{ marginTop: spacing.xl }}>
              <Text style={[typography.label, { marginBottom: spacing.sm }]}>{s.todayTotals}</Text>
              <View style={styles.card}>
                <AmountLine label={s.moneyIn} value={money(status.todayIn)} />
                <AmountLine label={s.moneyOut} value={money(status.todayOut)} />
              </View>
            </View>

            {shift && !form && (
              <Button label={s.endShift} variant="outline" onPress={() => openForm('end')} style={{ marginTop: spacing.lg }} />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  row: { flexDirection: 'row', gap: spacing.sm },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.ink, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warnBox: { backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  resultBox: { backgroundColor: colors.successBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
});

