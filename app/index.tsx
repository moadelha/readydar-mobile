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

  // The app is for hosts. A cleaner or staff session left over from an older
  // version is signed out rather than sent to a screen that no longer exists.
  const notHost = !!session && session.user.role !== 'HOST';
  useEffect(() => {
    if (!isLoading && notHost) logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, notHost]);

  if (isLoading || notHost) return <LoadingScreen />;

  if (!session) return <Redirect href="/login" />;

  return <Redirect href="/(host-tabs)/dashboard" />;
}
