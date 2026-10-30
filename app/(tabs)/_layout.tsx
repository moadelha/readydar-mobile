import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { colors, fonts } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { useAuth } from '@/lib/auth-context';
import { api, isCleanerLocationEnabled } from '@/lib/api';
import { TabIcon, LoadingScreen } from '@/components/ui';
import { CleanerComingSoon } from '@/components/cleaner-coming-soon';

/**
 * Also where the "coming soon, not available in your location yet" gate
 * lives for the cleaner side of the app: once we know this cleaner has
 * picked at least one city and none of them have cleanersEnabled, the
 * whole tab group (feed/jobs/earnings/profile) is replaced with
 * CleanerComingSoon. /onboarding is a sibling route outside this layout,
 * so it's unaffected — a cleaner can still get there (via the coming-soon
 * screen's "Edit profile" button) to pick a different city. The same rule
 * is enforced server-side by CleanerLocationGuard on the job feed/accept/
 * earnings/commission endpoints, so this is a UX nicety, not the only gate.
 */
export default function TabsLayout() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const [locationEnabled, setLocationEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    api.cleaners
      .getProfile(session.accessToken)
      .then((profile) => {
        if (!cancelled) setLocationEnabled(isCleanerLocationEnabled(profile));
      })
      .catch(() => {
        // A load failure here shouldn't itself block the tabs — each
        // screen's own data fetch will surface the real error.
        if (!cancelled) setLocationEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (locationEnabled === null) return <LoadingScreen />;
  if (locationEnabled === false) return <CleanerComingSoon />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, elevation: 0, shadowOpacity: 0 },
        tabBarLabelStyle: { fontFamily: fonts[lang === 'AR' ? 'arabic' : 'latin'][500], fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: t.tabsCleaner.jobFeed,
          tabBarIcon: ({ focused, size }) => <TabIcon name="list-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t.tabsCleaner.myJobs,
          tabBarIcon: ({ focused, size }) => <TabIcon name="briefcase-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t.tabsCleaner.earnings,
          tabBarIcon: ({ focused, size }) => <TabIcon name="wallet-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabsCleaner.profile,
          tabBarIcon: ({ focused, size }) => <TabIcon name="person-outline" focused={focused} size={size} />,
        }}
      />
    </Tabs>
  );
}
