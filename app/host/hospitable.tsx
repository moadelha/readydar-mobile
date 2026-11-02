import { useState } from 'react';
import { View, StyleSheet, ScrollView, Image, Linking, Pressable } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, HospitableListing, resolveThumbnailUrl } from '@/lib/api';
import { Screen, Card, ErrorBanner, Reveal, AnimatedPressable } from '@/components/ui';
import { Button } from '@/components/Button';
import { useToast } from '@/lib/toast';
import { colors, spacing, typography, radius } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useHostAccess } from '@/lib/access';
import { NoAccess } from '@/components/no-access';
import { useLanguage } from '@/lib/i18n/language-context';
import { useLargeTitle } from '@/lib/large-title';

function HospitableConnectInner() {
  const largeTitle = useLargeTitle();
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  const c = t.connectAirbnb;
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
      setError(err instanceof ApiError ? err.message : c.errorConnect);
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
        toast.show(c.synced(result.propertiesCreated, result.reservationsCreated, result.datesBlocked), 'success');
      } else {
        toast.show(c.upToDate, 'success');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : c.errorSync);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: largeTitle.headerTitle(c.title), headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container} {...largeTitle.scrollProps}>
        <Reveal>
          <Text style={typography.h1}>{c.title}</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{c.intro}</Text>
          {/* Said plainly up front: hosts have assumed a block made here reaches Airbnb. */}
          <View style={styles.oneWay}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.warning} />
            <Text style={[typography.body, { flex: 1 }]}>{c.oneWayNote}</Text>
          </View>
        </Reveal>

        {error && <ErrorBanner message={error} />}

        <Reveal delay={40}>
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={typography.h3}>{c.step1Title}</Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{c.step1Body}</Text>
            <Button
              label={isConnecting ? c.opening : c.connectButton}
              onPress={handleConnect}
              loading={isConnecting}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Reveal>

        <Reveal delay={80}>
          <Card style={{ marginTop: spacing.md }}>
            <Text style={typography.h3}>{c.step2Title}</Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{c.step2Body}</Text>
            <Button
              label={isSyncing ? c.syncing : c.syncNow}
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
                {c.foundOnAirbnb(listings.length)}
              </Text>
              <Pressable onPress={() => setListings(null)} hitSlop={8}>
                <Text style={styles.dismissText}>{c.hide}</Text>
              </Pressable>
            </View>
            {listings.length === 0 ? (
              <Card>
                <Text style={typography.bodyMuted}>{c.noListings}</Text>
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
                      <Text style={typography.body}>{listing.public_name || listing.private_name || c.listingFallback}</Text>
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
            <Text style={[typography.bodyMuted, { flex: 1 }]}>{c.footer}</Text>
          </AnimatedPressable>
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  oneWay: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
  },
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
  listingThumbPlaceholder: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

// Owner-only: every Airbnb-connect route acts on the caller's own Hospitable
// customer, so for any co-host it would link or query the wrong account.
// See HospitableConnectController.
// Wrapped rather than early-returned so the real screen's hooks and
// API calls never run for someone without access.
export default function HospitableConnectScreen() {
  const { isOwner } = useHostAccess();
  return isOwner ? <HospitableConnectInner /> : <NoAccess />;
}
