// Matches the ReadyDar web app's brand tokens (see apps/web/tailwind.config.ts)
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
  xl: 28,
  full: 999,
};

/**
 * Shadow/elevation presets, used to give cards real visual hierarchy
 * instead of every surface sitting at the same flat "bordered box" level.
 * `low` is the new default resting state for a plain Card (previously
 * cards had no shadow at all, just a border); `medium`/`high` are for
 * content that should read as literally on top of everything else —
 * a hero/summary card, a floating action button, a modal sheet, a toast.
 */
export const elevation = {
  low: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  medium: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  high: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
} as const;

/** Shared timing budget for every micro-interaction in the app — keeps every
 * transition feeling like it belongs to the same system rather than each
 * screen inventing its own speed. See `src/lib/motion.ts` for the easing
 * curves and reusable animation hooks built on top of these numbers. */
export const motion = {
  duration: {
    fast: 150,
    base: 220,
    slow: 320,
  },
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.ink },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.ink },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink },
  bodyMuted: { fontSize: 14, fontWeight: '400' as const, color: colors.inkMuted },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.inkFaint },
};
