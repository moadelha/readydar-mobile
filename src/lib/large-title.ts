import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * A large page title that hands over to the header as it scrolls away, the
 * way iOS does it. Screens used to print the same words twice — "Guest
 * online check-in" in the header and again as the heading right under it.
 * Now the header stays empty while the heading is on screen and picks the
 * title up once it's scrolled past.
 *
 *   const largeTitle = useLargeTitle();
 *   <Stack.Screen options={{ title: largeTitle.headerTitle(name) }} />
 *   <ScrollView {...largeTitle.scrollProps}>
 *     <Text style={typography.h1} {...largeTitle.titleProps}>{name}</Text>
 *
 * With `titleProps` on the heading, the hand-over happens where the heading
 * really ends — which matters when something (a cover photo) sits above it.
 * Without it, `fallbackThreshold` assumes the heading is the first thing.
 * `titleProps` must go on a direct child of the scroll content, since its
 * layout y is read as a scroll offset.
 */
export function useLargeTitle(fallbackThreshold = 44) {
  const [collapsed, setCollapsed] = useState(false);
  const titleBottom = useRef<number | null>(null);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const threshold = titleBottom.current ?? fallbackThreshold;
      const next = e.nativeEvent.contentOffset.y > threshold;
      setCollapsed((prev) => (prev === next ? prev : next));
    },
    [fallbackThreshold],
  );
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    titleBottom.current = y + height * 0.6;
  }, []);
  return {
    collapsed,
    headerTitle: (title: string) => (collapsed ? title : ''),
    scrollProps: { onScroll, scrollEventThrottle: 16 },
    titleProps: { onLayout },
  };
}
