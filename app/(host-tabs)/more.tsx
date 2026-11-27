import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/text';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '@/lib/i18n/language-context';
import { useHostAccess } from '@/lib/access';
import { usePlanStrings } from '@/lib/i18n/plan-strings';
import { usePlanConsole } from '@/lib/plan-console';
import { useMessagesStrings } from '@/lib/i18n/messages-strings';
import { useReviewsStrings } from '@/lib/i18n/reviews-strings';
import { useSetupStrings } from '@/lib/i18n/setup-strings';
import { useDeskStrings } from '@/lib/i18n/desk-strings';
import { rtlFlip } from '@/lib/rtl';

type Entry = { icon: string; label: string; description: string; path: string; visible: boolean };

/**
 * Everything that isn't a tab, as one grouped list — the way a phone's own
 * Settings reads — rather than a dozen separate cards each with an icon in
 * a tinted circle, which is the template look DESIGN.md §9 rules out.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isOwner, isManager, has } = useHostAccess();
  const planStrings = usePlanStrings();
  const { canMessages, businessType } = usePlanConsole();
  const ms = useMessagesStrings();
  const rs = useReviewsStrings();
  const setup = useSetupStrings();
  const ds = useDeskStrings();
  const isHostel = businessType === 'HOSTEL';

  // Every entry's visibility mirrors the backend guard on the API it opens,
  // so a co-host is never shown a screen that would just fail with a 403:
  //   Guests        → guest-welcome controller, @RequireHostPermission('CHECKINS')
  //   Cleaning contacts / Rental contract → @MinHostRole('MANAGER')
  //   Connect Airbnb → @MinHostRole('OWNER') — see HospitableConnectController
  //     for why even a MANAGER can't use it.
  const groups: { title: string; items: Entry[] }[] = [
    {
      title: t.more.sectionOperations,
      items: [
        // On Pro (and for hostels) Expenses isn't a tab — see (host-tabs)/_layout.tsx.
        { icon: 'receipt-outline', label: t.tabsHost.expenses, description: ms.expensesDesc, path: '/expenses', visible: (canMessages || businessType === 'HOSTEL') && has('EXPENSES') },
        // Hostels: the same three open from the Desk's shortcuts.
        { icon: 'wallet-outline', label: ds.cash, description: ds.cashIntro, path: '/host/cash', visible: isHostel && has('CALENDAR') && has('REPORTS') },
        { icon: 'cafe-outline', label: ds.activities, description: ds.actIntro, path: '/host/activities', visible: isHostel && has('CALENDAR') },
        { icon: 'grid-outline', label: ds.bedPlan, description: ds.planIntro, path: '/host/beds', visible: isHostel && has('CALENDAR') },
        // The cleaning contacts open from inside this one.
        { icon: 'logo-whatsapp', label: setup.alerts.title, description: setup.alerts.intro, path: '/host/turnovers', visible: has('CALENDAR') },
      ],
    },
    {
      title: t.more.sectionGuests,
      items: [
        { icon: 'people-outline', label: t.more.guests, description: t.more.guestsDesc, path: '/host/guests', visible: has('CHECKINS') },
        { icon: 'flash-outline', label: ms.templates.manage, description: ms.templates.manageDesc, path: '/host/messages/templates', visible: canMessages },
        // Reading reviews is open to every host (GuestReviewsController); replying is Pro, gated inside the screen.
        { icon: 'star-outline', label: rs.title, description: rs.menuDesc, path: '/host/reviews', visible: true },
        { icon: 'document-text-outline', label: t.more.contract, description: t.more.contractDesc, path: '/host/contract', visible: isManager },
      ],
    },
    {
      title: t.more.sectionAccount,
      items: [
        { icon: 'link-outline', label: t.more.connectAirbnb, description: t.more.connectAirbnbDesc, path: '/host/hospitable', visible: isOwner },
        { icon: 'card-outline', label: planStrings.title, description: planStrings.menuDesc, path: '/host/plan', visible: isManager },
        { icon: 'person-outline', label: t.more.profile, description: t.more.profileDesc, path: '/host/profile', visible: true },
      ],
    },
  ];

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>{t.more.title}</Text>

        {groups.map((group) => {
          const items = group.items.filter((item) => item.visible);
          if (items.length === 0) return null;
          return (
            <View key={group.title}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.group}>
                {items.map((item, i) => (
                  <Pressable
                    key={item.path}
                    onPress={() => router.push(item.path as any)}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
                    accessibilityRole="button"
                  >
                    <Ionicons name={item.icon as any} size={20} color={colors.inkMuted} style={styles.icon} />
                    <View style={[styles.rowBody, i > 0 && styles.divider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>{item.label}</Text>
                        <Text style={styles.description} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} style={rtlFlip} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  groupTitle: { ...typography.label, marginTop: spacing.lg, marginBottom: spacing.sm },
  group: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingStart: spacing.md },
  icon: { marginEnd: spacing.md },
  // The divider starts after the icon, like a native grouped list.
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingVertical: 10, paddingEnd: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: colors.ink },
  description: { ...typography.caption, marginTop: 1 },
});
