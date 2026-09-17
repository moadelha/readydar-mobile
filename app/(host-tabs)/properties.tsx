import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, propertyCoverUrl } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner } from '@/components/ui';
import { PropertyThumb } from '@/components/host-ui';
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
        <Pressable onPress={() => router.push('/host/hospitable')} style={styles.airbnbButton} hitSlop={8}>
          <Ionicons name="link-outline" size={16} color={colors.primary} />
          <Text style={styles.airbnbButtonText}>Airbnb</Text>
        </Pressable>
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
            <Card style={{ marginBottom: spacing.md }}>
              <View style={styles.cardRow}>
                <PropertyThumb photoUrl={propertyCoverUrl(item, 180)} size={64} />
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[typography.h3, { flex: 1 }]} numberOfLines={2}>{item.name}</Text>
                    {item.hospitableListingId && (
                      <View style={styles.syncBadge}>
                        <Ionicons name="link-outline" size={11} color={colors.primary} />
                        <Text style={styles.syncBadgeText}>Airbnb</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
                    <Text style={typography.bodyMuted} numberOfLines={2}>
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
                </View>
              </View>
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
  airbnbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  airbnbButtonText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  syncBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rate: { marginTop: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: 13 },
});
