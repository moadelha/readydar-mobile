import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/text';
import { colors } from '@/theme';

/**
 * A small round badge for the channel a conversation or booking came from —
 * the mobile twin of the web app's ChannelMark. Brand colour plus initial
 * rather than the real logos, so no trademark artwork ships in the app.
 */
const CHANNELS: Record<string, { bg: string; letter: string }> = {
  AIRBNB: { bg: colors.channel.airbnb, letter: 'A' },
  BOOKING_COM: { bg: colors.channel.booking, letter: 'B' },
  EXPEDIA: { bg: colors.channel.expedia, letter: 'E' },
};

export function ChannelMark({ provider, size = 40 }: { provider: string; size?: number }) {
  const channel = CHANNELS[provider] ?? { bg: colors.inkFaint, letter: provider.charAt(0).toUpperCase() || '?' };
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2, backgroundColor: channel.bg }]}>
      <Text style={[styles.letter, { fontSize: size * 0.42, color: provider === 'EXPEDIA' ? colors.green950 : colors.onPrimary }]}>
        {channel.letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '600' },
});
