import { useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatClock } from '@/lib/dates';
import { rtlFlip } from '@/lib/rtl';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
const toHHmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Half-hour times from `from` to `to` (both "HH:mm", inclusive) — plus
 * `current` when it's off the grid (a 10:15 set on the website), so the
 * guest's actual request is always there to see and keep.
 */
export function timeSlots(from: string, to: string, current?: string | null) {
  const out: string[] = [];
  for (let m = toMinutes(from); m <= toMinutes(to); m += 30) out.push(toHHmm(m));
  if (current && !out.includes(current)) out.push(current);
  return out.sort((a, b) => toMinutes(a) - toMinutes(b));
}

/** "15:00" minus/plus half an hour, clamped to the day. */
export function shiftTime(hhmm: string, minutes: number) {
  return toHHmm(Math.min(23 * 60 + 30, Math.max(0, toMinutes(hhmm) + minutes)));
}

/**
 * One timing request on a stay: "Early check-in — 11:00". Tapping opens a
 * grid of times to pick the one the guest asked for, or "No request" to
 * clear it. Same values as the web calendar's time fields — they share
 * earlyCheckInTime / lateCheckOutTime on the API.
 */
export function TimeRequestRow({
  label,
  hint,
  value,
  slots,
  notAsked,
  clearLabel,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null | undefined;
  slots: string[];
  notAsked: string;
  clearLabel: string;
  disabled?: boolean;
  onChange: (time: string | null) => void;
}) {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  function pick(time: string | null) {
    setOpen(false);
    if (time !== (value ?? null)) onChange(time);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatClock(value, lang) : notAsked}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={typography.body}>{label}</Text>
          <Text style={typography.caption}>{hint}</Text>
        </View>
        <Text style={[styles.value, !value && styles.valueEmpty]}>{value ? formatClock(value, lang) : notAsked}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} style={rtlFlip} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onStartShouldSetResponder={() => true}>
            <Text style={typography.h2}>{label}</Text>
            <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{hint}</Text>
            <View style={styles.grid}>
              {slots.map((s) => {
                const selected = s === value;
                return (
                  <Pressable
                    key={s}
                    onPress={() => pick(s)}
                    style={({ pressed }) => [styles.slot, selected && styles.slotSelected, pressed && !selected && { backgroundColor: colors.surface2 }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.slotText, selected && styles.slotTextSelected]}>{formatClock(s, lang)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button label={clearLabel} variant="secondary" onPress={() => pick(null)} style={{ marginTop: spacing.md }} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  value: { fontSize: 15, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  valueEmpty: { fontWeight: '400', color: colors.inkFaint },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: '85%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  slot: {
    width: '22.5%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  slotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  slotTextSelected: { color: colors.onPrimary, fontWeight: '600' },
});
