import { Pressable, StyleSheet, ActivityIndicator, ViewStyle, Animated, View } from 'react-native';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/theme';
import { usePressScale, useCrossFade } from '@/lib/motion';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * DESIGN.md buttons: 6px corners, flat, medium weight. Primary is the Atlas
 * green fill (one per view); secondary and outline are the quiet white
 * button with a strong hairline; danger is for destructive confirmations.
 * A press darkens the fill and settles the button 2% — no glow, no bounce.
 */
export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  const { onPressIn, onPressOut, style: pressStyle } = usePressScale(0.98);
  const contentOpacity = useCrossFade(loading);
  const filled = variant === 'primary' || variant === 'danger';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={style}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.base,
            variantStyles[variant],
            pressed && pressedStyles[variant],
            isDisabled && styles.disabled,
            pressStyle,
          ]}
        >
          <Animated.View style={{ opacity: contentOpacity }}>
            {loading ? (
              <ActivityIndicator color={filled ? colors.onPrimary : colors.primary} />
            ) : (
              <View style={styles.row}>
                <Text style={[styles.label, !filled && styles.labelQuiet]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  labelQuiet: {
    color: colors.ink,
  },
  disabled: {
    opacity: 0.45,
  },
});

const variantStyles: Record<string, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineStrong },
  outline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineStrong },
  danger: { backgroundColor: colors.danger },
};

const pressedStyles: Record<string, ViewStyle> = {
  primary: { backgroundColor: colors.green800 },
  secondary: { backgroundColor: colors.surface2 },
  outline: { backgroundColor: colors.surface2 },
  danger: { backgroundColor: colors.dangerStrong },
};
