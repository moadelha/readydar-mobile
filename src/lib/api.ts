import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  'http://localhost:4000/api/v1';

/** Base URL of the web app — used to build the guest-facing online check-in link and the Terms & Conditions link. */
export const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ??
  (Constants.expoConfig?.extra?.webUrl as string) ??
  'http://localhost:3000';

/**
 * The host-only PDF export for one guest check-in — full details plus
 * every guest's uploaded ID photo, laid out for printing/filing. Requires
 * a bearer token (see `downloadAndShare` in `src/lib/files.ts`), so this
 * just builds the URL rather than fetching it directly.
 */
export function checkInPdfUrl(checkInId: string) {
  return `${API_URL}/checkins/${checkInId}/pdf`;
}

/**
 * The host-only PDF export of a guest's *signed rental contract* — the
 * contract text as it read at signing time, plus the drawn signature.
 * Only ever resolves to something real once the guest has actually signed
 * one during online check-in (see GuestCheckIn.contract on the backend) —
 * callers should only surface a download action when `GuestCheckIn.contract`
 * is present. Same auth-header pattern as `checkInPdfUrl` above.
 */
export function contractPdfUrl(checkInId: string) {
  return `${API_URL}/checkins/${checkInId}/contract-pdf`;
}

/**
 * The host-only PDF export of a cleaning report — every photo grouped by
 * area, with timestamps/GPS and the QR verification code. Same auth-header
 * pattern as checkInPdfUrl above.
 */
export function cleaningReportPdfUrl(reportId: string) {
  return `${API_URL}/cleaning-reports/${reportId}/pdf`;
}

/** The public, no-login page anyone with the report's QR code or link can open to confirm it's authentic — mirrors CleaningReportsService#verificationUrlFor on the backend. */
export function resolveCleaningReportVerificationUrl(verificationCode: string) {
  return `${WEB_URL}/verify/cleaning-report/${verificationCode}`;
}

const SESSION_KEY = 'darclean_session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type HostAccessRole = 'OWNER' | 'MANAGER' | 'STAFF';

export interface AuthUser {
  id: string;
  email: string;
  role: 'HOST' | 'CLEANER' | 'ADMIN' | 'SUPPORT';
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  preferredLanguage?: 'EN' | 'FR' | 'AR';
  /** Only meaningful for role === 'HOST' — null means no host-business standing at all. */
  hostRole?: HostAccessRole | null;
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// --- Secure session storage -------------------------------------------------

export async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: StoredSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// --- Silent token refresh ----------------------------------------------------

let refreshInFlight: Promise<string | null> | null = null;
let onForceLogout: (() => void) | null = null;
let onSessionRefreshed: ((session: StoredSession) => void) | null = null;

/** Called once by AuthProvider so the API layer can trigger a clean logout. */
export function registerForceLogoutHandler(handler: () => void) {
  onForceLogout = handler;
}

/**
 * Called once by AuthProvider so a *silent*, 401-triggered refresh (below)
 * can push the rotated token pair into React state, not just SecureStore.
 *
 * Without this, every screen keeps reading the stale `session.accessToken`
 * it was mounted with — `request()` still recovers on that screen's own
 * next 401 (it always re-reads SecureStore fresh), but every other
 * concurrent or subsequent call made with the stale token pays for its own
 * redundant 401-then-refresh round trip, and a `Promise.all` of several
 * such calls (property/checkins/status-overview firing together — see the
 * property page's `load()`) can race the backend's refresh-token rotation:
 * more than one of them reads the *same* now-stale refresh token before
 * either has written the rotated one back, so only the first actually
 * succeeds and the rest fail outright instead of quietly retrying. That
 * race is what made changing a property's status back to "Ready" seem to
 * randomly error — the status write itself succeeded; the reload right
 * after it was the one that lost the race.
 */
export function registerSessionRefreshHandler(handler: (session: StoredSession) => void) {
  onSessionRefreshed = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const stored = await readStoredSession();
    if (!stored?.refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (!res.ok) return null;

      const data = await res.json();
      const next: StoredSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      };
      await writeStoredSession(next);
      onSessionRefreshed?.(next);
      return next.accessToken;
    } catch {
      return null;
    }
  })();

  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

// --- Core request helpers ----------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && options.token && !isRetry && !path.startsWith('/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, { ...options, token: newToken }, true);
    }
    await clearStoredSession();
    onForceLogout?.();
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.message ?? res.statusText ?? 'Something went wrong';
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }

  return data as T;
}

function requestPut<T>(path: string, body: unknown, token: string): Promise<T> {
  return request<T>(path, { method: 'PUT', body, token });
}

/** A file picked via expo-image-picker, ready to attach to a multipart request. */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

async function requestForm<T>(
  path: string,
  fields: Record<string, string>,
  files: Record<string, PickedFile>,
  options: { method?: 'POST' | 'PATCH'; token?: string | null } = {},
  isRetry = false,
): Promise<T> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  for (const [key, file] of Object.entries(files)) {
    // React Native's fetch/FormData accepts this shape directly.
    formData.append(key, { uri: file.uri, name: file.name, type: file.type } as any);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: formData,
  });

  if (res.status === 401 && options.token && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return requestForm<T>(path, fields, files, { ...options, token: newToken }, true);
    }
    await clearStoredSession();
    onForceLogout?.();
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.message ?? res.statusText ?? 'Something went wrong';
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }

  return data as T;
}

