import { useEffect, useRef } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, Animated } from 'react-native';
import { colors, elevation, radius, spacing } from '@/theme';
import { DURATIONS, EASING, usePressScale } from '@/lib/motion';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * Presses now scale down slightly instead of the old flat opacity dip, and
 * the label/spinner swap gets a quick fade rather than popping instantly —
 * small touches, but they're what make a tap register as "the app just
 * responded to me" instead of "the app changed a moment later."
 */
export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  const { onPressIn, onPressOut, style: pressStyle } = usePressScale(0.96);
  const contentFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(contentFade, {
        toValue: 0,
        duration: DURATIONS.fast,
        easing: EASING.accelerate,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: DURATIONS.base,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <Pressable onPress={onPress} disabled={isDisabled} onPressIn={onPressIn} onPressOut={onPressOut} style={style}>
      <Animated.View
        style={[
          styles.base,
          variantStyles[variant],
          variant !== 'outline' && styles.raised,
          isDisabled && styles.disabled,
          pressStyle,
        ]}
      >
        <Animated.View style={{ opacity: contentFade }}>
          {loading ? (
            <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.white} />
          ) : (
            <Text style={[styles.label, variant === 'outline' && styles.labelOutline]}>{label}</Text>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  raised: {
    ...elevation.low,
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  labelOutline: {
    color: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles: Record<string, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.accent },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
};
