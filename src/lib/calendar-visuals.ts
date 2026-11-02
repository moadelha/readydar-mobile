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
import { STATUS_TONE } from './status';
import { propertyColor } from './property-colors';
import { colors } from '@/theme';
import { Dict } from './i18n/dictionary';

export const KIND_ICON: Record<CalendarEvent['kind'], string> = {
  CLEANING: 'sparkles-outline',
  GUEST_STAY: 'bed-outline',
};

/**
 * @deprecated English-only fallback for call sites that don't have `t`
 * handy. Prefer `t.sourceLabel` (see the Dict interface) — every screen
 * this module is actually used from does have `t`, so this should shrink
 * to zero call sites over time rather than grow new ones.
 */
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
export function sourceShortLabel(event: CalendarEvent, t: Dict): string {
  if (event.isBlocked) return t.calendarHost.legendBlocked;
  if (!event.source) return t.sourceLabel.DIRECT;
  return t.sourceLabel[event.source as keyof Dict['sourceLabel']] ?? event.source;
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
export function staySpanLabel(event: CalendarEvent, t: Dict, locale?: string): string {
  const start = parseDateOnly(event.date);
  const end = parseDateOnly(event.endDate || event.date);
  const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const startLabel = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  if (nights <= 0) return startLabel;
  return `${startLabel} – ${endLabel} · ${t.calendarHost.nightsCount(nights)}`;
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

/**
 * @deprecated English-only fallback for call sites without `t` handy —
 * prefer `t.guestStayStatus` (see eventStatusLabel below, which does).
 */
export const GUEST_STAY_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting online check-in',
  SUBMITTED: 'Check-in complete',
  EXPIRED: 'Check-in link expired',
};

/**
 * Today's date on the phone, as YYYY-MM-DD. Local, not UTC: `toISOString`
 * gives the UTC date, which is yesterday in Morocco just after midnight and
 * already tomorrow by the evening for a host in the Americas.
 */
export function todayIso() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The locale dates are written in, following the app's language rather than the phone's. */
export function dateLocale(lang: 'EN' | 'FR' | 'AR') {
  return lang === 'FR' ? 'fr-FR' : lang === 'AR' ? 'ar-MA' : 'en-GB';
}

/** Monday-first weekday initials in the given locale — the Calendar tab and the date picker. */
export function weekdayLetters(locale: string) {
  // 1 January 2024 was a Monday.
  return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }));
}

/** Text colour that reads on a calendar bar of the given colour (dark on the light saffron/yellow bars). */
export function barTextColor(background: string) {
  return background === colors.accent || background === colors.channel.expedia ? colors.green950 : colors.onPrimary;
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

export function eventStatusLabel(event: CalendarEvent, t: Dict) {
  if (event.kind === 'CLEANING') return t.bookingStatus[event.status as keyof Dict['bookingStatus']] ?? event.status;
  if (event.isBlocked) return t.calendarHost.legendBlocked;
  if (event.source === 'DIRECT') return t.guestStayStatus[event.status as keyof Dict['guestStayStatus']] ?? event.status;
  return t.calendarHost.confirmedStatus;
}
export function eventStatusTone(event: CalendarEvent): 'neutral' | 'primary' | 'accent' | 'success' {
  if (event.kind === 'CLEANING') return STATUS_TONE[event.status as keyof typeof STATUS_TONE] ?? 'neutral';
  if (event.isBlocked) return 'neutral';
  if (event.source === 'DIRECT' && event.status === 'PENDING') return 'accent';
  return 'success';
}
/**
 * Booking color, by source rather than by property — Airbnb pink, Booking.com
 * blue, anything host-entered (an offline booking or a standalone check-in
 * link with no synced reservation) yellow, and a blocked night grey
 * regardless of which platform it was blocked on. Replaces the old
 * per-property rotating palette (still used for the Expenses list's
 * property dots, see property-colors.ts) — a host telling stays apart by
 * platform at a glance was more useful than telling properties apart by
 * color, and the source is now shown as text on every bar anyway (see
 * sourceShortLabel).
 */
const SOURCE_ACCENT_COLOR: Record<string, string> = {
  AIRBNB: colors.channel.airbnb,
  BOOKING_COM: colors.channel.booking,
};
// Host-entered booking — offline (MANUAL, not blocked) or a standalone
// check-in link (DIRECT): booked in ReadyDar itself, so the brand green.
// (Saffron is taken by cleanings.)
const OFFLINE_ACCENT_COLOR = colors.green500;

export function eventAccentColor(event: CalendarEvent): string {
  if (event.kind === 'CLEANING') return colors.accent;
  if (event.isBlocked) return colors.inkFaint;
  if (event.source && SOURCE_ACCENT_COLOR[event.source]) return SOURCE_ACCENT_COLOR[event.source];
  if (event.source === 'MANUAL' || event.source === 'DIRECT') return OFFLINE_ACCENT_COLOR;
  // Anything else (a source the app doesn't know about yet) falls back to
  // the old per-property color rather than an undefined/blank bar.
  return propertyColor(event.propertyId);
}
export function eventIcon(event: CalendarEvent): string {
  if (event.isBlocked) return 'lock-closed-outline';
  return KIND_ICON[event.kind];
}
