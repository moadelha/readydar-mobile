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
