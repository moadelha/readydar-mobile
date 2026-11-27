import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/text';
import { Screen, TextField, Chip, ErrorBanner, SkeletonListItem } from '@/components/ui';
import { Button } from '@/components/Button';
import { AmountLine } from '@/components/desk-ui';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CashMethod, StayBalance, StayRef } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useDeskStrings, formatMad } from '@/lib/i18n/desk-strings';
import { useLargeTitle } from '@/lib/large-title';
import { useToast } from '@/lib/toast';
import { dateLocale } from '@/lib/calendar-visuals';
import { colors, radius, spacing, typography } from '@/theme';

const METHODS: CashMethod[] = ['CASH', 'CARD', 'TRANSFER'];

/**
 * Hostels: what a stay owes at the desk, and taking a payment for it. Cash
 * goes in the open shift's drawer (the API asks for a shift first); card and
 * transfer are recorded the same way, outside the drawer. Same balance the
 * website's front desk shows, in MAD.
 */
export default function PayScreen() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const s = useDeskStrings();
  const toast = useToast();
  const params = useLocalSearchParams<{ reservationId?: string; checkInId?: string; name?: string }>();
  const ref: StayRef | null = params.reservationId
    ? { reservationId: params.reservationId }
    : params.checkInId
      ? { checkInId: params.checkInId }
      : null;

  const [balance, setBalance] = useState<StayBalance | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CashMethod>('CASH');
  const [error, setError] = useState<string | null>(null);
  const [needShift, setNeedShift] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session || !ref) return;
    setError(null);
    try {
      const b = await api.frontDesk.balance(ref, session.accessToken);
      setBalance(b);
      setAmount(b.due > 0 ? String(Math.round(b.due * 100) / 100) : '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.paymentError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, params.reservationId, params.checkInId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!session || !ref || !balance) return;
    setError(null);
    setNeedShift(false);
    const value = Number(amount.replace(',', '.'));
    if (!(value > 0)) {
      setError(s.amountInvalid);
      return;
    }
    setBusy(true);
    try {
      await api.cashDesk.record(balance.propertyId, { direction: 'IN', method, category: 'ROOM', amount: Math.round(value * 100) / 100, ...ref }, session.accessToken);
      toast.show(s.paymentSaved);
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NO_SHIFT') setNeedShift(true);
      else setError(err instanceof ApiError ? err.message : s.paymentError);
    } finally {
      setBusy(false);
    }
  }

  const locale = dateLocale(lang);
  const online = balance?.payment?.status === 'ota';

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.payTitle), headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" {...largeTitle.scrollProps}>
        <Text style={typography.h1}>{s.payTitle}</Text>
        {params.name ? <Text style={[typography.h3, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>{params.name}</Text> : null}

        {!balance ? (
          error ? (
            <ErrorBanner message={error} onRetry={load} />
          ) : (
            <SkeletonListItem />
          )
        ) : (
          <>
            <View style={styles.card}>
              <AmountLine label={s.total} value={formatMad(balance.owed, lang)} />
              {(balance.extras ?? []).map((x) => (
                <AmountLine key={x.id} label={`  ${s.extrasLine(x.name, x.people)}`} value={formatMad(x.amount, lang)} />
              ))}
              <AmountLine label={s.paid} value={formatMad(balance.paid, lang)} />
              <View style={styles.rule} />
              <AmountLine label={s.leftToPay} value={formatMad(balance.due, lang)} strong />
            </View>

            {online ? (
              <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>{s.paidOnline}</Text>
            ) : balance.due <= 0 ? (
              <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>{s.nothingDue}</Text>
            ) : null}

            {!online && (
              <View style={{ marginTop: spacing.lg }}>
                <TextField label={s.amount('MAD')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                <Text style={styles.label}>{s.method}</Text>
                <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
                  {METHODS.map((m) => (
                    <Chip key={m} label={s.methods[m]} active={method === m} onPress={() => setMethod(m)} />
                  ))}
                </View>
                {error && <ErrorBanner message={error} />}
                {needShift && (
                  <View style={styles.shiftBox}>
                    <Text style={{ color: colors.warning, fontSize: 14, marginBottom: spacing.sm }}>{s.needShift}</Text>
                    <Button label={s.openShiftNow} variant="outline" onPress={() => router.push('/host/cash')} />
                  </View>
                )}
                <Button label={busy ? s.recording : s.recordPayment} onPress={submit} loading={busy} style={{ marginTop: spacing.sm }} />
              </View>
            )}

            {balance.entries.length > 0 && (
              <View style={{ marginTop: spacing.xl }}>
                <Text style={[typography.h3, { marginBottom: spacing.sm }]}>{s.earlierPayments}</Text>
                <View style={styles.card}>
                  {balance.entries.map((e) => (
                    <AmountLine
                      key={e.id}
                      label={`${new Date(e.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · ${s.methods[e.method]} · ${e.createdByName}`}
                      value={`${e.direction === 'OUT' ? '−' : ''}${formatMad(e.amount, lang)}`}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.ink, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shiftBox: { backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
});
