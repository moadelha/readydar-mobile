import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Linking, Modal, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAuth, ApiError } from '@/lib/auth-context';
import {
  api,
  PropertyStatusItem,
  CalendarEvent,
  PendingCheckIn,
  AllCheckIn,
  Property,
  resolveCheckInUrl,
  propertyCoverUrl,
} from '@/lib/api';
import { Screen, Card, EmptyState, ErrorBanner, Reveal, SkeletonListItem, StatusBadge } from '@/components/ui';
import {
  SectionHeader,
  PropertyRow,
  StatusTag,
  FilterDropdown,
  PropertyThumb,
  NotificationBell,
  ToneIcon,
} from '@/components/host-ui';
import { Button } from '@/components/Button';
import {
  PROPERTY_STATUS_TONE,
  PropertyStatus,
  UPCOMING_CHECKIN_WINDOW_MS,
} from '@/lib/status';
import { stayLabel } from '@/lib/checkin-groups';
import { todayIso, addDaysIso } from '@/lib/calendar-visuals';
import { addDismissed, clearDismissed, pruneDismissed } from '@/lib/dismissed';
import {
  buildNotifications,
  notificationTime,
  addSeen,
  pruneSeen,
  unreadCount,
  HostNotification,
} from '@/lib/notifications';
import { useToast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/lib/i18n/language-context';
import { Dict } from '@/lib/i18n/dictionary';
import { useHostAccess } from '@/lib/access';

/**
 * How many rows each section shows before the rest go behind "View all".
 * Home is a summary — a host who wants the full list has a tab for it.
 */
const CHECKIN_LIMIT = 3;
const TOMORROW_LIMIT = 4;

/** Filters offered on the "All apartments" section. */
type AllFilter = 'ALL' | PropertyStatus;

/**
 * One row of the "Tomorrow's checkouts" section — a property with a guest
 * leaving tomorrow, so the host can see what needs to be turned around
 * before the day is out. `turnover` and `incomingEvent` flag the tighter,
 * same-day case where another guest checks in on the same date.
 */
type TomorrowCheckout = {
  propertyId: string;
  propertyName: string;
  location: string;
  photoUrl: string | null;
  event: CalendarEvent;
  turnover: boolean;
  incomingEvent: CalendarEvent | null;
};

/** A pending link has no submitted guest record yet, so the only name available is the hint carried over from the reservation. */
function guestLabel(item: PendingCheckIn, t: Dict) {
  return item.guestNameHint?.trim() || t.dashboardHost.guestFallback;
}

/**
 * How many whole calendar days away a date is — negative for the past.
 * Compared by day rather than elapsed hours, so a stay starting at 15:00
 * today reads "today" at 9am instead of "tomorrow" just because it's more
 * than 24h out by the clock.
 */
function daysAway(iso: string) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / (24 * 60 * 60 * 1000));
}

/** The short pill that sits on a check-in's photo: "Today", "Tomorrow", or the date. */
function arrivalBadge(iso: string, t: Dict): { label: string; tone: 'primary' | 'accent' | 'danger' } {
  const days = daysAway(iso);
  if (days < 0) return { label: t.relativeDate.overdue, tone: 'danger' };
  if (days === 0) return { label: t.relativeDate.today, tone: 'primary' };
  if (days === 1) return { label: t.relativeDate.tomorrow, tone: 'accent' };
  return {
    label: new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    tone: 'accent',
  };
}

/** "Today · Sat 13 Sep" — relative wording first, with the real date attached. */
function arrivalPhrase(iso: string, t: Dict) {
  const days = daysAway(iso);
  const date = new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  if (days === 0) return t.relativeDate.todayAt(date);
  if (days === 1) return t.relativeDate.tomorrowAt(date);
  if (days === -1) return t.relativeDate.yesterdayAt(date);
  if (days < -1) return t.relativeDate.daysAgoAt(Math.abs(days), date);
  return t.relativeDate.inDaysAt(days, date);
}

/**
 * "Check-in 3:00 PM" from the property's configured arrival time.
 *
 * The check-in record's own `expectedCheckIn` is a date the host picked, so
 * its time component is whatever the picker defaulted to — usually midnight,
 * which would be worse than useless on screen. The property's `checkInTime`
 * setting is the real answer, and properties that haven't set one simply
 * don't show a time.
 */
