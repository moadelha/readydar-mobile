import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { AllCheckIn, CalendarEvent, resolveThumbnailUrl } from './api';
import { stayLabel } from './checkin-groups';

/**
 * Host notifications — derived on the device, not fetched.
 *
 * There is no notifications API to call. The backend's `notifications`
 * module is a genuine empty stub: a controller with zero routes and a
 * service with no methods (`apps/api/src/modules/notifications/`). So
 * there is no notification record, no server-side read/unread state, and
 * no push — everything here is computed from responses the Home screen
 * already has, and "read" is stored per-device.
 *
 * **Why a guest submission comes from `/checkins/all` and not the
 * welcome-message queue.** `guestWelcome.listPending` looks like the
 * cheaper source — it is literally "check-ins a guest just submitted" —
 * but its query requires `guestPhone: { not: null }` *and*
 * `property.guestWelcomeMode === 'MANUAL_CONFIRM'`. A host who leaves
 * welcome automation off, or a guest who checked in without a phone
 * number, would produce nothing at all: a bell that never rings. The
 * status on the check-in itself is the only complete signal.
 *
 * The cost of that choice is real and worth knowing: `/checkins/all`
 * returns up to 300 rows, 60 days back, each with its nested guest
 * records and contract. It is by far the heaviest call Home makes. A lean
 * `GET /checkins/submitted?since=` would be the right fix if this screen
 * ever feels slow — see the notes at the end of the Part 39 doc entry.
 */

/** Notification ids are stable across loads — read state is keyed on them. */
export type NotificationKind = 'CHECKIN_SUBMITTED' | 'JOB_UNACCEPTED' | 'SAME_DAY_TURNOVER';

export interface HostNotification {
  /** Stable across reloads. Never derive this from an array index. */
  id: string;
  kind: NotificationKind;
  /** Epoch ms — sorts the list and drives the relative time label. */
  at: number;
  title: string;
  body: string;
  /** Route pushed when the row is tapped. */
  href: string;
  photoUrl: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'primary' | 'accent' | 'danger';
}

/**
 * How far back a submission still counts as news.
 *
 * `/checkins/all` reaches 60 days back, which is history, not a
 * notification — a bell showing two months of submissions is a list, and
 * the host already has one of those on the Guests screen.
 */
export const SUBMITTED_WINDOW_DAYS = 14;
const SUBMITTED_WINDOW_MS = SUBMITTED_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * `YYYY-MM-DD` from **local** date components.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that is UTC, which in
 * Morocco (UTC+1) puts anything after 23:00 on the previous day.
 */
function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Midnight at the start of the local day containing `ms`. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function guestLabel(c: AllCheckIn): string {
  const full = `${c.guestFirstName ?? ''} ${c.guestLastName ?? ''}`.trim();
  return full || c.guestNameHint || 'Your guest';
}

/**
 * Builds the notification list from what Home already has in memory.
 *
 * Deliberately a pure function of its inputs: it does no fetching and
 * holds no state, so it can be unit-tested directly and so the same
 * `turnoverPropertyIds` set Home derives for its "Apartments not ready"
 * section is reused here rather than recomputed a second way.
 */
