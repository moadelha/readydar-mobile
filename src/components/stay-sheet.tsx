import { useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import { Button } from '@/components/Button';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, CalendarEvent, resolveCheckInUrl } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import { useHostelStrings } from '@/lib/i18n/hostel-strings';
import { useDeskStrings } from '@/lib/i18n/desk-strings';
import { useRedesignStrings } from '@/lib/i18n/redesign-strings';
import { useHostAccess } from '@/lib/access';
import { checkInCopyMessage } from '@/lib/checkin-message';
import { eventAccentColor, dateLocale } from '@/lib/calendar-visuals';
import { guestNameOf, stayRef, unitLabel } from '@/lib/hostel';
import { useToast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Hostels: one stay, opened from the bed plan — who, where, when, how it
 * was booked, whether the guest is here and their details are in — with the
 * desk's actions: arrived / checked out, register, payment, check-in link.
 */
export function StaySheet({ event, onClose, onChanged }: { event: CalendarEvent | null; onClose: () => void; onChanged: () => void }) {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useLanguage();
  const hs = useHostelStrings();
  const ds = useDeskStrings();
  const st = useRedesignStrings().stay;
  const { has } = useHostAccess();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ id: string; checkedInAt?: string | null; checkedOutAt?: string | null } | null>(null);

  if (!event) return null;
  const e = state?.id === event.id ? { ...event, ...state } : event;
  const locale = dateLocale(lang);
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const nights = Math.max(1, Math.round((Date.parse(e.endDate.slice(0, 10)) - Date.parse(e.date.slice(0, 10))) / 86_400_000));
  const units = [...new Set(e.roomUnits ?? [])].map((n) => unitLabel(n, e.roomTypeKind, hs)).join(', ');
  const source = e.walkIn ? hs.walkIn : e.source === 'MANUAL' ? hs.offline : e.channelName || (e.source ? t.sourceLabel[e.source as keyof typeof t.sourceLabel] : null);
  const detailsMissing = !!e.checkInId && e.checkInStatus !== 'SUBMITTED';
  const name = guestNameOf(e);

  async function setStatus(action: 'CHECK_IN' | 'CHECK_OUT' | 'UNDO_CHECK_IN' | 'UNDO_CHECK_OUT') {
    if (!session) return;
    setBusy(true);
    try {
      const res = await api.frontDesk.status({ ...stayRef(e), action }, session.accessToken);
      setState({ id: e.id, ...res });
      onChanged();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : hs.actionError, 'error');
    } finally {
      setBusy(false);
    }
  }

  function go(pathname: '/host/desk/register' | '/host/desk/pay', params: Record<string, string>) {
    onClose();
    router.push({ pathname, params });
  }

  const status = e.checkedOutAt
    ? { text: hs.leftAt(time(e.checkedOutAt)), tone: 'muted' as const }
    : e.checkedInAt
      ? { text: hs.arrivedAt(time(e.checkedInAt)), tone: 'ok' as const }
      : { text: hs.expected, tone: 'muted' as const };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={st.close}>
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onStartShouldSetResponder={() => true}>
          <View style={styles.grabber} />

          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={typography.h2} numberOfLines={2}>
                {name}
              </Text>
              <View style={styles.sourceRow}>
                <View style={[styles.dot, { backgroundColor: eventAccentColor(e) }]} />
                <Text style={typography.bodyMuted} numberOfLines={1}>
                  {[source, e.guestCount ? t.common.guestsCount(e.guestCount) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={st.close}>
              <Ionicons name="close" size={22} color={colors.inkMuted} />
            </Pressable>
          </View>

          <View style={styles.chips}>
            <View style={[styles.chip, status.tone === 'ok' ? styles.chipOk : styles.chipMuted]}>
              <Text style={[styles.chipText, status.tone === 'ok' && { color: colors.success }]}>{status.text}</Text>
            </View>
            {e.checkInId ? (
              <View style={[styles.chip, detailsMissing ? styles.chipWarn : styles.chipOk]}>
                <Text style={[styles.chipText, { color: detailsMissing ? colors.warning : colors.success }]}>
                  {detailsMissing ? hs.detailsMissing : hs.detailsDone}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Line label={st.where} value={[e.roomTypeName, units].filter(Boolean).join(' · ') || '—'} />
            <Line label={st.arrival} value={day(e.date)} />
            <Line label={st.departure} value={`${day(e.endDate)} · ${t.calendarHost.nightsCount(nights)}`} last />
          </View>

          {/* The one thing to do now, then the rest as small buttons. */}
          {!e.checkedInAt ? (
            <Button label={busy ? '…' : hs.markArrived} onPress={() => setStatus('CHECK_IN')} loading={busy} />
          ) : !e.checkedOutAt ? (
            <View style={styles.row}>
              <Button label={busy ? '…' : hs.markLeft} onPress={() => setStatus('CHECK_OUT')} loading={busy} style={{ flex: 1 }} />
              <Button label={hs.undo} variant="outline" onPress={() => setStatus('UNDO_CHECK_IN')} disabled={busy} />
            </View>
          ) : (
            <Button label={hs.undo} variant="outline" onPress={() => setStatus('UNDO_CHECK_OUT')} loading={busy} />
          )}

          <View style={styles.pills}>
            {detailsMissing && has('CHECKINS') ? (
              <Pill icon="id-card-outline" label={ds.shortRegister} onPress={() => go('/host/desk/register', { checkInId: e.checkInId!, name, count: String(e.guestCount || 1) })} />
            ) : null}
            {detailsMissing && e.checkInToken ? (
              <Pill
                icon="copy-outline"
                label={ds.shortCopy}
                onPress={async () => {
                  await Clipboard.setStringAsync(checkInCopyMessage(t, lang, { propertyName: e.propertyName, checkIn: e.date }, resolveCheckInUrl(e.checkInToken!)));
                  toast.show(t.calendarHost.checkInLinkCopied);
                }}
              />
            ) : null}
            {has('REPORTS') ? (
              <Pill icon="cash-outline" label={ds.shortPay} onPress={() => go('/host/desk/pay', { ...(stayRef(e) as Record<string, string>), name })} />
            ) : null}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function Line({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.line, !last && styles.lineDivider]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Pill({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && { backgroundColor: colors.surface2 }]} accessibilityRole="button">
      <Ionicons name={icon} size={16} color={colors.green700} />
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.sand,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  chipMuted: { backgroundColor: colors.surface2 },
  chipOk: { backgroundColor: colors.successBg },
  chipWarn: { backgroundColor: colors.warningBg },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 11 },
  lineDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  lineLabel: { fontSize: 14, color: colors.inkMuted },
  lineValue: { fontSize: 14, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.green700 },
});