export function resolveUploadUrl(path: string) {
  // Uploaded photos (door photos, job before/after photos, guest ID
  // photos) are stored on Cloudinary now and already come back as full
  // `https://res.cloudinary.com/...` URLs — pass those through untouched.
  // Only a bare relative path (a leftover from the old local-disk storage,
  // if any such record still exists) gets resolved against the API's
  // origin. Concatenating the two for an already-absolute URL would
  // produce a broken, unreachable image link.
  if (/^https?:\/\//i.test(path)) return path;
  const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${apiOrigin}${path}`;
}

/**
 * Options for a larger image than a list thumbnail — the property page's
 * cover photo being the only current caller. Defaults reproduce the
 * original thumbnail behaviour exactly, so existing call sites are
 * unaffected.
 */
export interface ThumbnailOptions {
  /**
   * Target height in real device pixels. Only meaningful with a cropping
   * mode; `limit` ignores it and scales by width alone.
   */
  height?: number;
  /**
   * `limit` (default) — scale down to fit the width, never up, keep the
   * whole image. Right for a thumbnail whose container crops it anyway.
   *
   * `lfill` — crop to exactly width×height, but **never upscale** past the
   * original. Right for a fixed-size hero: the server delivers precisely
   * the pixels the view needs instead of a wider image the device has to
   * downscale itself, which is what makes a large photo look soft.
   * Deliberately `lfill` rather than `fill`: plain `fill` happily upscales
   * a small original server-side, so you download a bigger file that is
   * no sharper.
   */
  crop?: 'limit' | 'lfill';
  /** Cloudinary quality. `auto` (default) is fine for thumbnails; `auto:good` is worth it on a hero. */
  quality?: string;
}

/**
 * A resized/optimized version of a photo URL, for use at a known display
 * size. Photo grids (property door photos, job before/after photos, guest
 * ID photos) were rendering `resolveUploadUrl()`'s full original — often
 * several MB straight from a phone camera — at ~64-84 logical px, which is
 * a real, avoidable source of slowness on any screen with more than a
 * couple of photos. Use `resolveUploadUrl` (full resolution) for the
 * full-screen photo viewer.
 *
 * **`width` is in real device pixels, not logical points.** A 170pt-tall
 * hero on a 3x phone needs ~1030px of image; asking for 340 and letting
 * the device stretch it is exactly how a big photo ends up looking worse
 * than a small one.
 *
 * Two different hosts turn up here, and they're handled separately:
 * - **Cloudinary** (anything a host uploaded) — a transformation segment is
 *   spliced into the delivery URL.
 * - **Airbnb/muscache** (a cover photo imported by the Hospitable sync,
 *   which stores Airbnb's own CDN URL verbatim rather than re-uploading —
 *   see HospitablePropertySyncService#syncCoverPhoto). Cloudinary
 *   transformations mean nothing there; that CDN takes an `im_w` query
 *   parameter instead. If it ever stops honouring it the parameter is
 *   simply ignored and we get the default rendition — the same image we
 *   were already getting, so this can't make things worse.
 *
 * Anything else (a leftover local-disk path) is returned untouched.
 */
export function resolveThumbnailUrl(path: string, width = 200, opts: ThumbnailOptions = {}) {
  const url = resolveUploadUrl(path);

  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const { height, crop = 'limit', quality = 'auto' } = opts;
    const transform = [`w_${Math.round(width)}`];
    if (height && crop !== 'limit') transform.push(`h_${Math.round(height)}`);
    transform.push(`c_${crop}`, `q_${quality}`, 'f_auto');
    const insertAt = idx + marker.length;
    return `${url.slice(0, insertAt)}${transform.join(',')}/${url.slice(insertAt)}`;
  }

  if (url.includes('muscache.com') && !/[?&]im_w=/.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}im_w=${Math.round(width)}`;
  }

  return url;
}

/**
 * A property's cover photo at thumbnail size, or `null` when it has none.
 *
 * Every host-facing property endpoint now returns the most recent
 * `PROPERTY_PHOTO` — `GET /properties/mine`, `/properties/status-overview`
 * and `/properties/:id` alike (the last of which returns *all* photo types,
 * hence the explicit filter rather than just taking `photos[0]`). Most of
 * these photos are Hospitable's own hosted Airbnb image URLs, which pass
 * through `resolveThumbnailUrl` untouched; a photo the host uploaded by hand
 * goes through Cloudinary and does get resized.
 *
 * Kept here next to the other URL resolvers so no screen re-derives "which
 * photo is the cover" for itself.
 */
export function propertyCoverUrl(
  property: { photos?: PropertyPhoto[] | null } | null | undefined,
  width = 130,
  opts?: ThumbnailOptions,
): string | null {
  const cover = property?.photos?.find((p) => p.type === 'PROPERTY_PHOTO');
  return cover ? resolveThumbnailUrl(cover.url, width, opts) : null;
}

/** The guest-facing online check-in form for a given check-in link's token. */
export function resolveCheckInUrl(token: string) {
  return `${WEB_URL}/checkin/${token}`;
}

// --- Domain types --------------------------------------------------------------

