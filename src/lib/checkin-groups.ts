import { GuestCheckIn } from './api';

/**
 * How the app classifies and buckets check-ins for the Guests screen and the
 * property page. Shared rather than duplicated per screen, because the
 * expiry rule below is subtle enough that two independent copies would drift.
 */

export type CheckInBucket = 'UPCOMING' | 'SUBMITTED' | 'EXPIRED';

/**
 * Which section a check-in belongs in.
 *
 * **`status === 'EXPIRED'` is very nearly a dead value.** Nothing on the
 * backend ever flips a row from PENDING to EXPIRED — expiry is only checked
 * live, at the moment a guest tries to submit (`CheckinsService#submit`), and
 * never written back. So a link whose window has closed still reads PENDING
 * forever, and a section built by matching on the status alone would be
 * permanently empty while "upcoming" filled with years of dead links.
 *
 * Expiry is therefore derived: past its `expiresAt` if it has one, otherwise
 * past its expected checkout. The stored status is still honoured when it
 * does say EXPIRED, for whatever rows carry it.
 */
export function bucketOf(item: GuestCheckIn, now = Date.now()): CheckInBucket {
  if (item.status === 'SUBMITTED') return 'SUBMITTED';
  if (item.status === 'EXPIRED') return 'EXPIRED';
  const deadline = item.expiresAt ?? item.expectedCheckOut;
  if (deadline && new Date(deadline).getTime() < now) return 'EXPIRED';
  return 'UPCOMING';
}

export interface MonthGroup<T> {
  /** Sortable YYYY-MM key. */
  key: string;
  /** "This month", "Next month", "Last month", or "March 2026". */
  label: string;
  /** Whole months from the current one — 0 = this month, 1 = next, -1 = last. */
  offset: number;
  items: T[];
}

/** YYYY-MM for a date string, from local components (not UTC, which would shift month boundaries). */
function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthOffset(key: string, now: Date) {
  const [y, m] = key.split('-').map(Number);
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
}

/**
 * Buckets items into calendar months, nearest-to-now first.
 *
 * The three months either side of now get relative labels ("This month",
 * "Next month", "Last month") because that's how a host thinks about the
 * near term; anything further out is named outright so it can't be confused
 * with them.
 *
 * Ordering runs outward from the present rather than straight
 * chronologically: for a list of upcoming arrivals the useful thing at the
 * top is this month, then next, and for a list of past submissions it's this
 * month then last. Sorting by `|offset|` gives both from one rule, with
 * future edging out past on a tie.
 */
export function groupByMonth<T>(items: T[], getDate: (item: T) => string, now = new Date()): MonthGroup<T>[] {
  const map = new Map<string, MonthGroup<T>>();

  for (const item of items) {
    const iso = getDate(item);
    if (!iso) continue;
    const key = monthKey(iso);
    let group = map.get(key);
    if (!group) {
      const offset = monthOffset(key, now);
      group = { key, label: monthLabel(key, offset), offset, items: [] };
      map.set(key, group);
    }
    group.items.push(item);
  }

  for (const group of map.values()) {
    group.items.sort((a, b) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime());
  }

  return Array.from(map.values()).sort(
    (a, b) => Math.abs(a.offset) - Math.abs(b.offset) || b.offset - a.offset,
  );
}

function monthLabel(key: string, offset: number) {
  if (offset === 0) return 'This month';
  if (offset === 1) return 'Next month';
  if (offset === -1) return 'Last month';
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "12 – 16 Sep · 4 nights" for a stay. */
export function stayLabel(item: { expectedCheckIn: string; expectedCheckOut: string }) {
  const start = new Date(item.expectedCheckIn);
  const end = new Date(item.expectedCheckOut);
  const nights = Math.max(
    0,
    Math.round(
      (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
        new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (nights <= 0) return fmt(start);
  return `${fmt(start)} – ${fmt(end)} · ${nights} night${nights === 1 ? '' : 's'}`;
}
