import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { dateLocale, parseDateOnly, todayIso, weekdayLetters, ymd } from '@/lib/calendar-visuals';
import { formatDay } from '@/lib/dates';
import { rtlFlip } from '@/lib/rtl';

/**
 * Date inputs that open a month grid instead of asking for "YYYY-MM-DD".
 * Values stay plain YYYY-MM-DD strings, so the forms and the API calls
 * behind them don't change. Pure JS (no native picker module), so it ships
 * in an over-the-air update and looks the same on iOS and Android.
 */

type Selection = { start: string; end: string | null };

function monthOf(iso: string) {
  const d = parseDateOnly(iso);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function nightsBetween(start: string, end: string) {
  return Math.round((parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / 86_400_000);
}

function CalendarSheet({
  visible,
  mode,
  initial,
  minDate,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  mode: 'single' | 'range';
  initial: Selection;
  minDate?: string;
  onClose: () => void;
  onConfirm: (selection: Selection) => void;
}) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const locale = dateLocale(lang);
  const today = todayIso();
  const [selection, setSelection] = useState<Selection>(initial);
  const [view, setView] = useState(() => monthOf(initial.start || today));

  // Each opening starts from the field's current value.
  useEffect(() => {
    if (!visible) return;
    setSelection(initial);
    setView(monthOf(initial.start || today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(ymd(view.year, view.month, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function pick(iso: string) {
    if (mode === 'single') {
      onConfirm({ start: iso, end: null });
      return;
    }
    // First tap sets check-in; the second sets check-out, unless it's on or
    // before check-in, in which case it starts the stay over from there.
    if (!selection.start || selection.end || iso <= selection.start) setSelection({ start: iso, end: null });
    else setSelection({ start: selection.start, end: iso });
  }

  const monthTitle = new Date(view.year, view.month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const rangeReady = mode === 'range' && !!selection.start && !!selection.end;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.common.cancel}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.monthBar}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navButton} accessibilityRole="button" accessibilityLabel={t.common.previousMonth}>
              <Ionicons name="chevron-back" size={20} color={colors.ink} style={rtlFlip} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navButton} accessibilityRole="button" accessibilityLabel={t.common.nextMonth}>
              <Ionicons name="chevron-forward" size={20} color={colors.ink} style={rtlFlip} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekdayLetters(locale).map((w, i) => (
              <Text key={i} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((iso, i) => {
              if (!iso) return <View key={`e${i}`} style={styles.cell} />;
              const disabled = !!minDate && iso < minDate;
              const isStart = iso === selection.start;
              const isEnd = iso === selection.end;
              const inRange = !!selection.end && iso > selection.start && iso < selection.end;
              const selected = isStart || isEnd;
              return (
                <Pressable
                  key={iso}
                  disabled={disabled}
                  onPress={() => pick(iso)}
                  style={[styles.cell, inRange && styles.cellInRange]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={formatDay(iso, lang)}
                >
                  <View style={[styles.day, selected && styles.daySelected, iso === today && !selected && styles.dayToday]}>
                    <Text style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>
                      {parseDateOnly(iso).getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {mode === 'range' && (
            <View style={styles.footer}>
              <Text style={styles.summary} numberOfLines={1}>
                {rangeReady
                  ? `${formatDay(selection.start, lang)} → ${formatDay(selection.end!, lang)} · ${t.calendarHost.nightsCount(nightsBetween(selection.start, selection.end!))}`
                  : t.common.pickCheckOut}
              </Text>
              <Button label={t.common.done} onPress={() => rangeReady && onConfirm(selection)} disabled={!rangeReady} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FieldBox({ label, value, onPress, flex }: { label: string; value: string; onPress: () => void; flex?: boolean }) {
  return (
    <View style={[{ marginBottom: spacing.md }, flex && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.box, pressed && { borderColor: colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        <Text style={styles.boxText} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="calendar-outline" size={17} color={colors.inkFaint} />
      </Pressable>
    </View>
  );
}

/** One date — a cleaning's day, an expense's date. */
export function DateField({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
}) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <FieldBox label={label} value={formatDay(value, lang)} onPress={() => setOpen(true)} />
      <CalendarSheet
        visible={open}
        mode="single"
        initial={{ start: value, end: null }}
        minDate={minDate}
        onClose={() => setOpen(false)}
        onConfirm={(s) => {
          onChange(s.start);
          setOpen(false);
        }}
      />
    </>
  );
}

/** A stay — check-in and check-out picked on one calendar. */
export function DateRangeField({
  startLabel,
  endLabel,
  start,
  end,
  onChange,
  minDate,
}: {
  startLabel: string;
  endLabel: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  minDate?: string;
}) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={styles.rangeRow}>
        <FieldBox flex label={startLabel} value={formatDay(start, lang)} onPress={() => setOpen(true)} />
        <FieldBox flex label={endLabel} value={formatDay(end, lang)} onPress={() => setOpen(true)} />
      </View>
      <CalendarSheet
        visible={open}
        mode="range"
        initial={{ start, end }}
        minDate={minDate}
        onClose={() => setOpen(false)}
        onConfirm={(s) => {
          onChange(s.start, s.end!);
          setOpen(false);
        }}
      />
    </>
  );
}

const CELL = 44;

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { ...typography.h3, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', ...typography.caption, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: CELL, alignItems: 'center', justifyContent: 'center' },
  cellInRange: { backgroundColor: colors.green100 },
  day: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.lineStrong },
  dayText: { fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  dayTextSelected: { color: colors.onPrimary, fontWeight: '600' },
  dayTextDisabled: { color: colors.inkFaint, opacity: 0.5 },
  footer: { gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  summary: { ...typography.body, textAlign: 'center' },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.inkMuted, marginBottom: 6 },
  box: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  boxText: { fontSize: 15, color: colors.ink, flexShrink: 1 },
  rangeRow: { flexDirection: 'row', gap: spacing.sm },
});
