import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/i18n/language-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(host-tabs)" />
          <Stack.Screen name="job/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/property/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/property/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="host/property-settings/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/booking/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/booking/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="host/checkin/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="host/expense/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="host/guests" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/expenses" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/profile" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/turnovers" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/cleaning-contacts" options={{ presentation: 'card' }} />
          <Stack.Screen name="host/cleaning-contact/new" options={{ presentation: 'modal' }} />
        </Stack>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
