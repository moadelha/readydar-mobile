import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { Text } from '@/components/text';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, ErrorBanner, EmptyState, SegmentedControl, SkeletonListItem, AnimatedPressable } from '@/components/ui';
import { ChannelMark } from '@/components/channel-mark';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, GuestThread } from '@/lib/api';
import { usePlanConsole } from '@/lib/plan-console';
import { useMessagesStrings, providerName } from '@/lib/i18n/messages-strings';
import { colors, radius, spacing, typography } from '@/theme';

type StatusFilter = 'all' | 'unread' | 'open';

/** While the inbox is on screen — there's no push yet, so this is how a new guest message shows up. */
const LIST_POLL_MS = 30_000;

/**
 * Pro guest inbox — Booking.com and Airbnb conversations, answered through
 * Channex. Same data and filters as the web inbox (apps/web/src/app/host/
 * messages); a tap opens the conversation as its own screen.
 */
export default function MessagesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const m = useMessagesStrings();
  const { canMessages, refreshUnread } = usePlanConsole();
  const token = session?.accessToken;

  const [status, setStatus] = useState<StatusFilter>('all');
  const [threads, setThreads] = useState<GuestThread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !canMessages) return;
    try {
      setThreads(await api.messaging.listThreads(status, token));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : m.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canMessages, status]);

  // Reload on focus (coming back from a conversation marks it read) and
  // keep polling only while this tab is the one on screen.
  useFocusEffect(
    useCallback(() => {
      load();
      refreshUnread();
      const timer = setInterval(load, LIST_POLL_MS);
      return () => clearInterval(timer);
    }, [load, refreshUnread]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    refreshUnread();
    setRefreshing(false);
  }

  function changeStatus(next: StatusFilter) {
    setStatus(next);
    setThreads(null);
  }

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h1}>{m.title}</Text>
          <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{m.subtitle}</Text>
        </View>
        <AnimatedPressable
          onPress={() => router.push('/host/messages/templates')}
          style={styles.headerButton}
          accessibilityLabel={m.templates.manage}
        >
          <Ionicons name="flash-outline" size={18} color={colors.primary} />
        </AnimatedPressable>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'all', label: m.filters.all },
            { value: 'unread', label: m.filters.unread },
            { value: 'open', label: m.filters.open },
          ]}
          value={status}
          onChange={changeStatus}
        />
      </View>

      {error && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      )}

      {threads === null && !error ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={threads ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            threads && !error ? (
              <View style={{ marginTop: spacing.lg }}>
                {status === 'all' ? (
                  <EmptyState icon="chatbubbles-outline" message={`${m.empty.title}\n${m.empty.body}`} />
                ) : (
                  <EmptyState icon="chatbubbles-outline" message={m.empty.filtered} />
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ThreadRow thread={item} onPress={() => router.push({ pathname: '/host/messages/[id]', params: { id: item.id } })} />
          )}
        />
      )}
    </Screen>
  );
}

function ThreadRow({ thread, onPress }: { thread: GuestThread; onPress: () => void }) {
  const m = useMessagesStrings();
  const unread = thread.unreadCount > 0;
  const preview = thread.lastMessagePreview
    ? `${thread.lastMessageSender === 'HOST' ? `${m.you}: ` : ''}${thread.lastMessagePreview}`
    : '';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <ChannelMark provider={thread.provider} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.guestName, unread && styles.guestNameUnread]} numberOfLines={1}>
            {thread.guestName || m.guest}
          </Text>
          {thread.lastMessageAt && <Text style={[styles.time, unread && styles.timeUnread]}>{fmtShort(thread.lastMessageAt)}</Text>}
        </View>
        <Text style={typography.caption} numberOfLines={1}>
          {providerName(thread.provider)} · {thread.property.name}
          {thread.reservation ? ` · ${fmtDay(thread.reservation.checkIn)} – ${fmtDay(thread.reservation.checkOut)}` : ''}
        </Text>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          {thread.isInquiry && <Text style={[styles.tag, styles.tagInquiry]}>{m.inquiry}</Text>}
          {thread.isClosed && <Text style={styles.tag}>{m.closed}</Text>}
          {unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{thread.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** Calendar date of a stay — stored as UTC midnight, so formatted in UTC. */
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Today → time; this year → day + month; older → full date. Same rule as the web inbox. */
function fmtShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  list: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guestName: { ...typography.h3, flex: 1, fontWeight: '500' },
  guestNameUnread: { fontWeight: '700' },
  time: { ...typography.caption },
  timeUnread: { color: colors.primary, fontWeight: '700' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  preview: { ...typography.bodyMuted, flex: 1, fontSize: 13 },
  previewUnread: { color: colors.ink, fontWeight: '600' },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkMuted,
    backgroundColor: colors.surface2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  tagInquiry: { color: colors.warning, backgroundColor: colors.accentBg },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
});
