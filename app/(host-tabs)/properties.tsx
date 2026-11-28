import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, Alert } from 'react-native';
import { Text } from '@/components/text';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CalendarEvent, Property, PropertyStatusItem, propertyCoverUrl } from '@/lib/api';
import { FirstRun } from '@/components/first-run';
import { Screen, Card, LoadingScreen, ErrorBanner, StatusBadge } from '@/components/ui';
import { PropertyThumb } from '@/components/host-ui';
import { colors, spacing, typography, radius } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '@/lib/i18n/language-context';
import { useRedesignStrings } from '@/lib/i18n/redesign-strings';
import { useHostAccess } from '@/lib/access';
import { usePlanConsole } from '@/lib/plan-console';
import { addDaysIso, dateLocale, eventGuestName, todayIso } from '@/lib/calendar-visuals';
import { PROPERTY_STATUS_TONE } from '@/lib/status';
import { rtlFlip } from '@/lib/rtl';

/**
 * Properties: what's happening in each place — its status today and the
 * next stay — rather than the address and nightly price a host already
 * knows (those are on the property's own page).
 */
export default function PropertiesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const s = useRedesignStrings().props;
  const { isOwner, isManager } = useHostAccess();
  const { isPro } = usePlanConsole();
  const [properties, setProperties] = useState<Property[]>([]);
  const [statuses, setStatuses] = useState<PropertyStatusItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const today = todayIso();
      const [list, overview, calendar] = await Promise.all([
        api.properties.listMine(session.accessToken),
        // Both only add detail to the rows: the list works without them.
        api.properties.getStatusOverview(session.accessToken).catch(() => [] as PropertyStatusItem[]),
        api.properties.getCalendar(addDaysIso(today, -1), addDaysIso(today, 30), session.accessToken).catch(() => [] as CalendarEvent[]),
      ]);
      setProperties(list);
      setStatuses(overview);
      setEvents(calendar.filter((e) => e.kind === 'GUEST_STAY' && !e.isBlocked));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.propertiesList.errorLoad);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const locale = dateLocale(lang);
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

  /** "Essaouira · Next: Emma, Thu 3" — or who's leaving, or nothing booked. */
  const lineOf = useMemo(() => {
    const today = todayIso();
    return (p: Property) => {
      const mine = events.filter((e) => e.propertyId === p.id).sort((a, b) => a.date.localeCompare(b.date));
      const current = mine.find((e) => e.date.slice(0, 10) <= today && e.endDate.slice(0, 10) > today);
      const next = mine.find((e) => e.date.slice(0, 10) > today || (e.date.slice(0, 10) === today && e !== current));
      const what = current
        ? s.leaves(eventGuestName(current) ?? s.aGuest, day(current.endDate))
        : next
          ? s.next(eventGuestName(next) ?? s.aGuest, day(next.date))
          : s.nothingBooked;
      return [p.city?.name, what].filter(Boolean).join(' · ');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, s, locale]);

  function add() {
    // Connecting Airbnb is owner-only; creating a property is @MinHostRole('MANAGER').
    // Importing from Airbnb is for owners on Light (Pro connects channels on the website).
    if (!isOwner || isPro) return router.push('/host/property/new');
    Alert.alert(s.addWhat, undefined, [
      { text: s.newProperty, onPress: () => router.push('/host/property/new') },
      { text: s.importAirbnb, onPress: () => router.push('/host/hospitable') },
      { text: s.cancel, style: 'cancel' },
    ]);
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h1}>{t.propertiesList.title}</Text>
          <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{s.count(properties.length)}</Text>
        </View>
        {isManager && (
          <Pressable
            onPress={add}
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={s.addWhat}
          >
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <Text style={styles.addText}>{s.add}</Text>
          </Pressable>
        )}
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
          <Card elevated>
            <FirstRun />
          </Card>
        }
        renderItem={({ item, index }) => {
          const status = statuses.find((x) => x.property.id === item.id)?.status;
          return (
            <Pressable
              onPress={() => router.push(`/host/property/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                index === 0 && styles.rowFirst,
                index === properties.length - 1 && styles.rowLast,
                index > 0 && styles.rowDivider,
                pressed && { backgroundColor: colors.surface2 },
              ]}
              accessibilityRole="button"
            >
              <PropertyThumb photoUrl={propertyCoverUrl(item, 130)} size={48} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={typography.caption} numberOfLines={2}>
                  {lineOf(item)}
                </Text>
                {status && (
                  <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                    <StatusBadge label={t.propertyStatus[status]} tone={PROPERTY_STATUS_TONE[status]} />
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} style={rtlFlip} />
            </Pressable>
          );
        }}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  addText: { color: colors.onPrimary, fontWeight: '600', fontSize: 14 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    backgroundColor: colors.white,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  rowDivider: { borderTopWidth: 1 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
});
