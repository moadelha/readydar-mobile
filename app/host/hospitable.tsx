import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Linking, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, HospitableListing, resolveThumbnailUrl } from '@/lib/api';
import { Screen, Card, ErrorBanner, Reveal, AnimatedPressable } from '@/components/ui';
import { Button } from '@/components/Button';
import { useToast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function HospitableConnectScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [listings, setListings] = useState<HospitableListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!session) return;
    setError(null);
    setIsConnecting(true);
    try {
      const { return_url } = await api.hospitable.connect(session.accessToken);
      await Linking.openURL(return_url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the Airbnb connection.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSync() {
    if (!session) return;
    setError(null);
    setIsSyncing(true);
    try {
      const result = await api.hospitable.sync(session.accessToken);
      const found = await api.hospitable.listListings(session.accessToken);
      setListings(found);
      if (result.propertiesCreated > 0 || result.reservationsCreated > 0 || result.datesBlocked > 0) {
        const parts = [
          `${result.propertiesCreated} new propert${result.propertiesCreated === 1 ? 'y' : 'ies'}`,
          `${result.reservationsCreated} new stay${result.reservationsCreated === 1 ? '' : 's'}`,
        ];
        if (result.datesBlocked > 0) {
          parts.push(`${result.datesBlocked} blocked date range${result.datesBlocked === 1 ? '' : 's'}`);
        }
        toast.show(`Synced Airbnb — ${parts.join(', ')}`, 'success');
      } else {
        toast.show('Everything is already up to date.', 'success');
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not sync with Hospitable — make sure your Airbnb account is connected first.',
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Connect Airbnb', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Reveal>
          <Text style={typography.h1}>Connect Airbnb</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
            ReadyDar uses Hospitable to link directly to your Airbnb account, so your listings and reservations
            import automatically instead of being entered by hand.
          </Text>
        </Reveal>

        {error && <ErrorBanner message={error} />}

        <Reveal delay={40}>
          <Card style={{ marginTop: spacing.lg }}>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <Text style={typography.h3}>Connect your Airbnb account</Text>
            </View>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
              Opens in your browser — Hospitable's own secure page, not ReadyDar. Once you've authorized it there,
              come back to this screen and tap "Sync now" below.
            </Text>
            <Button
              label={isConnecting ? 'Opening…' : 'Connect Airbnb account'}
              onPress={handleConnect}
              loading={isConnecting}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Reveal>

        <Reveal delay={80}>
          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={typography.h3}>Import your listings</Text>
            </View>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
              Pulls in every connected Airbnb listing as a property, plus its upcoming reservations and any dates
              you've blocked on Airbnb. This also happens automatically in the background as new bookings come in —
              tap this any time you want it to happen right now instead of waiting.
            </Text>
            <Button
              label={isSyncing ? 'Syncing…' : 'Sync now'}
              onPress={handleSync}
              loading={isSyncing}
              variant="outline"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Reveal>

        {listings && (
          <Reveal delay={120}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>
                Found on Airbnb ({listings.length})
              </Text>
              <Pressable onPress={() => setListings(null)} hitSlop={8}>
                <Text style={styles.dismissText}>Hide</Text>
              </Pressable>
            </View>
            {listings.length === 0 ? (
              <Card>
                <Text style={typography.bodyMuted}>No listings found yet — connect your Airbnb account above first.</Text>
              </Card>
            ) : (
              listings.map((listing) => (
                <Card key={listing.id} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.listingRow}>
                    {listing.picture ? (
                      <Image source={{ uri: resolveThumbnailUrl(listing.picture, 80) }} style={styles.listingThumb} />
                    ) : (
                      <View style={[styles.listingThumb, styles.listingThumbPlaceholder]}>
                        <Ionicons name="home-outline" size={18} color={colors.inkFaint} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={typography.body}>{listing.public_name || listing.private_name || 'Airbnb listing'}</Text>
                      {listing.address?.city && <Text style={typography.caption}>{listing.address.city}</Text>}
                    </View>
                  </View>
                </Card>
              ))
            )}
          </Reveal>
        )}

        <Reveal delay={160}>
          <AnimatedPressable
            onPress={() => router.push('/(host-tabs)/properties')}
            scaleTo={0.98}
            style={styles.infoRow}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
            <Text style={[typography.bodyMuted, { flex: 1 }]}>
              Imported properties show an "Airbnb" tag on the Properties tab. Their name, address, and room counts
              stay in sync with Airbnb automatically — edit those on Airbnb, not here. Each new Airbnb reservation
              also gets its own check-in link automatically, ready to send to the guest from the property page.
            </Text>
          </AnimatedPressable>
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.h3 },
  dismissText: { color: colors.inkFaint, fontSize: 13, fontWeight: '600' },
  listingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listingThumb: { width: 44, height: 44, borderRadius: 10 },
  listingThumbPlaceholder: { backgroundColor: 'rgba(27,31,35,0.06)', alignItems: 'center', justifyContent: 'center' },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
