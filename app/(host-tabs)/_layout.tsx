import { Tabs } from 'expo-router';
import { colors, fonts } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { TabIcon } from '@/components/ui';
import { useHostAccess } from '@/lib/access';
import { usePlanConsole } from '@/lib/plan-console';
import { useMessagesStrings } from '@/lib/i18n/messages-strings';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';

export default function HostTabsLayout() {
  const { t, lang } = useLanguage();
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
  const { canMessages, unreadThreads, businessType } = usePlanConsole();
  const ms = useMessagesStrings();
  const hs = useHostelStrings();
  // Hostels and guesthouses run on the desk: Desk and Rooms replace Home and
  // Properties (one property, rooms inside it). Expenses sits in More, as on Pro.
  const isHostel = businessType === 'HOSTEL';

  const deskFirst = isHostel && canCalendar;
  const HOME = (
    <Tabs.Screen
      key="dashboard"
      name="dashboard"
      options={{
        title: t.tabsHost.home,
        // Hostels start on Desk; a co-host without Calendar access has no Desk and keeps Home.
        href: isHostel && canCalendar ? null : undefined,
        tabBarIcon: ({ focused, size }) => <TabIcon name="home-outline" focused={focused} size={size} />,
      }}
    />
  );
  const DESK = (
    <Tabs.Screen
      key="desk"
      name="desk"
      options={{
        title: hs.tabDesk,
        href: isHostel && canCalendar ? undefined : null,
        tabBarIcon: ({ focused, size }) => <TabIcon name="today-outline" focused={focused} size={size} />,
      }}
    />
  );
  const ROOMS = (
    <Tabs.Screen
      key="housekeeping"
      name="housekeeping"
      options={{
        title: hs.tabHousekeeping,
        // Housekeepers often have only the cleaning permission: the API lets them in (CALENDAR or CLEANING_REPORTS).
        href: isHostel && (canCalendar || has('CLEANING_REPORTS')) ? undefined : null,
        tabBarIcon: ({ focused, size }) => <TabIcon name="sparkles-outline" focused={focused} size={size} />,
      }}
    />
  );

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
      {/*
        Back from a tab goes to the first tab in this list (Android's back
        button, then out of the app). So the first one must be the start tab
        this account can see: Desk for a hostel's front desk, Home for
        everyone else. With Desk first for an apartment host, back opened
        the hostel Desk; with Home first for a hostel, back bounced
        between Home and Desk and never left the app.
      */}
      {deskFirst ? [DESK, ROOMS, HOME] : [HOME, DESK, ROOMS]}
      <Tabs.Screen
        name="calendar"
        options={{
          // Hostels see the bed plan here (calendar.tsx).
          title: isHostel ? hs.tabBeds : t.tabsHost.calendar,
          href: canCalendar ? undefined : null,
          tabBarIcon: ({ focused, size }) => <TabIcon name={isHostel ? 'bed-outline' : 'calendar-outline'} focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: t.tabsHost.properties,
          href: canCalendar && !isHostel ? undefined : null,
          tabBarIcon: ({ focused, size }) => <TabIcon name="business-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t.tabsHost.expenses,
          href: canExpenses && !canMessages && !isHostel ? undefined : null,
          tabBarIcon: ({ focused, size }) => <TabIcon name="receipt-outline" focused={focused} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: ms.tab,
          href: canMessages ? undefined : null,
          tabBarBadge: unreadThreads > 0 ? unreadThreads : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.green950, fontSize: 10, fontFamily: fonts.latin[600] },
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
