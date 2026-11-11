import type { CalendarEvent, StayRef } from './api';
import { todayIso } from './calendar-visuals';

/**
 * Hostels: helpers shared by the Desk and Housekeeping tabs. Same rules as
 * the web app's front desk (apps/web components/front-desk.tsx and
 * rooms-tonight.tsx), so the phone and the desk computer agree.
 */

/**
 * The property's own day (YYYY-MM-DD) in its time zone — the "today" the
 * server books against, whatever zone the phone is set to. Morocco when the
 * property has no (valid) zone.
 */
export function propertyDay(timeZone?: string | null) {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  try {
    return format(timeZone || 'Africa/Casablanca');
  } catch {
    try {
      return format('Africa/Casablanca');
    } catch {
      // No time-zone data on this phone's JS engine: its own date is the best we have.
      return todayIso();
    }
  }
}

/**
 * A booking of several rooms/beds arrives as one calendar event per room
 * (same groupKey). Folds them into one — the first room's event, with every
 * room's beds and the party size — so the desk lists the booking once.
 */
export function collapseRoomGroups(events: CalendarEvent[]): CalendarEvent[] {
  const groups = new Map<string, CalendarEvent[]>();
  const out: CalendarEvent[] = [];
  for (const e of events) {
    if (!e.groupKey) {
      out.push(e);
      continue;
    }
    const list = groups.get(e.groupKey);
    if (list) list.push(e);
    else {
      groups.set(e.groupKey, [e]);
      out.push(e);
    }
  }
  return out.map((e) => {
    const rows = e.groupKey ? groups.get(e.groupKey) : undefined;
    if (!rows || rows.length < 2) return e;
    const guests = e.checkInId ? e.guestCount : rows.reduce((n, r) => n + (r.guestCount ?? 0), 0) || e.guestCount;
    return { ...e, guestCount: guests, roomUnits: rows.flatMap((r) => r.roomUnits ?? []), groupSize: rows.length };
  });
}

/** "Room 4" / "Bed 4" for a numbered unit; a name the host chose ("Suite Atlas") as is. */
export function unitLabel(name: string, kind: 'PRIVATE' | 'DORM' | null | undefined, s: { roomN: (n: number) => string; bedN: (n: number) => string }) {
  if (!/^\d+$/.test(name)) return name;
  return kind === 'DORM' ? s.bedN(Number(name)) : s.roomN(Number(name));
}

/** What the front-desk endpoints take to find a stay. */
export function stayRef(e: CalendarEvent): StayRef {
  return e.reservationId ? { reservationId: e.reservationId } : { checkInId: e.checkInId! };
}

/** The guest's name: the first part of the event title ("Ana Silva · Dorm 6"). */
export function guestNameOf(e: CalendarEvent) {
  return e.title.split(' · ')[0];
}
