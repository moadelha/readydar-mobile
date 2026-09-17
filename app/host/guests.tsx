import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Linking, Alert } from 'react-native';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, AllCheckIn, resolveThumbnailUrl, resolveCheckInUrl } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, TextField, ErrorBanner, StatusBadge } from '@/components/ui';
import { Button } from '@/components/Button';
import { PropertyThumb } from '@/components/host-ui';
import { useToast } from '@/lib/toast';
import { bucketOf, groupByMonth, stayLabel, CheckInBucket, MonthGroup } from '@/lib/checkin-groups';
import { colors, spacing, typography, radius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

/**
 * The three sections this screen is built around.
 *
 * Grouping by *property* (the previous design) turned out not to be how a
 * host uses this screen: `/checkins/all` returns a 60-day-back window across
 * every property, so each property group was a mixed bag of links still
 * waiting on a guest, submissions already dealt with, and dead links from
 * months ago — with no way to get at just the ones needing action. Status
 * first, month second, matches what the host is actually looking for.
 */
const SECTIONS: {
  key: CheckInBucket;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}[] = [
  {
    key: 'UPCOMING',
    title: 'Upcoming',
    subtitle: 'Links still waiting on the guest',
    icon: 'key-outline',
    tint: colors.accentBg,
  },
  {
    key: 'SUBMITTED',
    title: 'Submitted by guest',
    subtitle: 'Details received — ID, contract and PDF on the property page',
    icon: 'checkmark-circle-outline',
    tint: colors.successBg,
  },
  {
    key: 'EXPIRED',
    title: 'Expired',
    subtitle: 'The stay has passed and the link no longer works',
    icon: 'time-outline',
    tint: 'rgba(27,31,35,0.06)',
  },
];

const CHECKIN_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting guest',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Expired',
};
const CHECKIN_STATUS_TONE: Record<string, 'neutral' | 'primary' | 'accent' | 'success'> = {
  PENDING: 'accent',
  SUBMITTED: 'success',
  EXPIRED: 'neutral',
};

function guestLabel(item: AllCheckIn) {
  if (item.guestFirstName) return `${item.guestFirstName} ${item.guestLastName ?? ''}`.trim();
  return item.guestNameHint || 'Guest';
}

