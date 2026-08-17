import { View, Text, TextInput, StyleSheet, ActivityIndicator, TextInputProps, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';
import { useLanguage, Lang } from '@/lib/i18n/language-context';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{message}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={styles.emptyStateAction} hitSlop={8}>
          <Text style={styles.emptyStateActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Consistent error display with an optional retry — use instead of a hand-rolled red box. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.errorBannerRetry}>{t.common.retry}</Text>
        </Pressable>
      )}
    </View>
  );
}

const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'EN', label: 'English' },
  { value: 'FR', label: 'Français' },
  { value: 'AR', label: 'العربية' },
];

/** Drop this into any profile/settings screen to let the host or cleaner pick their language. */
export function LanguagePicker() {
  const { lang, setLang, t } = useLanguage();
  return (
    <View>
      <Text style={styles.fieldLabel}>{t.common.language}</Text>
      <SegmentedControl value={lang} onChange={setLang} options={LANGUAGE_OPTIONS} />
    </View>
  );
}

export function TextField({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'accent' | 'success' }) {
  return (
    <View style={[styles.badge, badgeTones[tone]]}>
      <Text style={[styles.badgeText, badgeTextTones[tone]]}>{label}</Text>
    </View>
  );
}

/** A row of mutually-exclusive pill options (e.g. role picker, urgency picker). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A toggleable pill, used for multi-select chip lists (cities, service types, etc). */
export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    ...typography.bodyMuted,
    textAlign: 'center',
  },
  emptyStateAction: {
    marginTop: spacing.md,
  },
  emptyStateActionText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    flex: 1,
  },
  errorBannerRetry: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  fieldLabel: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(27,31,35,0.05)',
    borderRadius: radius.full,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  segmentTextActive: { color: colors.primary },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.successBg, borderColor: colors.primary },
  chipText: { color: colors.inkMuted, fontWeight: '500', fontSize: 13 },
  chipTextActive: { color: colors.primary },
});

const badgeTones: Record<string, any> = {
  neutral: { backgroundColor: 'rgba(27,31,35,0.06)' },
  primary: { backgroundColor: colors.successBg },
  accent: { backgroundColor: colors.accentBg },
  success: { backgroundColor: colors.successBg },
};

const badgeTextTones: Record<string, any> = {
  neutral: { color: colors.inkMuted },
  primary: { color: colors.primary },
  accent: { color: '#B45309' },
  success: { color: colors.primary },
};