export interface City {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface PropertyPhoto {
  id: string;
  type: 'PROPERTY_PHOTO' | 'DOOR_PHOTO' | 'OTHER' | string;
  url: string;
  createdAt: string;
}

/** PropertyType — matches the backend's Prisma enum. */
export type PropertyType = 'APARTMENT' | 'VILLA' | 'RIAD' | 'STUDIO' | 'HOUSE' | 'OTHER';

/** OFF: manual, host does everything by hand. MANUAL_CONFIRM: system prepares, host reviews/sends. AUTO: sent immediately. */
export type AutomationMode = 'OFF' | 'MANUAL_CONFIRM' | 'AUTO';

export type CleaningContactType = 'EXTERNAL' | 'COMPANY_ACCOUNT';

/** A host's cleaning crew contact — their own staff (EXTERNAL) or an enrolled ReadyDar cleaner company account. */
export interface CleaningContact {
  id: string;
  name: string;
  whatsappNumber: string;
  type: CleaningContactType;
  messageTemplate?: string | null;
  cleanerProfileId?: string | null;
  cleanerProfile?: { user?: { firstName: string; lastName: string } | null } | null;
  createdAt?: string;
}

export type CleaningReportStatus = 'IN_PROGRESS' | 'COMPLETED';

/** One photo captured during a cleaning-report walkthrough. `capturedAt` is the device's own clock at the moment of the shot; `receivedAt` is this server's clock at upload, which is what the PDF's authenticity statement actually relies on. `url` is a signed, directly-fetchable S3 URL — only present on the detail endpoint (CleaningReportsService#getDetail resolves it fresh on every call), never on the upload response. */
export interface CleaningReportPhoto {
  id: string;
  section: string;
  url?: string;
  capturedAt: string;
  receivedAt: string;
  latitude: number;
  longitude: number;
  locationAccuracyM?: number | null;
}

/** A camera-verified proof-of-cleaning walkthrough for one property — see property/[id].tsx's "Cleaning reports" action. `_count` and `property` are only present on the list/detail endpoints respectively — see CleaningReportsService#listForProperty vs #getDetail on the backend. */
export interface CleaningReport {
  id: string;
  propertyId: string;
  status: CleaningReportStatus;
  verificationCode: string;
  startedAt: string;
  completedAt?: string | null;
  photos?: CleaningReportPhoto[];
  _count?: { photos: number };
  property?: { id: string; name: string; addressLine: string; city?: { name: string } | null };
}

export interface Property {
  id: string;
  name: string;
  type?: string;
  addressLine: string;
  latitude?: number;
  longitude?: number;
  city: City;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  createdAt?: string;
  nightlyRate?: string | null;
  manualStatusOverride?: string | null;
  accessInstructions?: string | null;
  cleaningNotes?: string | null;
  wifiInfo?: string | null;
  googleMapsUrl?: string | null;
  gateCode?: string | null;
  apartmentNumber?: string | null;
  doorAccessCode?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  houseRules?: string | null;
  photos?: PropertyPhoto[];
  guestWelcomeMode?: AutomationMode;
  guestWelcomeTemplate?: string | null;
  automationMode?: AutomationMode;
  defaultCleaningContactId?: string | null;
  defaultCleaningContact?: CleaningContact | null;
  defaultServiceType?: string | null;
  /** Set only when this property was imported from an Airbnb listing via Hospitable Connect — see HospitablePropertySyncService on the backend. Name/address/room counts on a synced property are overwritten on every re-sync, so they should be edited on Airbnb, not here. */
  hospitableListingId?: string | null;
}

/**
 * One Airbnb listing as Hospitable Connect reports it — the raw shape
 * returned by GET /integrations/hospitable/listings, used purely for the
 * "here's what we found on Airbnb" preview panel. The actual Property
 * records come from POST /integrations/hospitable/sync, not from this.
 */
export interface HospitableListing {
  id: string;
  public_name?: string;
  private_name?: string;
  picture?: string;
  address?: { city?: string; street?: string };
}

export type CheckInLanguage = 'EN' | 'FR' | 'AR';
export type CheckInStatus = 'PENDING' | 'SUBMITTED' | 'EXPIRED';

export interface CheckInGuestEntry {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  idType: string;
  idNumber: string;
  idPhotoUrl: string;
  order: number;
}

export interface GuestCheckIn {
  id: string;
  propertyId: string;
  token: string;
  status: CheckInStatus;
  expectedCheckIn: string;
  expectedCheckOut: string;
  guestNameHint?: string | null;
  guestCount: number;
  language: CheckInLanguage;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  nationality?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  idPhotoUrl?: string | null;
  guests?: CheckInGuestEntry[];
  /** The guest asked to arrive before the property's standard check-in time (or the host flagged it for them). */
  earlyCheckInRequested?: boolean;
  /** The guest asked to leave after the standard checkout time. */
  lateCheckOutRequested?: boolean;
  /** Free text attached to either timing request — "flight lands 11am", etc. */
  timingRequestNote?: string | null;
  submittedAt?: string | null;
  expiresAt?: string | null;
  nightlyRate?: string | null;
  createdAt: string;
  /** Set when this check-in link was auto-created from a synced Airbnb/Booking.com reservation (Hospitable Connect or iCal) rather than by the host — see HospitableReservationSyncService#createCheckInLink on the backend. */
  externalReservationId?: string | null;
  welcomeNotifiedAt?: string | null;
  welcomeWaLink?: string | null;
  welcomeWhatsappSent?: boolean;
  welcomeMessageText?: string | null;
  /** Present only when the guest signed the rental contract as part of this check-in (host turned contract signing on — see api.properties.getContract). Use contractPdfUrl(id) to download it once this is set. */
  contract?: { signedAt: string } | null;
}

export interface CreateCheckInLinkPayload {
  expectedCheckIn: string;
  expectedCheckOut: string;
  guestNameHint?: string;
  guestCount?: number;
  language?: CheckInLanguage;
  nightlyRate?: number;
}

/** A submitted online check-in awaiting (or ready for) its WhatsApp welcome/access-info message. */
export interface PendingWelcomeItem {
  id: string;
  expectedCheckIn: string;
  expectedCheckOut: string;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  guestNameHint?: string | null;
  guestPhone?: string | null;
  welcomeWaLink?: string | null;
  welcomeMessageText?: string | null;
  property: Property;
}

export interface PendingWelcomeMessages {
  needsConfirmation: PendingWelcomeItem[];
  readyToSend: PendingWelcomeItem[];
}

/**
 * A single check-in, as returned by `checkins.listAll` — every guest
 * check-in across all of the host's properties (60 days back to any time
 * ahead), with just enough of the parent property attached to group and
 * show a cover photo without a second round-trip. Mirrors the web app's
 * `AllCheckIn` type (`apps/web/src/lib/api.ts`) that powers the Check-ins
 * page this screen is modeled on.
 */
export type AllCheckIn = GuestCheckIn & {
  property: { id: string; name: string; photoUrl: string | null };
};

/**
 * A still-actionable check-in link, as returned by `checkins.listPendingForHost`
 * (`GET /checkins/pending`). Deliberately narrower than `AllCheckIn`: the
 * backend only returns rows that are still `PENDING` **and** not past their
 * `expiresAt`, soonest expected check-in first, capped at 100.
 *
 * That server-side expiry filter is the whole point of using this endpoint
 * over `listAll` for the Home screen. Nothing ever flips a row's status from
 * PENDING to EXPIRED (expiry is only enforced at submission time), so every
 * link ever auto-created for a synced reservation — including the years of
 * past stays a pre-fix Hospitable backfill imported — sits at PENDING
 * forever. `listAll` would hand all of that to the Home screen to filter
 * client-side; this endpoint never sends it in the first place.
 */
export interface PendingCheckIn {
  id: string;
  propertyId: string;
  token: string;
  status: CheckInStatus;
  expectedCheckIn: string;
  expectedCheckOut: string;
  guestNameHint?: string | null;
  guestCount: number;
  expiresAt?: string | null;
  externalReservationId?: string | null;
  earlyCheckInRequested?: boolean;
  lateCheckOutRequested?: boolean;
  timingRequestNote?: string | null;
  property: { id: string; name: string };
}

export interface WhatsappSendResult {
  /** True only if actually delivered via the WhatsApp Cloud API — otherwise the client must open `waLink`. */
  sent: boolean;
  waLink: string;
}

/**
 * A pending cleaning-crew turnover alert — either a guest check-in (has
 * `expectedCheckOut`/`guestFirstName`) or an iCal-synced Airbnb/Booking.com
 * reservation (has `checkOut`/`source` instead). Both shapes are flattened
 * into this one type since the UI treats them the same way.
 */
export interface PendingTurnoverItem {
  id: string;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  expectedCheckOut?: string | null;
  checkOut?: string | null;
  source?: 'AIRBNB' | 'BOOKING_COM' | null;
  turnoverWaLink?: string | null;
  property: Property;
}

export interface PendingTurnovers {
  needsConfirmation: { guestCheckIns: PendingTurnoverItem[]; externalReservations: PendingTurnoverItem[] };
  readyToSend: { guestCheckIns: PendingTurnoverItem[]; externalReservations: PendingTurnoverItem[] };
}

export type ExpenseCategory =
  | 'ELECTRICITY'
  | 'WATER'
  | 'CLEANING_PRODUCTS'
  | 'CLEANING_SERVICE'
  | 'MAINTENANCE'
  | 'OTHER';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  note?: string | null;
  propertyId?: string | null;
  property?: Property | null;
  isAutoGenerated: boolean;
  bookingId?: string | null;
  createdAt: string;
}

