import { readAppearancePref, resolveScheme } from '@/lib/appearance';

// The ReadyDar design system (DESIGN.md in the web repo), the same tokens
// the web console uses, so the app and the website read as one product.
// Key names are kept from the old teal palette so every screen picks up the
// new values; the new tokens below them are for new and reworked UI.
//
// `white` is the surface colour (cards, sheets, inputs) — near-black in dark
// mode. Text and icons that sit on the green or on a photo use `onPrimary`,
// which stays white in both.
const light = {
  // Atlas green, the brand colour: primary buttons, links, selection.
  primary: '#033E35',
  primaryLight: '#86C2B1',
  // Saffron: the one highlight on a screen (a star rating, a key number).
  accent: '#E49927',
  ink: '#141A18',
  inkMuted: '#5C605B',
  inkFaint: '#8A8D86',
  // Warm paper canvas, never pure grey.
  sand: '#F8F6F1',
  white: '#FFFFFF',
  onPrimary: '#FFFFFF',
  border: '#E6E1D7',
  danger: '#B42318',
  dangerStrong: '#911C13',
  dangerBg: '#FBEAE8',
  dangerLine: '#F1C9C4',
  /** Danger icon/text on the toast. */
  dangerOnDark: '#F29B91',
  successBg: '#EFF6F3',
  accentBg: '#FBEBD2',

  surface2: '#F2EFE8',
  lineStrong: '#D3CCBF',
  green950: '#02241F',
  green800: '#0A4E43',
  green700: '#135F52',
  green500: '#2F8A76',
  green100: '#DCEDE7',
  /** Saffron text on light backgrounds (contrast-safe). */
  saffronText: '#C47F17',
  success: '#1F7A4D',
  warning: '#B7791F',
  warningBg: '#FBEBD2',
  info: '#2B5C9E',
  infoBg: '#E9EFF7',
  overlay: 'rgba(20, 26, 24, 0.45)',
  toastBg: '#141A18',
  channel: { airbnb: '#E8505B', booking: '#1E4D9B', expedia: '#F2C230' },
};

// DESIGN.md dark neutrals; the green lifts to green-500 so buttons and
// links keep their contrast on the dark canvas, as on the web.
const dark: typeof light = {
  primary: '#2F8A76',
  primaryLight: '#86C2B1',
  accent: '#E49927',
  ink: '#ECEAE4',
  inkMuted: '#A3A8A2',
  inkFaint: '#6F756F',
  sand: '#0A100E',
  white: '#111917',
  onPrimary: '#FFFFFF',
  border: '#24302C',
  danger: '#E5675B',
  dangerStrong: '#C9503F',
  dangerBg: 'rgba(229, 103, 91, 0.14)',
  dangerLine: 'rgba(229, 103, 91, 0.32)',
  dangerOnDark: '#F29B91',
  successBg: 'rgba(47, 138, 118, 0.14)',
  accentBg: 'rgba(228, 153, 39, 0.16)',

  surface2: '#17211E',
  lineStrong: '#33423C',
  green950: '#02241F',
  green800: '#267563',
  green700: '#86C2B1',
  green500: '#2F8A76',
  green100: 'rgba(47, 138, 118, 0.24)',
  saffronText: '#E49927',
  success: '#5BBF8C',
  warning: '#E0A84A',
  warningBg: 'rgba(228, 153, 39, 0.16)',
  info: '#7FA6DA',
  infoBg: 'rgba(127, 166, 218, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  toastBg: '#24302C',
  channel: { airbnb: '#E8505B', booking: '#5B84D1', expedia: '#F2C230' },
};

export const appearancePref = readAppearancePref();
export const scheme = resolveScheme(appearancePref);
export const isDark = scheme === 'dark';
export const colors = isDark ? dark : light;

// 8px grid: 4 · 8 · 16 · 24 · 32 (12 and 48 are written inline where needed).
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// 6 for controls (inputs, buttons, badges), 10 for cards, 14 for large
// frames and sheets. Full pills only for status dots, toggles and avatars.
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  full: 999,
};

/**
 * Borders over shadows: surfaces are defined by a 1px `border` line and sit
 * flat on the page. Only what floats above the page (menus, dialogs, sheets,
 * toasts) carries a shadow — `high`. `low` and `medium` are kept so existing
 * call sites compile, and resolve to flat or a hairline lift.
 */
export const elevation = {
  low: {
    shadowColor: '#141A18',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  medium: {
    shadowColor: '#141A18',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  high: {
    shadowColor: '#000000',
    shadowOpacity: isDark ? 0.5 : 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
} as const;

/** 150ms for presses, 240ms (ease-out) for things entering. Nothing bounces. */
export const motion = {
  duration: {
    fast: 150,
    base: 240,
    slow: 320,
  },
};

/**
 * IBM Plex Sans / IBM Plex Sans Arabic, loaded in app/_layout.tsx. Screens
 * set `fontWeight` as usual; the shared Text (src/components/text.tsx) turns
 * it into the matching Plex file for the current language.
 */
export const fonts = {
  latin: { 400: 'IBMPlexSans_400Regular', 500: 'IBMPlexSans_500Medium', 600: 'IBMPlexSans_600SemiBold' },
  arabic: { 400: 'IBMPlexSansArabic_400Regular', 500: 'IBMPlexSansArabic_500Medium', 600: 'IBMPlexSansArabic_600SemiBold' },
  /** Codes and references only: booking codes, door codes. */
  mono: 'IBMPlexMono_500Medium',
};

export const typography = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '600' as const, letterSpacing: -0.5, color: colors.ink },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.2, color: colors.ink },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, color: colors.ink },
  bodyMuted: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, color: colors.inkMuted },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, color: colors.inkFaint },
  /** Small uppercase section label ("TODAY", "THIS MONTH"). */
  label: { fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.9, textTransform: 'uppercase' as const, color: colors.inkFaint },
  /** Amounts, dates and counts that should line up. */
  number: { fontVariant: ['tabular-nums' as const] },
};
