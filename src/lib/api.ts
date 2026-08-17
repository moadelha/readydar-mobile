import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  'http://localhost:4000/api/v1';

/** Base URL of the web app — used to build the guest-facing online check-in link. */
const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ??
  (Constants.expoConfig?.extra?.webUrl as string) ??
  'http://localhost:3000';

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

/** Called once by AuthProvider so the API layer can trigger a clean logout. */
export function registerForceLogoutHandler(handler: () => void) {
  onForceLogout = handler;
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
  const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${apiOrigin}${path}`;
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
  guestWelcomeMode?: 'OFF' | 'MANUAL_CONFIRM' | 'AUTO';
  guestWelcomeTemplate?: string | null;
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
  submittedAt?: string | null;
  expiresAt?: string | null;
  nightlyRate?: string | null;
  createdAt: string;
  welcomeNotifiedAt?: string | null;
  welcomeWaLink?: string | null;
  welcomeWhatsappSent?: boolean;
  welcomeMessageText?: string | null;
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

export interface WhatsappSendResult {
  /** True only if actually delivered via the WhatsApp Cloud API — otherwise the client must open `waLink`. */
  sent: boolean;
  waLink: string;
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
  },
  jobActions: {
    accept: (bookingId: string, token: string) =>
      request<Booking>(`/bookings/${bookingId}/accept`, { method: 'PATCH', token }),
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
    create: (payload: CreatePropertyPayload, token: string) =>
      request<Property>('/properties', { method: 'POST', body: payload, token }),
    markReady: (propertyId: string, token: string) =>
      request<Property>(`/properties/${propertyId}/mark-ready`, { method: 'POST', token }),
    setStatus: (propertyId: string, status: string | null, token: string) =>
      request<Property>(`/properties/${propertyId}/status`, { method: 'PATCH', body: { status }, token }),
  },
  checkins: {
    createLink: (propertyId: string, payload: CreateCheckInLinkPayload, token: string) =>
      request<GuestCheckIn>(`/properties/${propertyId}/checkins`, { method: 'POST', body: payload, token }),
    listForProperty: (propertyId: string, token: string) =>
      request<GuestCheckIn[]>(`/properties/${propertyId}/checkins`, { token }),
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
