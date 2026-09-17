import { Tabs } from 'expo-router';
import { colors } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { TabIcon } from '@/components/ui';

export default function TabsLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { borderTopColor: colors.border },
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
