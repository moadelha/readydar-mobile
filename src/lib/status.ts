import { BookingStatus, ExpenseCategory } from './api';

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_MATCH: 'Finding a cleaner',
  MATCHED: 'Matched — confirm cleaner',
  CONFIRMED: 'Confirmed',
  CLEANER_EN_ROUTE: 'En route',
  CHECKED_IN: 'Checked in',
  IN_PROGRESS: 'In progress',
  AWAITING_APPROVAL: 'Awaiting your approval',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<BookingStatus, 'neutral' | 'primary' | 'accent' | 'success'> = {
  PENDING_MATCH: 'neutral',
  MATCHED: 'accent',
  CONFIRMED: 'accent',
  CLEANER_EN_ROUTE: 'primary',
  CHECKED_IN: 'primary',
  IN_PROGRESS: 'primary',
  AWAITING_APPROVAL: 'accent',
  COMPLETED: 'success',
  DISPUTED: 'neutral',
  CANCELLED: 'neutral',
};

/**
 * How soon a PENDING guest check-in's expected arrival must be before it
 * counts as "urgent" — drives the red "!" badge on the Guests screen's
 * property groups. Kept as one shared constant so every screen agrees on
 * what "urgent" means.
 */
export const URGENT_CHECKIN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How far ahead the Home screen looks for pending check-ins worth showing.
 *
 * Deliberately wider than `URGENT_CHECKIN_WINDOW_MS` (which is about the
 * badge, not the list) and deliberately not unbounded: a host with a synced
 * Airbnb account has a pending link for every future reservation on the
 * books, so an unfiltered list buries today's arrivals under stays months
 * out. Three days matches the web dashboard's own cutoff
 * (`apps/web/src/app/host/dashboard/page.tsx`, `pendingCheckInsSoon`) so
 * both clients surface the same set.
 */
export const UPCOMING_CHECKIN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export type PropertyStatus = 'OCCUPIED' | 'READY' | 'NEEDS_CLEANING' | 'IN_PROGRESS';

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  READY: 'Ready for guests',
  NEEDS_CLEANING: 'Needs cleaning',
  IN_PROGRESS: 'Cleaning in progress',
  OCCUPIED: 'Guest staying',
};

export const PROPERTY_STATUS_TONE: Record<PropertyStatus, 'neutral' | 'primary' | 'accent' | 'success'> = {
  READY: 'success',
  NEEDS_CLEANING: 'accent',
  IN_PROGRESS: 'primary',
  OCCUPIED: 'neutral',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ELECTRICITY: 'Electricity',
  WATER: 'Water',
  CLEANING_PRODUCTS: 'Cleaning products',
  CLEANING_SERVICE: 'Cleaning service',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

/**
 * Ionicons name for each category — kept here so both the list and the
 * add-expense form stay in sync. Typed as `string`; cast at the JSX call
 * site (`as any`) since Ionicons' own name union isn't imported here.
 */
export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  ELECTRICITY: 'flash-outline',
  WATER: 'water-outline',
  CLEANING_PRODUCTS: 'basket-outline',
  CLEANING_SERVICE: 'sparkles-outline',
  MAINTENANCE: 'construct-outline',
  OTHER: 'ellipsis-horizontal-circle-outline',
};

/**
 * The Expenses list groups the backend's 6 real categories into 4 simple
 * filter pills (All / Cleaning / Maintenance / Utilities / Other) so the
 * filter row stays short — every expense still keeps its real, specific
 * category underneath; this grouping is display-only.
 */
export type ExpenseCategoryGroup = 'CLEANING' | 'MAINTENANCE' | 'UTILITIES' | 'OTHER';

export const EXPENSE_CATEGORY_GROUP_LABELS: Record<ExpenseCategoryGroup, string> = {
  CLEANING: 'Cleaning',
  MAINTENANCE: 'Maintenance',
  UTILITIES: 'Utilities',
  OTHER: 'Other',
};

export const EXPENSE_CATEGORY_GROUPS: Record<ExpenseCategoryGroup, ExpenseCategory[]> = {
  CLEANING: ['CLEANING_PRODUCTS', 'CLEANING_SERVICE'],
  MAINTENANCE: ['MAINTENANCE'],
  UTILITIES: ['ELECTRICITY', 'WATER'],
  OTHER: ['OTHER'],
};

export function categoryGroupOf(category: ExpenseCategory): ExpenseCategoryGroup {
  for (const group of Object.keys(EXPENSE_CATEGORY_GROUPS) as ExpenseCategoryGroup[]) {
    if (EXPENSE_CATEGORY_GROUPS[group].includes(category)) return group;
  }
  return 'OTHER';
}