function checkInTimeLabel(property?: Property | null): string | null {
  const raw = property?.checkInTime?.trim();
  if (!raw) return null;
  const [h, m] = raw.split(':').map(Number);
  if (!Number.isFinite(h)) return raw;
  const date = new Date();
  date.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Same as `checkInTimeLabel` but for the property's configured checkout time. */
function checkOutTimeLabel(property?: Property | null): string | null {
  const raw = property?.checkOutTime?.trim();
  if (!raw) return null;
  const [h, m] = raw.split(':').map(Number);
  if (!Number.isFinite(h)) return raw;
  const date = new Date();
  date.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "City Center · Apartment 3" — the unit number only when the property has one. */
function locationLine(property?: Property | null, fallbackName?: string) {
  const city = property?.city?.name ?? '';
  const unit = property?.apartmentNumber?.trim();
  return [city || fallbackName, unit].filter(Boolean).join(' · ');
}

export default function HostDashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  // Sheets below render inside a <Modal>, which sits outside the <Screen>
  // tree — so they don't inherit its safe-area padding and have to consume
  // the bottom inset themselves. Without it the last button in a sheet sits
  // under Android's gesture bar (edgeToEdgeEnabled is on).
  const insets = useSafeAreaInsets();
  const { has, isManager } = useHostAccess();
  const canCheckins = has('CHECKINS');

  const [overview, setOverview] = useState<PropertyStatusItem[]>([]);
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [tomorrowEvents, setTomorrowEvents] = useState<CalendarEvent[]>([]);
  const [pendingCheckIns, setPendingCheckIns] = useState<PendingCheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allFilter, setAllFilter] = useState<AllFilter>('ALL');
  /** The check-in whose reservation card is open, if any. */
  const [openCheckIn, setOpenCheckIn] = useState<PendingCheckIn | null>(null);
  /** The tomorrow's-checkout row whose detail card is open, if any. */
  const [openCheckout, setOpenCheckout] = useState<TomorrowCheckout | null>(null);
  /**
   * What happens after this checkout, for properties that *aren't* a
   * same-day turnover (those already show their incoming guest inline —
   * see `tomorrowCheckouts`). Fetched lazily per property, only once the
   * sheet is actually open, rather than upfront for every row: it's a
   * second network call per property and most hosts only open a couple of
   * these on any given day.
   */
  const [followUp, setFollowUp] = useState<{
    propertyId: string;
    loading: boolean;
    next: CalendarEvent | null;
    blockedNextDay: boolean;
  } | null>(null);
  const [timingBusy, setTimingBusy] = useState(false);
  /**
   * The cleaner reminder for the checkout sheet that's open: which stay to
   * remind about (from GET /turnovers/tomorrow) and who it goes to. Fetched
   * lazily when a sheet opens, like `followUp` above — one call per sheet
   * rather than on every dashboard load. `target` is null when there's
   * nothing remindable: no contact on the property, or already sent.
   */
  const [reminder, setReminder] = useState<{
    propertyId: string;
    loading: boolean;
    target: { kind: 'checkin' | 'reservation'; id: string; contactName: string } | null;
    sending: boolean;
    sent: boolean;
  } | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);
  /** Check-in ids the host has cleared off Home — see src/lib/dismissed.ts. */
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  /** Every check-in across every property — the only complete source for "a guest submitted". See src/lib/notifications.ts. */
  const [allCheckIns, setAllCheckIns] = useState<AllCheckIn[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const today = todayIso();
      const tomorrow = addDaysIso(today, 1);
      const [statusList, todayList, tomorrowList, checkIns, everyCheckIn] = await Promise.all([
        api.properties.getStatusOverview(session.accessToken),
        api.properties.getCalendar(today, today, session.accessToken),
        // A separate day range rather than widening the first call — Home
        // only ever needs today's and tomorrow's events, never a range.
        api.properties.getCalendar(tomorrow, tomorrow, session.accessToken),
        // /checkins/pending, not /checkins/all — the server already drops
        // anything submitted or past its expiry, so the years of stale links
        // a pre-fix Hospitable backfill created never reach this screen.
        api.checkins.listPendingForHost(session.accessToken).catch(() => [] as PendingCheckIn[]),
        // ...and /checkins/all *as well*, for the notification bell, which
        // needs the opposite set: the ones a guest has already submitted.
        // Tolerated separately so the heaviest call on this screen failing
        // costs the host their bell, not their dashboard.
        api.checkins.listAll(session.accessToken).catch(() => [] as AllCheckIn[]),
      ]);
      setOverview(statusList);
      setTodayEvents(todayList);
      setTomorrowEvents(tomorrowList);
      setPendingCheckIns(checkIns);
      setAllCheckIns(everyCheckIn);
      // Prune on every load: a check-in that's been submitted or has expired
      // has dropped out of this list, so its dismissal is dead weight.
      setDismissedIds(await pruneDismissed(checkIns.map((c) => c.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.dashboardHost.errorLoad);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** The full property record per id — `getStatusOverview` returns it, which is what gives every row a photo, a city and a check-in time without a second request. */
  const propertyById = useMemo(() => {
    const map: Record<string, Property> = {};
    for (const o of overview) map[o.property.id] = o.property;
    return map;
  }, [overview]);

  /**
   * Properties where a guest leaves and another arrives on the same day.
   *
   * The most time-critical cleaning there is — the window is the few hours
   * between one guest's checkout and the next one's arrival, rather than
   * "before the next booking, whenever that is".
   */
  const turnoverToday = useMemo(() => {
    const today = todayIso();
    const out = new Set<string>();
    const inn = new Set<string>();
    for (const ev of todayEvents) {
      if (ev.kind !== 'GUEST_STAY' || ev.isBlocked) continue;
      if (ev.endDate.slice(0, 10) === today && ev.endDate !== ev.date) out.add(ev.propertyId);
      if (ev.date.slice(0, 10) === today) inn.add(ev.propertyId);
    }
    const both = new Set<string>();
    for (const id of out) if (inn.has(id)) both.add(id);
    return both;
  }, [todayEvents]);

  /**
   * What the bell shows. Derived, not fetched — there is no notifications
   * API (see src/lib/notifications.ts for why, and why the submitted
   * check-ins come from `/checkins/all` rather than the welcome queue).
   *
   * `turnoverToday` is reused rather than recomputed: the not-ready section
   * and the bell must never disagree about what counts as a turnover.
   */
  const notifications = useMemo(
    () => buildNotifications({ allCheckIns, todayEvents, turnoverPropertyIds: turnoverToday, t }),
    [allCheckIns, todayEvents, turnoverToday, t],
  );

  const notifIdsKey = useMemo(() => notifications.map((n) => n.id).join('|'), [notifications]);
  const unread = useMemo(() => unreadCount(notifications, seenIds), [notifications, seenIds]);

  useEffect(() => {
    // Guarded on `isLoading`: pruning against an empty list before the first
    // load lands would wipe every read mark the host already has.
    if (isLoading) return;
    let cancelled = false;
    (async () => {
      const kept = await pruneSeen(notifications.map((n) => n.id));
      if (!cancelled) setSeenIds(kept);
    })();
    return () => {
      cancelled = true;
    };
    // notifIdsKey stands in for `notifications` — the array identity changes
    // on every load even when the contents are the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifIdsKey, isLoading]);

  function openNotification(item: HostNotification) {
    setNotifOpen(false);
    setSeenIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    void addSeen([item.id]);
    // Navigating while the Modal is still mounted puts the pushed screen
    // underneath a native overlay on Android, which reads as "the tap did
    // nothing". Let the sheet finish closing first.
    setTimeout(() => router.push(item.href), 180);
  }

  async function markAllRead() {
    const ids = notifications.map((n) => n.id);
    setSeenIds(ids);
    await addSeen(ids);
  }

  const upcomingCheckIns = useMemo(() => {
    const now = Date.now();
    return pendingCheckIns
      .filter((c) => !dismissedIds.includes(c.id))
      // Anything already in progress counts too — a guest who was due
      // earlier and still hasn't filled the form in is the case most worth
      // chasing — which is why this is an upper bound, not a range.
      .filter((c) => new Date(c.expectedCheckIn).getTime() - now <= UPCOMING_CHECKIN_WINDOW_MS)
      .sort((a, b) => new Date(a.expectedCheckIn).getTime() - new Date(b.expectedCheckIn).getTime());
  }, [pendingCheckIns, dismissedIds]);

  /**
   * Guests checking out tomorrow, with same-day-turnover detection.
   *
   * Mirrors `turnoverToday`'s out/inn approach but one day ahead, over a
   * separate `getCalendar(tomorrow, tomorrow)` fetch — this is what lets a
   * host see tomorrow's turnaround work today instead of finding out when
   * it's already tomorrow.
   */
  const tomorrowCheckouts = useMemo<TomorrowCheckout[]>(() => {
    const tomorrow = addDaysIso(todayIso(), 1);
    const outEvents: CalendarEvent[] = [];
    const innByProperty = new Map<string, CalendarEvent>();
    for (const ev of tomorrowEvents) {
      if (ev.kind !== 'GUEST_STAY' || ev.isBlocked) continue;
      if (ev.endDate.slice(0, 10) === tomorrow && ev.endDate !== ev.date) outEvents.push(ev);
      if (ev.date.slice(0, 10) === tomorrow) innByProperty.set(ev.propertyId, ev);
    }
    const items: TomorrowCheckout[] = outEvents.map((ev) => {
      const incoming = innByProperty.get(ev.propertyId) ?? null;
      const property = propertyById[ev.propertyId];
      return {
        propertyId: ev.propertyId,
        propertyName: ev.propertyName,
        location: locationLine(property, ev.propertyName),
        photoUrl: propertyCoverUrl(property, 160),
        event: ev,
        turnover: !!incoming,
        incomingEvent: incoming,
      };
    });
    // Same-day turnovers are the tighter, more urgent case — surface those first.
    return items.sort((a, b) =>
      a.turnover === b.turnover ? a.propertyName.localeCompare(b.propertyName) : a.turnover ? -1 : 1,
    );
  }, [tomorrowEvents, propertyById]);


  const filteredAll = useMemo(
    () => (allFilter === 'ALL' ? overview : overview.filter((o) => o.status === allFilter)),
    [overview, allFilter],
  );

  /**
   * Looks ahead for whatever's next at a property once its guest leaves.
   *
   * Same-day turnovers already carry their incoming guest inline (see
   * `tomorrowCheckouts`), so this only runs for the more common case — a
   * checkout with nothing arriving that same day — where "what's next" is
   * genuinely unknown without asking: another booking a few days out,
   * nothing booked at all (stays Ready), or the host has blocked the days
   * right after checkout (maintenance, personal use, etc).
   *
   * A 30-day window is generous on purpose — a host turning a property
   * around wants to know if it's about to sit empty for a while, not just
   * whether tomorrow is booked.
   */
  useEffect(() => {
    if (!session || !openCheckout) {
      setReminder(null);
      return;
    }
    const propertyId = openCheckout.propertyId;
    let cancelled = false;
    setReminder({ propertyId, loading: true, target: null, sending: false, sent: false });
    api.turnovers
      .tomorrow(session.accessToken)
      .then(({ guestCheckIns, externalReservations }) => {
        if (cancelled) return;
        // A synced Airbnb stay can exist as both a reservation and a
        // submitted check-in; either reminds the same cleaner about the same
        // checkout, so the check-in is preferred only because it's the
        // record the host is more likely to recognise.
        const ci = guestCheckIns.find((c) => c.propertyId === propertyId && c.property.defaultCleaningContact);
        const rv = externalReservations.find((r) => r.propertyId === propertyId && r.property.defaultCleaningContact);
        const hit = ci ? { kind: 'checkin' as const, item: ci } : rv ? { kind: 'reservation' as const, item: rv } : null;
        setReminder({
          propertyId,
          loading: false,
          sending: false,
          sent: false,
          target: hit
            ? { kind: hit.kind, id: hit.item.id, contactName: hit.item.property.defaultCleaningContact!.name }
            : null,
        });
      })
      .catch(() => {
        if (!cancelled) setReminder({ propertyId, loading: false, target: null, sending: false, sent: false });
      });
    return () => {
      cancelled = true;
    };
    // Same reasoning as the followUp effect below: openCheckout is rebuilt
    // every render, so key on its stable id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, openCheckout?.propertyId]);

  async function handleNotifyCleaner() {
    if (!session || !reminder?.target || reminder.sending) return;
    const { kind, id } = reminder.target;
    setReminder({ ...reminder, sending: true });
    try {
      const { whatsapp } =
        kind === 'checkin'
          ? await api.turnovers.remindCheckIn(id, session.accessToken)
          : await api.turnovers.remindReservation(id, session.accessToken);
      // Without WhatsApp Cloud API credentials the backend only prepares a
      // wa.me link — same contract as the Turnovers screen.
      if (!whatsapp.sent && whatsapp.waLink) await Linking.openURL(whatsapp.waLink);
      setReminder((r) => (r ? { ...r, sending: false, sent: true } : r));
      toast.show(t.dashboardHost.cleanerNotified);
    } catch (err) {
      setReminder((r) => (r ? { ...r, sending: false } : r));
      toast.show(err instanceof ApiError ? err.message : t.dashboardHost.notifyCleanerError, 'info');
    }
  }

  useEffect(() => {
    if (!session || !openCheckout || openCheckout.turnover) {
      setFollowUp(null);
      return;
    }
    let cancelled = false;
    setFollowUp({ propertyId: openCheckout.propertyId, loading: true, next: null, blockedNextDay: false });
    const checkoutDay = openCheckout.event.endDate.slice(0, 10);
    const dayAfter = addDaysIso(checkoutDay, 1);
    const windowEnd = addDaysIso(checkoutDay, 30);
    api.properties
      .getCalendar(dayAfter, windowEnd, session.accessToken)
      .then((events) => {
        if (cancelled) return;
        const forThisProperty = events
          .filter((e) => e.propertyId === openCheckout.propertyId && e.kind === 'GUEST_STAY')
          .sort((a, b) => a.date.localeCompare(b.date));
        const blockedNextDay = forThisProperty.some(
          (e) => e.isBlocked && dayAfter >= e.date.slice(0, 10) && dayAfter <= (e.endDate || e.date).slice(0, 10),
        );
        const next = forThisProperty.find((e) => !e.isBlocked) ?? null;
        setFollowUp({ propertyId: openCheckout.propertyId, loading: false, next, blockedNextDay });
      })
      .catch(() => {
        if (!cancelled) setFollowUp({ propertyId: openCheckout.propertyId, loading: false, next: null, blockedNextDay: false });
      });
    return () => {
      cancelled = true;
    };
    // openCheckout is a freshly-built object every render (see
    // `tomorrowCheckouts`), so it's compared by id rather than identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, openCheckout?.propertyId, openCheckout?.turnover]);

  async function handleMarkReady(propertyId: string, propertyName: string) {
    if (!session) return;
    setError(null);
    setBusyId(propertyId);
    try {
      await api.properties.markReady(propertyId, session.accessToken);
      await load();
      toast.show(t.dashboardHost.markedReady(propertyName), 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.dashboardHost.errorUpdateProperty);
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Flags an early arrival or late checkout on the open reservation.
   *
   * The PATCH is partial, so only the toggled field is sent and the server
   * keeps whatever it had for the other. The card's own copy is updated
   * optimistically — a switch that waits on a round-trip before moving feels
   * broken — with the list refreshed underneath and the switch rolled back
   * if the call fails.
   */
  async function handleTiming(item: PendingCheckIn, field: 'earlyCheckInRequested' | 'lateCheckOutRequested', value: boolean) {
    if (!session) return;
    setOpenCheckIn((prev) => (prev && prev.id === item.id ? { ...prev, [field]: value } : prev));
    setTimingBusy(true);
    try {
      await api.properties.setCheckInTiming(item.id, { [field]: value }, session.accessToken);
      setPendingCheckIns((prev) => prev.map((c) => (c.id === item.id ? { ...c, [field]: value } : c)));
    } catch (err) {
      setOpenCheckIn((prev) => (prev && prev.id === item.id ? { ...prev, [field]: !value } : prev));
      setError(err instanceof ApiError ? err.message : t.dashboardHost.errorTiming);
    } finally {
      setTimingBusy(false);
    }
  }

  /**
   * Corrects the party size on a pending check-in.
   *
   * Not cosmetic: the guest-facing form refuses to accept more people than
   * this, so a link stuck at 1 — which every link created before the
   * Hospitable sync started reading `guests.total` is — makes it impossible
   * for a family to check in, and renders their contract for one person.
   *
   * Optimistic, like the timing switches, and rolled back on failure.
   */
  async function handleGuestCount(item: PendingCheckIn, next: number) {
    if (!session || next < 1 || next > 30) return;
    const previous = item.guestCount;
    setOpenCheckIn((prev) => (prev && prev.id === item.id ? { ...prev, guestCount: next } : prev));
    setGuestBusy(true);
    try {
      await api.properties.updateCheckIn(item.id, { guestCount: next }, session.accessToken);
      setPendingCheckIns((prev) => prev.map((c) => (c.id === item.id ? { ...c, guestCount: next } : c)));
    } catch (err) {
      setOpenCheckIn((prev) => (prev && prev.id === item.id ? { ...prev, guestCount: previous } : prev));
      setError(err instanceof ApiError ? err.message : t.dashboardHost.errorGuestCount);
    } finally {
      setGuestBusy(false);
    }
  }

  async function handleDismissCheckIn(item: PendingCheckIn) {
    setDismissedIds(await addDismissed(item.id));
    toast.show(t.dashboardHost.hiddenFromHome, 'info');
  }

  async function handleCopyCheckInLink(item: PendingCheckIn) {
    await Clipboard.setStringAsync(resolveCheckInUrl(item.token));
    setCopiedId(item.id);
    toast.show(t.dashboardHost.checkInLinkCopied);
    setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 2000);
  }

  async function handleShareCheckInLink(item: PendingCheckIn) {
    setBusyId(item.id);
    try {
      const url = resolveCheckInUrl(item.token);
      // Naming the stay matters: a guest with more than one booking (or one
      // made months ago) otherwise has no way to tell which stay a bare link
      // belongs to.
      // timeZone UTC: expectedCheckIn is a calendar date (the host picks it
      // as YYYY-MM-DD) stored as UTC midnight, so formatting it in the
      // device's own zone names the previous day for anyone west of
      // Greenwich — and this string goes straight into the guest's WhatsApp.
      const arriving = new Date(item.expectedCheckIn).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      });
      const text = t.dashboardHost.checkInShareMessage(item.property.name, arriving, url);
      // Target the guest's own number directly when we have one (from
      // Hospitable's synced reservation data) — wa.me/<digits>?text=...
      // opens straight into a chat with that guest, prefilled. Without a
      // digits segment, wa.me/?text=... has no recipient at all and just
      // opens WhatsApp's contact picker — which is what this used to do
      // unconditionally, even for check-ins where the guest's number was
      // already known.
      const digits = item.guestPhone?.replace(/[^\d]/g, '');
      const target = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
      await Linking.openURL(`${target}?text=${encodeURIComponent(text)}`);
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Opens a WhatsApp chat straight to the guest's own number — as opposed
   * to `handleShareCheckInLink`, which shares the check-in *link* for the
   * guest to fill in themselves. Only shows when `guestPhone` came through
   * from Hospitable's synced reservation data (see PendingCheckIn's doc
   * comment), so a host can message a guest who hasn't submitted the
   * online check-in form yet — "what time will you arrive?", an early
   * check-in question — well before that form is ever filled in.
   */
  function handleMessageGuestWhatsApp(item: PendingCheckIn) {
    if (!item.guestPhone) return;
    const digits = item.guestPhone.replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${digits}`);
  }

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <View style={styles.container}>
          <View style={{ gap: 6 }}>
            <View style={{ width: 160, height: 26, borderRadius: 6, backgroundColor: 'rgba(27,31,35,0.08)' }} />
            <View style={{ width: 220, height: 14, borderRadius: 6, backgroundColor: 'rgba(27,31,35,0.06)', marginTop: 4 }} />
          </View>
          <SkeletonListItem style={{ marginTop: spacing.xl }} />
          <SkeletonListItem />
          <SkeletonListItem />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Reveal>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h1}>
                {session?.user.firstName ? t.dashboardHost.greeting(session.user.firstName) : t.dashboardHost.greetingFallback}
              </Text>
              <Text style={[typography.bodyMuted, { marginTop: 2 }]}>
                {t.dashboardHost.subtitle}
              </Text>
            </View>
            <NotificationBell count={unread} onPress={() => setNotifOpen(true)} />
          </View>
        </Reveal>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {overview.length === 0 ? (
          <Reveal delay={60}>
            <Card elevated style={{ marginTop: spacing.lg }}>
              <Text style={typography.h3}>{t.dashboardHost.emptyTitle}</Text>
              <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
                {t.dashboardHost.emptySubtitle}
              </Text>
              <Button
                label={t.dashboardHost.addProperty}
                onPress={() => router.push('/host/property/new')}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: spacing.lg }}
              />
            </Card>
          </Reveal>
        ) : (
          <>
            <Reveal delay={40}>
              <View style={styles.quickActionsRow}>
                <Pressable style={styles.quickAction} onPress={() => router.push('/host/booking/new')}>
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>{t.dashboardHost.quickRequestCleaning}</Text>
                </Pressable>
                {canCheckins && (
                <Pressable style={styles.quickAction} onPress={() => router.push('/host/checkin/new')}>
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="key-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>{t.dashboardHost.quickGuestCheckIn}</Text>
                </Pressable>
                )}
              </View>
            </Reveal>

            {/* ---------------------------------------------------------- */}
            {/* Next check-ins                                              */}
            {/* ---------------------------------------------------------- */}
            <Reveal delay={80}>
              <SectionHeader
                icon="calendar-outline"
                title={t.dashboardHost.nextCheckIns}
                subtitle={t.dashboardHost.nextCheckInsSubtitle}
                actionLabel={pendingCheckIns.length > 0 && canCheckins ? t.dashboardHost.viewAll : undefined}
                onAction={() => router.push('/host/guests')}
              />
            </Reveal>

            {upcomingCheckIns.length === 0 ? (
              <EmptyState
                icon="key-outline"
                message={
                  pendingCheckIns.length > 0
                    ? t.dashboardHost.noArrivalsSoon
                    : t.dashboardHost.noGuestsWaiting
                }
              />
            ) : (
              upcomingCheckIns.slice(0, CHECKIN_LIMIT).map((c, index) => {
                const property = propertyById[c.propertyId];
                const time = checkInTimeLabel(property);
                return (
                  <Reveal key={c.id} delay={100 + index * 30}>
                    <PropertyRow
                      photoUrl={propertyCoverUrl(property, 160)}
                      topBadge={arrivalBadge(c.expectedCheckIn, t)}
                      title={guestLabel(c, t)}
                      subtitle={`${c.property.name}${locationLine(property) ? ` · ${locationLine(property)}` : ''}`}
                      meta={[
                        { icon: 'people-outline', label: t.common.guestsCount(c.guestCount || 1) },
                        ...(time ? [{ icon: 'time-outline' as const, label: t.dashboardHost.checkInAt(time) }] : []),
                        { icon: 'link-outline', label: t.dashboardHost.checkInLinkReady, tone: 'primary' as const },
                      ]}
                      onPress={() => setOpenCheckIn(c)}
                      onDismiss={() => handleDismissCheckIn(c)}
                      showChevron={false}
                      right={
                        <View style={styles.linkActions}>
                          <Pressable style={styles.linkButton} onPress={() => handleCopyCheckInLink(c)}>
                            <Ionicons
                              name={copiedId === c.id ? 'checkmark' : 'link-outline'}
                              size={13}
                              color={colors.white}
                            />
                            <Text style={styles.linkButtonText}>{copiedId === c.id ? t.dashboardHost.copied : t.dashboardHost.copyLink}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.shareButton}
                            disabled={busyId === c.id}
                            onPress={() => handleShareCheckInLink(c)}
                          >
                            <Ionicons name="logo-whatsapp" size={15} color={colors.primary} />
                          </Pressable>
                        </View>
                      }
                    />
                  </Reveal>
                );
              })
            )}

            {upcomingCheckIns.length > CHECKIN_LIMIT && (
              <Pressable style={styles.moreRow} onPress={() => router.push('/host/guests')}>
                <Text style={styles.moreText}>
                  {t.dashboardHost.moreArrivingSoon(upcomingCheckIns.length - CHECKIN_LIMIT)}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </Pressable>
            )}

            {/* Dismissing is only low-stakes if it's reversible — one tap
                brings every hidden card back. */}
            {dismissedIds.length > 0 && (
              <Pressable
                style={styles.moreRow}
                onPress={async () => {
                  setDismissedIds(await clearDismissed());
                  toast.show(t.dashboardHost.hiddenRestored, 'info');
                }}
              >
                <Ionicons name="eye-outline" size={15} color={colors.inkMuted} />
                <Text style={styles.restoreText}>
                  {t.dashboardHost.hiddenCheckIns(dismissedIds.length)}
                </Text>
              </Pressable>
            )}

            {/* ---------------------------------------------------------- */}
            {/* Tomorrow's checkouts                                        */}
            {/* ---------------------------------------------------------- */}
            <Reveal delay={120}>
              <SectionHeader
                icon="log-out-outline"
                title={t.dashboardHost.tomorrowCheckouts}
                subtitle={t.dashboardHost.tomorrowCheckoutsSubtitle}
              />
            </Reveal>

            {tomorrowCheckouts.length === 0 ? (
              <EmptyState icon="checkmark-circle-outline" message={t.dashboardHost.noCheckoutsTomorrow} />
            ) : (
              tomorrowCheckouts.slice(0, TOMORROW_LIMIT).map((item, index) => (
                <Reveal key={`${item.propertyId}-${index}`} delay={140 + index * 30}>
                  <PropertyRow
                    photoUrl={item.photoUrl}
                    title={item.propertyName}
                    subtitle={item.location}
                    tags={
                      item.turnover
                        ? [{ label: t.dashboardHost.sameDayTurnover, tone: 'danger', icon: 'flash' }]
                        : undefined
                    }
                    right={<StatusTag label={t.dashboardHost.checkoutTag} tone="primary" icon="log-out-outline" />}
                    onPress={() => setOpenCheckout(item)}
                  />
                </Reveal>
              ))
            )}

            {tomorrowCheckouts.length > TOMORROW_LIMIT && (
              <Pressable style={styles.moreRow} onPress={() => router.push('/calendar')}>
                <Text style={styles.moreText}>{t.dashboardHost.moreCheckingOut(tomorrowCheckouts.length - TOMORROW_LIMIT)}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </Pressable>
            )}

            {/* ---------------------------------------------------------- */}
            {/* All apartments                                              */}
            {/* ---------------------------------------------------------- */}
            <Reveal delay={160}>
              <SectionHeader icon="business-outline" title={t.dashboardHost.allApartments} subtitle={t.dashboardHost.allApartmentsSubtitle} />
            </Reveal>

            <View style={styles.filterRow}>
              <FilterDropdown
                value={allFilter}
                onChange={setAllFilter}
                options={[
                  { value: 'ALL', label: t.dashboardHost.allStatuses(overview.length) },
                  { value: 'READY', label: t.propertyStatus.READY },
                  { value: 'NEEDS_CLEANING', label: t.propertyStatus.NEEDS_CLEANING },
                  { value: 'IN_PROGRESS', label: t.propertyStatus.IN_PROGRESS },
                  { value: 'OCCUPIED', label: t.propertyStatus.OCCUPIED },
                ]}
              />
            </View>

            {filteredAll.length === 0 ? (
              <EmptyState icon="business-outline" message={t.dashboardHost.noPropertiesWithStatus} />
            ) : (
              filteredAll.map((item, index) => (
                <Reveal key={item.property.id} delay={180 + Math.min(index, 8) * 25}>
                  <PropertyRow
                    photoUrl={propertyCoverUrl(item.property, 160)}
                    title={item.property.name}
                    subtitle={locationLine(item.property)}
                    right={
                      <StatusTag
                        label={t.propertyStatus[item.status]}
                        tone={
                          item.status === 'READY'
                            ? 'success'
                            : item.status === 'NEEDS_CLEANING'
                              ? 'accent'
                              : item.status === 'IN_PROGRESS'
                                ? 'primary'
                                : 'neutral'
                        }
                      />
                    }
                    onPress={() => router.push(`/host/property/${item.property.id}`)}
                  />
                </Reveal>
              ))
            )}

            {/* Marking a property ready is the one action worth keeping on
                Home — it's how a host clears the "not ready" list once a
                cleaning they did themselves is done. */}
            {allFilter === 'NEEDS_CLEANING' && filteredAll.length > 0 && (
              <View style={styles.markReadyHint}>
                <Text style={typography.caption}>{t.dashboardHost.markReadyHint}</Text>
                <View style={styles.markReadyRow}>
                  {filteredAll.slice(0, 4).map((item) => (
                    <Pressable
                      key={item.property.id}
                      style={styles.markReadyChip}
                      disabled={busyId === item.property.id}
                      onPress={() => handleMarkReady(item.property.id, item.property.name)}
                    >
                      <PropertyThumb photoUrl={propertyCoverUrl(item.property, 80)} size={20} />
                      <Text style={styles.markReadyText} numberOfLines={1}>
                        {busyId === item.property.id ? '…' : item.property.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ------------------------------------------------------------- */}
      {/* Notifications                                                  */}
      {/* ------------------------------------------------------------- */}
      <Modal visible={notifOpen} transparent animationType="fade" onRequestClose={() => setNotifOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setNotifOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.notifHeader}>
              <Text style={typography.h2}>{t.dashboardHost.notifications}</Text>
              {unread > 0 && (
                <Pressable onPress={markAllRead} hitSlop={8}>
                  <Text style={styles.notifMarkAll}>{t.dashboardHost.markAllRead}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setNotifOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.inkFaint} />
              </Pressable>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Ionicons name="notifications-off-outline" size={26} color={colors.inkFaint} />
                <Text style={[typography.bodyMuted, { marginTop: spacing.sm, textAlign: 'center' }]}>
                  {t.dashboardHost.notificationsEmpty}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.map((item) => {
                  const isUnread = !seenIds.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => openNotification(item)}
                      style={[styles.notifRow, isUnread && styles.notifRowUnread]}
                    >
                      {item.photoUrl ? (
                        <PropertyThumb photoUrl={item.photoUrl} size={42} />
                      ) : (
                        <ToneIcon icon={item.icon} tone={item.tone} size={42} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifTitle, isUnread && { fontWeight: '700' }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={typography.caption} numberOfLines={2}>
                          {item.body}
                        </Text>
                        <Text style={styles.notifWhen}>{notificationTime(item.at, t)}</Text>
                      </View>
                      {isUnread && <View style={styles.notifDot} />}
                      <Ionicons name="chevron-forward" size={15} color={colors.inkFaint} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Reservation card                                               */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={!!openCheckIn}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenCheckIn(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpenCheckIn(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            {openCheckIn &&
              (() => {
                const property = propertyById[openCheckIn.propertyId];
                const status = overview.find((o) => o.property.id === openCheckIn.propertyId)?.status;
                const time = checkInTimeLabel(property);
                return (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.sheetHeader}>
                      <PropertyThumb photoUrl={propertyCoverUrl(property, 200)} size={64} />
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h2} numberOfLines={2}>
                          {guestLabel(openCheckIn, t)}
                        </Text>
                        <Text style={typography.bodyMuted} numberOfLines={1}>
                          {openCheckIn.property.name}
                        </Text>
                        {locationLine(property) ? (
                          <Text style={typography.caption}>{locationLine(property)}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => setOpenCheckIn(null)} hitSlop={12}>
                        <Ionicons name="close" size={22} color={colors.inkFaint} />
                      </Pressable>
                    </View>

                    {status && (
                      <View style={styles.sheetStatusRow}>
                        <Text style={typography.caption}>{t.dashboardHost.sheetPropertyStatus}</Text>
                        <StatusBadge label={t.propertyStatus[status]} tone={PROPERTY_STATUS_TONE[status]} />
                      </View>
                    )}

                    <View style={styles.sheetFacts}>
                      <SheetFact
                        icon="log-in-outline"
                        label={t.dashboardHost.sheetArrives}
                        value={`${arrivalPhrase(openCheckIn.expectedCheckIn, t)}${time ? ` · ${time}` : ''}`}
                      />
                      <SheetFact
                        icon="log-out-outline"
                        label={t.dashboardHost.sheetLeaves}
                        value={new Date(openCheckIn.expectedCheckOut).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'UTC', // calendar date — see the note on `arriving` above
                        })}
                      />
                      <SheetFact icon="moon-outline" label={t.dashboardHost.sheetLengthOfStay} value={stayLabel(openCheckIn, t)} />
                      <View style={styles.fact}>
                        <View style={styles.factIcon}>
                          <Ionicons name="people-outline" size={15} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={typography.caption}>{t.dashboardHost.sheetGuests}</Text>
                          <Text style={styles.factValue}>
                            {t.common.guestsCount(openCheckIn.guestCount || 1)}
                          </Text>
                        </View>
                        {/* Editable here because this is the number the
                            guest's own form is capped at — see handleGuestCount. */}
                        <View style={styles.stepper}>
                          <Pressable
                            style={styles.stepperButton}
                            disabled={guestBusy || (openCheckIn.guestCount || 1) <= 1}
                            onPress={() => handleGuestCount(openCheckIn, (openCheckIn.guestCount || 1) - 1)}
                          >
                            <Ionicons
                              name="remove"
                              size={16}
                              color={(openCheckIn.guestCount || 1) <= 1 ? colors.inkFaint : colors.primary}
                            />
                          </Pressable>
                          <Pressable
                            style={styles.stepperButton}
                            disabled={guestBusy || (openCheckIn.guestCount || 1) >= 30}
                            onPress={() => handleGuestCount(openCheckIn, (openCheckIn.guestCount || 1) + 1)}
                          >
                            <Ionicons name="add" size={16} color={colors.primary} />
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    <Text style={[typography.h3, { marginTop: spacing.lg }]}>{t.dashboardHost.timingRequestsTitle}</Text>
                    <Text style={typography.caption}>
                      {t.dashboardHost.timingRequestsSubtitle}
                    </Text>

                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.body}>{t.dashboardHost.earlyCheckIn}</Text>
                        <Text style={typography.caption}>{time ? t.dashboardHost.arrivingBefore(time) : t.dashboardHost.arrivingBeforeUsual}</Text>
                      </View>
                      <Switch
                        value={!!openCheckIn.earlyCheckInRequested}
                        disabled={timingBusy}
                        onValueChange={(v) => handleTiming(openCheckIn, 'earlyCheckInRequested', v)}
                        trackColor={{ true: colors.primary }}
                      />
                    </View>

                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.body}>{t.dashboardHost.lateCheckout}</Text>
                        <Text style={typography.caption}>{t.dashboardHost.leavingAfterUsual}</Text>
                      </View>
                      <Switch
                        value={!!openCheckIn.lateCheckOutRequested}
                        disabled={timingBusy}
                        onValueChange={(v) => handleTiming(openCheckIn, 'lateCheckOutRequested', v)}
                        trackColor={{ true: colors.primary }}
                      />
                    </View>

                    {openCheckIn.timingRequestNote ? (
                      <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                        {t.dashboardHost.note(openCheckIn.timingRequestNote)}
                      </Text>
                    ) : null}

                    {openCheckIn.guestPhone && (
                      <Button
                        label={t.dashboardHost.messageGuestWhatsApp}
                        onPress={() => handleMessageGuestWhatsApp(openCheckIn)}
                        variant="secondary"
                        style={{ marginTop: spacing.lg }}
                      />
                    )}
                    <Button
                      label={copiedId === openCheckIn.id ? t.dashboardHost.copiedExclaim : t.dashboardHost.copyCheckInLink}
                      onPress={() => handleCopyCheckInLink(openCheckIn)}
                      style={{ marginTop: openCheckIn.guestPhone ? spacing.sm : spacing.lg }}
                    />
                    <Button
                      label={busyId === openCheckIn.id ? t.dashboardHost.opening : t.dashboardHost.shareViaWhatsApp}
                      onPress={() => handleShareCheckInLink(openCheckIn)}
                      loading={busyId === openCheckIn.id}
                      variant="outline"
                      style={{ marginTop: spacing.sm }}
                    />
                    <Button
                      label={t.dashboardHost.openProperty}
                      variant="outline"
                      onPress={() => {
                        const id = openCheckIn.propertyId;
                        setOpenCheckIn(null);
                        router.push(`/host/property/${id}`);
                      }}
                      style={{ marginTop: spacing.sm }}
                    />
                  </ScrollView>
                );
              })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Tomorrow's checkout detail card                                */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={!!openCheckout}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenCheckout(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpenCheckout(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            {openCheckout &&
              (() => {
                const property = propertyById[openCheckout.propertyId];
                const outTime = checkOutTimeLabel(property);
                const inTime = checkInTimeLabel(property);
                const { event, incomingEvent } = openCheckout;
                return (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.sheetHeader}>
                      <PropertyThumb photoUrl={openCheckout.photoUrl} size={64} />
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h2} numberOfLines={2}>
                          {openCheckout.propertyName}
                        </Text>
                        {openCheckout.location ? (
                          <Text style={typography.caption}>{openCheckout.location}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => setOpenCheckout(null)} hitSlop={12}>
                        <Ionicons name="close" size={22} color={colors.inkFaint} />
                      </Pressable>
                    </View>

                    {openCheckout.turnover && (
                      <View style={styles.sheetStatusRow}>
                        <Text style={typography.caption}>{t.dashboardHost.turnaround}</Text>
                        <StatusTag label={t.dashboardHost.sameDayTurnover} tone="danger" icon="flash" />
                      </View>
                    )}

                    <View style={styles.sheetFacts}>
                      <SheetFact
                        icon="log-out-outline"
                        label={t.dashboardHost.checkoutTag}
                        value={`${arrivalPhrase(event.endDate, t)}${outTime ? ` · ${outTime}` : ''}`}
                      />
                      <SheetFact
                        icon="people-outline"
                        label={t.dashboardHost.departingGuests}
                        value={t.common.guestsCount(event.guestCount || 1)}
                      />
                      {event.lateCheckOutRequested && (
                        <SheetFact icon="time-outline" label={t.dashboardHost.lateCheckoutRequested} value={t.dashboardHost.yes} />
                      )}
                    </View>

                    {event.timingRequestNote ? (
                      <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                        {t.dashboardHost.note(event.timingRequestNote)}
                      </Text>
                    ) : null}

                    {incomingEvent && (
                      <>
                        <Text style={[typography.h3, { marginTop: spacing.lg }]}>{t.dashboardHost.nextGuestSameDay}</Text>
                        <View style={styles.sheetFacts}>
                          <SheetFact
                            icon="log-in-outline"
                            label={t.dashboardHost.sheetArrives}
                            value={`${arrivalPhrase(incomingEvent.date, t)}${inTime ? ` · ${inTime}` : ''}`}
                          />
                          <SheetFact
                            icon="people-outline"
                            label={t.dashboardHost.arrivingGuests}
                            value={t.common.guestsCount(incomingEvent.guestCount || 1)}
                          />
                          {incomingEvent.earlyCheckInRequested && (
                            <SheetFact icon="time-outline" label={t.dashboardHost.earlyCheckInRequested} value={t.dashboardHost.yes} />
                          )}
                        </View>
                        {incomingEvent.timingRequestNote ? (
                          <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                            {t.dashboardHost.note(incomingEvent.timingRequestNote)}
                          </Text>
                        ) : null}
                      </>
                    )}

                    {/* Not a same-day turnover — show what's coming up
                        instead, once it's back from the lookahead fetch. */}
                    {!openCheckout.turnover && (
                      <>
                        <Text style={[typography.h3, { marginTop: spacing.lg }]}>{t.dashboardHost.afterThisCheckout}</Text>
                        {!followUp || followUp.loading || followUp.propertyId !== openCheckout.propertyId ? (
                          <Text style={typography.bodyMuted}>{t.dashboardHost.checkingWhatsNext}</Text>
                        ) : followUp.next ? (
                          <View style={styles.sheetFacts}>
                            <SheetFact
                              icon="log-in-outline"
                              label={t.dashboardHost.nextGuestArrives}
                              value={arrivalPhrase(followUp.next.date, t)}
                            />
                            <SheetFact
                              icon="people-outline"
                              label={t.dashboardHost.sheetGuests}
                              value={t.common.guestsCount(followUp.next.guestCount || 1)}
                            />
                          </View>
                        ) : followUp.blockedNextDay ? (
                          <StatusTag label={t.dashboardHost.blockedAfterCheckout} tone="neutral" icon="lock-closed-outline" />
                        ) : (
                          <Text style={typography.bodyMuted}>{t.dashboardHost.nothingBookedYet}</Text>
                        )}
                      </>
                    )}

                    {/* Same-day turnovers are already time-critical enough
                        that the host is watching them closely — offered
                        here mainly for the quieter case, where nothing's
                        arranged yet and a note/urgency flag is how that
                        gets to whichever cleaner picks it up. */}
                    {!openCheckout.turnover && (!followUp?.next) && (
                      <Button
                        label={t.dashboardHost.requestCleaningForTurnover}
                        variant="outline"
                        onPress={() => {
                          const id = openCheckout.propertyId;
                          const date = openCheckout.event.endDate.slice(0, 10);
                          setOpenCheckout(null);
                          router.push({ pathname: '/host/booking/new', params: { propertyId: id, date } });
                        }}
                        style={{ marginTop: spacing.lg }}
                      />
                    )}

                    {/* Notify the property's default cleaning contact about
                        tomorrow's checkout. Only offered when the backend has
                        a remindable stay for this property with a contact
                        attached; otherwise managers get a pointer to where
                        the contact is set (staff can't change settings). */}
                    {reminder && reminder.propertyId === openCheckout.propertyId && !reminder.loading && (
                      reminder.sent ? (
                        <View style={{ marginTop: spacing.lg }}>
                          <StatusTag label={t.dashboardHost.cleanerNotified} tone="success" icon="checkmark-circle-outline" />
                        </View>
                      ) : reminder.target ? (
                        <Button
                          label={t.dashboardHost.notifyCleaner(reminder.target.contactName)}
                          onPress={handleNotifyCleaner}
                          loading={reminder.sending}
                          style={{ marginTop: spacing.lg }}
                        />
                      ) : isManager && !property?.defaultCleaningContactId ? (
                        <Text style={[typography.caption, { marginTop: spacing.lg }]}>{t.dashboardHost.noCleaningContact}</Text>
                      ) : null
                    )}

                    <Button
                      label={t.dashboardHost.openProperty}
                      onPress={() => {
                        const id = openCheckout.propertyId;
                        setOpenCheckout(null);
                        router.push(`/host/property/${id}`);
                      }}
                      style={{ marginTop: spacing.sm }}
                    />
                    <Button
                      label={t.dashboardHost.openPropertyCalendar}
                      variant="outline"
                      onPress={() => {
                        const id = openCheckout.propertyId;
                        setOpenCheckout(null);
                        router.push({ pathname: '/calendar', params: { propertyId: id } });
                      }}
                      style={{ marginTop: spacing.sm }}
                    />
                  </ScrollView>
                );
              })()}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

/** One labelled fact in the reservation card — icon, caption, value. */
function SheetFact({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.caption}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  quickActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: colors.ink },
  filterRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  linkActions: { alignItems: 'flex-end', gap: 6 },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  linkButtonText: { fontSize: 11, fontWeight: '700', color: colors.white },
  shareButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  moreText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  restoreText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  markReadyHint: { marginTop: spacing.sm, gap: spacing.xs },
  markReadyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  markReadyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    maxWidth: '48%',
  },
  markReadyText: { fontSize: 12, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  notifMarkAll: { fontSize: 12, fontWeight: '700', color: colors.primary },
  notifEmpty: { alignItems: 'center', paddingVertical: spacing.xl },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    marginBottom: 2,
  },
  // Unread gets a tint rather than a bold border: the list is mostly unread
  // the first time it's opened, and a row of outlines reads as noise.
  notifRowUnread: { backgroundColor: colors.successBg },
  notifTitle: { ...typography.h3, fontSize: 14, fontWeight: '600' },
  notifWhen: { fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  notifDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  sheetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sheetFacts: { marginTop: spacing.md, gap: spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  factIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factValue: { fontSize: 14, fontWeight: '700', color: colors.ink },
  stepper: { flexDirection: 'row', gap: 6 },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
