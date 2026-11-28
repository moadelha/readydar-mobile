import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Share } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { Screen, TextField, Chip, SegmentedControl, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { PropertySelect } from '@/components/PropertySelect';
import { Stepper, DayChips } from '@/components/desk-ui';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, HousekeepingBoard, NewStayResult, resolveCheckInUrl } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useDeskStrings } from '@/lib/i18n/desk-strings';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';
import { useHostAccess } from '@/lib/access';
import { useLargeTitle } from '@/lib/large-title';
import { checkInCopyMessage } from '@/lib/checkin-message';
import { formatDay } from '@/lib/dates';
import { addDaysIso, dateLocale } from '@/lib/calendar-visuals';
import { useToast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Hostels: a stay made at the desk. "Today" is a walk-in (the beds are
 * theirs from tonight); "Later" books a group or anyone coming on another
 * day. Either way the API makes a check-in link, so the guests can fill in
 * their own details — or staff register them here when they're at the desk.
 */
export default function NewStayScreen() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const s = useDeskStrings();
  const hs = useHostelStrings();
  const toast = useToast();
  const { has } = useHostAccess();

  const [board, setBoard] = useState<HousekeepingBoard | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [when, setWhen] = useState<'today' | 'later'>('today');
  const [day, setDay] = useState<string | null>(null);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [roomCount, setRoomCount] = useState(1);
  const [nights, setNights] = useState(1);
  const [guestCount, setGuestCount] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<(NewStayResult & { arrival: string; propertyName: string }) | null>(null);

  useEffect(() => {
    if (!session) return;
    api.housekeeping
      .board(session.accessToken)
      .then((b) => {
        setBoard(b);
        setPropertyId((id) => id ?? b.properties[0]?.propertyId ?? null);
        setDay((d) => d ?? addDaysIso(b.today, 1));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : s.stayError));
  }, [session, s.stayError]);

  const property = board?.properties.find((p) => p.propertyId === propertyId) ?? null;
  const roomType = property?.roomTypes.find((r) => r.id === roomTypeId) ?? null;
  // The first room type by default; none when the place is let whole.
  useEffect(() => {
    if (property && !property.roomTypes.some((r) => r.id === roomTypeId)) setRoomTypeId(property.roomTypes[0]?.id ?? null);
  }, [property, roomTypeId]);
  // A dorm bed sleeps one: guests follow the beds unless staff change it.
  useEffect(() => {
    if (roomType?.kind === 'DORM') setGuestCount((g) => Math.max(g, roomCount));
  }, [roomType?.kind, roomCount]);

  const today = board?.today ?? null;
  const arrival = when === 'today' ? today : day;

  async function submit() {
    if (!session || !propertyId || !arrival) return;
    setError(null);
    if (!name.trim()) {
      setError(s.nameRequired);
      return;
    }
    const price = Number(rate.replace(',', '.'));
    // A typo in the price would otherwise book at the room type's price without a word.
    if (rate.trim() && !(price >= 0)) {
      setError(s.amountInvalid);
      return;
    }
    const body = {
      ...(roomTypeId ? { roomTypeId, roomCount } : {}),
      nights,
      guestCount,
      guestName: name.trim(),
      ...(phone.trim() ? { guestPhone: phone.trim() } : {}),
      ...(rate.trim() && price >= 0 ? { nightlyRate: price } : {}),
    };
    setBusy(true);
    try {
      const res =
        when === 'today'
          ? await api.frontDesk.walkIn(propertyId, body, session.accessToken)
          : await api.frontDesk.groupBooking(propertyId, { ...body, checkIn: arrival }, session.accessToken);
      setCreated({ ...res, arrival, propertyName: property?.propertyName ?? '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.stayError);
    } finally {
      setBusy(false);
    }
  }

  const message = useMemo(
    () =>
      created
        ? checkInCopyMessage(t, lang, { propertyName: created.propertyName, checkIn: created.arrival }, resolveCheckInUrl(created.token))
        : '',
    [created, t, lang],
  );

  if (created) {
    const isToday = created.arrival === today;
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: s.stayAdded, headerBackTitle: t.common.back }} />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={28} color={colors.success} />
          </View>
          <Text style={typography.h1}>{s.stayAdded}</Text>
          <Text style={[typography.body, { marginTop: spacing.sm }]}>
            {name.trim()} · {t.common.guestsCount(guestCount)} · {t.calendarHost.nightsCount(nights)}
          </Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
            {isToday ? s.stayAddedToday : s.stayAddedLater(formatDay(created.arrival, lang, { utc: true }))}
          </Text>
          {isToday && has('CHECKINS') && (
            <Button
              label={s.registerNow}
              onPress={() =>
                router.replace({ pathname: '/host/desk/register', params: { checkInId: created.checkInId, name: name.trim(), count: String(guestCount) } })
              }
              style={{ marginBottom: spacing.sm }}
            />
          )}
          <Button
            label={s.copyLink}
            variant={isToday && has('CHECKINS') ? 'outline' : 'primary'}
            onPress={async () => {
              await Clipboard.setStringAsync(message);
              toast.show(s.linkCopied);
            }}
            style={{ marginBottom: spacing.sm }}
          />
          <Button label={s.shareLink} variant="outline" onPress={() => Share.share({ message }).catch(() => {})} style={{ marginBottom: spacing.sm }} />
          <Button label={s.done} variant="outline" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  const locale = dateLocale(lang);
  const dayLabel = (d: string, i: number) =>
    i === 0 ? s.tomorrow : new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(s.newStayTitle), headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" {...largeTitle.scrollProps}>
        <Text style={typography.h1}>{s.newStayTitle}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>{s.newStayIntro}</Text>

        {board && board.properties.length > 1 && (
          <View style={{ marginBottom: spacing.md }}>
            <PropertySelect
              properties={board.properties.map((p) => ({ id: p.propertyId, name: p.propertyName })) as any}
              value={propertyId}
              onChange={(id) => id && setPropertyId(id)}
            />
          </View>
        )}

        <Text style={styles.label}>{s.when}</Text>
        <SegmentedControl
          options={[
            { value: 'today', label: s.today },
            { value: 'later', label: s.later },
          ]}
          value={when}
          onChange={setWhen}
        />
        {when === 'later' && today && day && (
          <View style={{ marginTop: spacing.sm }}>
            <DayChips today={addDaysIso(today, 1)} value={day} onChange={setDay} count={21} labelOf={dayLabel} />
          </View>
        )}

        {property && property.roomTypes.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>{s.roomType}</Text>
            <View style={styles.chipRow}>
              {property.roomTypes.map((r) => (
                <Chip key={r.id} label={r.name} active={r.id === roomTypeId} onPress={() => setRoomTypeId(r.id)} />
              ))}
            </View>
          </View>
        )}

        <View style={[styles.row, { marginTop: spacing.lg }]}>
          {roomTypeId && (
            <Stepper
              label={roomType?.kind === 'DORM' ? s.beds : s.rooms}
              value={roomCount}
              onChange={setRoomCount}
              max={30}
              fewerLabel={s.fewer}
              moreLabel={s.more}
            />
          )}
          <Stepper label={s.nights} value={nights} onChange={setNights} max={60} fewerLabel={s.fewer} moreLabel={s.more} />
          <Stepper label={s.guests} value={guestCount} onChange={setGuestCount} max={30} fewerLabel={s.fewer} moreLabel={s.more} />
        </View>

        <TextField label={s.guestName} value={name} onChangeText={setName} placeholder={s.guestNamePlaceholder} autoCapitalize="words" maxLength={120} />
        <TextField label={s.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={40} />
        <TextField label={s.price('MAD')} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder={s.pricePlaceholder} />

        {property && property.roomTypes.length === 0 && <Text style={[typography.caption, { marginBottom: spacing.sm }]}>{hs.noRooms}</Text>}
        {error && <ErrorBanner message={error} />}

        <Button label={busy ? s.adding : s.addStay} onPress={submit} loading={busy} disabled={!property} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.ink, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  doneIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});

