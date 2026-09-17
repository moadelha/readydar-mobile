import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppMetricsRoot } from 'expo-observe';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/i18n/language-context';
import { ToastProvider } from '@/lib/toast';

// A shared, consistent push transition — was left at the native default
// before (fine, but each platform/screen combination could feel slightly
// different). Pinning `animation`/`animationDuration` here means every
// pushed screen (not modals — those already get a proper slide-up sheet
// motion from `presentation: 'modal'`) moves the same way, in the same
// time, everywhere in the app. This is native-stack's own transition
// (react-native-screens, already part of the app) — no new dependency.
const CARD_TRANSITION = {
  animation: 'slide_from_right' as const,
  animationDuration: 240,
};

function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, ...CARD_TRANSITION }}>
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
            </Stack>
          </ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Wraps the root layout so Expo Observe can measure app-level metrics
// (startup time, navigation, crashes) — see Index below for where
// AppMetrics.markInteractive() is called once initial auth loading resolves.
export default AppMetricsRoot.wrap(RootLayout);
