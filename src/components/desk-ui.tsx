import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/theme';
import { addDaysIso } from '@/lib/calendar-visuals';

/**
 * Small pieces shared by the hostel desk screens (new stay, cash, meals and
 * activities): a number stepper, a row of day chips, and the desk's
 * shortcut buttons.
 */

/** "–  3  +" with a label, 44pt targets. */
export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  fewerLabel,
  moreLabel,
}: {
  label?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  fewerLabel: string;
  moreLabel: string;
}) {
  return (
    <View style={styles.stepperWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={[styles.stepButton, value <= min && { opacity: 0.35 }]}
          accessibilityRole="button"
          accessibilityLabel={fewerLabel}
          hitSlop={4}
        >
          <Ionicons name="remove" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.stepValue} accessibilityLabel={label ? `${label}: ${value}` : String(value)}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={[styles.stepButton, value >= max && { opacity: 0.35 }]}
          accessibilityRole="button"
          accessibilityLabel={moreLabel}
          hitSlop={4}
        >
          <Ionicons name="add" size={18} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

/** Today, tomorrow and the next days as a scrolling row of chips. */
export function DayChips({
  today,
  value,
  onChange,
  count = 7,
  labelOf,
}: {
  today: string;
  value: string;
  onChange: (d: string) => void;
  count?: number;
  /** The chip's text for a day that's i days from today. */
  labelOf: (day: string, i: number) => string;
}) {
  const days = Array.from({ length: count }, (_, i) => addDaysIso(today, i));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
      {days.map((d, i) => {
        const active = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            style={[styles.dayChip, active && styles.dayChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.dayText, active && styles.dayTextActive]}>{labelOf(d, i)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** One of the desk's shortcuts: icon over a short label. */
export function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && { backgroundColor: colors.surface2 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={colors.green700} />
      <Text style={styles.quickText} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A label + value line in a summary card ("Cash in   1 200 MAD"). */
export function AmountLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.amountLine}>
      <Text style={[styles.amountLabel, strong && { color: colors.ink, fontWeight: '600' }]}>{label}</Text>
      <Text style={[styles.amountValue, strong && styles.amountStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.ink, marginBottom: spacing.sm },
  stepperWrap: { flex: 1, marginBottom: spacing.md },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  stepButton: { width: 44, height: 46, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 17, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  dayRow: { gap: spacing.sm, paddingVertical: 2 },
  dayChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 14, fontWeight: '500', color: colors.ink },
  dayTextActive: { color: colors.onPrimary },
  quick: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  quickText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  amountLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 6, gap: spacing.md },
  amountLabel: { fontSize: 14, color: colors.inkMuted, flexShrink: 1 },
  amountValue: { fontSize: 15, fontWeight: '500', color: colors.ink, fontVariant: ['tabular-nums'] },
  amountStrong: { fontSize: 20, fontWeight: '700' },
});