export default function GuestsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [checkIns, setCheckIns] = useState<AllCheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Which status sections are expanded. Upcoming is the one worth opening on arrival. */
  const [openSections, setOpenSections] = useState<Record<CheckInBucket, boolean>>({
    UPCOMING: true,
    SUBMITTED: false,
    EXPIRED: false,
  });
  /**
   * Explicitly-toggled month groups, keyed `SECTION:YYYY-MM`. A month that
   * isn't in here falls back to its default (the nearest month in each
   * section opens; the rest stay shut), which is why this is a sparse record
   * rather than a complete open/closed map.
   */
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const data = await api.checkins.listAll(session.accessToken);
      setCheckIns(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load guest check-ins.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Each section's check-ins, bucketed by month. */
  const sectionGroups = useMemo(() => {
    const now = Date.now();
    const byBucket: Record<CheckInBucket, AllCheckIn[]> = { UPCOMING: [], SUBMITTED: [], EXPIRED: [] };
    for (const item of checkIns) byBucket[bucketOf(item, now)].push(item);

    const result = {} as Record<CheckInBucket, { total: number; months: MonthGroup<AllCheckIn>[] }>;
    for (const section of SECTIONS) {
      const items = byBucket[section.key];
      result[section.key] = {
        total: items.length,
        // Submitted check-ins are filed by when the stay happened, same as
        // the others — a host looking for "who stayed in July" wants the
        // stay's month, not the date the form happened to be filled in.
        months: groupByMonth(items, (i) => i.expectedCheckIn),
      };
    }
    return result;
  }, [checkIns]);

  function toggleSection(key: CheckInBucket) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isMonthOpen(sectionKey: CheckInBucket, group: MonthGroup<AllCheckIn>, index: number) {
    return openMonths[`${sectionKey}:${group.key}`] ?? index === 0;
  }

  function toggleMonth(sectionKey: CheckInBucket, group: MonthGroup<AllCheckIn>, index: number) {
    const key = `${sectionKey}:${group.key}`;
    const current = isMonthOpen(sectionKey, group, index);
    setOpenMonths((prev) => ({ ...prev, [key]: !current }));
  }

  async function handleCopyLink(item: AllCheckIn) {
    const url = resolveCheckInUrl(item.token);
    await Clipboard.setStringAsync(url);
    setCopiedId(item.id);
    toast.show('Check-in link copied');
    setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 2000);
  }

  /**
   * Permanently deletes a check-in link.
   *
   * Only ever offered on a link the guest hasn't submitted — see the guard
   * at the call site. A SUBMITTED check-in holds the guest's ID photos and
   * (where contract signing is on) their signed contract, which is the
   * host's only copy and may be a legal retention obligation; the backend
   * endpoint would delete those too, so mobile simply never offers it there.
   */
  async function handleDeleteCheckIn(item: AllCheckIn) {
    if (!session) return;
    const label = item.guestNameHint?.trim() || 'this guest';
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Delete check-in link?',
        `The link for ${label} at ${item.property.name} will stop working and can't be recovered. The guest hasn't submitted anything yet, so no guest details are lost.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!confirmed) return;

    setError(null);
    setBusyId(item.id);
    try {
      await api.properties.deleteGuestCheckIn(item.id, session.accessToken);
      // Drop it locally rather than refetching — clearing a run of stale
      // links shouldn't cost a round-trip each.
      setCheckIns((prev) => prev.filter((c) => c.id !== item.id));
      toast.show('Check-in link deleted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that check-in link.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleShareCheckIn(item: AllCheckIn) {
    setBusyId(item.id);
    try {
      const url = resolveCheckInUrl(item.token);
      // Naming the stay's date matters for a guest with more than one
      // booking, or one made months ahead.
      const arriving = new Date(item.expectedCheckIn).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const text = `Hi! Please complete your online check-in for ${item.property.name}, arriving ${arriving}: ${url}`;
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleExpandWelcome(item: AllCheckIn) {
    if (!session) return;
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    setError(null);
    setIsPreviewLoading(true);
    try {
      const { text } = await api.guestWelcome.preview(item.id, session.accessToken);
      setPreviewText(text);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the message preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleSendWelcome(item: AllCheckIn) {
    if (!session) return;
    setError(null);
    setBusyId(item.id);
    try {
      const { whatsapp } = await api.guestWelcome.send(item.id, previewText, session.accessToken);
      if (!whatsapp.sent && whatsapp.waLink) {
        await Linking.openURL(whatsapp.waLink);
        await api.guestWelcome.acknowledge(item.id, session.accessToken);
      }
      setExpandedId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the welcome message.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenReadyWelcome(item: AllCheckIn) {
    if (!session || !item.welcomeWaLink) return;
    setError(null);
    setBusyId(item.id);
    try {
      await Linking.openURL(item.welcomeWaLink);
      await api.guestWelcome.acknowledge(item.id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open WhatsApp.');
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Guests', headerBackTitle: 'Back' }} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={typography.bodyMuted}>
          Every guest check-in, grouped by what still needs doing and then by month.
        </Text>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {checkIns.length === 0 ? (
          <Card style={{ marginTop: spacing.lg }}>
            <EmptyState message="No guest check-ins yet. They'll show up here as soon as you create a check-in link for a property." />
            <Pressable onPress={() => router.push('/(host-tabs)/properties')} style={styles.linkAction}>
              <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.linkText}>Start a guest's online check-in from a property</Text>
            </Pressable>
          </Card>
        ) : (
          SECTIONS.map((section) => {
            const group = sectionGroups[section.key];
            const open = openSections[section.key];
            return (
              <Card key={section.key} style={styles.sectionCard}>
                <Pressable onPress={() => toggleSection(section.key)} style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: section.tint }]}>
                    <Ionicons name={section.icon} size={16} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>
                      {section.title} · {group.total}
                    </Text>
                    <Text style={typography.caption}>{section.subtitle}</Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkFaint} />
                </Pressable>

                {open &&
                  (group.total === 0 ? (
                    <Text style={styles.sectionEmpty}>Nothing here.</Text>
                  ) : (
                    group.months.map((monthGroup, monthIndex) => {
                      const monthOpen = isMonthOpen(section.key, monthGroup, monthIndex);
                      return (
                        <View key={monthGroup.key} style={styles.monthBlock}>
                          <Pressable
                            onPress={() => toggleMonth(section.key, monthGroup, monthIndex)}
                            style={styles.monthHeader}
                          >
                            <Ionicons
                              name={monthOpen ? 'chevron-down' : 'chevron-forward'}
                              size={15}
                              color={colors.primary}
                            />
                            <Text style={styles.monthLabel}>{monthGroup.label}</Text>
                            <Text style={styles.monthCount}>{monthGroup.items.length}</Text>
                          </Pressable>

                          {monthOpen &&
                            monthGroup.items.map((item) => (
                              <View key={item.id} style={styles.checkinRow}>
                                <View style={styles.row}>
                                  <PropertyThumb
                                    photoUrl={
                                      item.property.photoUrl ? resolveThumbnailUrl(item.property.photoUrl, 130) : null
                                    }
                                    size={44}
                                  />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.guestName} numberOfLines={1}>
                                      {guestLabel(item)}
                                    </Text>
                                    <Text style={typography.caption} numberOfLines={1}>
                                      {item.property.name}
                                    </Text>
                                    <Text style={styles.stayLine}>
                                      {stayLabel(item)}
                                      {item.guestCount > 1 ? ` · ${item.guestCount} guests` : ''}
                                    </Text>
                                  </View>
                                  <StatusBadge
                                    label={CHECKIN_STATUS_LABEL[item.status] ?? item.status}
                                    tone={CHECKIN_STATUS_TONE[item.status] ?? 'neutral'}
                                  />
                                </View>

                                {/* Actions hang off the *section*, not the stored
                                    status: a link in Expired is still PENDING on
                                    the server, but offering to share it would be
                                    sending a guest a link that no longer works. */}
                                {section.key === 'UPCOMING' && (
                                  <View style={styles.actionRow}>
                                    <Button
                                      label={copiedId === item.id ? 'Copied!' : 'Copy link'}
                                      onPress={() => handleCopyLink(item)}
                                      variant="outline"
                                    />
                                    <Button
                                      label={busyId === item.id ? 'Opening…' : 'Share via WhatsApp'}
                                      onPress={() => handleShareCheckIn(item)}
                                      loading={busyId === item.id}
                                      variant="secondary"
                                      style={{ marginTop: spacing.sm }}
                                    />
                                    <Pressable
                                      style={styles.deleteRow}
                                      onPress={() => handleDeleteCheckIn(item)}
                                      disabled={busyId === item.id}
                                    >
                                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                                      <Text style={styles.deleteText}>Delete this link</Text>
                                    </Pressable>
                                  </View>
                                )}

                                {section.key === 'EXPIRED' && (
                                  <Pressable
                                    style={styles.deleteRow}
                                    onPress={() => handleDeleteCheckIn(item)}
                                    disabled={busyId === item.id}
                                  >
                                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                                    <Text style={styles.deleteText}>Delete this link</Text>
                                  </Pressable>
                                )}

                                {section.key === 'SUBMITTED' && (
                                  <View style={{ marginTop: spacing.sm }}>
                                    {item.welcomeWhatsappSent ? (
                                      <View style={styles.welcomeStatusRow}>
                                        <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                                        <Text style={typography.caption}>Welcome message sent</Text>
                                      </View>
                                    ) : item.welcomeNotifiedAt && item.welcomeWaLink ? (
                                      <Button
                                        label={busyId === item.id ? 'Opening…' : 'Open WhatsApp — welcome message ready'}
                                        onPress={() => handleOpenReadyWelcome(item)}
                                        loading={busyId === item.id}
                                        variant="secondary"
                                      />
                                    ) : (
                                      <>
                                        <Pressable
                                          onPress={() => handleExpandWelcome(item)}
                                          style={styles.welcomeStatusRow}
                                        >
                                          <Ionicons
                                            name={
                                              expandedId === item.id ? 'chevron-up' : 'chatbubble-ellipses-outline'
                                            }
                                            size={14}
                                            color={colors.primary}
                                          />
                                          <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                                            {expandedId === item.id ? 'Hide welcome message' : 'Send welcome message'}
                                          </Text>
                                        </Pressable>

                                        {expandedId === item.id && (
                                          <View style={{ marginTop: spacing.sm }}>
                                            {isPreviewLoading ? (
                                              <Text style={typography.bodyMuted}>Loading preview…</Text>
                                            ) : (
                                              <>
                                                <TextField
                                                  label="Message (edit if needed)"
                                                  value={previewText}
                                                  onChangeText={setPreviewText}
                                                  multiline
                                                  numberOfLines={6}
                                                />
                                                <Button
                                                  label={busyId === item.id ? 'Sending…' : 'Send via WhatsApp'}
                                                  onPress={() => handleSendWelcome(item)}
                                                  loading={busyId === item.id}
                                                />
                                              </>
                                            )}
                                          </View>
                                        )}
                                      </>
                                    )}
                                  </View>
                                )}

                                <Pressable
                                  onPress={() => router.push(`/host/property/${item.property.id}`)}
                                  style={styles.viewPropertyLink}
                                >
                                  <Text style={styles.linkText}>View ID photo, contract &amp; PDF in property →</Text>
                                </Pressable>
                              </View>
                            ))}
                        </View>
                      );
                    })
                  ))}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionCard: { marginTop: spacing.sm, padding: 0, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEmpty: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  monthBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(27,31,35,0.02)',
  },
  monthLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.ink },
  monthCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkMuted,
    backgroundColor: 'rgba(27,31,35,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  checkinRow: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guestName: { ...typography.h3, fontSize: 15 },
  stayLine: { fontSize: 12, fontWeight: '600', color: colors.ink, marginTop: 1 },
  actionRow: { marginTop: spacing.sm },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  deleteText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  welcomeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewPropertyLink: { marginTop: spacing.sm },
  linkAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  linkText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});
