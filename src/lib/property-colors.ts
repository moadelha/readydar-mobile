/**
 * Deterministic per-property color, used to color-code reservation bars on
 * the Calendar and the small property dots on the Expenses list. Hashes the
 * property id into a fixed palette so a given property always gets the same
 * color across screens and sessions, without needing to store anything new
 * on the backend. Palette chosen to sit well as small dots/bars on the
 * app's light (white card / sand background) theme, starting with the
 * brand teal and amber before falling back to a few extra hues.
 */
const PALETTE = [
  '#006D77', // brand primary teal
  '#FFB703', // brand accent amber
  '#7C6FEE', // purple
  '#3B82F6', // blue
  '#F97066', // coral
  '#10B981', // green
  '#EC4899', // pink
  '#F59E0B', // orange
];

export function propertyColor(propertyId: string | null | undefined): string {
  if (!propertyId) return 'rgba(27, 31, 35, 0.35)'; // shared/business — neutral, no property color
  let hash = 0;
  for (let i = 0; i < propertyId.length; i++) {
    hash = (hash * 31 + propertyId.charCodeAt(i)) % 997;
  }
  return PALETTE[hash % PALETTE.length];
}
