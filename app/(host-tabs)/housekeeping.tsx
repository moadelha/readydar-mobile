import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Modal } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, TextInput } from '@/components/text';
import { Screen, ErrorBanner, SkeletonListItem, SegmentedControl } from '@/components/ui';
import { Button } from '@/components/Button';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, HousekeepingBoard, HousekeepingStatus, HousekeepingUnit } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';
import { useHostAccess } from '@/lib/access';
import { dateLocale } from '@/lib/calendar-visuals';
import { formatDay } from '@/lib/dates';
import { unitLabel } from '@/lib/hostel';
import { useToast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';

type Filter = 'ALL' | 'TO_CLEAN' | 'READY';

const STATUS_COLOR: Record<HousekeepingStatus, { fg: string; bg: string }> = {
  DIRTY: { fg: colors.warning, bg: colors.warningBg },
  CLEAN: { fg: colors.success, bg: colors.successBg },
  INSPECTED: { fg: colors.green700, bg: colors.green100 },
  OUT_OF_ORDER: { fg: colors.danger, bg: colors.dangerBg },
};

/**
 * Hostels: every room and bed, whether it's ready, and what happens in it
 * today (who leaves, who arrives, who stays). Rooms to clean come first and
 * clean in one tap; the other states (inspected, out of order) are in the
 * sheet a row opens. Checking a guest out on the Desk tab is what turns
 * their beds "to clean".
 */
export default function HousekeepingScreen() {
  const { session } = useAuth();
  const { lang } = useLanguage();
  const s = useHostelStrings();
  const toast = useToast();
  const { isManager } = useHostAccess();
  const insets = useSafeAreaInsets();
  const locale = dateLocale(lang);

  const [board, setBoard] = useState<HousekeepingBoard | null>(null);
  const [filter, setFilter] = useState<Filter>('TO_CLEAN');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The room whose sheet is open, and its property's room-type kind for the label. */
  const [open, setOpen] = useState<{ unit: HousekeepingUnit; label: string } | null>(null);
  const [oooMode, setOooMode] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      setBoard(await api.housekeeping.board(session.accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.hkLoadError);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, s]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = useMemo(() => {
    const c = { CLEAN: 0, DIRTY: 0, INSPECTED: 0, OUT_OF_ORDER: 0 } as Record<HousekeepingStatus, number>;
    for (const p of board?.properties ?? []) for (const k of Object.keys(c) as HousekeepingStatus[]) c[k] += p.counts[k] ?? 0;
    return c;
  }, [board]);

  const shows = (u: HousekeepingUnit) =>
    filter === 'ALL' ? true : filter === 'TO_CLEAN' ? u.status === 'DIRTY' : u.status === 'CLEAN' || u.status === 'INSPECTED';

  async function setStatus(unit: HousekeepingUnit, status: HousekeepingStatus, note?: string | null) {
    if (!session) return;
    setBusyId(unit.id);
    try {
      await api.housekeeping.setStatus(unit.id, { status, ...(note ? { note } : {}) }, session.accessToken);
      setOpen(null);
      setOooMode(false);
      setReason('');
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : s.hkActionError, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  /** What happens in this room today, in one or two short lines. */
  function todayLines(u: HousekeepingUnit) {
    const lines: string[] = [];
    if (u.today.departure !== null) lines.push(u.today.departed ? s.left(u.today.departure) : s.leaving(u.today.departure));
    if (u.today.arrival !== null) lines.push(u.today.arrived ? s.arrived(u.today.arrival) : s.arriving(u.today.arrival));
    if (u.today.stayover) lines.push(s.stayover);
    if (u.status === 'OUT_OF_ORDER') {
      if (u.outOfOrderUntil) lines.push(s.offSaleUntil(formatDay(u.outOfOrderUntil, lang, { utc: true, weekday: false })));
      if (u.note) lines.push(u.note);
    }
    return lines;
  }

  const anyRooms = (board?.properties ?? []).some((p) => p.units.length > 0);
  const nothingShown = !!board && board.properties.every((p) => !p.units.some(shows));

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={typography.h1}>{s.hkTitle}</Text>
        {board && anyRooms && (
          <Text style={[typography.bodyMuted, { marginTop: 2 }]}>
            {(['DIRTY', 'CLEAN', 'INSPECTED', 'OUT_OF_ORDER'] as HousekeepingStatus[])
              .filter((k) => totals[k] > 0)
              .map((k) => `${s.status[k]} ${totals[k]}`)
              .join(' · ')}
          </Text>
        )}

        <View style={{ marginTop: spacing.md }}>
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'TO_CLEAN', label: `${s.filterToClean}${totals.DIRTY ? ` ${totals.DIRTY}` : ''}` },
              { value: 'READY', label: s.filterReady },
              { value: 'ALL', label: s.filterAll },
            ]}
          />
        </View>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {isLoading ? (
          <View style={{ marginTop: spacing.lg }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : !anyRooms ? (
          <View style={[styles.emptyLine, { marginTop: spacing.lg }]}>
            <Text style={typography.bodyMuted}>{s.noRooms}</Text>
          </View>
        ) : nothingShown ? (
          <View style={[styles.emptyLine, { marginTop: spacing.lg }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={[typography.bodyMuted, { flex: 1 }]}>{s.nothingToClean}</Text>
          </View>
        ) : (
          board!.properties.map((p) => (
            <View key={p.propertyId}>
              {board!.properties.length > 1 && p.units.some(shows) && <Text style={styles.propertyName}>{p.propertyName}</Text>}
              {p.roomTypes.map((rt) => {
                // Most urgent first: to clean with someone arriving today, then
                // the rest to clean; otherwise the house's own order.
                const urgency = (u: HousekeepingUnit) =>
                  u.status === 'DIRTY' ? (u.today.arrival !== null && !u.today.arrived ? 0 : 1) : 2;
                const units = p.units
                  .filter((u) => u.roomTypeId === rt.id && shows(u))
                  .map((u, i) => ({ u, i }))
                  .sort((a, b) => urgency(a.u) - urgency(b.u) || a.i - b.i)
                  .map(({ u }) => u);
                if (!units.length) return null;
                return (
                  <View key={rt.id} style={{ marginTop: spacing.lg }}>
                    <Text style={styles.groupTitle}>{rt.name}</Text>
                    <View style={styles.list}>
                      {units.map((u, i) => {
                        const label = unitLabel(u.name, rt.kind, s);
                        const tone = STATUS_COLOR[u.status];
                        const lines = todayLines(u);
                        return (
                          // Two tap areas side by side — the room (opens its sheet) and
                          // "Mark clean" — not a button inside a button, which the web
                          // build refuses and screen readers read as one control.
                          <View key={u.id} style={[styles.row, i > 0 && styles.divider]}>
                            <Pressable
                              onPress={() => setOpen({ unit: u, label })}
                              style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.6 }]}
                              accessibilityRole="button"
                            >
                              <View style={styles.titleRow}>
                                <Text style={styles.unitName} numberOfLines={1}>
                                  {label}
                                </Text>
                                <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                                  <Text style={[styles.pillText, { color: tone.fg }]}>{s.status[u.status]}</Text>
                                </View>
                              </View>
                              {lines.map((l) => (
                                <Text key={l} style={styles.todayLine} numberOfLines={1}>
                                  {l}
                                </Text>
                              ))}
                              {u.by && u.at && <Text style={styles.byLine}>{s.byAt(u.by, time(u.at))}</Text>}
                            </Pressable>
                            {u.status === 'DIRTY' && (
                              <Pressable
                                onPress={() => setStatus(u, 'CLEAN')}
                                disabled={busyId === u.id}
                                style={({ pressed }) => [styles.cleanButton, pressed && { opacity: 0.85 }]}
                                accessibilityRole="button"
                                accessibilityLabel={`${s.markClean}: ${label}`}
                              >
                                <Ionicons name={busyId === u.id ? 'hourglass-outline' : 'sparkles-outline'} size={16} color={colors.onPrimary} />
                                <Text style={styles.cleanText}>{s.markClean}</Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* A room's other states */}
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => { setOpen(null); setOooMode(false); }}>
        <Pressable style={styles.backdrop} onPress={() => { setOpen(null); setOooMode(false); }}>
          <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onStartShouldSetResponder={() => true}>
            {open && (
              <>
                <Text style={typography.h2}>{open.label}</Text>
                <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{s.status[open.unit.status]}</Text>

                {oooMode ? (
                  <>
                    <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>{s.outOfOrderHint}</Text>
                    <TextInput
                      value={reason}
                      onChangeText={setReason}
                      placeholder={s.reasonPlaceholder}
                      placeholderTextColor={colors.inkFaint}
                      style={styles.input}
                      maxLength={200}
                    />
                    <Button
                      label={busyId === open.unit.id ? '…' : s.confirmOutOfOrder}
                      variant="danger"
                      loading={busyId === open.unit.id}
                      onPress={() => setStatus(open.unit, 'OUT_OF_ORDER', reason.trim() || null)}
                      style={{ marginTop: spacing.md }}
                    />
                    <Button label={s.cancel} variant="secondary" onPress={() => setOooMode(false)} style={{ marginTop: spacing.sm }} />
                  </>
                ) : (
                  <View style={[styles.list, { marginTop: spacing.md }]}>
                    {(
                      [
                        open.unit.status !== 'CLEAN' && { key: 'CLEAN', icon: 'sparkles-outline', label: s.markClean },
                        open.unit.status !== 'DIRTY' && open.unit.status !== 'OUT_OF_ORDER' && { key: 'DIRTY', icon: 'refresh-outline', label: s.markDirty },
                        isManager && open.unit.status !== 'INSPECTED' && open.unit.status !== 'OUT_OF_ORDER' && { key: 'INSPECTED', icon: 'checkmark-done-outline', label: s.markInspected },
                        open.unit.status === 'OUT_OF_ORDER'
                          ? { key: 'BACK', icon: 'arrow-undo-outline', label: s.backInService }
                          : { key: 'OOO', icon: 'construct-outline', label: s.markOutOfOrder },
                      ].filter(Boolean) as { key: string; icon: string; label: string }[]
                    ).map((a, i) => (
                      <Pressable
                        key={a.key}
                        disabled={busyId === open.unit.id}
                        onPress={() =>
                          a.key === 'OOO'
                            ? setOooMode(true)
                            : // Back in service means to be made up first.
                              setStatus(open.unit, a.key === 'BACK' ? 'DIRTY' : (a.key as HousekeepingStatus))
                        }
                        style={({ pressed }) => [styles.sheetRow, i > 0 && styles.divider, pressed && { backgroundColor: colors.surface2 }]}
                        accessibilityRole="button"
                      >
                        <Ionicons name={a.icon as any} size={18} color={a.key === 'OOO' ? colors.danger : colors.inkMuted} />
                        <Text style={[styles.sheetLabel, a.key === 'OOO' && { color: colors.danger }]}>{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  propertyName: { ...typography.h2, marginTop: spacing.xl },
  groupTitle: { ...typography.label, marginBottom: spacing.sm },
  list: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  emptyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 60 },
  rowMain: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unitName: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  pillText: { fontSize: 12, fontWeight: '600' },
  todayLine: { fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 2 },
  byLine: { ...typography.caption, marginTop: 4 },
  cleanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  cleanText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  sheetLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.ink },
  input: {
    marginTop: spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
});
