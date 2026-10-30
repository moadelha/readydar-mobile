import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { colors, typography } from '@/theme';
import { rtlFlip } from '@/lib/rtl';

/**
 * The header for every pushed/modal screen, registered once as the root
 * Stack's `header` option in app/_layout.tsx. Screens keep configuring it
 * the usual way — `headerShown`, `title`, `headerRight` via <Stack.Screen>.
 *
 * Why not the native header: with `edgeToEdgeEnabled` on this Expo/
 * react-native-screens combination, the native Android header lays itself
 * out from y=0 — under the status bar, title level with the clock and the
 * back arrow buried among the notification icons — and seeding
 * SafeAreaProvider with initialWindowMetrics didn't change that on device.
 * This header pads itself by the measured top inset instead, the same
 * mechanism that already puts the tab screens correctly below the bar.
 *
 * <Screen> reads HeaderShownContext and drops its own top inset whenever
 * this header is showing, so the space isn't reserved twice.
 */
export function AppHeader({ navigation, options, route, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const title =
    typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name);
  const right = options.headerRight?.({ tintColor: colors.primary, canGoBack: !!back });

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {back ? (
          <Pressable
            onPress={navigation.goBack}
            hitSlop={12}
            style={styles.side}
            accessibilityRole="button"
            accessibilityLabel={options.headerBackTitle ?? 'Back'}
          >
            <Ionicons name="arrow-back" size={24} color={colors.ink} style={rtlFlip} />
          </Pressable>
        ) : (
          <View style={styles.sideEmpty} />
        )}
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.sand,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sideEmpty: { width: 8 },
  title: { ...typography.h3, fontSize: 17, flex: 1, color: colors.ink },
  right: { minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingRight: 8 },
});