export interface CreateExpensePayload {
  category: ExpenseCategory;
  amount: number;
  date: string;
  propertyId: string | null;
  note?: string;
}

export interface PropertyStatusItem {
  property: Property;
  status: 'OCCUPIED' | 'READY' | 'NEEDS_CLEANING' | 'IN_PROGRESS';
  activeBooking: Booking | null;
  notifiedForCleaning: boolean;
}

/**
 * One entry in the combined calendar feed — GET /properties/calendar.
 * `kind: 'CLEANING'` entries are single-day (date === endDate) and come from
 * `Booking`; `kind: 'GUEST_STAY'` entries span `date` (check-in) to
 * `endDate` (check-out) and come from either a `GuestCheckIn` (source
 * DIRECT — online check-in flow) or a synced `ExternalReservation`
 * (source AIRBNB / BOOKING_COM, via iCal).
 */
export interface CalendarEvent {
  id: string;
  kind: 'CLEANING' | 'GUEST_STAY';
  propertyId: string;
  propertyName: string;
  /** Guest name / "Guest stay" for stays, the service name for cleanings. */
  title: string;
  date: string;
  endDate: string;
  /** BookingStatus for CLEANING, CheckInStatus ('PENDING'|'SUBMITTED'|'EXPIRED') for a DIRECT stay, else 'CONFIRMED'. */
  status: string;
  bookingId?: string;
  /**
   * Where a guest stay came from. `MANUAL` covers both a host's own
   * "offline booking" (a guest taken outside Airbnb/Booking.com) and a
   * manually blocked date range — `isBlocked` is what separates those two,
   * not the source. Absent entirely on CLEANING events.
   */
  source?: 'DIRECT' | 'AIRBNB' | 'BOOKING_COM' | 'MANUAL';
  checkInId?: string;
  guestCount?: number;
  reservationId?: string;
  /** CLEANING only — the job's real scheduled start ("14:00"), when one was set. */
  scheduledTime?: string | null;
  /** CLEANING only — the service's estimated duration, for showing an honest end time rather than inventing one. */
  estMinutes?: number | null;
  /** GUEST_STAY only — per-night rate (real payout figure for a Hospitable-synced stay, otherwise the property's default). */
  nightlyRate?: string | number | null;
  /** GUEST_STAY only — free-text note the host attached to a manual reservation/block. */
  note?: string | null;
  /** True for a night the host blocked on Airbnb/Booking.com themselves — not a real guest stay. Render distinctly from an actual reservation. */
  isBlocked?: boolean;
  /** The check-in link auto-created for a synced reservation, if any — lets the calendar offer "share check-in link" without a second lookup. */
  checkInToken?: string | null;
  checkInStatus?: string | null;
  /** GUEST_STAY only — whether this stay's guest asked for an earlier-than-standard check-in or a later-than-standard checkout, plus any free-text note about timing. Used on Home's tomorrow's-checkouts card. */
  earlyCheckInRequested?: boolean;
  lateCheckOutRequested?: boolean;
  timingRequestNote?: string | null;
}

export interface CreatePropertyPayload {
  type: PropertyType;
  name: string;
  cityId: string;
  addressLine: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  latitude?: number;
  longitude?: number;
  accessInstructions?: string;
  cleaningNotes?: string;
  wifiInfo?: string;
  nightlyRate?: number;
  googleMapsUrl?: string;
  gateCode?: string;
  apartmentNumber?: string;
  doorAccessCode?: string;
  checkInTime?: string;
  checkOutTime?: string;
  houseRules?: string;
}

