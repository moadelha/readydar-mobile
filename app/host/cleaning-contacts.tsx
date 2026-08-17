import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Alert, Linking } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CleaningContact } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner, StatusBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CleaningContactsScreen() {
  const { session } = useAuth();
  const router = useRouter();
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
      setError(err instanceof ApiError ? err.message : 'Could not load your cleaning contacts.');
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
    Alert.alert('Remove this contact?', `${contact.name} will no longer receive turnover notifications.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleDelete(contact.id) },
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
      setError(err instanceof ApiError ? err.message : 'Could not remove this contact.');
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Cleaning contacts', headerBackTitle: 'Back' }} />
      <View style={styles.header}>
        <Text style={typography.bodyMuted}>
          Your own staff or an enrolled cleaning company — used for automatic turnover WhatsApp alerts.
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
            message="No cleaning contacts yet. Add one to enable automatic turnover alerts."
            actionLabel="Add a contact"
            onAction={() => router.push('/host/cleaning-contact/new')}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={typography.h3}>{item.name}</Text>
                  {item.type === 'COMPANY_ACCOUNT' && <StatusBadge label="DarClean company" tone="primary" />}
                </View>
                <Pressable onPress={() => Linking.openURL(`https://wa.me/${item.whatsappNumber.replace(/[^\d]/g, '')}`)}>
                  <View style={styles.metaRow}>
                    <Ionicons name="logo-whatsapp" size={13} color={colors.inkFaint} />
                    <Text style={typography.bodyMuted}>{item.whatsappNumber}</Text>
                  </View>
                </Pressable>
                {item.cleanerProfile?.user && (
                  <Text style={typography.caption}>
                    Enrolled account · {item.cleanerProfile.user.firstName} {item.cleanerProfile.user.lastName}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => confirmDelete(item)} disabled={deletingId === item.id} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={deletingId === item.id ? colors.inkFaint : colors.danger} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Pressable onPress={() => router.push('/host/cleaning-contact/new')} style={styles.fab}>
        <Ionicons name="add" size={24} color={colors.white} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
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
