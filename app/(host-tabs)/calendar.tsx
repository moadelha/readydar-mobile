import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, Linking } from 'react-native';
import { Text } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAuth, ApiError } from '@/lib/auth-context';
import {
  api,
  CalendarEvent,
  Property,
  PropertyStatusItem,
  resolveCheckInUrl,
  propertyCoverUrl,
} from '@/lib/api';
import {
  Screen,
  Card,
  EmptyState,
  LoadingScreen,
  ErrorBanner,
  SegmentedControl,
  StatusBadge,
  TextField,
} from '@/components/ui';
import { PropertySelect } from '@/components/PropertySelect';
import { Button } from '@/components/Button';
import { PropertyThumb } from '@/components/host-ui';
import { PROPERTY_STATUS_TONE } from '@/lib/status';
import {
  sourceShortLabel,
  eventGuestName,
  staySpanLabel,
  todayIso,
  ymd,
  parseDateOnly,
  addDaysIso,
  eventStatusLabel,
  eventStatusTone,
  eventAccentColor,
  eventIcon,
  barTextColor,
  dateLocale,
  weekdayLetters,
} from '@/lib/calendar-visuals';
import { ChannelMark } from '@/components/channel-mark';
import { useToast } from '@/lib/toast';
import { colors, elevation, radius, spacing, typography } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '@/lib/i18n/language-context';
import { Dict } from '@/lib/i18n/dictionary';
import { rtlFlip } from '@/lib/rtl';

type CalendarView = 'LIST' | 'MONTH';

// Weeks start on Monday (weekdayLetters), like the web calendar and the
// calendars hosts use in Europe and Morocco.
/** How many upcoming days the Listings view's per-property strip covers. */
const LIST_WINDOW_DAYS = 14;

/**
 * Month-grid geometry.
 *
 * A booking is drawn as one continuous bar spanning its days *within a week
 * row* — the same thing a desktop calendar does, and the only way a name
 * fits on a phone: a single day column is ~50px (useless for text), but a
 * three-day stay spans ~150px, which comfortably reads "Sarah · Airbnb".
 *
 * `MONTH_MAX_LANES` caps how many bars stack in one week before the rest
 * collapse into a "+N" the host can tap; without a cap a busy week would
 * make its row several times taller than the others and wreck the grid.
 */
const MONTH_LANE_HEIGHT = 19;
const MONTH_LANE_GAP = 3;
const MONTH_MAX_LANES = 3;
/** Space above the lanes for the day numbers. */
const MONTH_DAY_HEADER_HEIGHT = 26;

/** One booking drawn on one week row — the slice of it that falls inside that week. */
type MonthSegment = {
  event: CalendarEvent;
  /** Column (0 = Monday) this slice starts on within its week row. */
  startCol: number;
  /** How many columns the bar covers. */
  span: number;
  /** Which stacked lane within the week row it occupies. */
  lane: number;
  /** True when the booking actually began before this week (bar is cut off on the left). */
  clippedStart: boolean;
  /** True when it runs on past this week. */
  clippedEnd: boolean;
};

/** A single week row of the month grid: its 7 day cells plus every booking slice drawn across them. */
type MonthWeek = {
  /** 7 entries; `null` for leading/trailing days outside the displayed month. */
  days: ({ iso: string; day: number; isToday: boolean } | null)[];
  segments: MonthSegment[];
  /** Per-column count of bookings that didn't fit in the visible lanes. */
  overflowByCol: number[];
  laneCount: number;
};

