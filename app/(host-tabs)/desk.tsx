import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { Screen, ErrorBanner, SkeletonListItem } from '@/components/ui';
import { PropertySelect } from '@/components/PropertySelect';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CalendarEvent, Property, resolveCheckInUrl } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';
import { useDeskStrings } from '@/lib/i18n/desk-strings';
import { useHostAccess } from '@/lib/access';
import { QuickAction } from '@/components/desk-ui';
import { addDaysIso, dateLocale, todayIso } from '@/lib/calendar-visuals';
import { collapseRoomGroups, guestNameOf, propertyDay, stayRef, unitLabel } from '@/lib/hostel';
import { checkInCopyMessage } from '@/lib/checkin-message';
import { formatDay } from '@/lib/dates';
import { useToast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';

type Action = 'CHECK_IN' | 'CHECK_OUT' | 'UNDO_CHECK_IN' | 'UNDO_CHECK_OUT';

/**
 * Hostels: today at the front desk — who arrives and who leaves, by
 * booking, with the rooms and beds they take. One tap marks a guest
 * arrived or checked out (checking out turns their beds "to clean" on the
 * Rooms tab). Same data and rules as the web dashboard's front desk.
 * From here staff also add a walk-in or a later stay, register guests with
 * their ID photos, take a payment, and open the cash drawer, the day's
 * meals and activities, and the bed plan.
 */
export default function DeskScreen() {
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const s = useHostelStrings();
  const ds = useDeskStrings();
  const router = useRouter();
  const { has } = useHostAccess();
  const toast = useToast();
  const locale = dateLocale(lang);

  const [properties, setProperties] = useState<Property[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      // A day either side: each property's "today" follows its own zone,
      // which can be a day off the phone's.
      const today = todayIso();
      const [list, cal] = await Promise.all([
        api.properties.listMine(session.accessToken),
        api.properties.getCalendar(addDaysIso(today, -1), addDaysIso(today, 1), session.accessToken),
      ]);
      setProperties(list);
      setEvents(cal);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.loadError);
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

  const { arrivals, departures } = useMemo(() => {
    const dayOf = new Map(properties.map((p) => [p.id, propertyDay(p.timezone)]));
    const stays = collapseRoomGroups(
      events.filter(
        (e) =>
          e.kind === 'GUEST_STAY' &&
          !e.isBlocked &&
          (e.reservationId || e.checkInId) &&
          (!propertyFilter || e.propertyId === propertyFilter),
      ),
    );
    const todayOf = (e: CalendarEvent) => dayOf.get(e.propertyId) ?? propertyDay();
    // Still to do first; done ones sink to the bottom.
    const byPending = (done: (e: CalendarEvent) => boolean) => (a: CalendarEvent, b: CalendarEvent) =>
      Number(done(a)) - Number(done(b)) || guestNameOf(a).localeCompare(guestNameOf(b));
    return {
      arrivals: stays.filter((e) => e.date.slice(0, 10) === todayOf(e)).sort(byPending((e) => !!e.checkedInAt)),
      departures: stays.filter((e) => e.endDate.slice(0, 10) === todayOf(e)).sort(byPending((e) => !!e.checkedOutAt)),
    };
  }, [events, properties, propertyFilter]);

  async function act(e: CalendarEvent, action: Action) {
    if (!session) return;
    setBusyId(`${e.id}:${action}`);
    try {
      const res = await api.frontDesk.status({ ...stayRef(e), action }, session.accessToken);
      // Every row of the booking moves together (the API updates them all).
      setEvents((prev) =>
        prev.map((x) =>
          (e.groupKey && x.groupKey === e.groupKey) || x.id === e.id
            ? { ...x, checkedInAt: res.checkedInAt, checkedOutAt: res.checkedOutAt }
            : x,
        ),
      );
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : s.actionError, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function copyMessage(e: CalendarEvent) {
    if (!e.checkInToken) return;
    await Clipboard.setStringAsync(
      checkInCopyMessage(t, lang, { propertyName: e.propertyName, checkIn: e.date }, resolveCheckInUrl(e.checkInToken)),
    );
    toast.show(t.calendarHost.checkInLinkCopied);
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  /** "Dorm 6 · Bed 3, Bed 4" */
  function roomsLine(e: CalendarEvent) {
    const units = [...new Set(e.roomUnits ?? [])].map((n) => unitLabel(n, e.roomTypeKind, s)).join(', ');
    return [e.roomTypeName, units].filter(Boolean).join(' · ');
  }

  function sourceLine(e: CalendarEvent) {
    if (e.walkIn) return s.walkIn;
    if (e.source === 'MANUAL') return s.offline;
    if (e.channelName) return e.channelName;
    return e.source ? t.sourceLabel[e.source as keyof typeof t.sourceLabel] ?? null : null;
  }

  function renderStayRow(e: CalendarEvent, mode: 'arrival' | 'departure') {
    const nights = Math.max(1, Math.round((Date.parse(e.endDate) - Date.parse(e.date)) / 86_400_000));
    const meta = [sourceLine(e), e.guestCount ? t.common.guestsCount(e.guestCount) : null, t.calendarHost.nightsCount(nights)]
      .filter(Boolean)
      .join(' · ');
    const done = mode === 'arrival' ? !!e.checkedInAt : !!e.checkedOutAt;
    const doneAt = mode === 'arrival' ? e.checkedInAt : e.checkedOutAt;
    const action: Action = mode === 'arrival' ? (done ? 'UNDO_CHECK_IN' : 'CHECK_IN') : done ? 'UNDO_CHECK_OUT' : 'CHECK_OUT';
    const busy = busyId === `${e.id}:${action}`;
    const detailsMissing = mode === 'arrival' && !!e.checkInId && e.checkInStatus !== 'SUBMITTED';

    return (
      <View style={[styles.rowWrap, done && styles.rowDone]}>
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {guestNameOf(e)}
          </Text>
          {roomsLine(e) ? (
            <Text style={styles.rooms} numberOfLines={2}>
              {roomsLine(e)}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          <View style={styles.chips}>
            <View style={[styles.chip, done ? styles.chipDone : styles.chipMuted]}>
              <Text style={[styles.chipText, done && { color: colors.success }]}>
                {done && doneAt
                  ? mode === 'arrival'
                    ? s.arrivedAt(time(doneAt))
                    : s.leftAt(time(doneAt))
                  : mode === 'arrival'
                    ? s.expected
                    : s.stillHere}
              </Text>
            </View>
            {mode === 'arrival' && e.checkInId ? (
              <View style={[styles.chip, detailsMissing ? styles.chipWarn : styles.chipDone]}>
                <Text style={[styles.chipText, { color: detailsMissing ? colors.warning : colors.success }]}>
                  {detailsMissing ? s.detailsMissing : s.detailsDone}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {done ? (
          <Pressable onPress={() => act(e, action)} disabled={busy} hitSlop={8} style={styles.undo} accessibilityRole="button">
            <Text style={styles.undoText}>{busy ? '…' : s.undo}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => act(e, action)}
            disabled={busy}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Ionicons name={mode === 'arrival' ? 'log-in-outline' : 'log-out-outline'} size={16} color={colors.onPrimary} />
            <Text style={styles.actionText}>{busy ? '…' : mode === 'arrival' ? s.markArrived : s.markLeft}</Text>
          </Pressable>
        )}
        </View>
        {/* What else to do for this stay, under the whole row. */}
        <View style={styles.links}>
          {detailsMissing && e.checkInId && has('CHECKINS') ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/host/desk/register', params: { checkInId: e.checkInId!, name: guestNameOf(e), count: String(e.guestCount || 1) } })
              }
              style={({ pressed }) => [styles.pill, pressed && { backgroundColor: colors.surface2 }]}
              accessibilityRole="button"
              accessibilityLabel={ds.registerAtDesk}
            >
              <Ionicons name="id-card-outline" size={15} color={colors.green700} />
              <Text style={styles.pillText}>{ds.shortRegister}</Text>
            </Pressable>
          ) : null}
          {detailsMissing && e.checkInToken ? (
            <Pressable
              onPress={() => copyMessage(e)}
              style={({ pressed }) => [styles.pill, pressed && { backgroundColor: colors.surface2 }]}
              accessibilityRole="button"
              accessibilityLabel={s.copyMessage}
            >
              <Ionicons name="copy-outline" size={15} color={colors.green700} />
              <Text style={styles.pillText}>{ds.shortCopy}</Text>
            </Pressable>
          ) : null}
          {has('REPORTS') ? (
            <Pressable
              onPress={() => router.push({ pathname: '/host/desk/pay', params: { ...stayRef(e), name: guestNameOf(e) } })}
              style={({ pressed }) => [styles.pill, pressed && { backgroundColor: colors.surface2 }]}
              accessibilityRole="button"
              accessibilityLabel={ds.takePayment}
            >
              <Ionicons name="cash-outline" size={15} color={colors.green700} />
              <Text style={styles.pillText}>{ds.shortPay}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  function renderSection(title: string, list: CalendarEvent[], mode: 'arrival' | 'departure', empty: string, count: string) {
    return (
      <View style={{ marginTop: spacing.lg }}>
        <View style={styles.sectionHead}>
          <Text style={typography.h3}>{title}</Text>
          {list.length > 0 && <Text style={typography.caption}>{count}</Text>}
        </View>
        {list.length === 0 ? (
          <View style={styles.emptyLine}>
            <Text style={typography.bodyMuted}>{empty}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((e, i) => (
              <View key={e.id} style={i > 0 && styles.divider}>
                {renderStayRow(e, mode)}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={[typography.label, { marginBottom: 6 }]}>{formatDay(new Date(), lang)}</Text>
        <Text style={typography.h1}>{s.deskTitle}</Text>

        <View style={styles.quickRow}>
          <QuickAction icon="person-add-outline" label={ds.newStay} onPress={() => router.push('/host/desk/new-stay')} />
          {has('REPORTS') && <QuickAction icon="wallet-outline" label={ds.cash} onPress={() => router.push('/host/cash')} />}
          <QuickAction icon="cafe-outline" label={ds.activities} onPress={() => router.push('/host/activities')} />
          <QuickAction icon="grid-outline" label={ds.bedPlan} onPress={() => router.push('/host/beds')} />
        </View>

        {properties.length > 1 && (
          <View style={{ marginTop: spacing.md }}>
            <PropertySelect
              properties={properties}
              value={propertyFilter}
              onChange={setPropertyFilter}
              extraOptions={[{ value: '__NONE__', label: t.calendarHost.allProperties }]}
            />
          </View>
        )}

        {error && <ErrorBanner message={error} onRetry={load} />}

        {isLoading ? (
          <View style={{ marginTop: spacing.lg }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {renderSection(
              s.arrivingToday,
              arrivals,
              'arrival',
              s.noArrivals,
              s.arrivedCount(arrivals.filter((e) => e.checkedInAt).length, arrivals.length),
            )}
            {renderSection(
              s.leavingToday,
              departures,
              'departure',
              s.noDepartures,
              s.leftCount(departures.filter((e) => e.checkedOutAt).length, departures.length),
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  list: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  emptyLine: { paddingVertical: 12, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  rowWrap: { padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowDone: { backgroundColor: colors.surface2 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  rooms: { fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 2 },
  meta: { ...typography.caption, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  chipMuted: { backgroundColor: colors.surface2 },
  chipDone: { backgroundColor: colors.successBg },
  chipWarn: { backgroundColor: colors.warningBg },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.green700 },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary },
  undo: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  undoText: { fontSize: 14, fontWeight: '500', color: colors.inkMuted },
});
