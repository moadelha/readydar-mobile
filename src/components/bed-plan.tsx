import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { StaySheet } from '@/components/stay-sheet';
import { Stack, useFocusEffect } from 'expo-router';
import { Text } from '@/components/text';
import { Screen, ErrorBanner, SkeletonListItem } from '@/components/ui';
import { PropertySelect } from '@/components/PropertySelect';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CalendarEvent, HousekeepingBoard } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useDeskStrings } from '@/lib/i18n/desk-strings';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';
import { useLargeTitle } from '@/lib/large-title';
import { addDaysIso, dateLocale } from '@/lib/calendar-visuals';
import { guestNameOf, unitLabel } from '@/lib/hostel';
import { formatDay } from '@/lib/dates';
import { colors, radius, spacing, typography } from '@/theme';

const DAYS = 14;
const COL = 52;
const ROW = 40;
const HEAD = 54;
const GROUP = 40;
const LABEL = 116;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Hostels: the bed plan — every room and bed down the side, the next two
 * weeks across, and who sleeps in each one night by night. Read-only on the
 * phone: moving a guest to another bed stays on the website's planning.
 * Hostels get it as their Calendar tab (`asTab`) and from the Desk.
 */
export function BedPlan({ asTab = false }: { asTab?: boolean }) {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const s = useDeskStrings();
  const hs = useHostelStrings();
  const locale = dateLocale(lang);

  const [board, setBoard] = useState<HousekeepingBoard | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const b = await api.housekeeping.board(session.accessToken);
      const cal = await api.properties.getCalendar(addDaysIso(b.today, -30), addDaysIso(b.today, DAYS), session.accessToken);
      setBoard(b);
      setEvents(cal.filter((e) => e.kind === 'GUEST_STAY' && !e.isBlocked && (e.roomUnits?.length ?? 0) > 0));
      setPropertyId((id) => id ?? b.properties[0]?.propertyId ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.planError);
    } finally {
      setRefreshing(false);
    }
  }, [session, s.planError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const property = board?.properties.find((p) => p.propertyId === propertyId) ?? null;
  const start = board?.today ?? null;
  const days = useMemo(() => (start ? Array.from({ length: DAYS }, (_, i) => addDaysIso(start, i)) : []), [start]);

  /** Room types in order, each with its units and the stays in each unit. */
  const groups = useMemo(() => {
    if (!property || !start) return [];
    return property.roomTypes
      .map((rt) => ({
        roomType: rt,
        units: property.units
          .filter((u) => u.roomTypeId === rt.id)
          .map((u) => ({
            unit: u,
            stays: events.filter(
              (e) =>
                e.propertyId === property.propertyId &&
                e.roomTypeId === rt.id &&
                (e.roomUnits ?? []).includes(u.name) &&
                e.endDate.slice(0, 10) > start &&
                e.date.slice(0, 10) < addDaysIso(start, DAYS),
            ),
          })),
      }))
      .filter((g) => g.units.length > 0);
  }, [property, events, start]);

  /** How many of the property's rooms and beds someone sleeps in on night d. */
  const unitCount = groups.reduce((n, g) => n + g.units.length, 0);
  const takenOn = (d: string) => groups.reduce((n, g) => n + g.units.filter((u) => u.stays.some((e) => e.date.slice(0, 10) <= d && e.endDate.slice(0, 10) > d)).length, 0);

  // A tapped stay opens in a sheet with the desk's actions (StaySheet).
  const [opened, setOpened] = useState<CalendarEvent | null>(null);
  const showStay = (e: CalendarEvent) => setOpened(e);

  return (
    <Screen edges={asTab ? ['top'] : undefined}>
      {!asTab && <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.planTitle), headerBackTitle: t.common.back }} />}
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        {...(asTab ? {} : largeTitle.scrollProps)}
      >
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={typography.h1}>{s.planTitle}</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.md }]}>{s.planIntro}</Text>
          {board && board.properties.length > 1 && (
            <View style={{ marginBottom: spacing.md }}>
              <PropertySelect
                properties={board.properties.map((p) => ({ id: p.propertyId, name: p.propertyName })) as any}
                value={propertyId}
                onChange={(id) => id && setPropertyId(id)}
              />
            </View>
          )}
          {error && <ErrorBanner message={error} onRetry={load} />}
        </View>

        {!board ? (
          !error && (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SkeletonListItem />
              <SkeletonListItem />
            </View>
          )
        ) : groups.length === 0 ? (
          <Text style={[typography.bodyMuted, { paddingHorizontal: spacing.lg }]}>{s.planEmpty}</Text>
        ) : (
          <View style={styles.grid}>
            {/* Room and bed names: outside the sideways scroll, so they stay put. */}
            <View style={{ width: LABEL }}>
              <View style={{ height: HEAD }} />
              {groups.map((g) => (
                <View key={g.roomType.id}>
                  <View style={[styles.groupLabel, { height: GROUP }]}>
                    {/* Two lines, so long names ("6-bed mixed dorm") aren't cut. */}
                    <Text style={styles.groupText} numberOfLines={2}>
                      {g.roomType.name}
                    </Text>
                  </View>
                  {g.units.map(({ unit }) => (
                    <View key={unit.id} style={[styles.unitLabel, { height: ROW }]}>
                      <Text style={styles.unitText} numberOfLines={1}>
                        {unitLabel(unit.name, g.roomType.kind, hs)}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ width: COL * DAYS }}>
                <View style={[styles.headRow, { height: HEAD }]}>
                  {days.map((d, i) => {
                    const date = new Date(`${d}T12:00:00Z`);
                    return (
                      <View key={d} style={[styles.headCell, i === 0 && styles.todayCol]}>
                        <Text style={styles.headDay}>{date.toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' })}</Text>
                        <Text style={[styles.headNum, i === 0 && { color: colors.primary }]}>{date.getUTCDate()}</Text>
                        <Text style={styles.headTaken} accessibilityLabel={s.bedsTakenA11y(takenOn(d), unitCount)}>
                          {takenOn(d)}/{unitCount}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {groups.map((g) => (
                  <View key={g.roomType.id}>
                    <View style={[styles.groupBand, { height: GROUP }]} />
                    {g.units.map(({ unit, stays }) => (
                      <View key={unit.id} style={[styles.unitRow, { height: ROW }]}>
                        {days.map((d, i) => (
                          <View key={d} style={[styles.cell, i === 0 && styles.todayCol]} />
                        ))}
                        {stays.map((e) => {
                          // A night is drawn from the middle of its day to the middle of the next.
                          const from = Math.max(-0.5, daysBetween(start!, e.date.slice(0, 10)));
                          const to = Math.min(DAYS - 0.5, daysBetween(start!, e.endDate.slice(0, 10)));
                          if (to <= from) return null;
                          const left = (from + 0.5) * COL + 2;
                          const width = (to - from) * COL - 4;
                          const arrived = !!e.checkedInAt;
                          return (
                            <Pressable
                              key={e.id}
                              onPress={() => showStay(e)}
                              style={[styles.bar, { start: left, width }, arrived ? styles.barIn : styles.barBooked]}
                              accessibilityRole="button"
                              accessibilityLabel={`${guestNameOf(e)}, ${unitLabel(unit.name, g.roomType.kind, hs)}`}
                            >
                              <Text style={[styles.barText, arrived && { color: colors.onPrimary }]} numberOfLines={1}>
                                {guestNameOf(e)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>
      <StaySheet event={opened} onClose={() => setOpened(null)} onChanged={load} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.lg, paddingBottom: spacing.xl * 2 },
  grid: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  groupLabel: { justifyContent: 'center', paddingHorizontal: spacing.sm, backgroundColor: colors.surface2 },
  groupText: { fontSize: 12, lineHeight: 15, fontWeight: '600', color: colors.inkMuted },
  headTaken: { fontSize: 10, color: colors.inkMuted, fontVariant: ['tabular-nums'], marginTop: 1 },
  unitLabel: { justifyContent: 'center', paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  unitText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  headRow: { flexDirection: 'row' },
  headCell: { width: COL, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.border },
  headDay: { fontSize: 11, color: colors.inkFaint, fontWeight: '500' },
  headNum: { fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  todayCol: { backgroundColor: colors.successBg },
  groupBand: { backgroundColor: colors.surface2 },
  unitRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  cell: { width: COL, borderLeftWidth: 1, borderLeftColor: colors.border },
  bar: { position: 'absolute', top: 6, bottom: 6, borderRadius: radius.sm, justifyContent: 'center', paddingHorizontal: 6 },
  barBooked: { backgroundColor: colors.green100, borderWidth: 1, borderColor: colors.green500 },
  barIn: { backgroundColor: colors.primary },
  // ink reads on the pale booked bar in light and dark alike.
  barText: { fontSize: 12, fontWeight: '600', color: colors.ink },
});