/** ServiceType — matches the backend's Prisma enum. */
export type ServiceType =
  | 'DEEP_CLEANING'
  | 'EXPRESS_CLEANING'
  | 'LAUNDRY'
  | 'LINEN_RENTAL'
  | 'LINEN_MANAGEMENT'
  | 'RESTOCKING'
  | 'PROPERTY_INSPECTION'
  | 'KEY_EXCHANGE'
  | 'ELECTRICIAN'
  | 'PLUMBER'
  | 'PAINTER'
  | 'AC_REPAIR'
  | 'POOL_CLEANING'
  | 'GARDEN_MAINTENANCE';

export interface Service {
  id: string;
  type: ServiceType | string;
  category: 'CLEANING' | 'MAINTENANCE';
  name: string;
  description?: string | null;
  basePrice: string;
  estMinutes: number;
}

export type BookingStatus =
  | 'PENDING_MATCH'
  | 'MATCHED'
  | 'CONFIRMED'
  | 'CLEANER_EN_ROUTE'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED';

export interface Booking {
  id: string;
  status: BookingStatus;
  urgency: 'STANDARD' | 'URGENT';
  scheduledDate: string;
  scheduledTime: string;
  specialRequests?: string | null;
  budget?: string | null;
  agreedPrice?: string | null;
  shareAccessDetails?: boolean;
  /** Only present for the assigned cleaner, and only once the host opted in
   * via shareAccessDetails at booking creation — see BookingsService#findOne. */
  hostContact?: { name: string; phone: string | null } | null;
  property: Property;
  service: Service;
  cleaner?: { id: string; averageRating: number; user: { firstName: string; lastName: string } } | null;
  checklist?: { id: string; label: string; isDone: boolean }[];
  photos?: { id: string; type: string; url: string }[];
  review?: { id: string; rating: number; comment?: string | null } | null;
  createdAt: string;
}

export interface CreateBookingPayload {
  propertyId: string;
  serviceType: ServiceType | string;
  scheduledDate: string;
  scheduledTime: string;
  urgency?: 'STANDARD' | 'URGENT';
  specialRequests?: string;
  budget?: number;
  /** If true, the property's access details and the host's phone number are
   * shared with the cleaner once matched. Off by default on the backend. */
  shareAccessDetails?: boolean;
}

export interface JobFeedItem extends Booking {
  distanceKm: number | null;
}

export interface CleanerProfile {
  id: string;
  bio?: string | null;
  yearsExperience: number;
  isVerified: boolean;
  averageRating: number;
  totalJobsCompleted: number;
  user: { firstName: string; lastName: string; email: string; phone?: string | null };
  cities: { city: City }[];
  availability: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
  location?: { latitude: number; longitude: number } | null;
}

export interface EarningsSummary {
  entries: {
    id: string;
    amount: string;
    createdAt: string;
    booking: { property: Property; service: Service };
  }[];
  totalAllTime: number;
  totalThisMonth: number;
}

/** A single cash-on-delivery job's 10% platform commission charge. */
export interface CommissionCharge {
  id: string;
  amount: string;
  isPaid: boolean;
  paidAt: string | null;
  createdAt: string;
  booking: { property: Property; service: Service };
}

/**
 * The cleaner's commission balance — see CommissionCharge on the backend.
 * `isBlocked` mirrors the same check the accept endpoint enforces, so the
 * app can show a clear message instead of letting Accept just fail.
 */
export interface CommissionStatus {
  totalOwed: number;
  overdueAmount: number;
  isBlocked: boolean;
  charges: CommissionCharge[];
}

