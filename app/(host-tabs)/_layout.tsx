import { Tabs } from 'expo-router';
import { colors } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { TabIcon } from '@/components/ui';
import { useHostAccess } from '@/lib/access';
import { usePlanConsole } from '@/lib/plan-console';
import { useMessagesStrings } from '@/lib/i18n/messages-strings';

export default function HostTabsLayout() {
  const { t } = useLanguage();
  const { has } = useHostAccess();
  // `href: null` is expo-router's way of keeping a route registered but
  // off the tab bar. A STAFF co-host only gets the tabs their permissions
  // cover — before this, every tab showed for everyone and a missing
  // permission surfaced as a red 403 banner after tapping in.
  const canCalendar = has('CALENDAR');
  const canExpenses = has('EXPENSES');
  // Pro hosts get the guest inbox as a tab. Five tabs is already the most
  // that fit, so for them Expenses moves into More (see more.tsx) and
  // Messages takes its place.
  const { canMessages, unreadThreads } = usePlanConsole();
  const ms = useMessagesStrings();

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
          href: canCalendar ? undefined : null,
          tabBarIcon: ({ focused, size }) => <TabIcon name="calendar-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: t.tabsHost.properties,
          href: canCalendar ? undefined : null,
          tabBarIcon: ({ focused, size }) => <TabIcon name="business-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t.tabsHost.expenses,
          href: canExpenses && !canMessages ? undefined : null,
          tabBarIcon: ({ focused, size }) => <TabIcon name="receipt-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: ms.tab,
          href: canMessages ? undefined : null,
          tabBarBadge: unreadThreads > 0 ? unreadThreads : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 11 },
          tabBarIcon: ({ focused, size }) => <TabIcon name="chatbubbles-outline" focused={focused} size={size} />,
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
