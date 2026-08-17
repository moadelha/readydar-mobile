import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PropertiesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const list = await api.properties.listMine(session.accessToken);
      setProperties(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your properties.');
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

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h1}>Properties</Text>
          <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{properties.length} listed</Text>
        </View>
        <Pressable onPress={() => router.push('/host/property/new')} style={styles.addButton}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {error && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      )}

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            message="No properties yet."
            actionLabel="Add your first property"
            onAction={() => router.push('/host/property/new')}
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/host/property/${item.id}`)}>
            <Card style={{ marginBottom: spacing.sm }}>
              <Text style={typography.h3}>{item.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
                <Text style={typography.bodyMuted}>
                  {item.addressLine}, {item.city.name}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="bed-outline" size={13} color={colors.inkFaint} />
                <Text style={typography.caption}>
                  {item.bedrooms} bed · {item.bathrooms} bath · up to {item.maxGuests} guests
                </Text>
              </View>
              {item.nightlyRate && (
                <Text style={styles.rate}>{Number(item.nightlyRate).toFixed(0)} MAD / night</Text>
              )}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rate: { marginTop: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: 13 },
});
