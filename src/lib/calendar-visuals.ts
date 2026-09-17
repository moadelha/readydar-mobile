/**
 * Shared date/visual helpers for rendering a `CalendarEvent` — pulled out of
 * `calendar.tsx` so the Home screen (attention list, today's
 * arrivals/departures) and, later, the Property Detail "Calendar" tab can
 * show the exact same colors, icons and status wording for a booking or
 * guest stay instead of re-deriving their own. Keep anything that reads a
 * `CalendarEvent` and decides "what color/icon/label represents this" here,
 * not duplicated per-screen — see the project's duplication rule.
 */
import { CalendarEvent } from './api';
import { STATUS_LABELS, STATUS_TONE } from './status';
import { propertyColor } from './property-colors';
import { colors } from '@/theme';

export const KIND_ICON: Record<CalendarEvent['kind'], string> = {
  CLEANING: 'sparkles-outline',
  GUEST_STAY: 'bed-outline',
};

export const SOURCE_LABEL: Record<string, string> = {
  AIRBNB: 'Airbnb',
  BOOKING_COM: 'Booking.com',
  DIRECT: 'Direct',
  MANUAL: 'Offline',
};

/**
 * The short "where did this booking come from" label shown on a calendar
 * bar — "Airbnb", "Booking.com", "Direct", "Offline", or "Blocked".
 *
 * `isBlocked` deliberately wins over the source: a range the host blocked
 * on Airbnb is not an Airbnb *booking*, and labelling it "Airbnb" is the
 * exact confusion Part 27 set out to fix.
 */
export function sourceShortLabel(event: CalendarEvent): string {
  if (event.isBlocked) return 'Blocked';
  if (!event.source) return 'Direct';
  return SOURCE_LABEL[event.source] ?? event.source;
}

/**
 * The guest's name for a stay, or `null` when the feed never carried one.
 *
 * The backend composes a synced reservation's `title` as
 * `"<guest name> · <platform label>"` (see PropertiesService#getCalendarEvents),
 * falling back to the bare platform label — "Airbnb reservation",
 * "Blocked", "Offline booking" — when the platform gave no guest. Splitting
 * that back apart lets the UI show the name and the source as two separate,
 * differently-styled pieces rather than one long run-on string that gets
 * truncated mid-platform-name in a narrow bar.
 *
 * Returning `null` (rather than a placeholder) is what lets a caller decide
 * how to fill the space — a timeline bar shows just the source pill, where
 * a detail sheet might prefer the word "Guest".
 */
/**
 * "12 – 16 Sep · 4 nights" for a stay, or a single formatted date when it
 * doesn't span nights. Shown wherever one day of a booking is listed on its
 * own (a day's event sheet, an attention card) so the host can tell at a
 * glance that today's entry is part of a longer stay they've already seen,
 * rather than a new arrival.
 */
export function staySpanLabel(event: CalendarEvent): string {
  const start = parseDateOnly(event.date);
  const end = parseDateOnly(event.endDate || event.date);
  const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (nights <= 0) return startLabel;
  return `${startLabel} – ${endLabel} · ${nights} night${nights === 1 ? '' : 's'}`;
}

export function eventGuestName(event: CalendarEvent): string | null {
  if (event.kind === 'CLEANING') return event.title;
  const parts = event.title.split(' · ');
  if (parts.length > 1) return parts[0].trim() || null;
  // A single-part title is a real name for a direct stay, but for anything
  // synced it's the platform label standing in for a name we never got.
  if (event.source && event.source !== 'DIRECT') return null;
  if (event.isBlocked) return null;
  const only = parts[0].trim();
  return only && only !== 'Guest stay' ? only : null;
}

/** Host-facing wording for a guest stay's check-in status, as shown on a calendar event. */
export const GUEST_STAY_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting online check-in',
  SUBMITTED: 'Check-in complete',
  EXPIRED: 'Check-in link expired',
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
export function pad(n: number) {
  return String(n).padStart(2, '0');
}
/** Format y/m(0-indexed)/d as 'YYYY-MM-DD' purely from local components — avoids
 * the UTC-shift trap of toISOString() when doing day-grid date arithmetic. */
export function ymd(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
export function parseDateOnly(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** Adds `n` days to an ISO date string, purely via local date components (see ymd() above). */
export function addDaysIso(iso: string, n: number) {
  const d = parseDateOnly(iso);
  const shifted = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return ymd(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

export function eventStatusLabel(event: CalendarEvent) {
  if (event.kind === 'CLEANING') return STATUS_LABELS[event.status as keyof typeof STATUS_LABELS] ?? event.status;
  if (event.isBlocked) return 'Blocked';
  if (event.source === 'DIRECT') return GUEST_STAY_STATUS_LABEL[event.status] ?? event.status;
  return 'Confirmed';
}
export function eventStatusTone(event: CalendarEvent): 'neutral' | 'primary' | 'accent' | 'success' {
  if (event.kind === 'CLEANING') return STATUS_TONE[event.status as keyof typeof STATUS_TONE] ?? 'neutral';
  if (event.isBlocked) return 'neutral';
  if (event.source === 'DIRECT' && event.status === 'PENDING') return 'accent';
  return 'success';
}
/** A night the host blocked on Airbnb themselves — not a real guest, so it gets a neutral color/icon instead of the property's own color and a bed icon. */
export function eventAccentColor(event: CalendarEvent): string {
  if (event.kind === 'CLEANING') return colors.accent;
  if (event.isBlocked) return colors.inkFaint;
  return propertyColor(event.propertyId);
}
export function eventIcon(event: CalendarEvent): string {
  if (event.isBlocked) return 'lock-closed-outline';
  return KIND_ICON[event.kind];
}
