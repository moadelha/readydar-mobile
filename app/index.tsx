import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { AppMetrics } from 'expo-observe';
import { useAuth } from '@/lib/auth-context';
import { LoadingScreen } from '@/components/ui';

export default function Index() {
  const { session, isLoading, logout } = useAuth();

  // This is the app's single entry route (every launch passes through here
  // before redirecting into login or a tab), so it's where Expo Observe's
  // Time to Interactive measurement should stop — once we know whether the
  // session check succeeded and where the user is headed.
  useEffect(() => {
    if (!isLoading) AppMetrics.markInteractive();
  }, [isLoading]);

  if (isLoading) return <LoadingScreen />;

  if (session && session.user.role !== 'CLEANER' && session.user.role !== 'HOST') {
    logout();
    return <LoadingScreen />;
  }

  if (!session) return <Redirect href="/login" />;

  return <Redirect href={session.user.role === 'HOST' ? '/(host-tabs)/dashboard' : '/(tabs)/feed'} />;
}
