import { PropertyType } from './api';

/**
 * Client-side price estimator for cleaning jobs. There's no per-room pricing
 * on the backend (PricingRule is a per-city override on Service, not a
 * property-size adjustment), so this suggests a starting number from the
 * service's basePrice, scaled by property type and room count. The host can
 * always override the suggestion before requesting a cleaner, and the
 * cleaner can propose a different number when accepting the job.
 */

const TYPE_MULTIPLIER: Record<string, number> = {
  VILLA: 1.25,
  RIAD: 1.2,
  HOUSE: 1.15,
  APARTMENT: 1,
  STUDIO: 0.9,
  OTHER: 1,
};

/** Only meaningful for the two cleaning service types — everything else
 * (maintenance, laundry, key exchange…) isn't sized by room count. */
const ROOM_SCALED_SERVICE_TYPES = new Set(['DEEP_CLEANING', 'EXPRESS_CLEANING']);

export function isRoomScaledService(serviceType?: string | null): boolean {
  return !!serviceType && ROOM_SCALED_SERVICE_TYPES.has(serviceType);
}

export interface PriceEstimateInput {
  basePrice: number;
  serviceType?: string | null;
  propertyType?: string | PropertyType | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
}

export interface PriceEstimate {
  amount: number;
  /** Short human-readable reasoning, e.g. "Villa · 3 bedrooms". */
  reason: string;
}

/** Rounds to the nearest 10 MAD — keeps suggested numbers clean. */
function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

export function estimatePrice({
  basePrice,
  serviceType,
  propertyType,
  bedrooms,
  bathrooms,
}: PriceEstimateInput): PriceEstimate {
  if (!isRoomScaledService(serviceType)) {
    return { amount: roundToTen(basePrice), reason: 'Standard rate for this service' };
  }

  const beds = bedrooms ?? 1;
  const baths = bathrooms ?? 1;
  const typeKey = (propertyType ?? 'APARTMENT').toUpperCase();
  const typeMultiplier = TYPE_MULTIPLIER[typeKey] ?? 1;

  // Extra rooms beyond a 1-bed/1-bath baseline add a bit each — a bigger
  // place takes longer to clean regardless of the flat service basePrice.
  const roomFactor = Math.max(0, beds - 1) * 0.15 + Math.max(0, baths - 1) * 0.1;

  const amount = roundToTen(basePrice * typeMultiplier * (1 + roomFactor));

  const typeLabel = typeKey.charAt(0) + typeKey.slice(1).toLowerCase();
  const bedLabel = `${beds} bedroom${beds === 1 ? '' : 's'}`;
  const reason = `${typeLabel} · ${bedLabel}`;

  return { amount, reason };
}