export function buildNotifications(input: {
  /** Every check-in across the host's properties — `api.checkins.listAll`. */
  allCheckIns: AllCheckIn[];
  /** Today's calendar feed, already loaded for the not-ready section. */
  todayEvents: CalendarEvent[];
  /** Properties with a checkout and an arrival on the same day, as Home derives them. */
  turnoverPropertyIds: Set<string>;
  now?: number;
}): HostNotification[] {
  const { allCheckIns, todayEvents, turnoverPropertyIds } = input;
  const now = input.now ?? Date.now();
  const items: HostNotification[] = [];

  // 1. A guest filled in their check-in link — the one the host asked for.
  for (const c of allCheckIns) {
    if (c.status !== 'SUBMITTED') continue;
    // `submittedAt` is written by CheckinsService#submit. Falling back to
    // `createdAt` keeps a row with a missing timestamp visible rather than
    // silently dropping it; it only affects the ordering and the "2 days
    // ago" label, never whether the host is told.
    const at = Date.parse(c.submittedAt ?? c.createdAt);
    if (!Number.isFinite(at)) continue;
    if (now - at > SUBMITTED_WINDOW_MS) continue;
    items.push({
      id: `checkin:${c.id}`,
      kind: 'CHECKIN_SUBMITTED',
      at,
      title: `${guestLabel(c)} completed their check-in`,
      body: `${c.property.name} · ${stayLabel(c)}`,
      // Straight to the property page with that check-in opened — where the
      // ID photos, signed contract, PDF export and welcome message all are.
      href: `/host/property/${c.propertyId}?checkin=${c.id}`,
      photoUrl: c.property.photoUrl ? resolveThumbnailUrl(c.property.photoUrl, 130) : null,
      icon: 'person-circle-outline',
      tone: 'primary',
    });
  }

  // 2. A cleaning today that nobody has accepted. The property's own status
  //    can still read READY while the job silently goes unfilled, so this
  //    is not implied by anything else on the screen.
  for (const ev of todayEvents) {
    if (ev.kind !== 'CLEANING') continue;
    if (ev.status !== 'PENDING_MATCH' && ev.status !== 'DISPUTED') continue;
    if (!ev.bookingId) continue;
    const at = Date.parse(ev.date);
    items.push({
      id: `job:${ev.bookingId}`,
      kind: 'JOB_UNACCEPTED',
      at: Number.isFinite(at) ? at : now,
      title: 'Cleaning still has no cleaner',
      body: `${ev.propertyName} · scheduled today`,
      href: `/host/booking/${ev.bookingId}`,
      photoUrl: null,
      icon: 'alert-circle-outline',
      tone: 'danger',
    });
  }

  // 3. Same-day turnover — one guest out, another in, today. The tightest
  //    cleaning window there is.
  //
  // The day comes from `now`, not from the clock: this function promises to
  // be a pure function of its inputs, and reading the clock here would make
  // the id disagree with the rest of the list whenever `now` is supplied.
  const today = localDay(now);
  const turnoverNames: Record<string, string> = {};
  for (const ev of todayEvents) turnoverNames[ev.propertyId] = ev.propertyName;
  for (const propertyId of turnoverPropertyIds) {
    const at = Date.parse(`${today}T00:00:00`);
    items.push({
      // Keyed by day: tomorrow's turnover on the same property is a new
      // notification rather than one the host already dismissed yesterday.
      id: `turnover:${propertyId}:${today}`,
      kind: 'SAME_DAY_TURNOVER',
      at: Number.isFinite(at) ? at : now,
      title: 'Same-day turnover today',
      body: `${turnoverNames[propertyId] ?? 'A property'} · a guest leaves and another arrives`,
      href: `/host/property/${propertyId}`,
      photoUrl: null,
      icon: 'flash',
      tone: 'danger',
    });
  }

  return items.sort((a, b) => b.at - a.at);
}

/**
 * "Just now" / "3h ago" / "Yesterday" / "4 days ago" / a plain date.
 *
 * The day boundary is checked **before** the hours one, and by calendar
 * date rather than elapsed time. Something a guest submitted at 23:00 last
 * night should read "Yesterday" when the host opens the app at 10:00, not
 * "11h ago" — the host thinks in days, and an hours figure that crosses
 * midnight quietly lies about which day it was.
 */
export function notificationTime(at: number, now = Date.now()): string {
  const diff = now - at;
  if (diff < 60 * 1000) return 'Just now';
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return `${minutes}m ago`;

  const days = Math.round((startOfDay(now) - startOfDay(at)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ------------------------------------------------------------------ */
/* Read state — per device, same reasoning as src/lib/dismissed.ts     */
/* ------------------------------------------------------------------ */

/**
 * There is no field on any backend model for "the host has seen this",
 * and inventing one would mean a migration for what is really a reading
 * preference. The cost is that read state doesn't follow a host to a
 * second device — the right trade while these notifications are derived
 * rather than stored.
 */
const KEY = 'darclean_seen_notifications';

export async function readSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // A corrupt store must never stop Home loading. Worst case the bell
    // shows a count for something the host already looked at.
    return [];
  }
}

/** Marks one or many as read. Returns the new full list. */
export async function addSeen(ids: string[]): Promise<string[]> {
  const current = await readSeen();
  const next = Array.from(new Set([...current, ...ids]));
  if (next.length === current.length) return current;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore — the in-memory copy still marks it read for this session.
  }
  return next;
}

/**
 * Drops read marks for notifications that no longer exist, so the stored
 * list can't grow without bound. A submission ages out of the 14-day
 * window, a cleaning gets accepted, a turnover's day passes — all of them
 * leave their id behind otherwise.
 */
export async function pruneSeen(liveIds: string[]): Promise<string[]> {
  const current = await readSeen();
  const live = new Set(liveIds);
  const next = current.filter((id) => live.has(id));
  if (next.length === current.length) return current;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore.
  }
  return next;
}

export function unreadCount(items: HostNotification[], seen: string[]): number {
  const read = new Set(seen);
  return items.reduce((n, item) => (read.has(item.id) ? n : n + 1), 0);
}
