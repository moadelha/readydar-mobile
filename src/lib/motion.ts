/**
 * Small, dependency-free animation toolkit built entirely on React Native's
 * built-in `Animated` API — no Reanimated/gesture-handler. That's a
 * deliberate choice: this project ships UI-only changes over the air via
 * `eas update`, and pulling in a native animation library would mean none
 * of this becomes visible until a brand-new `eas build` + reinstall, the
 * same friction the SDK 55 upgrade just caused. Everything here uses only
 * `transform`/`opacity`, so every animation runs on the native thread
 * (`useNativeDriver: true`) and stays smooth even while JS is busy.
 *
 * Keep new micro-interactions built on these primitives (or the constants
 * below) rather than one-off `Animated.timing` calls scattered per screen —
 * that's what keeps the whole app feeling like one consistent system.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { motion } from '@/theme';

export const DURATIONS = motion.duration;

export const EASING = {
  /** Default for anything that isn't explicitly entering or leaving. */
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  /** Content arriving — starts fast, settles gently. Use for entrances. */
  decelerate: Easing.out(Easing.cubic),
  /** Content leaving — starts gentle, exits with a bit more speed. */
  accelerate: Easing.in(Easing.cubic),
};

/**
 * Scale-down-on-press feedback for any pressable surface — cards, buttons,
 * chips, list rows. Spread `onPressIn`/`onPressOut` onto a `Pressable` and
 * apply `style` to the `Animated.View` wrapping its visible content (see
 * `AnimatedPressable` in `src/components/ui.tsx`, which does exactly this).
 */
export function usePressScale(toValue = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.timing(scale, {
      toValue,
      duration: DURATIONS.fast,
      easing: EASING.standard,
      useNativeDriver: true,
    }).start();
  }

  function onPressOut() {
    Animated.timing(scale, {
      toValue: 1,
      duration: DURATIONS.base,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start();
  }

  return { onPressIn, onPressOut, scale, style: { transform: [{ scale }] } };
}

/**
 * Gentle fade + rise entrance for content that should feel like it's
 * settling into place rather than popping in — dashboard sections, list
 * rows, card grids. Pass an increasing `delay` per item (e.g. `index * 40`)
 * to stagger a list's entrance instead of everything appearing at once.
 * Capped internally so a long list doesn't end up waiting seconds to finish.
 */
export function useEntrance(delay = 0, distance = 10) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATIONS.slow,
      delay: Math.min(delay, 400),
      easing: EASING.decelerate,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Deliberately runs once on mount only — this animates a screen/item
    // appearing, not a value that should keep re-animating on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  };
}

/**
 * Cross-fades between two render states (e.g. a spinner and a label inside
 * a button, or an old value and a new one) instead of an abrupt swap.
 * Returns an opacity Animated.Value already wired to `deps` changes.
 */
export function useCrossFade(key: unknown) {
  const opacity = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: DURATIONS.base,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return opacity;
}
