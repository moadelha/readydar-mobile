import { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TextInputProps,
  Pressable,
  PressableProps,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
// Installed via expo-router (its direct dependency); Expo's own docs import
// header helpers from here the same way.
import { HeaderShownContext } from '@react-navigation/elements';
import Ionicons from '@expo/vector-icons/Ionicons';
import { appearancePref, colors, elevation, radius, spacing, typography } from '@/theme';
import { AppearancePref, setAppearancePref } from '@/lib/appearance';
import { useLanguage, Lang } from '@/lib/i18n/language-context';
import { downloadAndShare } from '@/lib/files';
import { DURATIONS, EASING, useEntrance, usePressScale } from '@/lib/motion';

/**
 * Every screen goes through here, so wrapping the shared KeyboardAvoidingView
 * once at this level is what actually keeps a focused TextInput visible above
 * the keyboard everywhere — forms that didn't have their own ad-hoc wrapper
 * (Add Expense, Add booking, Add check-in, etc.) previously had no keyboard
 * avoidance at all. `padding` on iOS / `height` on Android is the combination
 * that plays nicely with a ScrollView-based form on both platforms.
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
}: {
  children: React.ReactNode;
  /**
   * Which safe-area edges this screen consumes. Defaults to both.
   *
   * `bottom` matters because app.json sets `edgeToEdgeEnabled: true`, so the
   * app draws underneath Android's gesture/navigation bar. Without it, the
   * last element on a screen sits behind that bar — tapping it either does
   * nothing or triggers the system Back gesture instead, which is how the
   * "Share via WhatsApp" button became almost unhittable.
   *
   * Screens inside a tab navigator pass `['top']`: the tab bar already sits
   * in that space and pads itself, so consuming the inset again would leave
   * a second gap above it.
   */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  // When AppHeader is showing it already sits below the status bar, so the
  // content under it must not reserve that space a second time — that was
  // the extra gap visible under every screen title.
  const headerShown = useContext(HeaderShownContext);
  const effectiveEdges = headerShown ? edges.filter((e) => e !== 'top') : edges;
  return (
    <SafeAreaView style={styles.screen} edges={effectiveEdges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Base building block for every tactile surface in the app — a card,
 * a chip, a quick-action tile, a list row. Scales down slightly on press
 * (native-driver, so it stays smooth) instead of the old flat opacity-only
 * feedback, which is what makes tapping something feel like it *responded*
 * rather than the app just reacting a moment later.
 */
export function AnimatedPressable({
  children,
  style,
  scaleTo = 0.97,
  disabled,
  ...rest
}: Omit<PressableProps, 'children' | 'style'> & {
  children: React.ReactNode;
  style?: any;
  scaleTo?: number;
}) {
  const { onPressIn, onPressOut, style: pressStyle } = usePressScale(scaleTo);
  return (
    <Pressable disabled={disabled} onPressIn={onPressIn} onPressOut={onPressOut} {...rest}>
      <Animated.View style={[style, !disabled && pressStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Fades + gently rises content into place. Use for anything that should
 * feel like it's settling in rather than instantly appearing — pass an
 * increasing `delay` (e.g. `index * 40`) across a list to stagger it.
 */
export function Reveal({
  children,
  delay = 0,
  style,
  onLayout,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
  onLayout?: React.ComponentProps<typeof Animated.View>['onLayout'];
}) {
  const entrance = useEntrance(delay);
  return (
    <Animated.View style={[entrance, style]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

/**
 * The app's default surface. Now carries a soft resting shadow by default
 * (previously just a flat bordered box) so related content reads as
 * grouped and "above" the page rather than everything sitting at the same
 * visual level. Pass `onPress` to make the whole card a tactile, animated
 * pressable (replaces the old pattern of wrapping `<Card>` in a separate
 * `<Pressable>` — same result, plus the press-scale feedback). Pass
 * `elevated` for content that should stand out further, like a hero
 * summary card or the one item currently in focus.
 */
export function Card({
  children,
  style,
  onPress,
  elevated,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  elevated?: boolean;
}) {
  const cardStyle = [styles.card, elevated && styles.cardElevated, style];
  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} scaleTo={0.98} style={cardStyle}>
        {children}
      </AnimatedPressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

/**
 * A shimmering placeholder block — the building piece for skeleton loading
 * states. Prefer composing a screen-shaped skeleton (see `SkeletonListItem`
 * below) over a bare spinner wherever a screen's real content has a
 * recognizable shape; it reads as "this is loading and here's roughly
 * what's coming" instead of a jarring blank-then-full-content swap.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius: cornerRadius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: any;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, easing: EASING.standard, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, easing: EASING.standard, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Animated.View
      style={[{ width, height, borderRadius: cornerRadius, backgroundColor: colors.surface2 }, { opacity }, style]}
    />
  );
}

/** A skeleton shaped like the app's common "title + meta + trailing badge" list row (bookings, jobs). */
export function SkeletonListItem({ style }: { style?: any }) {
  return (
    <View style={[styles.card, { marginBottom: spacing.sm }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="55%" height={15} />
          <Skeleton width="38%" height={12} />
          <Skeleton width="30%" height={11} />
        </View>
        <Skeleton width={56} height={20} radius={10} />
      </View>
    </View>
  );
}

/** A skeleton shaped like a small stat tile (icon + label + big number). */
export function SkeletonStat({ style }: { style?: any }) {
  return (
    <View style={[styles.card, { alignItems: 'flex-start', gap: 8 }, style]}>
      <Skeleton width={18} height={18} radius={9} />
      <Skeleton width={54} height={11} />
      <Skeleton width={34} height={20} radius={5} />
    </View>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
  icon = 'file-tray-outline',
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const entrance = useEntrance(0, 6);
  return (
    <Animated.View style={[styles.emptyState, entrance]}>
      <Ionicons name={icon} size={22} color={colors.inkFaint} style={{ marginBottom: spacing.sm }} />
      <Text style={styles.emptyStateText}>{message}</Text>
      {actionLabel && onAction && (
        <AnimatedPressable onPress={onAction} scaleTo={0.95} style={styles.emptyStateAction}>
          <Text style={styles.emptyStateActionText}>{actionLabel}</Text>
        </AnimatedPressable>
      )}
    </Animated.View>
  );
}

/** Consistent error display with an optional retry — use instead of a hand-rolled red box. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  const entrance = useEntrance(0, 6);
  return (
    <Animated.View style={[styles.errorBanner, entrance]}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.errorBannerRetry}>{t.common.retry}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

/** The positive counterpart to `ErrorBanner` — inline confirmation for something that just succeeded. */
export function SuccessBanner({ message }: { message: string }) {
  const entrance = useEntrance(0, 6);
  return (
    <Animated.View style={[styles.successBanner, entrance]}>
      <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
      <Text style={styles.successBannerText}>{message}</Text>
    </Animated.View>
  );
}

/** A number that gently counts to its new value instead of jumping — use for stat tiles/totals. */
export function AnimatedNumber({ value, style }: { value: number; style?: any }) {
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: DURATIONS.slow,
      easing: EASING.decelerate,
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

/** The small icon a bottom tab renders, with a gentle pop + color shift when it becomes the active tab. */
export function TabIcon({
  name,
  focused,
  size = 22,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: focused ? 1 : 0.92,
      duration: DURATIONS.fast,
      easing: EASING.standard,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name} size={size} color={focused ? colors.primary : colors.inkMuted} />
    </Animated.View>
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

/**
 * System / Light / Dark. The palette is fixed for each run of the app (see
 * src/lib/appearance.ts), so picking a different one restarts the app.
 */
export function AppearancePicker() {
  const { t } = useLanguage();
  const [value, setValue] = useState<AppearancePref>(appearancePref);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.fieldLabel}>{t.common.appearance}</Text>
      <SegmentedControl
        value={value}
        onChange={(next) => {
          if (next === value) return;
          setValue(next);
          // Let the selection settle visibly before the restart.
          setTimeout(() => setAppearancePref(next), DURATIONS.base);
        }}
        options={[
          { value: 'system', label: t.common.appearanceSystem },
          { value: 'light', label: t.common.appearanceLight },
          { value: 'dark', label: t.common.appearanceDark },
        ]}
      />
    </View>
  );
}

/**
 * `isPassword` swaps a plain `secureTextEntry` field for one with a show/hide
 * eye toggle — hidden by default, tap to reveal. Use this instead of passing
 * `secureTextEntry` directly for any password field.
 */
export function TextField({
  label,
  isPassword,
  secureTextEntry,
  style,
  ...props
}: TextInputProps & { label: string; isPassword?: boolean }) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const actuallySecure = isPassword ? hidden : secureTextEntry;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <TextInput
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          secureTextEntry={actuallySecure}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.input, isPassword && styles.inputWithIcon, style]}
        />
        {isPassword && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} style={styles.eyeButton}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.inkFaint} />
          </Pressable>
        )}
      </View>
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

/** A row of mutually-exclusive pill options (e.g. role picker, urgency picker, language). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = containerWidth > 0 ? (containerWidth - 8) / options.length : 0;

  useEffect(() => {
    if (!segmentWidth) return;
    Animated.timing(indicatorX, {
      toValue: activeIndex * segmentWidth,
      duration: DURATIONS.base,
      easing: EASING.standard,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth, indicatorX]);

  return (
    <View style={styles.segmentRow} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {segmentWidth > 0 && (
        <Animated.View
          style={[styles.segmentIndicator, { width: segmentWidth, transform: [{ translateX: indicatorX }] }]}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={styles.segment}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A toggleable pill, used for multi-select chip lists (cities, service types, category filters). */
export function Chip({
  label,
  active,
  onPress,
  imageUrl,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Optional leading thumbnail — used by the property picker so a host can pick by sight, not just by name. */
  imageUrl?: string | null;
}) {
  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.95} style={[styles.chip, active && styles.chipActive]}>
      {imageUrl && <Image source={{ uri: imageUrl }} style={styles.chipImage} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

/** A simple square checkbox — used for the Terms & Conditions acceptance on sign-up. */
export function Checkbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <AnimatedPressable
      onPress={() => onChange(!checked)}
      scaleTo={0.94}
      hitSlop={8}
      style={[styles.checkbox, checked && styles.checkboxChecked]}
    >
      {checked && <Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
    </AnimatedPressable>
  );
}

/**
 * Full-screen viewer for a single uploaded photo (a guest's ID photo, a
 * before/after job photo, a door photo, etc) — tap a thumbnail to open,
 * tap anywhere (or the close button) to dismiss. `uri` is expected to
 * already be a fully-resolved, directly-loadable URL (see
 * `resolveUploadUrl` in `src/lib/api.ts`).
 *
 * The share/download button saves this exact photo through the native
 * share sheet (see `downloadAndShare` in `src/lib/files.ts`) — no auth
 * header needed here since photo URLs (Cloudinary) are publicly readable.
 */
export function PhotoViewerModal({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!uri || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadAndShare(uri, `photo-${Date.now()}.jpg`, 'image/jpeg');
    } catch {
      Alert.alert('Could not save photo', 'Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewerBackdrop} onPress={onClose}>
        {uri && <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />}
        <View style={styles.viewerActions}>
          <Pressable onPress={handleDownload} hitSlop={12} style={styles.viewerActionButton} disabled={isDownloading}>
            {isDownloading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Ionicons name="share-outline" size={22} color={colors.onPrimary} />
            )}
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12} style={styles.viewerActionButton}>
            <Ionicons name="close" size={26} color={colors.onPrimary} />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
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
  cardElevated: {
    ...elevation.medium,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
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
    color: colors.green700,
    fontWeight: '500',
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  errorBannerRetry: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.green100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  successBannerText: {
    color: colors.success,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.inkMuted,
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: 8,
    padding: 3,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    ...elevation.medium,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: colors.inkMuted },
  segmentTextActive: { color: colors.ink },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  // Left padding tightens when a thumbnail leads the chip, so the image sits
  // just inside the chip rather than floating in a wide gutter.
  chipImage: { width: 22, height: 22, borderRadius: 4, marginLeft: -4 },
  chipActive: { backgroundColor: colors.green100, borderColor: colors.primary },
  chipText: { color: colors.inkMuted, fontWeight: '500', fontSize: 13 },
  chipTextActive: { color: colors.primary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,16,14,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
  viewerActions: {
    position: 'absolute',
    top: 48,
    right: 20,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  viewerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const badgeTones: Record<string, any> = {
  neutral: { backgroundColor: colors.surface2 },
  primary: { backgroundColor: colors.green100 },
  accent: { backgroundColor: colors.warningBg },
  success: { backgroundColor: colors.successBg },
};

const badgeTextTones: Record<string, any> = {
  neutral: { color: colors.inkMuted },
  primary: { color: colors.primary },
  accent: { color: colors.warning },
  success: { color: colors.success },
};
