import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Expense, Property, propertyCoverUrl } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, SegmentedControl, ErrorBanner, Chip } from '@/components/ui';
import { PropertySelect } from '@/components/PropertySelect';
import {
  EXPENSE_CATEGORY_ICONS,
  EXPENSE_CATEGORY_GROUPS,
  categoryGroupOf,
  ExpenseCategoryGroup,
} from '@/lib/status';
import { propertyColor } from '@/lib/property-colors';
import { PropertyThumb } from '@/components/host-ui';
import { useLanguage } from '@/lib/i18n/language-context';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

type Range = 'MONTH' | 'LAST_MONTH' | 'ALL';
type CategoryFilter = 'ALL' | ExpenseCategoryGroup;

/** 'YYYY-MM' for the current month, shifted by `offset` months. The backend's
 * /expenses list treats `from`/`to` as month keys (see expenses.service.ts). */
function monthKey(offset: number) {
  const d = new Date();
  d.setDate(1); // avoid day-of-month overflow when shifting across shorter months
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

export default function ExpensesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  function rangeLabel(range: Range) {
    if (range === 'MONTH') return t.expenses.rangeMonth;
    if (range === 'LAST_MONTH') return t.expenses.rangeLastMonth;
    return t.expenses.rangeAll;
  }

  const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
    { value: 'ALL', label: t.expenses.filterAll },
    ...(Object.keys(EXPENSE_CATEGORY_GROUPS) as ExpenseCategoryGroup[]).map((g) => ({
      value: g as CategoryFilter,
      label: t.expenses.categoryGroupLabels[g],
    })),
  ];
  const [properties, setProperties] = useState<Property[]>([]);
  /** Cover photo per property id, for the "By property" breakdown rows. */
  const photoByProperty = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const p of properties) map[p.id] = propertyCoverUrl(p, 96);
    return map;
  }, [properties]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [range, setRange] = useState<Range>('MONTH');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null); // null = all
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api.properties.listMine(session.accessToken).then(setProperties);
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const primaryMonth = range === 'MONTH' ? monthKey(0) : range === 'LAST_MONTH' ? monthKey(-1) : undefined;
      const data = await api.expenses.list(
        { propertyId: propertyFilter ?? undefined, from: primaryMonth, to: primaryMonth },
        session.accessToken,
      );
      setExpenses(data.expenses);
      setTotal(data.total);

      // "vs last month" only makes sense when looking at one specific month.
      if (range === 'ALL') {
        setPreviousTotal(null);
      } else {
        const previousMonth = range === 'MONTH' ? monthKey(-1) : monthKey(-2);
        const previousData = await api.expenses.list(
          { propertyId: propertyFilter ?? undefined, from: previousMonth, to: previousMonth },
          session.accessToken,
        );
        setPreviousTotal(previousData.total);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.expenses.loadError);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, range, propertyFilter]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load]),
  );

  const visibleExpenses = useMemo(
    () => (categoryFilter === 'ALL' ? expenses : expenses.filter((e) => categoryGroupOf(e.category) === categoryFilter)),
    [expenses, categoryFilter],
  );

  const delta = useMemo(() => {
    if (previousTotal === null) return null;
    if (previousTotal === 0) return total === 0 ? { pct: 0, down: true } : null; // "+∞%" isn't meaningful — hide it
    const pct = Math.round(((total - previousTotal) / previousTotal) * 100);
    return { pct: Math.abs(pct), down: pct <= 0 };
  }, [total, previousTotal]);

  function confirmDelete(expense: Expense) {
    if (expense.isAutoGenerated) return;
    Alert.alert(t.expenses.deleteConfirmTitle, t.expenses.deleteConfirmMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.expenses.delete, style: 'destructive', onPress: () => handleDelete(expense.id) },
    ]);
  }

  async function handleDelete(id: string) {
    if (!session) return;
    setError(null);
    setDeletingId(id);
    try {
      await api.expenses.remove(id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.expenses.deleteError);
    } finally {
      setDeletingId(null);
    }
  }

  const byProperty = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; total: number }>();
    for (const e of expenses) {
      const key = e.propertyId ?? 'GENERAL';
      const name = e.property?.name ?? t.expenses.sharedBusinessFallback;
      const entry = map.get(key) ?? { id: e.propertyId ?? null, name, total: 0 };
      entry.total += Number(e.amount);
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, t]);

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h1}>{t.expenses.title}</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={{ marginBottom: spacing.sm }}>
          <PropertySelect
            properties={properties}
            value={propertyFilter}
            onChange={setPropertyFilter}
            extraOptions={[
              { value: '__NONE__', label: t.expenses.allProperties },
              { value: 'GENERAL', label: t.expenses.general },
            ]}
          />
        </View>

        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: 'MONTH', label: t.expenses.rangeMonth },
            { value: 'LAST_MONTH', label: t.expenses.rangeLastMonth },
            { value: 'ALL', label: t.expenses.rangeAll },
          ]}
        />

        <Card style={{ marginTop: spacing.md }}>
          <Text style={typography.bodyMuted}>{t.expenses.totalExpenses} · {rangeLabel(range).toLowerCase()}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{total.toFixed(0)} MAD</Text>
            {delta && (
              <View style={[styles.deltaPill, delta.down ? styles.deltaPillGood : styles.deltaPillBad]}>
                <Ionicons
                  name={delta.down ? 'arrow-down' : 'arrow-up'}
                  size={11}
                  color={delta.down ? colors.primary : '#B45309'}
                />
                <Text style={[styles.deltaText, { color: delta.down ? colors.primary : '#B45309' }]}>
                  {t.expenses.deltaVsLastMonth(delta.pct)}
                </Text>
              </View>
            )}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.sm }}>
          <Text style={typography.h3}>{t.expenses.byPropertyTitle}</Text>
          {byProperty.length === 0 ? (
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{t.expenses.byPropertyEmpty}</Text>
          ) : (
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {byProperty.map((row) => (
                <Pressable
                  key={row.key}
                  style={styles.byPropertyRow}
                  onPress={() => setPropertyFilter(propertyFilter === (row.id ?? 'GENERAL') ? null : row.id ?? 'GENERAL')}
                >
                  {/* A general/business expense has no property, so it keeps
                      the colour dot rather than a placeholder photo. */}
                  {row.id ? (
                    <PropertyThumb photoUrl={photoByProperty[row.id]} size={32} />
                  ) : (
                    <View style={[styles.propertyDot, { backgroundColor: propertyColor(row.id) }]} />
                  )}
                  <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>{row.name}</Text>
                  <Text style={styles.byPropertyAmount}>{row.total.toFixed(0)} MAD</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <View style={styles.chipRow}>
          {CATEGORY_FILTERS.map((c) => (
            <Chip key={c.value} label={c.label} active={categoryFilter === c.value} onPress={() => setCategoryFilter(c.value)} />
          ))}
        </View>

        {error && <ErrorBanner message={error} onRetry={load} />}
      </View>

      <FlatList
        data={visibleExpenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            message={expenses.length === 0 ? t.expenses.emptyNoneYet : t.expenses.emptyNoneInCategory}
            actionLabel={t.expenses.logExpenseAction}
            onAction={() => router.push('/host/expense/new')}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={styles.row}>
              <View style={styles.iconCircle}>
                <Ionicons name={EXPENSE_CATEGORY_ICONS[item.category] as any} size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3} numberOfLines={1}>{t.expenses.categoryLabels[item.category]}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.propertyDot, { backgroundColor: propertyColor(item.propertyId) }]} />
                  <Text style={typography.bodyMuted} numberOfLines={1}>
                    {item.property?.name ?? t.expenses.sharedBusinessFallback} · {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                {item.note && <Text style={[typography.caption, { marginTop: 2 }]} numberOfLines={1}>{item.note}</Text>}
                {item.isAutoGenerated && (
                  <View style={styles.autoBadge}>
                    <Ionicons name="sync-outline" size={11} color={colors.inkFaint} />
                    <Text style={styles.autoBadgeText}>{t.expenses.autoAdded}</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>{Number(item.amount).toFixed(0)} MAD</Text>
                {!item.isAutoGenerated && (
                  <Pressable onPress={() => confirmDelete(item)} disabled={deletingId === item.id} hitSlop={8} style={{ marginTop: spacing.xs }}>
                    <Ionicons name="trash-outline" size={16} color={deletingId === item.id ? colors.inkFaint : colors.danger} />
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        )}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/host/expense/new')}>
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.fabLabel}>{t.expenses.addExpense}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  totalValue: { ...typography.h1, fontSize: 28 },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  deltaPillGood: { backgroundColor: colors.successBg },
  deltaPillBad: { backgroundColor: colors.accentBg },
  deltaText: { fontSize: 11, fontWeight: '700' },
  byPropertyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  byPropertyAmount: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  propertyDot: { width: 6, height: 6, borderRadius: 3 },
  amount: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  autoBadgeText: { fontSize: 11, color: colors.inkFaint },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.full,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabLabel: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
