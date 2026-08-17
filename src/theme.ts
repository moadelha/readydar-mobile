// Matches the DarClean web app's brand tokens (see apps/web/tailwind.config.ts)
// so the mobile app feels like the same product, not a separate one.
export const colors = {
  primary: '#006D77',
  primaryLight: '#83C5BE',
  accent: '#FFB703',
  ink: '#1B1F23',
  inkMuted: 'rgba(27, 31, 35, 0.6)',
  inkFaint: 'rgba(27, 31, 35, 0.4)',
  sand: '#FBFAF7',
  white: '#FFFFFF',
  border: 'rgba(27, 31, 35, 0.08)',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  successBg: 'rgba(0, 109, 119, 0.08)',
  accentBg: 'rgba(255, 183, 3, 0.12)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  full: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.ink },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.ink },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink },
  bodyMuted: { fontSize: 14, fontWeight: '400' as const, color: colors.inkMuted },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.inkFaint },
};
