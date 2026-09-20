import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, Linking } from 'react-native';
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
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONE } from '@/lib/status';
import {
  SOURCE_LABEL,
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
} from '@/lib/calendar-visuals';
import { useToast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

type CalendarView = 'LIST' | 'MONTH';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** How many upcoming days the Listings view's per-property dot grid covers — 2 rows of 7 in a compact 14-day preview. */
const LIST_WINDOW_DAYS = 14;
const LIST_GRID_COLS = 7;

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
  /** Column (0 = Sunday) this slice starts on within its week row. */
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  /** Nightly rate typed into the booking sheet when converting a blocked range. */
  const [rateInput, setRateInput] = useState('');
  /** Party size typed into the booking sheet when generating a check-in link. */
  const [guestInput, setGuestInput] = useState('');

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

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
      setError(err instanceof ApiError ? err.message : 'Could not load the calendar.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, view, year, month, daysInMonth]);

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

  const listDays = useMemo(() => {
    const start = todayIso();
    return Array.from({ length: LIST_WINDOW_DAYS }, (_, i) => addDaysIso(start, i));
  }, []);
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
    const firstWeekday = new Date(year, month, 1).getDay();
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
          isToday: isCurrentMonth && dayNum === now.getDate(),
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
  }, [filteredEvents, year, month, daysInMonth, isCurrentMonth, now]);

  function openBookingOrProperty(event: CalendarEvent) {
    setSelectedEvent(null);
    setSelectedDay(null);
    if (event.bookingId) router.push(`/host/booking/${event.bookingId}`);
    else router.push(`/host/property/${event.propertyId}`);
  }

  async function handleShareCheckIn(event: CalendarEvent) {
    if (!event.checkInToken) return;
    const url = resolveCheckInUrl(event.checkInToken);
    const text = `Hi! Please complete your online check-in for ${event.propertyName} here: ${url}`;
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
      toast.show(event.isBlocked ? 'Booking created — link copied' : 'Check-in link created and copied', 'success');
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
      setError(err instanceof ApiError ? err.message : 'Could not create a check-in link for this reservation.');
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
      toast.show(rate !== null ? `Booked at ${rate} MAD/night` : 'Marked as a real booking', 'success');
      setSelectedEvent({ ...event, isBlocked: false, nightlyRate: rate ?? event.nightlyRate });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this reservation.');
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
      toast.show(rate !== null ? `Saved — ${rate} MAD/night` : 'Rate cleared — using the property default', 'success');
      setSelectedEvent({ ...event, nightlyRate: rate });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this rate.');
    } finally {
      setSheetBusy(false);
    }
  }

  async function handleCopyCheckIn(event: CalendarEvent) {
    if (!event.checkInToken) return;
    await Clipboard.setStringAsync(resolveCheckInUrl(event.checkInToken));
    setCopiedEventId(event.id);
    toast.show('Check-in link copied');
    setTimeout(() => setCopiedEventId((id) => (id === event.id ? null : id)), 2000);
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h1}>Calendar</Text>
        <View style={{ marginTop: spacing.sm }}>
          <PropertySelect
            properties={properties}
            value={propertyFilter}
            onChange={setPropertyFilter}
            extraOptions={[{ value: '__NONE__', label: 'All properties' }]}
          />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: 'LIST', label: 'Listings' },
              { value: 'MONTH', label: 'Calendar' },
            ]}
          />
        </View>
        {error && <ErrorBanner message={error} onRetry={load} />}
      </View>

      {view === 'MONTH' && (
        <View style={styles.monthNav}>
          <Pressable hitSlop={10} onPress={() => setMonthCursor(new Date(year, month - 1, 1))}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </Pressable>
          <Text style={typography.h3}>{monthLabel}</Text>
          <Pressable hitSlop={10} onPress={() => setMonthCursor(new Date(year, month + 1, 1))}>
            <Ionicons name="chevron-forward" size={20} color={colors.ink} />
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
              {WEEKDAY_LABELS.map((w, i) => (
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
                    const source = sourceShortLabel(seg.event);
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
                        <Ionicons name={eventIcon(seg.event) as any} size={10} color={colors.white} />
                        <Text style={styles.monthBarText} numberOfLines={1}>
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

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: colors.accent }]}>
                  <Ionicons name="sparkles-outline" size={9} color={colors.white} />
                </View>
                <Text style={styles.legendText}>Cleaning</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]}>
                  <Ionicons name="bed-outline" size={9} color={colors.white} />
                </View>
                <Text style={styles.legendText}>Guest stay</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: colors.inkFaint }]}>
                  <Ionicons name="lock-closed-outline" size={9} color={colors.white} />
                </View>
                <Text style={styles.legendText}>Blocked</Text>
              </View>
              <Text style={styles.legendHint}>Tap a booking for details</Text>
            </View>
          </View>
        )}

        {view === 'LIST' && (
          <View>
            {visibleProperties.length === 0 ? (
              <EmptyState message="No properties to show." />
            ) : (
              visibleProperties.map((p) => {
                const photoUrl = propertyCoverUrl(p, 130);
                const status = statusByProperty[p.id];
                const today = todayIso();
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
                          <Text style={typography.h3} numberOfLines={1}>{p.name}</Text>
                          {p.hospitableListingId && (
                            <View style={styles.syncBadge}>
                              <Ionicons name="link-outline" size={10} color={colors.primary} />
                              <Text style={styles.syncBadgeText}>Airbnb</Text>
                            </View>
                          )}
                        </View>
                        {status && (
                          <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                            <StatusBadge label={PROPERTY_STATUS_LABELS[status.status]} tone={PROPERTY_STATUS_TONE[status.status]} />
                          </View>
                        )}
                      </View>
                      <View style={styles.listDotGrid}>
                        {listDays.map((day) => {
                          const dayStatus = dayStatusForProperty(p.id, day);
                          const isToday = day === today;
                          return (
                            <View
                              key={day}
                              style={[
                                styles.listDot,
                                { backgroundColor: listDotColor(dayStatus) },
                                isToday && styles.listDotToday,
                              ]}
                            />
                          );
                        })}
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setQuickAddOpen(true)}>
        <Ionicons name="add" size={24} color={colors.white} />
      </Pressable>

      {/* Day overflow — Month view */}
      <Modal visible={!!selectedDay} animationType="fade" transparent onRequestClose={() => setSelectedDay(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedDay(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={typography.h3}>
              {selectedDay && parseDateOnly(selectedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <ScrollView style={{ maxHeight: 360, marginTop: spacing.sm }}>
              {(selectedDay ? eventsByDay[selectedDay] ?? [] : []).map((ev) => (
                <Pressable
                  key={ev.id}
                  onPress={() => {
                    setSelectedDay(null);
                    openEventSheet(ev);
                  }}
                >
                  <Card style={{ marginBottom: spacing.sm }}>
                    <View style={styles.row}>
                      <View style={[styles.iconCircle, { backgroundColor: `${eventAccentColor(ev)}22` }]}>
                        <Ionicons name={eventIcon(ev) as any} size={16} color={eventAccentColor(ev)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h3} numberOfLines={1}>{ev.title}</Text>
                        <Text style={typography.bodyMuted}>{ev.propertyName}</Text>
                        {/* The full span, so a day that's the middle of an
                            existing stay is obviously not a new arrival. */}
                        {ev.kind === 'GUEST_STAY' && (
                          <Text style={typography.caption}>{staySpanLabel(ev)}</Text>
                        )}
                      </View>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Event detail */}
      <Modal visible={!!selectedEvent} animationType="fade" transparent onRequestClose={() => setSelectedEvent(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedEvent(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {selectedEvent && (
              <>
                <View style={styles.row}>
                  <View style={[styles.iconCircle, { backgroundColor: `${eventAccentColor(selectedEvent)}22` }]}>
                    <Ionicons name={eventIcon(selectedEvent) as any} size={18} color={eventAccentColor(selectedEvent)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h2}>{selectedEvent.title}</Text>
                    <Text style={typography.bodyMuted}>{selectedEvent.propertyName}</Text>
                  </View>
                </View>

                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {selectedEvent.kind === 'GUEST_STAY' && (
                    <>
                      <Text style={typography.bodyMuted}>
                        {selectedEvent.isBlocked ? 'Blocked on' : 'Platform:'} {SOURCE_LABEL[selectedEvent.source ?? 'DIRECT']}
                      </Text>
                      <Text style={typography.bodyMuted}>{staySpanLabel(selectedEvent)}</Text>
                      {selectedEvent.guestCount != null && selectedEvent.guestCount > 0 && (
                        <Text style={typography.bodyMuted}>
                          {selectedEvent.guestCount} guest{selectedEvent.guestCount === 1 ? '' : 's'}
                        </Text>
                      )}
                    </>
                  )}
                  {selectedEvent.kind === 'CLEANING' && (
                    <Text style={typography.bodyMuted}>
                      {parseDateOnly(selectedEvent.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                  <StatusBadge label={eventStatusLabel(selectedEvent)} tone={eventStatusTone(selectedEvent)} />
                </View>

                {selectedEvent.checkInToken && selectedEvent.checkInStatus === 'PENDING' && (
                  <>
                    <Button
                      label={copiedEventId === selectedEvent.id ? 'Copied!' : 'Copy check-in link'}
                      onPress={() => handleCopyCheckIn(selectedEvent)}
                      style={{ marginTop: spacing.lg }}
                    />
                    <Button
                      label="Share via WhatsApp"
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
                      label="Rate per night (MAD) — optional"
                      value={rateInput}
                      onChangeText={setRateInput}
                      keyboardType="numeric"
                      placeholder="e.g. 650"
                    />
                    <Text style={typography.caption}>
                      Sets what this night earns in your reports. Leave blank and save to fall back to the property's default rate.
                    </Text>
                    <Button
                      label={sheetBusy ? 'Saving…' : 'Save price'}
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
                        label="Number of guests — optional"
                        value={guestInput}
                        onChangeText={setGuestInput}
                        keyboardType="number-pad"
                        placeholder="e.g. 4"
                      />
                      <Text style={typography.caption}>
                        How many people the guest can register on the check-in form. Defaults to 1.
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
                            ? 'Working…'
                            : selectedEvent.isBlocked
                              ? 'This is a real booking — create check-in link'
                              : 'Create check-in link'
                        }
                        loading={sheetBusy}
                        onPress={() => handleGenerateCheckIn(selectedEvent)}
                        style={{ marginTop: spacing.lg }}
                      />
                      {selectedEvent.isBlocked && (
                        <Button
                          label="Mark as booked (no guest link)"
                          variant="outline"
                          loading={sheetBusy}
                          onPress={() => handleUnblock(selectedEvent)}
                          style={{ marginTop: spacing.sm }}
                        />
                      )}
                    </>
                  )}
                <Button
                  label={selectedEvent.bookingId ? 'View booking' : 'View property'}
                  onPress={() => openBookingOrProperty(selectedEvent)}
                  style={{
                    marginTop:
                      (selectedEvent.checkInToken && selectedEvent.checkInStatus === 'PENDING') ||
                      (selectedEvent.kind === 'GUEST_STAY' && selectedEvent.reservationId && !selectedEvent.checkInToken)
                        ? spacing.sm
                        : spacing.lg,
                  }}
                />
                <Button label="Close" variant="outline" onPress={() => setSelectedEvent(null)} style={{ marginTop: spacing.sm }} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Quick add */}
      <Modal visible={quickAddOpen} animationType="fade" transparent onRequestClose={() => setQuickAddOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setQuickAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={typography.h3}>Add</Text>
            <Pressable
              style={styles.quickAddRow}
              onPress={() => {
                setQuickAddOpen(false);
                router.push({ pathname: '/host/booking/new', params: propertyFilter ? { propertyId: propertyFilter } : {} });
              }}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>Add cleaning</Text>
                <Text style={typography.bodyMuted}>Request a cleaning or maintenance visit</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.quickAddRow}
              onPress={() => {
                setQuickAddOpen(false);
                router.push({ pathname: '/host/checkin/new', params: propertyFilter ? { propertyId: propertyFilter } : {} });
              }}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="key-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>Guest online check-in</Text>
                <Text style={typography.bodyMuted}>Generate a check-in link for a guest stay</Text>
              </View>
            </Pressable>
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
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.inkFaint },
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
  dayCellToday: { backgroundColor: 'rgba(0,109,119,0.06)' },
  dayNumberWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrapToday: { backgroundColor: colors.primary },
  dayNumber: { fontSize: 13, color: colors.ink, fontWeight: '500' },
  dayNumberToday: { color: colors.white, fontWeight: '700' },
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
  monthBarText: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.white },
  monthOverflow: {
    position: 'absolute',
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  monthOverflowText: { fontSize: 10, fontWeight: '700', color: colors.inkMuted },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 16, height: 16, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  legendText: { fontSize: 11, color: colors.inkMuted, fontWeight: '500' },
  legendHint: { fontSize: 11, color: colors.inkFaint, marginLeft: 'auto' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  syncBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  listDotGrid: {
    width: LIST_GRID_COLS * 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  listDot: { width: 8, height: 8, borderRadius: 4 },
  listDotToday: { borderWidth: 1.5, borderColor: colors.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  quickAddRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
