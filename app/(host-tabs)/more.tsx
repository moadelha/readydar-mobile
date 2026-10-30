import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/text';
import { useRouter } from 'expo-router';
import { Screen, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '@/lib/i18n/language-context';
import { useHostAccess } from '@/lib/access';
import { usePlanStrings } from '@/lib/i18n/plan-strings';
import { usePlanConsole } from '@/lib/plan-console';
import { useMessagesStrings } from '@/lib/i18n/messages-strings';
import { useReviewsStrings } from '@/lib/i18n/reviews-strings';
import { rtlFlip } from '@/lib/rtl';

type Entry = { icon: string; label: string; description: string; path: string; visible: boolean };

export default function MoreScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isOwner, isManager, has } = useHostAccess();
  const planStrings = usePlanStrings();
  const { canMessages } = usePlanConsole();
  const ms = useMessagesStrings();
  const rs = useReviewsStrings();

  // Every entry's visibility mirrors the backend guard on the API it opens,
  // so a co-host is never shown a screen that would just fail with a 403:
  //   Guests        → guest-welcome controller, @RequireHostPermission('CHECKINS')
  //   Cleaning contacts / Rental contract → @MinHostRole('MANAGER')
  //   Connect Airbnb → @MinHostRole('OWNER') — see HospitableConnectController
  //     for why even a MANAGER can't use it.
  const menu: Entry[] = [
    // On Pro the Messages tab takes Expenses' place on the tab bar — see (host-tabs)/_layout.tsx.
    { icon: 'receipt-outline', label: t.tabsHost.expenses, description: ms.expensesDesc, path: '/expenses', visible: canMessages && has('EXPENSES') },
    { icon: 'flash-outline', label: ms.templates.manage, description: ms.templates.manageDesc, path: '/host/messages/templates', visible: canMessages },
    // Reading reviews is open to every host (GuestReviewsController); replying is Pro, gated inside the screen.
    { icon: 'star-outline', label: rs.title, description: rs.menuDesc, path: '/host/reviews', visible: true },
    { icon: 'people-outline', label: t.more.guests, description: t.more.guestsDesc, path: '/host/guests', visible: has('CHECKINS') },
    { icon: 'clipboard-outline', label: t.more.bookings, description: t.more.bookingsDesc, path: '/host/bookings', visible: has('CALENDAR') },
    { icon: 'swap-horizontal-outline', label: t.more.turnovers, description: t.more.turnoversDesc, path: '/host/turnovers', visible: has('CALENDAR') },
    { icon: 'call-outline', label: t.more.cleaningContacts, description: t.more.cleaningContactsDesc, path: '/host/cleaning-contacts', visible: isManager },
    { icon: 'link-outline', label: t.more.connectAirbnb, description: t.more.connectAirbnbDesc, path: '/host/hospitable', visible: isOwner },
    { icon: 'document-text-outline', label: t.more.contract, description: t.more.contractDesc, path: '/host/contract', visible: isManager },
    { icon: 'card-outline', label: planStrings.title, description: planStrings.menuDesc, path: '/host/plan', visible: isManager },
    { icon: 'person-outline', label: t.more.profile, description: t.more.profileDesc, path: '/host/profile', visible: true },
  ];

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>{t.more.title}</Text>
        <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{t.more.subtitle}</Text>

        <View style={{ marginTop: spacing.lg }}>
          {menu
            .filter((item) => item.visible)
            .map((item) => (
              <Pressable key={item.path} onPress={() => router.push(item.path as any)}>
                <Card style={styles.row}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>{item.label}</Text>
                    <Text style={typography.bodyMuted}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} style={rtlFlip} />
                </Card>
              </Pressable>
            ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
