import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SectionList, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CalendarEvent } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner, SegmentedControl, StatusBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

type Range = 'WEEK' | 'MONTH';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateKey: string) {
  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 86400000));
  if (dateKey === today) return 'Today';
  if (dateKey === tomorrow) return 'Tomorrow';
  return new Date(dateKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const KIND_ICON: Record<CalendarEvent['kind'], string> = {
  CLEANING: 'sparkles-outline',
  GUEST_STAY: 'bed-outline',
};

const SOURCE_LABEL: Record<string, string> = {
  AIRBNB: 'Airbnb',
  BOOKING_COM: 'Booking.com',
  DIRECT: 'Direct',
};

export default function CalendarScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<Range>('WEEK');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const from = isoDate(new Date());
      const to = isoDate(new Date(Date.now() + (range === 'WEEK' ? 7 : 30) * 86400000));
      const list = await api.properties.getCalendar(from, to, session.accessToken);
      setEvents(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the calendar.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, range]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load]),
  );

  if (isLoading) return <LoadingScreen />;

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = (event.date ?? '').slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(event);
  }
  const sections = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ title: dayLabel(date), data }));

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h1}>Calendar</Text>
        <Text style={[typography.bodyMuted, { marginTop: 2 }]}>Cleanings and guest stays, across all properties</Text>
        <View style={{ marginTop: spacing.md }}>
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={[
              { value: 'WEEK', label: 'Next 7 days' },
              { value: 'MONTH', label: 'Next 30 days' },
            ]}
          />
        </View>
        {error && <ErrorBanner message={error} onRetry={load} />}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState message="Nothing scheduled in this window." />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const onPress = item.bookingId
            ? () => router.push(`/host/booking/${item.bookingId}`)
            : () => router.push(`/host/property/${item.propertyId}`);
          return (
            <Pressable onPress={onPress}>
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.row}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={KIND_ICON[item.kind] as any} size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>{item.title}</Text>
                    <Text style={typography.bodyMuted}>{item.propertyName}</Text>
                    {item.source && item.source !== 'DIRECT' && (
                      <Text style={typography.caption}>{SOURCE_LABEL[item.source] ?? item.source}</Text>
                    )}
                  </View>
                  <StatusBadge label={item.status} tone={item.kind === 'CLEANING' ? 'primary' : 'accent'} />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionHeader: {
    ...typography.h3,
    backgroundColor: colors.sand,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
