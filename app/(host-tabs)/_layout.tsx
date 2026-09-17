import { Tabs } from 'expo-router';
import { colors } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { TabIcon } from '@/components/ui';

export default function HostTabsLayout() {
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
        name="dashboard"
        options={{
          title: t.tabsHost.home,
          tabBarIcon: ({ focused, size }) => <TabIcon name="home-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t.tabsHost.calendar,
          tabBarIcon: ({ focused, size }) => <TabIcon name="calendar-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: t.tabsHost.properties,
          tabBarIcon: ({ focused, size }) => <TabIcon name="business-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t.tabsHost.expenses,
          tabBarIcon: ({ focused, size }) => <TabIcon name="receipt-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t.tabsHost.more,
          tabBarIcon: ({ focused, size }) => <TabIcon name="menu-outline" focused={focused} size={size} />,
        }}
      />
    </Tabs>
  );
}