// --- API surface -----------------------------------------------------------------

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    register: (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: 'HOST' | 'CLEANER';
      phone?: string;
      acceptedTerms: boolean;
    }) =>
      request<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: payload,
      }),
    logout: (refreshToken: string) =>
      request<{ success: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  },
  users: {
    getMe: (token: string) => request<AuthUser>('/users/me', { token }),
    updateProfile: (payload: { email?: string; phone?: string | null }, token: string) =>
      request<AuthUser>('/users/me/profile', { method: 'PATCH', body: payload, token }),
    changePassword: (payload: { currentPassword: string; newPassword: string }, token: string) =>
      request<{ success: boolean }>('/users/me/password', { method: 'PATCH', body: payload, token }),
    updateLanguage: (preferredLanguage: 'EN' | 'FR' | 'AR', token: string) =>
      request<AuthUser>('/users/me/language', { method: 'PATCH', body: { preferredLanguage }, token }),
  },
  cities: {
    list: () => request<City[]>('/cities'),
  },
  services: {
    list: () => request<Service[]>('/services'),
  },
  cleaners: {
    getProfile: (token: string) => request<CleanerProfile>('/cleaners/me', { token }),
    updateProfile: (payload: { bio?: string; yearsExperience?: number }, token: string) =>
      request<CleanerProfile>('/cleaners/me', { method: 'PATCH', body: payload, token }),
    setCities: (cityIds: string[], token: string) =>
      request<any>('/cleaners/me/cities', { method: 'PUT', body: { cityIds }, token }),
    setAvailability: (
      slots: { dayOfWeek: number; startTime: string; endTime: string }[],
      token: string,
    ) => request<any>('/cleaners/me/availability', { method: 'PUT', body: { slots }, token }),
    updateLocation: (latitude: number, longitude: number, token: string) =>
      request<any>('/cleaners/me/location', { method: 'PATCH', body: { latitude, longitude }, token }),
    uploadDocument: (file: PickedFile, type: 'id_card' | 'profile_picture', token: string) =>
      requestForm<any>(`/cleaners/me/documents?type=${type}`, {}, { file }, { token }),
    getJobFeed: (token: string) => request<JobFeedItem[]>('/cleaners/me/job-feed', { token }),
    getMyJobs: (token: string) => request<Booking[]>('/cleaners/me/jobs', { token }),
    getEarnings: (token: string) => request<EarningsSummary>('/cleaners/me/earnings', { token }),
    getCommission: (token: string) => request<CommissionStatus>('/cleaners/me/commission', { token }),
  },
  jobActions: {
    accept: (bookingId: string, token: string, proposedPrice?: number) =>
      request<Booking>(`/bookings/${bookingId}/accept`, {
        method: 'PATCH',
        body: proposedPrice != null ? { proposedPrice } : undefined,
        token,
      }),
    checkIn: (bookingId: string, latitude: number, longitude: number, token: string) =>
      request<Booking>(`/bookings/${bookingId}/check-in`, {
        method: 'PATCH',
        body: { latitude, longitude },
        token,
      }),
    start: (bookingId: string, token: string) =>
      request<Booking>(`/bookings/${bookingId}/start`, { method: 'PATCH', token }),
    toggleChecklistItem: (bookingId: string, itemId: string, isDone: boolean, token: string) =>
      request<any>(`/bookings/${bookingId}/checklist/${itemId}`, {
        method: 'PATCH',
        body: { isDone },
        token,
      }),
    complete: (bookingId: string, token: string) =>
      request<Booking>(`/bookings/${bookingId}/complete`, { method: 'PATCH', token }),
    uploadPhoto: (bookingId: string, type: 'before' | 'after', file: PickedFile, token: string) =>
      requestForm<any>(`/bookings/${bookingId}/photos?type=${type}`, {}, { photo: file }, { token }),
  },
  bookings: {
    get: (id: string, token: string) => request<Booking>(`/bookings/${id}`, { token }),
    listMine: (token: string) => request<Booking[]>('/bookings/mine', { token }),
    create: (payload: CreateBookingPayload, token: string) =>
      request<Booking>('/bookings', { method: 'POST', body: payload, token }),
    confirm: (id: string, token: string) =>
      request<Booking>(`/bookings/${id}/confirm`, { method: 'PATCH', token }),
    approve: (id: string, token: string) =>
      request<Booking>(`/bookings/${id}/approve`, { method: 'PATCH', token }),
    cancel: (id: string, reason: string, token: string) =>
      request<Booking>(`/bookings/${id}/cancel`, { method: 'PATCH', body: { reason }, token }),
    openDispute: (id: string, reason: string, token: string) =>
      request<Booking>(`/bookings/${id}/dispute`, { method: 'POST', body: { reason }, token }),
  },
  reviews: {
    create: (payload: { bookingId: string; rating: number; comment?: string }, token: string) =>
      request<any>('/reviews', { method: 'POST', body: payload, token }),
  },
  properties: {
    listMine: (token: string) => request<Property[]>('/properties/mine', { token }),
    getOne: (id: string, token: string) => request<Property>(`/properties/${id}`, { token }),
    getStatusOverview: (token: string) => request<PropertyStatusItem[]>('/properties/status-overview', { token }),
    getUpcomingBookings: (token: string) => request<Booking[]>('/properties/upcoming-bookings', { token }),
    getCalendar: (from: string, to: string, token: string) =>
      request<CalendarEvent[]>(`/properties/calendar?from=${from}&to=${to}`, { token }),
    create: (payload: CreatePropertyPayload, token: string) =>
      request<Property>('/properties', { method: 'POST', body: payload, token }),
    markReady: (propertyId: string, token: string) =>
      request<Property>(`/properties/${propertyId}/mark-ready`, { method: 'POST', token }),
    setStatus: (propertyId: string, status: string | null, token: string) =>
      request<Property>(`/properties/${propertyId}/status`, { method: 'PATCH', body: { status }, token }),
    /**
     * Permanently removes a guest check-in — the link itself plus anything
     * hanging off it (submitted guest records, ID photos, a signed
     * contract). There is no undo and no soft-delete on the backend.
     *
     * Lives under `properties` rather than `checkins` because that's where
     * the route actually is (`POST /properties/checkins/:id/cancel`,
     * PropertiesController#deleteGuestCheckIn) — the same call the web app
     * makes from its check-ins page, property page, dashboard and calendar.
     * It's a POST, not a DELETE, despite the name.
     *
     * Mobile deliberately only offers this on **PENDING** links (see the
     * Guests and property screens): a SUBMITTED check-in is the host's only
     * copy of that guest's identity documents and signed contract, which
     * they may be legally required to retain. The endpoint itself will
     * happily delete those too — the restraint is ours, not the server's.
     */
    deleteGuestCheckIn: (checkInId: string, token: string) =>
      request<{ success: boolean }>(`/properties/checkins/${checkInId}/cancel`, { method: 'POST', token }),
    /**
     * Creates a check-in link for a synced reservation that doesn't have one.
     *
     * Two cases this exists for, both of which leave a host stuck otherwise:
     *   1. A reservation Airbnb sent through with no guest name — the
     *      auto-create in HospitableReservationSyncService only fires for
     *      reservations imported *after* that feature shipped, so anything
     *      older (or synced during a backfill) has no link at all.
     *   2. A range that came through as **blocked**. Airbnb reports a
     *      Booking.com stay as merely "not available", which syncs as a
     *      block rather than a booking. The server **auto-clears
     *      `isBlocked`** here, so generating a link is also how a host says
     *      "this block is actually a real guest".
     *
     * Throws if the reservation already has a link. Returns the new
     * `GuestCheckIn`, token included, so the caller can offer it straight
     * away without a refetch.
     */
    /**
     * Flags that a guest asked to arrive early or leave late, with an
     * optional note. Partial by design — the server keeps whatever it
     * already had for any field left undefined, so a caller can toggle one
     * without knowing the other's current value.
     *
     * There's a sibling route for a synced reservation that has no check-in
     * record of its own (`/properties/reservations/:id/timing-request`);
     * only the check-in one is wired up here, since that's where mobile
     * surfaces the control.
     */
    setCheckInTiming: (
      checkInId: string,
      payload: { earlyCheckInRequested?: boolean; lateCheckOutRequested?: boolean; timingRequestNote?: string | null },
      token: string,
    ) =>
      request<GuestCheckIn>(`/properties/checkins/${checkInId}/timing-request`, {
        method: 'PATCH',
        body: payload,
        token,
      }),
    generateReservationCheckInLink: (reservationId: string, token: string, guestCount?: number) =>
      request<GuestCheckIn>(`/properties/reservations/${reservationId}/checkin-link`, {
        method: 'POST',
        // ExternalReservation stores no party size, so the host is the only
        // source here — omitted, the server falls back to 1.
        body: guestCount ? { guestCount } : {},
        token,
      }),
    /**
     * Corrects a pending check-in link's guest count (or guest name).
     *
     * `guestCount` is not cosmetic: the public submit endpoint rejects more
     * guest records than this number, so a link stuck at 1 makes it
     * impossible for a family to complete check-in and renders the contract
     * for one person.
     *
     * For a **Hospitable-synced** check-in this isn't the last word — the
     * reservation sync refreshes the count from the platform on every
     * resync, so a hand edit to a synced link is corrected the next time
     * that reservation syncs. It sticks for manually-created links.
     */
    updateCheckIn: (
      checkInId: string,
      payload: { guestCount?: number; guestNameHint?: string },
      token: string,
    ) => request<GuestCheckIn>(`/properties/checkins/${checkInId}`, { method: 'PATCH', body: payload, token }),
    /**
     * Edits a synced or manually-created reservation: reclassify a block as
     * a real booking (`isBlocked: false`) or back again, and set the
     * nightly rate the Reports revenue figures are built from.
     */
    updateReservation: (
      reservationId: string,
      // nightlyRate: null explicitly clears a saved override back to the
      // property's default rate — omitting the field leaves it untouched.
      // See UpdateReservationDto and PropertiesService#updateReservation.
      payload: { isBlocked?: boolean; nightlyRate?: number | null; note?: string },
      token: string,
    ) => request<any>(`/properties/reservations/${reservationId}`, { method: 'PATCH', body: payload, token }),
    /** One shared rental-contract setting for the whole host account (not per property) — see PropertiesController#getContract/setContract on the backend. */
    getContract: (token: string) =>
      request<{ contractSigningRequired: boolean; contractTemplate: string | null }>('/properties/contract', { token }),
    setContract: (
      payload: { contractSigningRequired: boolean; contractTemplate?: string },
      token: string,
    ) =>
      request<{ contractSigningRequired: boolean; contractTemplate: string | null }>('/properties/contract', {
        method: 'PATCH',
        body: payload,
        token,
      }),
  },
  /**
   * Hospitable Connect — lets a host link their Airbnb account so their
   * listings and reservations import into ReadyDar automatically instead of
   * being entered by hand. See HospitableConnectController on the backend
   * for the full flow; `connect()` returns a one-time browser link (opens in
   * the system browser, not in-app — Hospitable's hosted connect page isn't
   * embeddable), and `sync()` is safe to call repeatedly.
   */
  hospitable: {
    connect: (token: string) => request<{ return_url: string; expires_at: string }>('/integrations/hospitable/connect', { method: 'POST', token }),
    listListings: (token: string) => request<HospitableListing[]>('/integrations/hospitable/listings', { token }),
    /** `datesBlocked` counts nights the host manually blocked on Airbnb (not a real stay) — see ExternalReservation.isBlocked. */
    sync: (token: string) =>
      request<{ properties: number; propertiesCreated: number; reservationsCreated: number; datesBlocked: number }>(
        '/integrations/hospitable/sync',
        { method: 'POST', token },
      ),
  },
  automation: {
    /** Cleaning-crew turnover automation: mode + default cleaning contact/service for a property. */
    setForProperty: (
      propertyId: string,
      payload: { automationMode: AutomationMode; defaultCleaningContactId?: string | null; defaultServiceType?: string },
      token: string,
    ) => request<Property>(`/properties/${propertyId}/automation`, { method: 'PATCH', body: payload, token }),
    /** Guest welcome/access-info automation + the property's access details (gate code, WiFi, etc). */
    setGuestWelcome: (
      propertyId: string,
      payload: {
        guestWelcomeMode: AutomationMode;
        guestWelcomeTemplate?: string;
        googleMapsUrl?: string;
        gateCode?: string;
        apartmentNumber?: string;
        floor?: string;
        doorAccessCode?: string;
        checkInTime?: string;
        checkOutTime?: string;
        houseRules?: string;
      },
      token: string,
    ) => request<Property>(`/properties/${propertyId}/guest-welcome`, { method: 'PATCH', body: payload, token }),
  },
  cleaningContacts: {
    list: (token: string) => request<CleaningContact[]>('/cleaning-contacts', { token }),
    create: (
      payload: { name: string; whatsappNumber: string; type: CleaningContactType; cleanerAccountEmail?: string },
      token: string,
    ) => request<CleaningContact>('/cleaning-contacts', { method: 'POST', body: payload, token }),
    update: (
      id: string,
      payload: { name?: string; whatsappNumber?: string; messageTemplate?: string },
      token: string,
    ) => request<CleaningContact>(`/cleaning-contacts/${id}`, { method: 'PATCH', body: payload, token }),
    remove: (id: string, token: string) =>
      request<{ success: boolean }>(`/cleaning-contacts/${id}`, { method: 'DELETE', token }),
  },
  reports: {
    /** Set a property's default nightly rate (applied to future reservations). */
    setPropertyRate: (propertyId: string, nightlyRate: number, token: string) =>
      request<Property>(`/reports/properties/${propertyId}/rate`, { method: 'PATCH', body: { nightlyRate }, token }),
  },
  checkins: {
    createLink: (propertyId: string, payload: CreateCheckInLinkPayload, token: string) =>
      request<GuestCheckIn>(`/properties/${propertyId}/checkins`, { method: 'POST', body: payload, token }),
    listForProperty: (propertyId: string, token: string) =>
      request<GuestCheckIn[]>(`/properties/${propertyId}/checkins`, { token }),
    /** Every check-in across all of the host's properties, grouped client-side by property. */
    listAll: (token: string) => request<AllCheckIn[]>('/checkins/all', { token }),
    /**
     * Only the check-in links still worth acting on — PENDING and not yet
     * past expiry — soonest first. Server-filtered; see `PendingCheckIn`.
     * Named `listPendingForHost` rather than `listPending` to stay clearly
     * distinct from `guestWelcome.listPending`, which is a different queue
     * (already-submitted check-ins awaiting their welcome message).
     */
    listPendingForHost: (token: string) => request<PendingCheckIn[]>('/checkins/pending', { token }),
    /**
     * A short-lived signed URL for one guest's ID photo.
     *
     * Guest ID/passport photos are uploaded to Cloudinary's *authenticated*
     * delivery type, so what's stored on the guest record is an opaque
     * `public_id`, not a fetchable link — building a URL from it directly
     * (the pre-Part-32 behavior) renders a broken image. This endpoint is
     * the only way to view one, and the URL it returns expires, so fetch it
     * at view time rather than caching it.
     *
     * `guestId` is the literal string `'legacy'` for pre-per-guest-record
     * submissions, whose single photo lives on the check-in itself.
     */
    guestPhotoUrl: (checkInId: string, guestId: string, token: string) =>
      request<{ url: string }>(`/checkins/${checkInId}/guests/${guestId}/photo-url`, { token }),
  },
  cleaningReports: {
    /** Starts a new in-progress report for a property; the walkthrough then uploads photos to it one at a time. */
    create: (propertyId: string, token: string) =>
      request<CleaningReport>('/cleaning-reports', { method: 'POST', body: { propertyId }, token }),
    listForProperty: (propertyId: string, token: string) =>
      request<CleaningReport[]>(`/properties/${propertyId}/cleaning-reports`, { token }),
    getDetail: (reportId: string, token: string) => request<CleaningReport>(`/cleaning-reports/${reportId}`, { token }),
    /**
     * Uploads one photo immediately after it's captured — never batched —
     * so the server's own received-at clock stays close to the moment the
     * shutter was pressed. `capturedAt` is an ISO string from the device;
     * `latitude`/`longitude` come from a fresh location fix taken for this
     * specific photo, not a cached one from when the report started.
     */
    uploadPhoto: (
      reportId: string,
      meta: { section: string; capturedAt: string; latitude: number; longitude: number; accuracyMeters?: number },
      photo: PickedFile,
      token: string,
    ) =>
      requestForm<CleaningReportPhoto & { timestampDriftMs: number; timestampSuspicious: boolean }>(
        `/cleaning-reports/${reportId}/photos`,
        {
          section: meta.section,
          capturedAt: meta.capturedAt,
          latitude: String(meta.latitude),
          longitude: String(meta.longitude),
          ...(meta.accuracyMeters != null ? { accuracyMeters: String(meta.accuracyMeters) } : {}),
        },
        { photo },
        { token },
      ),
    removePhoto: (reportId: string, photoId: string, token: string) =>
      request<{ success: boolean }>(`/cleaning-reports/${reportId}/photos/${photoId}`, { method: 'DELETE', token }),
    /** Locks the report and makes its PDF/verification link available. Requires at least one photo. */
    complete: (reportId: string, token: string) =>
      request<CleaningReport>(`/cleaning-reports/${reportId}/complete`, { method: 'PATCH', token }),
  },
  guestWelcome: {
    listPending: (token: string) => request<PendingWelcomeMessages>('/guest-welcome/pending', { token }),
    preview: (checkInId: string, token: string) =>
      request<{ text: string }>(`/guest-welcome/checkin/${checkInId}/preview`, { token }),
    send: (checkInId: string, text: string | undefined, token: string) =>
      request<{ whatsapp: WhatsappSendResult }>(`/guest-welcome/checkin/${checkInId}/send`, {
        method: 'POST',
        body: { text },
        token,
      }),
    acknowledge: (checkInId: string, token: string) =>
      request<any>(`/guest-welcome/checkin/${checkInId}/acknowledge`, { method: 'POST', token }),
  },
  turnovers: {
    listPending: (token: string) => request<PendingTurnovers>('/turnovers/pending', { token }),
    confirmCheckIn: (checkInId: string, token: string) =>
      request<{ whatsapp: WhatsappSendResult }>(`/turnovers/checkin/${checkInId}/confirm`, { method: 'POST', token }),
    confirmReservation: (reservationId: string, token: string) =>
      request<{ whatsapp: WhatsappSendResult }>(`/turnovers/reservation/${reservationId}/confirm`, {
        method: 'POST',
        token,
      }),
    acknowledgeCheckIn: (checkInId: string, token: string) =>
      request<any>(`/turnovers/checkin/${checkInId}/acknowledge`, { method: 'POST', token }),
    acknowledgeReservation: (reservationId: string, token: string) =>
      request<any>(`/turnovers/reservation/${reservationId}/acknowledge`, { method: 'POST', token }),
  },
  expenses: {
    list: (filters: { propertyId?: string; from?: string; to?: string; category?: string }, token: string) => {
      const params = new URLSearchParams();
      if (filters.propertyId) params.set('propertyId', filters.propertyId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.category) params.set('category', filters.category);
      const qs = params.toString();
      return request<{ expenses: Expense[]; total: number }>(`/expenses${qs ? `?${qs}` : ''}`, { token });
    },
    create: (payload: CreateExpensePayload, token: string) =>
      request<Expense>('/expenses', { method: 'POST', body: payload, token }),
    remove: (id: string, token: string) =>
      request<{ success: boolean }>(`/expenses/${id}`, { method: 'DELETE', token }),
  },
};
