import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Alert, TextInput } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { Screen, ErrorBanner, SkeletonListItem } from '@/components/ui';
import { Button } from '@/components/Button';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, OfferRoster, OfferSignup, OfferStay } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useDeskStrings, formatMad } from '@/lib/i18n/desk-strings';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';
import { useHostAccess } from '@/lib/access';
import { useLargeTitle } from '@/lib/large-title';
import { useToast } from '@/lib/toast';
import { formatDay } from '@/lib/dates';
import { unitsLine } from '@/lib/hostel';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Hostels: one activity's list for a day — who's going, the waiting list,
 * and who can still be added (guests staying that day). Places freed go to
 * the waiting list in order; the screen says who to tell. A past day can
 * only be changed by owners and managers (it changes the bills).
 */
export default function ActivityRosterScreen() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const s = useDeskStrings();
  const hs = useHostelStrings();
  const toast = useToast();
  const { isManager } = useHostAccess();
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();

  const [roster, setRoster] = useState<OfferRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!session || !id || !date) return;
    setError(null);
    try {
      setRoster(await api.hostelOffers.roster(id, date, session.accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.loadError);
    } finally {
      setRefreshing(false);
    }
  }, [session, id, date, s.loadError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function run(key: string, action: () => Promise<{ promoted?: string[] } | unknown>, done?: string) {
    setBusy(key);
    setError(null);
    try {
      const res = (await action()) as { promoted?: string[] } | undefined;
      const names = res?.promoted?.filter(Boolean) ?? [];
      if (names.length) Alert.alert(s.actTitle, s.promoted(names.join(', ')));
      else if (done) toast.show(done);
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : s.actionError, 'error');
    } finally {
      setBusy(null);
    }
  }

  function add(stay: OfferStay, late = false) {
    if (!session || !roster) return;
    if (roster.closed && !late) {
      Alert.alert(s.closed, s.lateConfirm, [
        { text: s.cancel, style: 'cancel' },
        { text: s.addAnyway, onPress: () => add(stay, true) },
      ]);
      return;
    }
    const ref = stay.reservationId ? { reservationId: stay.reservationId } : { checkInId: stay.checkInId! };
    run(`add:${stay.key}`, async () => {
      const res = await api.hostelOffers.addSignup(roster.offer.id, { date: roster.date, ...ref, people: Math.max(1, stay.people), ...(late ? { late: true } : {}) }, session.accessToken);
      toast.show(res.status === 'WAITING' ? s.addedWaiting : s.added);
      setAdding(false);
      setQuery('');
    });
  }

  function remove(x: OfferSignup) {
    if (!session) return;
    Alert.alert(s.remove, s.removeConfirm(x.guestName), [
      { text: s.cancel, style: 'cancel' },
      { text: s.remove, style: 'destructive', onPress: () => run(x.id, () => api.hostelOffers.changeSignup(x.id, { action: 'REMOVE' }, session.accessToken)) },
    ]);
  }

  function toggleOff() {
    if (!session || !roster) return;
    const off = !roster.off;
    const go = () => run('off', () => api.hostelOffers.setOff(roster.offer.id, roster.date, off, session.accessToken));
    if (off) Alert.alert(s.callOff, s.callOffConfirm, [{ text: s.cancel, style: 'cancel' }, { text: s.callOff, style: 'destructive', onPress: go }]);
    else go();
  }

  const editable = !!roster && (roster.date >= roster.today || isManager);
  const o = roster?.offer;

  function renderLine(x: OfferSignup, i: number, waiting: boolean) {
    const line = unitsLine(x.units, hs);
    const isBusy = busy === x.id;
    return (
      <View key={x.id} style={[styles.row, i > 0 && styles.divider]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {x.guestName || '—'}
          </Text>
          {line ? <Text style={typography.caption}>{line}</Text> : null}
          {x.food ? <Text style={styles.food}>{x.food}</Text> : null}
          <View style={styles.chips}>
            {x.left != null && x.left > 0 && (
              <View style={[styles.chip, styles.chipWarn]}>
                <Text style={[styles.chipText, { color: colors.warning }]}>{s.leftToPayShort(formatMad(x.left, lang))}</Text>
              </View>
            )}
            {x.notStaying && (
              <View style={[styles.chip, styles.chipDanger]}>
                <Text style={[styles.chipText, { color: colors.danger }]}>{s.notStaying}</Text>
              </View>
            )}
          </View>
          {waiting && editable && (
            <Pressable
              onPress={() => run(x.id, () => api.hostelOffers.changeSignup(x.id, { action: 'GIVE_PLACE' }, session!.accessToken), s.added)}
              disabled={isBusy}
              style={styles.inlineAction}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-up-circle-outline" size={16} color={colors.green700} />
              <Text style={styles.inlineActionText}>{s.giveplace}</Text>
            </Pressable>
          )}
        </View>
        {editable ? (
          <View style={styles.people}>
            <Pressable
              onPress={() => (x.people > 1 ? run(x.id, () => api.hostelOffers.changeSignup(x.id, { action: 'PEOPLE', people: x.people - 1 }, session!.accessToken)) : remove(x))}
              disabled={isBusy}
              style={styles.peopleButton}
              accessibilityRole="button"
              accessibilityLabel={x.people > 1 ? s.fewer : s.remove}
            >
              <Ionicons name={x.people > 1 ? 'remove' : 'trash-outline'} size={17} color={x.people > 1 ? colors.ink : colors.danger} />
            </Pressable>
            <Text style={styles.peopleValue}>{isBusy ? '…' : x.people}</Text>
            <Pressable
              onPress={() => run(x.id, () => api.hostelOffers.changeSignup(x.id, { action: 'PEOPLE', people: x.people + 1 }, session!.accessToken))}
              disabled={isBusy || x.people >= 50}
              style={styles.peopleButton}
              accessibilityRole="button"
              accessibilityLabel={s.more}
            >
              <Ionicons name="add" size={17} color={colors.ink} />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.peopleValue}>{x.people}</Text>
        )}
      </View>
    );
  }

  const q = query.trim().toLowerCase();
  const candidates = (roster?.stays ?? []).filter((x) => !q || `${x.name ?? ''} ${unitsLine(x.units, hs)}`.toLowerCase().includes(q));

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(o?.name ?? s.actTitle), headerBackTitle: t.common.back }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        {...largeTitle.scrollProps}
      >
        {!roster || !o ? (
          error ? <ErrorBanner message={error} onRetry={load} /> : <SkeletonListItem />
        ) : (
          <>
            <Text style={typography.h1}>{o.name}</Text>
            <Text style={[typography.body, { marginTop: spacing.xs }]}>
              {formatDay(roster.date, lang, { utc: true })} · {o.endTime ? `${o.startTime}–${o.endTime}` : o.startTime}
            </Text>
            <Text style={[typography.bodyMuted, { marginTop: 2 }]}>
              {[o.place, o.price ? s.perPerson(formatMad(o.price, lang)) : s.free, roster.closed ? s.closed : s.closes(roster.closesAt.slice(11))]
                .filter(Boolean)
                .join(' · ')}
            </Text>

            {roster.off ? (
              <View style={[styles.banner, { backgroundColor: colors.dangerBg }]}>
                <Text style={{ color: colors.danger, fontWeight: '600' }}>{s.off}</Text>
                <Text style={[typography.caption, { marginTop: 2 }]}>{s.offBy(roster.off.by)}</Text>
              </View>
            ) : null}
            {!editable && (
              <View style={[styles.banner, { backgroundColor: colors.surface2 }]}>
                <Text style={typography.bodyMuted}>{s.pastDay}</Text>
              </View>
            )}

            <View style={styles.sectionHead}>
              <Text style={typography.h3}>{s.goingTitle}</Text>
              <Text style={typography.caption}>{s.going(roster.taken, o.capacity)}</Text>
            </View>
            {roster.going.length === 0 ? (
              <Text style={typography.bodyMuted}>{s.nobodyYet}</Text>
            ) : (
              <View style={styles.list}>{roster.going.map((x, i) => renderLine(x, i, false))}</View>
            )}

            {roster.waiting.length > 0 && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={typography.h3}>{s.waitingTitle}</Text>
                  <Text style={typography.caption}>{s.waitingN(roster.waiting.length)}</Text>
                </View>
                <View style={styles.list}>{roster.waiting.map((x, i) => renderLine(x, i, true))}</View>
              </>
            )}

            {editable && !roster.off && !o.archived && (
              <View style={{ marginTop: spacing.lg }}>
                {!adding ? (
                  <Button label={s.addToList} onPress={() => setAdding(true)} />
                ) : roster.stays.length === 0 ? (
                  <Text style={typography.bodyMuted}>{s.nobodyToAdd}</Text>
                ) : (
                  <>
                    <Text style={[typography.h3, { marginBottom: spacing.sm }]}>{s.addToList}</Text>
                    {roster.stays.length > 6 && (
                      <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder={s.addSearch}
                        placeholderTextColor={colors.inkFaint}
                        style={styles.search}
                        autoCorrect={false}
                      />
                    )}
                    <View style={styles.list}>
                      {candidates.map((x, i) => (
                        <Pressable
                          key={x.key}
                          onPress={() => add(x)}
                          disabled={busy === `add:${x.key}`}
                          style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: colors.surface2 }]}
                          accessibilityRole="button"
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.name} numberOfLines={1}>
                              {x.name || '—'}
                            </Text>
                            <Text style={typography.caption} numberOfLines={1}>
                              {[unitsLine(x.units, hs), s.peopleN(Math.max(1, x.people))].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <Ionicons name={busy === `add:${x.key}` ? 'hourglass-outline' : 'add-circle-outline'} size={22} color={colors.green700} />
                        </Pressable>
                      ))}
                    </View>
                    <Button label={s.cancel} variant="outline" onPress={() => setAdding(false)} style={{ marginTop: spacing.sm }} />
                  </>
                )}
              </View>
            )}

            {editable && !o.archived && (
              <Button
                label={roster.off ? s.backOn : s.callOff}
                variant="outline"
                onPress={toggleOff}
                loading={busy === 'off'}
                style={{ marginTop: spacing.xl }}
              />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  banner: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  list: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  food: { fontSize: 13, color: colors.ink, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  chipWarn: { backgroundColor: colors.warningBg },
  chipDanger: { backgroundColor: colors.dangerBg },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' },
  inlineActionText: { fontSize: 14, fontWeight: '600', color: colors.green700 },
  people: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  peopleButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  peopleValue: { minWidth: 24, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    color: colors.ink,
    backgroundColor: colors.white,
  },
});
