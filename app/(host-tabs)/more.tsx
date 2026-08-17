import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

const MENU: { icon: string; label: string; description: string; path: string }[] = [
  {
    icon: 'people-outline',
    label: 'Guests',
    description: 'Send WhatsApp welcome messages to checked-in guests',
    path: '/host/guests',
  },
  {
    icon: 'receipt-outline',
    label: 'Expenses',
    description: 'Log and track costs against each property',
    path: '/host/expenses',
  },
  {
    icon: 'swap-horizontal-outline',
    label: 'Turnovers',
    description: 'Notify your cleaning contact after guest checkout',
    path: '/host/turnovers',
  },
  {
    icon: 'call-outline',
    label: 'Cleaning contacts',
    description: 'Your staff and enrolled cleaning company accounts',
    path: '/host/cleaning-contacts',
  },
  {
    icon: 'person-outline',
    label: 'Profile',
    description: 'Your account, phone, and log out',
    path: '/host/profile',
  },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>More</Text>
        <Text style={[typography.bodyMuted, { marginTop: 2 }]}>Everything else, in one place.</Text>

        <View style={{ marginTop: spacing.lg }}>
          {MENU.map((item) => (
            <Pressable key={item.path} onPress={() => router.push(item.path as any)}>
              <Card style={styles.row}>
                <View style={styles.iconCircle}>
                  <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{item.label}</Text>
                  <Text style={typography.bodyMuted}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
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