export default function CalendarScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { t, lang } = useLanguage();
  const locale = dateLocale(lang);
  const weekdayLabels = useMemo(() => weekdayLetters(locale), [locale]);
  // The sheets below live in a <Modal>, outside <Screen>, so they consume
  // the bottom inset themselves — see the same note in dashboard.tsx.
  const insets = useSafeAreaInsets();
  // Arriving from a property-specific entry point (Home's "tomorrow's
  // checkouts" card, the property page) rather than the Calendar tab itself
  // — pre-select that property and land straight on Month view, which is
  // what actually reads as "this property's calendar" rather than the
  // all-properties list.
  const { propertyId: initialPropertyId } = useLocalSearchParams<{ propertyId?: string }>();

  const [view, setView] = useState<CalendarView>(initialPropertyId ? 'MONTH' : 'LIST');
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(initialPropertyId ?? null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [listEvents, setListEvents] = useState<CalendarEvent[]>([]);
  const [statusOverview, setStatusOverview] = useState<PropertyStatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  /** Nightly rate typed into the booking sheet when converting a blocked range. */
  const [rateInput, setRateInput] = useState('');
  /** Party size typed into the booking sheet when generating a check-in link. */
  const [guestInput, setGuestInput] = useState('');

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthCursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const today = todayIso();
  const isCurrentMonth = today.slice(0, 7) === ymd(year, month, 1).slice(0, 7);
  /** Day of the month that is today, when the displayed month is this one. */
  const todayDay = isCurrentMonth ? Number(today.slice(8, 10)) : -1;

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const propertyList = await api.properties.listMine(session.accessToken);
      setProperties(propertyList);

      if (view === 'LIST') {
        const from = todayIso();
        const to = addDaysIso(from, LIST_WINDOW_DAYS - 1);
        const [list, overview] = await Promise.all([
          api.properties.getCalendar(from, to, session.accessToken),
          api.properties.getStatusOverview(session.accessToken),
        ]);
        setListEvents(list);
        setStatusOverview(overview);
      } else {
        const from = ymd(year, month, 1);
        const to = ymd(year, month, daysInMonth);
        const list = await api.properties.getCalendar(from, to, session.accessToken);
        setEvents(list);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.calendarHost.errorLoad);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, view, year, month, daysInMonth, t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load]),
  );

  const filteredEvents = useMemo(
    () => (propertyFilter ? events.filter((e) => e.propertyId === propertyFilter) : events),
    [events, propertyFilter],
  );
  const visibleProperties = useMemo(
    () => (propertyFilter ? properties.filter((p) => p.id === propertyFilter) : properties),
    [properties, propertyFilter],
  );

  const listDays = useMemo(
    () => Array.from({ length: LIST_WINDOW_DAYS }, (_, i) => addDaysIso(today, i)),
    [today],
  );
  const listEventsByProperty = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of listEvents) (map[e.propertyId] ??= []).push(e);
    return map;
  }, [listEvents]);
  const statusByProperty = useMemo(() => {
    const map: Record<string, PropertyStatusItem> = {};
    for (const o of statusOverview) map[o.property.id] = o;
    return map;
  }, [statusOverview]);

  /** What a single day's dot should show for one property — a guest stay/block wins over a same-day cleaning, which wins over an empty day. Carries the actual event along so the dot can be colored by source (see eventAccentColor), not just by status. */
  function dayStatusForProperty(
    propertyId: string,
    dateIso: string,
  ): { status: 'blocked' | 'stay' | 'cleaning' | 'free'; event: CalendarEvent | null } {
    const dayEvents = listEventsByProperty[propertyId] ?? [];
    const stay = dayEvents.find(
      (e) => e.kind === 'GUEST_STAY' && dateIso >= e.date.slice(0, 10) && dateIso <= (e.endDate || e.date).slice(0, 10),
    );
    if (stay) return { status: stay.isBlocked ? 'blocked' : 'stay', event: stay };
    const cleaning = dayEvents.find((e) => e.kind === 'CLEANING' && e.date.slice(0, 10) === dateIso);
    return { status: cleaning ? 'cleaning' : 'free', event: cleaning ?? null };
  }
  function listDotColor(day: { status: 'blocked' | 'stay' | 'cleaning' | 'free'; event: CalendarEvent | null }) {
    if ((day.status === 'stay' || day.status === 'blocked') && day.event) return eventAccentColor(day.event);
    if (day.status === 'cleaning') return colors.accent;
    return colors.border;
  }

  // Every day a multi-day guest stay touches gets an entry, clamped to the
  // displayed month, so Month view shows the whole span, not just its start.
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month, daysInMonth);
    for (const ev of filteredEvents) {
      const start = parseDateOnly(ev.date);
      const end = parseDateOnly(ev.endDate || ev.date);
      const clampedStart = start < monthStart ? monthStart : start;
      const clampedEnd = end > monthEnd ? monthEnd : end;
      let cursor = clampedStart;
      while (cursor <= clampedEnd) {
        const key = ymd(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        (map[key] ??= []).push(ev);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }
    }
    return map;
  }, [filteredEvents, year, month, daysInMonth]);

  /**
   * The month laid out as week rows, with every booking already positioned
   * and lane-packed.
   *
   * Two things make this different from the old per-day dot/icon grid:
   *
   * 1. A booking is ONE bar spanning its days, not a mark repeated on each
   *    of them — so a four-night stay reads as a single thing a host can
   *    identify without tapping it, which is the whole point.
   * 2. A booking crossing a week boundary is split into one slice per week
   *    row (a grid can't draw a bar that wraps), each flagged so the cut
   *    edge renders flat and reads as "continues".
   *
   * Checkout day is excluded from a stay's span: a booking running the
   * 3rd→6th occupies the 3rd, 4th and 5th, because the guest is gone on the
   * 6th and that night is free for someone else. Cleanings are single-day
   * bars and get the same treatment, so a turnover shows up as its own
   * labelled item rather than an anonymous dot.
   *
   * Lane packing is the standard first-fit sweep: segments sorted by start
   * (longest first on ties, so the big bars sit at the top where they read
   * best), each dropped into the lowest lane it doesn't collide in.
   */
  const monthWeeks = useMemo<MonthWeek[]>(() => {
    // Monday-first column of the 1st (getDay() counts from Sunday).
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const weekCount = totalCells / 7;

    // Grid day index (0-based from the first cell of the first week, which
    // may be in the previous month) for a given YYYY-MM-DD in this month.
    const gridIndexOf = (iso: string) => firstWeekday + Number(iso.slice(8, 10)) - 1;

    const monthStartIso = ymd(year, month, 1);
    const monthEndIso = ymd(year, month, daysInMonth);

    type Placed = { event: CalendarEvent; startIdx: number; endIdx: number; clippedStart: boolean; clippedEnd: boolean };
    const placed: Placed[] = [];

    for (const ev of filteredEvents) {
      const startIso = ev.date.slice(0, 10);
      const rawEndIso = (ev.endDate || ev.date).slice(0, 10);
      const lastIso =
        ev.kind === 'GUEST_STAY' && rawEndIso > startIso ? addDaysIso(rawEndIso, -1) : rawEndIso;
      if (lastIso < monthStartIso || startIso > monthEndIso) continue;

      const visibleStart = startIso < monthStartIso ? monthStartIso : startIso;
      const visibleEnd = lastIso > monthEndIso ? monthEndIso : lastIso;
      placed.push({
        event: ev,
        startIdx: gridIndexOf(visibleStart),
        endIdx: gridIndexOf(visibleEnd),
        clippedStart: startIso < monthStartIso,
        clippedEnd: lastIso > monthEndIso,
      });
    }

    placed.sort((a, b) => a.startIdx - b.startIdx || b.endIdx - b.startIdx - (a.endIdx - a.startIdx));

    const weeks: MonthWeek[] = [];
    for (let w = 0; w < weekCount; w++) {
      const weekStart = w * 7;
      const weekEnd = weekStart + 6;

      const days = Array.from({ length: 7 }, (_, c) => {
        const dayNum = weekStart + c - firstWeekday + 1;
        if (dayNum < 1 || dayNum > daysInMonth) return null;
        return {
          iso: ymd(year, month, dayNum),
          day: dayNum,
          isToday: dayNum === todayDay,
        };
      });

      const segments: MonthSegment[] = [];
      const overflowByCol = [0, 0, 0, 0, 0, 0, 0];
      // lanes[i] holds the last column filled in lane i, so a candidate only
      // needs to clear that to fit.
      const laneEnds: number[] = [];

      for (const item of placed) {
        if (item.endIdx < weekStart || item.startIdx > weekEnd) continue;
        const sliceStart = Math.max(item.startIdx, weekStart);
        const sliceEnd = Math.min(item.endIdx, weekEnd);
        const startCol = sliceStart - weekStart;
        const span = sliceEnd - sliceStart + 1;

        let lane = laneEnds.findIndex((end) => end < startCol);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(sliceEnd - weekStart);
        } else {
          laneEnds[lane] = sliceEnd - weekStart;
        }

        if (lane >= MONTH_MAX_LANES) {
          for (let c = startCol; c < startCol + span; c++) overflowByCol[c]++;
          continue;
        }

        segments.push({
          event: item.event,
          startCol,
          span,
          lane,
          // A slice is only "clipped" on a side if it continues past this
          // week — either because the booking itself ran outside the month,
          // or simply because it carries on into the next row.
          clippedStart: item.startIdx < weekStart || (item.clippedStart && sliceStart === item.startIdx),
          clippedEnd: item.endIdx > weekEnd || (item.clippedEnd && sliceEnd === item.endIdx),
        });
      }

      weeks.push({
        days,
        segments,
        overflowByCol,
        laneCount: Math.min(laneEnds.length, MONTH_MAX_LANES),
      });
    }

    return weeks;
  }, [filteredEvents, year, month, daysInMonth, todayDay]);

  function openBookingOrProperty(event: CalendarEvent) {
    setSelectedEvent(null);
    setSelectedDay(null);
    if (event.bookingId) router.push(`/host/booking/${event.bookingId}`);
    else router.push(`/host/property/${event.propertyId}`);
  }

  async function handleShareCheckIn(event: CalendarEvent) {
    if (!event.checkInToken) return;
    const url = resolveCheckInUrl(event.checkInToken);
    const text = t.calendarHost.checkInShareMessage(event.propertyName, url);
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

  /**
   * Copy the guest's check-in link straight off the booking.
   *
   * WhatsApp was the only way to send a link from here, which forces a
   * channel on the host — plenty of guests are reachable by SMS, email, or
   * whatever the platform's own messaging is. Same `expo-clipboard` +
   * 2-second "Copied!" pattern the Guests screen and Home use.
   */
  /**
   * Creates a check-in link for a synced reservation that has none, and
   * copies it immediately.
   *
   * Covers the two cases a host is otherwise stuck with:
   *   - an Airbnb reservation that arrived with no guest name, and predates
   *     (or was backfilled around) the auto-create in the reservation sync;
   *   - a range that synced as **blocked**. Airbnb reports a Booking.com
   *     stay as merely "not available", so it lands as a block rather than
   *     a booking. The server clears `isBlocked` as part of this call, so
   *     generating the link is also how a host says "that's a real guest".
   */
  /**
   * The rate typed into the sheet, or null when it's blank or nonsense.
   *
   * Sent on both conversion paths because a stay with no nightly rate
   * contributes **nothing** to Reports revenue — which is the whole reason a
   * host reclassifies a Booking.com block as a booking in the first place.
   * Left blank, the backend falls back to the property's default rate.
   */
  function parsedRate(): number | null {
    const value = Number(rateInput.replace(',', '.').trim());
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /**
   * The party size typed into the sheet, or null when blank.
   *
   * A synced reservation row stores no guest count of its own — the
   * Hospitable sync reads `guests.total` straight onto the check-in it
   * creates and never onto the reservation — so for a link generated by
   * hand here the host is the only source. Left blank the server uses 1,
   * which caps what the guest can actually submit.
   */
  function parsedGuests(): number | null {
    const value = Number(guestInput.trim());
    return Number.isInteger(value) && value > 0 && value <= 30 ? value : null;
  }

  /** Opens the event detail sheet, pre-filling the rate field with whatever's already saved on this reservation rather than leaving it blank next to a placeholder. */
  function openEventSheet(ev: CalendarEvent) {
    setRateInput(ev.nightlyRate != null ? String(ev.nightlyRate) : '');
    setGuestInput('');
    setSelectedEvent(ev);
  }

  async function handleGenerateCheckIn(event: CalendarEvent) {
    if (!session || !event.reservationId) return;
    setError(null);
    setSheetBusy(true);
    try {
      const rate = parsedRate();
      // Rate first: the link call clears isBlocked, and a failure after that
      // would leave the stay converted but unpriced with no obvious retry.
      if (rate !== null) {
        await api.properties.updateReservation(event.reservationId, { nightlyRate: rate }, session.accessToken);
      }
      const checkIn = await api.properties.generateReservationCheckInLink(
        event.reservationId,
        session.accessToken,
        parsedGuests() ?? undefined,
      );
      await Clipboard.setStringAsync(resolveCheckInUrl(checkIn.token));
      toast.show(event.isBlocked ? t.calendarHost.bookingCreatedLinkCopied : t.calendarHost.checkInLinkCreatedCopied, 'success');
      // Reflect it on the open sheet straight away rather than making the
      // host close and reopen to see the link appear.
      setSelectedEvent({
        ...event,
        isBlocked: false,
        checkInId: checkIn.id,
        checkInToken: checkIn.token,
        checkInStatus: checkIn.status,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.calendarHost.errorCreateCheckIn);
    } finally {
      setSheetBusy(false);
    }
  }

  /**
   * Reclassifies a blocked range as a real booking without creating a
   * check-in link — for a stay the host doesn't need to collect guest
   * details for, but does want counted as occupancy and revenue.
   */
  async function handleUnblock(event: CalendarEvent) {
    if (!session || !event.reservationId) return;
    setError(null);
    setSheetBusy(true);
    try {
      const rate = parsedRate();
      await api.properties.updateReservation(
        event.reservationId,
        rate !== null ? { isBlocked: false, nightlyRate: rate } : { isBlocked: false },
        session.accessToken,
      );
      toast.show(rate !== null ? t.calendarHost.bookedAtRate(rate) : t.calendarHost.markedRealBooking, 'success');
      setSelectedEvent({ ...event, isBlocked: false, nightlyRate: rate ?? event.nightlyRate });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.calendarHost.errorUpdateReservation);
    } finally {
      setSheetBusy(false);
    }
  }

  /**
   * Saves a nightly rate on a blocked or offline entry on its own, without
   * generating a check-in link or otherwise touching its blocked/booked
   * state — for a host who just wants this night's price reflected in
   * Reports (see the reports-pdf "Other Bookings" breakdown) without
   * collecting guest details for it. Clearing the box back to blank and
   * saving explicitly removes the override (falls back to the property's
   * default rate) — see parsedRate's own doc comment.
   */
  async function handleSaveRate(event: CalendarEvent) {
    if (!session || !event.reservationId) return;
    setError(null);
    setSheetBusy(true);
    try {
      const rate = parsedRate();
      await api.properties.updateReservation(event.reservationId, { nightlyRate: rate }, session.accessToken);
      toast.show(rate !== null ? t.calendarHost.savedRate(rate) : t.calendarHost.rateCleared, 'success');
      setSelectedEvent({ ...event, nightlyRate: rate });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.calendarHost.errorSaveRate);
    } finally {
      setSheetBusy(false);
    }
  }

  async function handleCopyCheckIn(event: CalendarEvent) {
    if (!event.checkInToken) return;
    await Clipboard.setStringAsync(resolveCheckInUrl(event.checkInToken));
    setCopiedEventId(event.id);
    toast.show(t.calendarHost.checkInLinkCopied);
    setTimeout(() => setCopiedEventId((id) => (id === event.id ? null : id)), 2000);
  }

  if (isLoading) return <LoadingScreen />;

  // What each colour means, in both views. Stays are coloured by where they
  // were booked (see eventAccentColor), so that's what the legend lists.
  const legend = (
    <View style={styles.legendRow}>
      {[
        { color: colors.channel.airbnb, label: t.sourceLabel.AIRBNB },
        { color: colors.channel.booking, label: t.sourceLabel.BOOKING_COM },
        { color: colors.green500, label: t.sourceLabel.DIRECT },
        { color: colors.accent, label: t.calendarHost.legendCleaning },
        { color: colors.inkFaint, label: t.calendarHost.legendBlocked },
      ].map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={typography.h1}>{t.calendarHost.title}</Text>
        <View style={{ marginTop: spacing.sm }}>
          <PropertySelect
            properties={properties}
            value={propertyFilter}
            onChange={setPropertyFilter}
            extraOptions={[{ value: '__NONE__', label: t.calendarHost.allProperties }]}
          />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: 'LIST', label: t.calendarHost.viewListings },
              { value: 'MONTH', label: t.calendarHost.viewCalendar },
            ]}
          />
        </View>
        {error && <ErrorBanner message={error} onRetry={load} />}
      </View>

      {view === 'MONTH' && (
        <View style={styles.monthNav}>
          <Pressable hitSlop={10} onPress={() => setMonthCursor(new Date(year, month - 1, 1))}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} style={rtlFlip} />
          </Pressable>
          <Text style={typography.h3}>{monthLabel}</Text>
          <Pressable hitSlop={10} onPress={() => setMonthCursor(new Date(year, month + 1, 1))}>
            <Ionicons name="chevron-forward" size={20} color={colors.ink} style={rtlFlip} />
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {view === 'MONTH' && (
          <View>
            <View style={styles.weekdayRow}>
              {weekdayLabels.map((w, i) => (
                <Text key={i} style={styles.weekdayLabel}>{w}</Text>
              ))}
            </View>

            {monthWeeks.map((week, wi) => {
              const laneArea = week.laneCount * (MONTH_LANE_HEIGHT + MONTH_LANE_GAP);
              return (
                <View key={wi} style={[styles.weekRow, { height: MONTH_DAY_HEADER_HEIGHT + laneArea + 16 }]}>
                  {/* Day cells are the row's background; bars float above
                      them, which is what lets one bar cross several days. */}
                  <View style={styles.weekCells}>
                    {week.days.map((d, ci) => (
                      <Pressable
                        key={ci}
                        style={[styles.dayCell, d?.isToday && styles.dayCellToday]}
                        disabled={!d}
                        onPress={() => d && setSelectedDay(d.iso)}
                      >
                        {d && (
                          <View style={[styles.dayNumberWrap, d.isToday && styles.dayNumberWrapToday]}>
                            <Text style={[styles.dayNumber, d.isToday && styles.dayNumberToday]}>{d.day}</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>

                  {week.segments.map((seg) => {
                    const name = eventGuestName(seg.event);
                    const source = sourceShortLabel(seg.event, t);
                    // Only a bar with room for it shows the source as well as
                    // the name; below that the name alone is more useful than
                    // two truncated fragments.
                    const label =
                      seg.span >= 3 && name ? `${name} · ${source}` : (name ?? source);
                    return (
                      <Pressable
                        key={seg.event.id}
                        onPress={() => openEventSheet(seg.event)}
                        style={[
                          styles.monthBar,
                          {
                            left: `${(seg.startCol / 7) * 100}%`,
                            width: `${(seg.span / 7) * 100}%`,
                            top: MONTH_DAY_HEADER_HEIGHT + seg.lane * (MONTH_LANE_HEIGHT + MONTH_LANE_GAP),
                            backgroundColor: eventAccentColor(seg.event),
                          },
                          seg.clippedStart && styles.monthBarClippedStart,
                          seg.clippedEnd && styles.monthBarClippedEnd,
                        ]}
                      >
                        <Ionicons name={eventIcon(seg.event) as any} size={10} color={barTextColor(eventAccentColor(seg.event))} />
                        <Text style={[styles.monthBarText, { color: barTextColor(eventAccentColor(seg.event)) }]} numberOfLines={1}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {week.overflowByCol.map((count, ci) =>
                    count > 0 ? (
                      <Pressable
                        key={`ov-${ci}`}
                        onPress={() => week.days[ci] && setSelectedDay(week.days[ci]!.iso)}
                        style={[
                          styles.monthOverflow,
                          {
                            left: `${(ci / 7) * 100}%`,
                            top: MONTH_DAY_HEADER_HEIGHT + MONTH_MAX_LANES * (MONTH_LANE_HEIGHT + MONTH_LANE_GAP),
                          },
                        ]}
                      >
                        <Text style={styles.monthOverflowText}>+{count}</Text>
                      </Pressable>
                    ) : null,
                  )}
                </View>
              );
            })}

            {legend}
          </View>
        )}

        {view === 'LIST' && (
          <View>
            {/* Legend first here: at the end of a long list it sat under the + button. */}
            {visibleProperties.length > 0 && <View style={{ marginBottom: spacing.sm }}>{legend}</View>}
            {visibleProperties.length === 0 ? (
              <EmptyState message={t.calendarHost.noPropertiesToShow} />
            ) : (
              visibleProperties.map((p) => {
                const photoUrl = propertyCoverUrl(p, 130);
                const status = statusByProperty[p.id];
                return (
                  <Card
                    key={p.id}
                    onPress={() => {
                      setPropertyFilter(p.id);
                      setView('MONTH');
                    }}
                    style={{ marginBottom: spacing.sm }}
                  >
                    <View style={styles.listRow}>
                      <PropertyThumb photoUrl={photoUrl} size={52} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                          <Text style={[typography.h3, { flexShrink: 1 }]} numberOfLines={1}>{p.name}</Text>
                          {p.hospitableListingId && <ChannelMark provider="AIRBNB" size={16} />}
                        </View>
                        {status && (
                          <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                            <StatusBadge label={t.propertyStatus[status.status]} tone={PROPERTY_STATUS_TONE[status.status]} />
                          </View>
                        )}
                      </View>
                    </View>
                    {/* The next two weeks as one strip of days, each filled
                        in the colour of what's on it and labelled with its
                        date — readable at a glance, unlike the old 8pt dots. */}
                    {(() => {
                      const days = listDays.map((day) => ({ day, ...dayStatusForProperty(p.id, day) }));
                      // Nights, not days: a stay's checkout day isn't a night
                      // booked, so count days some stay covers before its end.
                      const stays = (listEventsByProperty[p.id] ?? []).filter((e) => e.kind === 'GUEST_STAY' && !e.isBlocked);
                      const booked = listDays.filter((day) =>
                        stays.some((e) => day >= e.date.slice(0, 10) && day < (e.endDate || e.date).slice(0, 10)),
                      ).length;
                      return (
                        <>
                          <View style={styles.strip}>
                            {days.map((d) => {
                              const filled = d.status !== 'free';
                              const bg = listDotColor(d);
                              return (
                                <View
                                  key={d.day}
                                  style={[
                                    styles.stripDay,
                                    { backgroundColor: filled ? bg : colors.surface2 },
                                    d.day === today && styles.stripToday,
                                  ]}
                                >
                                  <Text style={[styles.stripDate, { color: filled ? barTextColor(bg) : colors.inkMuted }]}>
                                    {parseDateOnly(d.day).getDate()}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                          <Text style={styles.stripCaption}>{t.calendarHost.nextTwoWeeks(booked)}</Text>
                        </>
                      );
                    })()}
                  </Card>
                );
              })
            )}
          </View>
        )}

      </ScrollView>

      <Pressable
        style={styles.fab}
        // Straight to a new check-in link: with cleaner booking gone it's the only thing to add here.
        onPress={() => router.push({ pathname: '/host/checkin/new', params: propertyFilter ? { propertyId: propertyFilter } : {} })}
        accessibilityRole="button"
        accessibilityLabel={t.calendarHost.guestOnlineCheckIn}
      >
        <Ionicons name="add" size={24} color={colors.onPrimary} />
      </Pressable>

      {/* Day overflow — Month view */}
      <Modal visible={!!selectedDay} animationType="fade" transparent onRequestClose={() => setSelectedDay(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedDay(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <Text style={typography.h3}>
              {selectedDay && parseDateOnly(selectedDay).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            {selectedDay && (eventsByDay[selectedDay] ?? []).length === 0 && (
              <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{t.calendarHost.dayEmpty}</Text>
            )}
            <ScrollView style={{ maxHeight: 360, marginTop: spacing.sm }}>
              {(selectedDay ? eventsByDay[selectedDay] ?? [] : []).map((ev, i) => (
                <Pressable
                  key={ev.id}
                  onPress={() => {
                    setSelectedDay(null);
                    openEventSheet(ev);
                  }}
                  style={({ pressed }) => [styles.dayItem, i > 0 && styles.dayItemDivider, pressed && { opacity: 0.6 }]}
                >
                  <View style={[styles.dayItemBar, { backgroundColor: eventAccentColor(ev) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayItemTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={styles.dayItemMeta} numberOfLines={1}>
                      {ev.propertyName}
                      {/* The full span, so a day that's the middle of an
                          existing stay is obviously not a new arrival. */}
                      {ev.kind === 'GUEST_STAY' ? ` · ${staySpanLabel(ev, t, locale)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} style={rtlFlip} />
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Event detail */}
      <Modal visible={!!selectedEvent} animationType="fade" transparent onRequestClose={() => setSelectedEvent(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedEvent(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            {selectedEvent && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.dayItemBar, { backgroundColor: eventAccentColor(selectedEvent), alignSelf: 'stretch' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h2}>{selectedEvent.title}</Text>
                    <Text style={typography.bodyMuted}>{selectedEvent.propertyName}</Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedEvent(null)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t.calendarHost.close}
                  >
                    <Ionicons name="close" size={20} color={colors.inkMuted} />
                  </Pressable>
                </View>

                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {selectedEvent.kind === 'GUEST_STAY' && (
                    <>
                      <Text style={typography.bodyMuted}>
                        {selectedEvent.isBlocked ? t.calendarHost.blockedOnPrefix : t.calendarHost.platformPrefix} {t.sourceLabel[(selectedEvent.source ?? 'DIRECT') as keyof Dict['sourceLabel']]}
                      </Text>
                      <Text style={typography.bodyMuted}>{staySpanLabel(selectedEvent, t, locale)}</Text>
                      {selectedEvent.guestCount != null && selectedEvent.guestCount > 0 && (
                        <Text style={typography.bodyMuted}>
                          {t.common.guestsCount(selectedEvent.guestCount)}
                        </Text>
                      )}
                    </>
                  )}
                  {selectedEvent.kind === 'CLEANING' && (
                    <Text style={typography.bodyMuted}>
                      {parseDateOnly(selectedEvent.date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                  <StatusBadge label={eventStatusLabel(selectedEvent, t)} tone={eventStatusTone(selectedEvent)} />
                </View>

                {selectedEvent.checkInToken && selectedEvent.checkInStatus === 'PENDING' && (
                  <>
                    <Button
                      label={copiedEventId === selectedEvent.id ? t.calendarHost.copiedExclaim : t.calendarHost.copyCheckInLink}
                      onPress={() => handleCopyCheckIn(selectedEvent)}
                      style={{ marginTop: spacing.lg }}
                    />
                    <Button
                      label={t.calendarHost.shareViaWhatsApp}
                      onPress={() => handleShareCheckIn(selectedEvent)}
                      variant="outline"
                      style={{ marginTop: spacing.sm }}
                    />
                  </>
                )}
                {/* A reservation with no check-in link yet — an Airbnb entry
                    that came through nameless, or a block that's really a
                    Booking.com guest. Generating the link also un-blocks it
                    server-side, which is why the wording changes. */}
                {/*
                    Editable for any host-entered entry — a block or an
                    offline booking (source MANUAL) — since both need a
                    price to show up correctly in Reports. Not shown for a
                    synced Airbnb/Booking.com reservation: that price comes
                    from the platform, and mobile doesn't override it.
                */}
                {selectedEvent.kind === 'GUEST_STAY' && selectedEvent.reservationId && selectedEvent.source === 'MANUAL' && (
                  <View style={{ marginTop: spacing.lg }}>
                    <TextField
                      label={t.calendarHost.ratePerNightLabel}
                      value={rateInput}
                      onChangeText={setRateInput}
                      keyboardType="numeric"
                      placeholder="e.g. 650"
                    />
                    <Text style={typography.caption}>
                      {t.calendarHost.ratePerNightHint}
                    </Text>
                    <Button
                      label={sheetBusy ? t.calendarHost.savingEllipsis : t.calendarHost.savePrice}
                      variant="outline"
                      loading={sheetBusy}
                      onPress={() => handleSaveRate(selectedEvent)}
                      style={{ marginTop: spacing.sm }}
                    />
                  </View>
                )}

                {/* Asked for wherever a link is about to be created, since
                    the reservation itself carries no party size. */}
                {selectedEvent.kind === 'GUEST_STAY' &&
                  selectedEvent.reservationId &&
                  !selectedEvent.checkInToken && (
                    <View style={{ marginTop: spacing.md }}>
                      <TextField
                        label={t.calendarHost.guestsOptionalLabel}
                        value={guestInput}
                        onChangeText={setGuestInput}
                        keyboardType="number-pad"
                        placeholder="e.g. 4"
                      />
                      <Text style={typography.caption}>
                        {t.calendarHost.guestsOptionalHint}
                      </Text>
                    </View>
                  )}

                {selectedEvent.kind === 'GUEST_STAY' &&
                  selectedEvent.reservationId &&
                  !selectedEvent.checkInToken && (
                    <>
                      <Button
                        label={
                          sheetBusy
                            ? t.calendarHost.workingEllipsis
                            : selectedEvent.isBlocked
                              ? t.calendarHost.confirmRealBookingCreateLink
                              : t.calendarHost.createCheckInLink
                        }
                        loading={sheetBusy}
                        onPress={() => handleGenerateCheckIn(selectedEvent)}
                        style={{ marginTop: spacing.lg }}
                      />
                      {selectedEvent.isBlocked && (
                        <Button
                          label={t.calendarHost.markBookedNoLink}
                          variant="outline"
                          loading={sheetBusy}
                          onPress={() => handleUnblock(selectedEvent)}
                          style={{ marginTop: spacing.sm }}
                        />
                      )}
                    </>
                  )}
                <Button
                  label={selectedEvent.bookingId ? t.calendarHost.viewBooking : t.calendarHost.viewProperty}
                  onPress={() => openBookingOrProperty(selectedEvent)}
                  variant="secondary"
                  style={{
                    marginTop:
                      (selectedEvent.checkInToken && selectedEvent.checkInStatus === 'PENDING') ||
                      (selectedEvent.kind === 'GUEST_STAY' && selectedEvent.reservationId && !selectedEvent.checkInToken)
                        ? spacing.sm
                        : spacing.lg,
                  }}
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  body: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  weekdayRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: spacing.xs },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '500', color: colors.inkFaint },
  weekRow: {
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  weekCells: { flexDirection: 'row', height: '100%' },
  dayCell: {
    width: `${100 / 7}%`,
    height: '100%',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  dayCellToday: { backgroundColor: colors.successBg },
  dayItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dayItemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  dayItemBar: { width: 4, height: 34, borderRadius: 2 },
  dayItemTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  dayItemMeta: { fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginTop: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dayNumberWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrapToday: { backgroundColor: colors.primary },
  dayNumber: { fontSize: 13, color: colors.ink, fontWeight: '500', ...typography.number },
  dayNumberToday: { color: colors.onPrimary, fontWeight: '600' },
  monthBar: {
    position: 'absolute',
    height: MONTH_LANE_HEIGHT,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    // Inset so neighbouring bars on consecutive days don't touch and read
    // as one continuous booking.
    marginHorizontal: 1,
  },
  // A booking continuing past this week's edge gets a flat corner there, so
  // it reads as carrying on rather than starting/ending on that day.
  monthBarClippedStart: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  monthBarClippedEnd: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  monthBarText: { flex: 1, fontSize: 10, fontWeight: '600', color: colors.onPrimary },
  monthOverflow: {
    position: 'absolute',
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  monthOverflowText: { fontSize: 10, fontWeight: '600', color: colors.inkMuted },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: 6,
    marginTop: spacing.md,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.inkMuted, fontWeight: '500' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  strip: { flexDirection: 'row', gap: 2, marginTop: spacing.md },
  stripDay: { flex: 1, height: 26, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  stripToday: { borderWidth: 1.5, borderColor: colors.ink },
  stripDate: { fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  stripCaption: { ...typography.caption, marginTop: 6 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.high,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
