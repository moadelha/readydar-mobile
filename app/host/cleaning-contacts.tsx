import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, Alert, Linking } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CleaningContact } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useHostAccess } from '@/lib/access';
import { NoAccess } from '@/components/no-access';
import { useLanguage } from '@/lib/i18n/language-context';
import { useSetupStrings } from '@/lib/i18n/setup-strings';

function CleaningContactsInner() {
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const s = useSetupStrings().contacts;
  const [contacts, setContacts] = useState<CleaningContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const list = await api.cleaningContacts.list(session.accessToken);
      setContacts(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.loadError);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(contact: CleaningContact) {
    Alert.alert(s.removeTitle, s.removeBody(contact.name), [
      { text: t.common.cancel, style: 'cancel' },
      { text: s.remove, style: 'destructive', onPress: () => handleDelete(contact.id) },
    ]);
  }

  async function handleDelete(id: string) {
    if (!session) return;
    setError(null);
    setDeletingId(id);
    try {
      await api.cleaningContacts.remove(id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.removeError);
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: s.title, headerBackTitle: t.common.back }} />
      <View style={styles.header}>
        <Text style={typography.bodyMuted}>
          {s.intro}
        </Text>
        {error && <ErrorBanner message={error} onRetry={load} />}
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            message={s.empty}
            actionLabel={s.add}
            onAction={() => router.push('/host/cleaning-contact/new')}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>{item.name}</Text>
                <Pressable onPress={() => Linking.openURL(`https://wa.me/${item.whatsappNumber.replace(/[^\d]/g, '')}`)}>
                  <View style={styles.metaRow}>
                    <Ionicons name="logo-whatsapp" size={13} color={colors.inkFaint} />
                    <Text style={typography.bodyMuted}>{item.whatsappNumber}</Text>
                  </View>
                </Pressable>
              </View>
              <Pressable onPress={() => confirmDelete(item)} disabled={deletingId === item.id} hitSlop={13} accessibilityRole="button" accessibilityLabel={s.removeA11y(item.name)}>
                <Ionicons name="trash-outline" size={18} color={deletingId === item.id ? colors.inkFaint : colors.danger} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Pressable onPress={() => router.push('/host/cleaning-contact/new')} style={styles.fab} accessibilityRole="button" accessibilityLabel={s.add}>
        <Ionicons name="add" size={24} color={colors.onPrimary} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  fab: {
    position: 'absolute',
    end: spacing.lg,
    bottom: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});

// Cleaning contacts are @MinHostRole('MANAGER') on the API.
// Wrapped rather than early-returned so the real screen's hooks and
// API calls never run for someone without access.
export default function CleaningContactsScreen() {
  const { isManager } = useHostAccess();
  return isManager ? <CleaningContactsInner /> : <NoAccess />;
}
