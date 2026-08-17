import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { LoadingScreen } from '@/components/ui';

export default function Index() {
  const { session, isLoading, logout } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (session && session.user.role !== 'CLEANER' && session.user.role !== 'HOST') {
    logout();
    return <LoadingScreen />;
  }

  if (!session) return <Redirect href="/login" />;

  return <Redirect href={session.user.role === 'HOST' ? '/(host-tabs)/dashboard' : '/(tabs)/feed'} />;
}
