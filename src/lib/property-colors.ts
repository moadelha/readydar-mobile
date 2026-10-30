import { colors } from '@/theme';

/**
 * Deterministic per-property color, used to color-code reservation bars on
 * the Calendar and the small property dots on the Expenses list. Hashes the
 * property id into a fixed palette so a given property always gets the same
 * color across screens and sessions, without needing to store anything new
 * on the backend. Muted, mid-tone hues so they read as small dots/bars on
 * both the light and the dark theme, starting from the brand green and
 * saffron.
 */
const PALETTE = [
  colors.green500,
  colors.accent,
  '#6F64C8', // violet
  '#3F74B8', // blue
  '#D0654F', // terracotta
  '#4E9A5E', // leaf
  '#B65A8A', // plum
  '#A8823A', // ochre
];

export function propertyColor(propertyId: string | null | undefined): string {
  if (!propertyId) return colors.inkFaint; // shared/business — neutral, no property color
  let hash = 0;
  for (let i = 0; i < propertyId.length; i++) {
    hash = (hash * 31 + propertyId.charCodeAt(i)) % 997;
  }
  return PALETTE[hash % PALETTE.length];
}
