import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AppMetricsRoot } from 'expo-observe';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/i18n/language-context';
import { ToastProvider } from '@/lib/toast';
import { PlanConsoleProvider } from '@/lib/plan-console';
import { AppHeader } from '@/components/app-header';
import { useFonts } from 'expo-font';
// One file per weight, imported by path: the packages' index pulls in every
// weight and italic (several MB in each update).
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { colors, isDark } from '@/theme';
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';

// A shared, consistent push transition — was left at the native default
// before (fine, but each platform/screen combination could feel slightly
// different). Pinning `animation`/`animationDuration` here means every
// pushed screen (not modals — those already get a proper slide-up sheet
// motion from `presentation: 'modal'`) moves the same way, in the same
// time, everywhere in the app. This is native-stack's own transition
// (react-native-screens, already part of the app) — no new dependency.
// Screen, header and tab backgrounds for React Navigation, from the same
// palette as everything else, so no default white flashes in dark mode.
const base = isDark ? DarkTheme : DefaultTheme;
const NAV_THEME = {
  ...base,
  colors: {
    ...base.colors,
    primary: colors.primary,
    background: colors.sand,
    card: colors.white,
    text: colors.ink,
    border: colors.border,
    notification: colors.accent,
  },
};

const CARD_TRANSITION = {
  animation: 'slide_from_right' as const,
  animationDuration: 240,
};

function RootLayout() {
  // IBM Plex, the brand typeface (see src/components/text.tsx). The fonts
  // ship inside the JS bundle, so they arrive with an over-the-air update.
  // If loading fails the app still starts, in the system font.
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexMono_500Medium,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    // initialMetrics seeds the provider with insets measured natively at
    // startup. Without it the first render reports every inset as 0 and the
    // native-stack header lays itself out against that — on Android with
    // edgeToEdgeEnabled that puts the title behind the status bar, level
    // with the clock and battery, and it never re-lays-out afterwards.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider value={NAV_THEME}>
      <AuthProvider>
        <LanguageProvider>
          <PlanConsoleProvider>
          <ToastProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                // Only renders on screens that opt in with headerShown: true.
                // See AppHeader for why the native header is replaced.
                header: (props) => <AppHeader {...props} />,
                contentStyle: { backgroundColor: colors.sand },
                ...CARD_TRANSITION,
              }}
            >
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="login" options={{ animation: 'fade' }} />
              <Stack.Screen name="register" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(host-tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="job/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/property/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/property/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="host/property-settings/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/booking/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/booking/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="host/checkin/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="host/expense/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="host/guests" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/bookings" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/profile" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/turnovers" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/cleaning-contacts" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/cleaning-contact/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="host/messages/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="host/messages/templates" options={{ presentation: 'card' }} />
            </Stack>
          </ToastProvider>
          </PlanConsoleProvider>
        </LanguageProvider>
      </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Wraps the root layout so Expo Observe can measure app-level metrics
// (startup time, navigation, crashes) — see Index below for where
// AppMetrics.markInteractive() is called once initial auth loading resolves.
export default AppMetricsRoot.wrap(RootLayout);
