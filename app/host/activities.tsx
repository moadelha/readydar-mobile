import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { Screen, ErrorBanner, SkeletonListItem, TextField, Checkbox } from '@/components/ui';
import { Button } from '@/components/Button';
import { PropertySelect } from '@/components/PropertySelect';
import { DayChips } from '@/components/desk-ui';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, OfferDay, OfferDayItem, OfferStay, Property } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useDeskStrings, formatMad } from '@/lib/i18n/desk-strings';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';
import { useHostAccess } from '@/lib/access';
import { useLargeTitle } from '@/lib/large-title';
import { useToast } from '@/lib/toast';
import { dateLocale } from '@/lib/calendar-visuals';
import { unitsLine } from '@/lib/hostel';
import { colors, radius, spacing, typography } from '@/theme';

const timeRange = (o: { startTime: string; endTime: string | null }) => (o.endTime ? `${o.startTime}–${o.endTime}` : o.startTime);

/**
 * Hostels: a day's meals and activities. What everyone staying gets
 * (breakfast) is a count worked out from the bookings, with who isn't
 * counted and the kitchen's notes; each activity guests sign up for shows
 * its places, waiting list and what's left to collect, and opens its list.
 * Setting up what's offered stays on the website.
 */
export default function ActivitiesScreen() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const s = useDeskStrings();
  const hs = useHostelStrings();
  const toast = useToast();
  const { has } = useHostAccess();
  const locale = dateLocale(lang);

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [day, setDay] = useState<OfferDay | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [collect, setCollect] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<{ stay: OfferStay | null } | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const list = properties.length ? properties : await api.properties.listMine(session.accessToken);
      if (!properties.length) setProperties(list);
      const id = propertyId ?? list[0]?.id;
      if (!id) return;
      if (!propertyId) setPropertyId(id);
      const d = await api.hostelOffers.day(id, date ?? undefined, session.accessToken);
      setDay(d);
      setToday(d.today);
      if (!date) setDate(d.date);
      if (has('REPORTS') && d.offers.some((o) => o.price && o.going)) {
        api.hostelOffers.collect(id, d.date, session.accessToken).then((c) => setCollect(c.byOffer), () => setCollect(null));
      } else setCollect(null);
    } catch (err) {
      // The server doesn't have meals and activities yet (route unknown).
      if (err instanceof ApiError && err.status === 404 && /cannot get/i.test(err.message)) setNotReady(true);
      else setError(err instanceof ApiError ? err.message : s.loadError);
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, properties, propertyId, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const dayLabel = (d: string, i: number) =>
    i === 0 ? s.today : i === 1 ? s.tomorrow : new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

  const meals = day?.offers.filter((o) => o.audience === 'EVERYONE') ?? [];
  const signups = day?.offers.filter((o) => o.audience === 'SIGNUP') ?? [];
  const kitchen = meals.length > 0 || signups.some((o) => o.askFood);
  const noted = day?.stays.filter((x) => x.note && (x.note.food || x.note.noMeals || (x.note.leavesAt && x.state === 'leaving'))) ?? [];

  function renderMeal(o: OfferDayItem) {
    const e = o.expected;
    return (
      <View key={o.id} style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.titleRow}>
            <Ionicons name="cafe-outline" size={18} color={colors.inkMuted} />
            <Text style={typography.h3} numberOfLines={1}>
              {o.name}
            </Text>
          </View>
          <Text style={typography.caption}>
            {timeRange(o)}
            {o.place ? ` · ${o.place}` : ''}
          </Text>
        </View>
        {o.off ? (
          <Text style={styles.offText}>{s.off}</Text>
        ) : e ? (
          <>
            <View style={styles.bigRow}>
              <Text style={styles.big}>{e.total}</Text>
              <Text style={typography.bodyMuted}>{s.people(e.total)}</Text>
            </View>
            <View style={styles.breakdown}>
              {(e.morning
                ? [
                    [e.staying, s.staying],
                    [e.leaving, s.leavingMorning],
                  ]
                : [
                    [e.staying, s.stayingOn],
                    [e.arriving, s.arriving],
                  ]
              ).map(([n, label]) => (
                <View key={String(label)} style={styles.breakLine}>
                  <Text style={styles.breakNum}>{n}</Text>
                  <Text style={styles.breakText}>{label}</Text>
                </View>
              ))}
              {(e.notCounted > 0 || e.noMeals > 0) && <Text style={[typography.label, { marginTop: spacing.sm }]}>{s.notCounted}</Text>}
              {e.notCounted > 0 && (
                <View style={styles.breakLine}>
                  <Text style={[styles.breakNum, { color: colors.inkMuted }]}>{e.notCounted}</Text>
                  <Text style={[styles.breakText, { color: colors.inkMuted }]}>{e.morning ? s.arrivalsNotCounted : s.departuresNotCounted}</Text>
                </View>
              )}
              {e.noMeals > 0 && (
                <View style={styles.breakLine}>
                  <Text style={[styles.breakNum, { color: colors.inkMuted }]}>{e.noMeals}</Text>
                  <Text style={[styles.breakText, { color: colors.inkMuted }]}>{s.noMealsCount}</Text>
                </View>
              )}
            </View>
            {(e.early > 0 || e.notArrived > 0) && (
              <View style={styles.flags}>
                {e.early > 0 && (
                  <View style={styles.flag}>
                    <Ionicons name="bag-handle-outline" size={15} color={colors.ink} />
                    <Text style={styles.flagText}>{s.early(e.early)}</Text>
                  </View>
                )}
                {e.notArrived > 0 && (
                  <View style={styles.flag}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                    <Text style={[styles.flagText, { color: colors.warning }]}>{s.notArrived(e.notArrived)}</Text>
                  </View>
                )}
              </View>
            )}
          </>
        ) : null}
      </View>
    );
  }

  function renderSignup(o: OfferDayItem, i: number) {
    const left = collect?.[o.id] ?? 0;
    return (
      <Pressable
        key={o.id}
        onPress={() => router.push({ pathname: '/host/activity/[id]', params: { id: o.id, date: day!.date } })}
        style={({ pressed }) => [styles.signupRow, i > 0 && styles.divider, pressed && { backgroundColor: colors.surface2 }]}
        accessibilityRole="button"
      >
        <View style={styles.timeCol}>
          <Text style={styles.time}>{o.startTime}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {o.name}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {[o.place, o.price ? s.perPerson(formatMad(o.price, lang)) : s.free].filter(Boolean).join(' · ')}
          </Text>
          {o.off ? (
            <Text style={[styles.offText, { marginTop: 4 }]}>{s.off}</Text>
          ) : (
            <View style={styles.chips}>
              <View style={[styles.chip, o.capacity && o.going >= o.capacity ? styles.chipWarn : styles.chipMuted]}>
                <Text style={styles.chipText}>{s.going(o.going, o.capacity)}</Text>
              </View>
              {o.waiting > 0 && (
                <View style={[styles.chip, styles.chipWarn]}>
                  <Text style={[styles.chipText, { color: colors.warning }]}>{s.waitingN(o.waiting)}</Text>
                </View>
              )}
              {left > 0 && (
                <View style={[styles.chip, styles.chipWarn]}>
                  <Text style={[styles.chipText, { color: colors.warning }]}>{s.toCollect(formatMad(left, lang))}</Text>
                </View>
              )}
              <Text style={[typography.caption, { alignSelf: 'center' }]}>{o.closed ? s.closed : s.closes(o.closesAt.slice(11))}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
      </Pressable>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.actTitle), headerBackTitle: t.common.back }} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        {...largeTitle.scrollProps}
      >
        <Text style={typography.h1}>{s.actTitle}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.md }]}>{s.actIntro}</Text>

        {properties.length > 1 && (
          <View style={{ marginBottom: spacing.md }}>
            <PropertySelect
              properties={properties}
              value={propertyId}
              onChange={(id) => {
                if (!id) return;
                setPropertyId(id);
                setDay(null);
              }}
            />
          </View>
        )}

        {notReady ? (
          <View style={styles.card}>
            <Text style={typography.body}>{s.notReady}</Text>
          </View>
        ) : (
          <>
            {today && date && (
              <View style={{ marginBottom: spacing.lg }}>
                <DayChips
                  today={today}
                  value={date}
                  onChange={(d) => {
                    if (d === date) return;
                    setDate(d);
                    setDay(null);
                  }}
                  labelOf={dayLabel}
                />
              </View>
            )}
            {error && <ErrorBanner message={error} onRetry={load} />}
            {!day ? (
              !error && (
                <>
                  <SkeletonListItem />
                  <SkeletonListItem />
                </>
              )
            ) : !day.hasOffers ? (
              <View style={styles.card}>
                <Text style={typography.body}>{s.nothingSetUp}</Text>
              </View>
            ) : day.offers.length === 0 ? (
              <Text style={typography.bodyMuted}>{s.nothingThatDay}</Text>
            ) : (
              <>
                {meals.map(renderMeal)}

                {signups.length > 0 && (
                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={[typography.h3, { marginBottom: spacing.sm }]}>{s.signupsTitle}</Text>
                    <View style={styles.list}>{signups.map(renderSignup)}</View>
                  </View>
                )}

                {kitchen && (
                  <View>
                    <View style={styles.sectionHead}>
                      <View style={styles.titleRow}>
                        <Ionicons name="restaurant-outline" size={17} color={colors.inkMuted} />
                        <Text style={typography.h3}>{s.kitchen}</Text>
                      </View>
                      <Pressable onPress={() => setNote({ stay: null })} hitSlop={8} accessibilityRole="button" style={styles.addLink}>
                        <Ionicons name="add" size={16} color={colors.green700} />
                        <Text style={styles.addLinkText}>{s.addNote}</Text>
                      </Pressable>
                    </View>
                    {noted.length === 0 ? (
                      <Text style={typography.bodyMuted}>{s.kitchenEmpty}</Text>
                    ) : (
                      <View style={styles.list}>
                        {noted.map((x, i) => (
                          <Pressable
                            key={x.key}
                            onPress={() => setNote({ stay: x })}
                            style={[styles.noteRow, i > 0 && styles.divider]}
                            accessibilityRole="button"
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.name} numberOfLines={1}>
                                {x.name || '—'} · {s.peopleN(x.people)}
                              </Text>
                              {unitsLine(x.units, hs) ? <Text style={typography.caption}>{unitsLine(x.units, hs)}</Text> : null}
                              <Text style={styles.noteText}>
                                {[x.note?.noMeals ? s.noMeals : x.note?.food, x.state === 'leaving' && x.note?.leavesAt ? s.leavesAt(x.note.leavesAt) : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Text>
                            </View>
                            <Ionicons name="create-outline" size={18} color={colors.inkFaint} />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {note && day && propertyId && (
        <KitchenNoteSheet
          stays={day.stays}
          initial={note.stay}
          propertyId={propertyId}
          onClose={() => setNote(null)}
          onSaved={() => {
            setNote(null);
            toast.show(s.noteSaved);
            load();
          }}
        />
      )}
    </Screen>
  );
}

/** A stay's kitchen note: what they don't eat, an early departure, no meals. */
function KitchenNoteSheet({
  stays,
  initial,
  propertyId,
  onClose,
  onSaved,
}: {
  stays: OfferStay[];
  initial: OfferStay | null;
  propertyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const s = useDeskStrings();
  const hs = useHostelStrings();
  const [stay, setStay] = useState<OfferStay | null>(initial);
  const [food, setFood] = useState(initial?.note?.food ?? '');
  const [leavesAt, setLeavesAt] = useState(initial?.note?.leavesAt ?? '');
  const [noMeals, setNoMeals] = useState(initial?.note?.noMeals ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(x: OfferStay) {
    setStay(x);
    setFood(x.note?.food ?? '');
    setLeavesAt(x.note?.leavesAt ?? '');
    setNoMeals(x.note?.noMeals ?? false);
  }

  async function save() {
    if (!session || !stay) return;
    const time = leavesAt.trim();
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError(s.leavesAtLabel);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.hostelOffers.saveMealNote(
        propertyId,
        {
          ...(stay.reservationId ? { reservationId: stay.reservationId } : { checkInId: stay.checkInId! }),
          food: food.trim() || null,
          leavesAt: time || null,
          noMeals,
        },
        session.accessToken,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.actionError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={typography.h2}>{s.noteTitle}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={s.cancel}>
              <Ionicons name="close" size={22} color={colors.inkMuted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            {!stay ? (
              <>
                <Text style={styles.label}>{s.whichGuest}</Text>
                <View style={styles.list}>
                  {stays.map((x, i) => (
                    <Pressable key={x.key} onPress={() => pick(x)} style={[styles.noteRow, i > 0 && styles.divider]} accessibilityRole="button">
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{x.name || '—'}</Text>
                        {unitsLine(x.units, hs) ? <Text style={typography.caption}>{unitsLine(x.units, hs)}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={[typography.h3, { marginBottom: spacing.md }]}>{stay.name || '—'}</Text>
                <TextField label={s.food} value={food} onChangeText={setFood} placeholder={s.foodPlaceholder} maxLength={200} autoCapitalize="sentences" />
                <TextField label={s.leavesAtLabel} value={leavesAt} onChangeText={setLeavesAt} placeholder="07:30" keyboardType="numbers-and-punctuation" maxLength={5} />
                <View style={styles.checkRow}>
                  <Checkbox checked={noMeals} onChange={setNoMeals} label={s.noMealsLabel} />
                  <Text style={typography.body}>{s.noMealsLabel}</Text>
                </View>
                {error && <ErrorBanner message={error} />}
                <Button label={s.save} onPress={save} loading={busy} style={{ marginTop: spacing.md }} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  cardHead: { gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: spacing.md },
  big: { fontSize: 56, lineHeight: 60, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  breakdown: { marginTop: spacing.sm },
  breakLine: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  breakNum: { width: 32, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  breakText: { fontSize: 14, color: colors.ink, flex: 1 },
  flags: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagText: { fontSize: 14, color: colors.ink, flex: 1 },
  offText: { marginTop: spacing.sm, fontSize: 14, fontWeight: '600', color: colors.danger },
  list: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  signupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  timeCol: { width: 48 },
  time: { fontSize: 15, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  chipMuted: { backgroundColor: colors.surface2 },
  chipWarn: { backgroundColor: colors.warningBg },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36 },
  addLinkText: { fontSize: 14, fontWeight: '600', color: colors.green700 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  noteText: { fontSize: 14, color: colors.ink, marginTop: 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.sand, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.ink, marginBottom: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
