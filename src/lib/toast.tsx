/**
 * App-wide toast notifications — the "confirmation feedback" piece of the
 * redesign. Mounted once in `app/_layout.tsx` via `ToastProvider`; any
 * screen calls `useToast().show('Expense deleted')` instead of an ad-hoc
 * inline banner or a jarring native `Alert` for things that succeeded.
 * Slides/fades in from the top, auto-dismisses, and can be tapped away —
 * built on the same `Animated` primitives as everything else in
 * `src/lib/motion.ts`, no new dependency.
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing } from '@/theme';
import { DURATIONS, EASING } from './motion';

type ToastKind = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const TONE: Record<ToastKind, string> = {
  success: colors.primary,
  error: colors.danger,
  info: colors.ink,
};

let nextToastId = 1;
const AUTO_DISMISS_MS = 2800;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: DURATIONS.base,
      easing: EASING.accelerate,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [anim]);

  const show = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setToast({ id: nextToastId++, message, kind });
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: DURATIONS.base,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }).start();
      timeoutRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [anim, dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.host,
            {
              top: insets.top + spacing.sm,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            style={[styles.toast, elevation.high, { borderLeftColor: TONE[toast.kind] }]}
            onPress={dismiss}
          >
            <Ionicons name={ICONS[toast.kind]} size={19} color={TONE[toast.kind]} />
            <Text style={styles.toastText} numberOfLines={2}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  toastText: {
    flex: 1,
    fontSize: 13.5,
    color: colors.ink,
    fontWeight: '500',
  },
});
