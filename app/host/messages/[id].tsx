import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, LoadingScreen, ErrorBanner, PhotoViewerModal } from '@/components/ui';
import { ChannelMark } from '@/components/channel-mark';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, GuestMessage, GuestThread, RenderedMessageTemplate } from '@/lib/api';
import { usePlanConsole } from '@/lib/plan-console';
import { useToast } from '@/lib/toast';
import { useMessagesStrings, providerName } from '@/lib/i18n/messages-strings';
import { colors, radius, spacing, typography } from '@/theme';

/** While the conversation is open — no push yet, so a guest's reply appears within this. */
const THREAD_POLL_MS = 10_000;
/** Same limit as the API (ChannexMessagingService.MAX_ATTACHMENT_BYTES). */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * One guest conversation. Opening it marks it read on the server (the GET
 * does that), so the unread badge is refreshed right after each load.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const toast = useToast();
  const m = useMessagesStrings();
  const { refreshUnread } = usePlanConsole();
  const token = session?.accessToken;

  const [thread, setThread] = useState<GuestThread | null>(null);
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [quickReplies, setQuickReplies] = useState<RenderedMessageTemplate[] | null>(null);
  const [showQuick, setShowQuick] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await api.messaging.getThread(id, token);
      setThread(res.thread);
      setMessages(res.messages);
      setError(null);
      refreshUnread();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : m.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, THREAD_POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const groups = useMemo(() => groupByDay(messages), [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || isSending || !token || !id) return;
    setIsSending(true);
    try {
      const sent = await api.messaging.send(id, text, token);
      setMessages((prev) => [...prev, sent]);
      setDraft('');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : m.sendError, 'error');
    } finally {
      setIsSending(false);
    }
  }

  async function sendPhoto(source: 'camera' | 'library') {
    if (!token || !id) return;
    let result: ImagePicker.ImagePickerResult;
    try {
      result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    } catch {
      Alert.alert(m.photoAccessTitle, m.photoAccessBody);
      return;
    }
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    if (asset.fileSize && asset.fileSize > MAX_ATTACHMENT_BYTES) {
      toast.show(m.attachSizeError, 'error');
      return;
    }
    setIsUploading(true);
    try {
      const sent = await api.messaging.sendAttachment(
        id,
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' },
        token,
      );
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : m.sendError, 'error');
    } finally {
      setIsUploading(false);
    }
  }

  function chooseAttachment() {
    Alert.alert(m.attach, undefined, [
      { text: m.takePhoto, onPress: () => sendPhoto('camera') },
      { text: m.choosePhoto, onPress: () => sendPhoto('library') },
      { text: m.cancel, style: 'cancel' },
    ]);
  }

  async function toggleQuickReplies() {
    if (showQuick) {
      setShowQuick(false);
      return;
    }
    if (!token || !id) return;
    setShowQuick(true);
    setQuickReplies(null);
    try {
      // Re-rendered each time: the check-in link or Wi-Fi may have changed.
      setQuickReplies(await api.messaging.renderedTemplates(id, token));
    } catch (err) {
      setShowQuick(false);
      toast.show(err instanceof ApiError ? err.message : m.loadError, 'error');
    }
  }

  function applyQuickReply(reply: RenderedMessageTemplate) {
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()}\n${reply.text}` : reply.text));
    setShowQuick(false);
    if (reply.missing.length) {
      const names = reply.missing.map((k) => m.templates.placeholders[k as keyof typeof m.templates.placeholders] ?? k);
      toast.show(m.templates.missingToast(names.join(', ')), 'info');
    }
  }

  async function act(kind: 'close' | 'noReply') {
    if (!token || !id) return;
    setIsActing(true);
    try {
      if (kind === 'close') await api.messaging.close(id, token);
      else await api.messaging.noReplyNeeded(id, token);
      toast.show(kind === 'close' ? m.closedToast : m.noReplyToast);
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : m.actionError, 'error');
    } finally {
      setIsActing(false);
    }
  }

  function openActions() {
    if (!thread || thread.isClosed) return;
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (thread.provider === 'BOOKING_COM') buttons.push({ text: m.noReplyNeeded, onPress: () => act('noReply') });
    buttons.push({
      text: m.close,
      style: 'destructive',
      onPress: () =>
        Alert.alert(m.closeConfirm, undefined, [
          { text: m.cancel, style: 'cancel' },
          { text: m.close, style: 'destructive', onPress: () => act('close') },
        ]),
    });
    buttons.push({ text: m.cancel, style: 'cancel' });
    Alert.alert(m.actions, thread.provider === 'BOOKING_COM' ? m.noReplyHint : undefined, buttons);
  }

  if (!thread) {
    if (error) {
      return (
        <Screen>
          <Stack.Screen options={{ headerShown: true, title: m.title }} />
          <View style={{ padding: spacing.lg }}>
            <ErrorBanner message={error} onRetry={load} />
          </View>
        </Screen>
      );
    }
    return <LoadingScreen />;
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: thread.guestName || m.guest,
          headerRight: thread.isClosed
            ? undefined
            : () => (
                <Pressable onPress={openActions} disabled={isActing} hitSlop={8} accessibilityLabel={m.actions}>
                  {isActing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={colors.primary} />
                  )}
                </Pressable>
              ),
        }}
      />

      <View style={styles.contextBar}>
        <ChannelMark provider={thread.provider} size={28} />
        <Text style={[typography.caption, { flex: 1 }]} numberOfLines={2}>
          {providerName(thread.provider)} · {thread.property.name}
          {thread.reservation ? ` · ${fmtDay(thread.reservation.checkIn)} – ${fmtDay(thread.reservation.checkOut)}` : ''}
          {thread.reservation?.reservationCode ? ` · #${thread.reservation.reservationCode}` : ''}
        </Text>
        {thread.isInquiry && <Text style={styles.inquiryTag}>{m.inquiry}</Text>}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.sand }}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {error && <ErrorBanner message={error} onRetry={load} />}
        {messages.length === 0 && <Text style={[typography.bodyMuted, styles.centered]}>{m.noMessages}</Text>}
        {groups.map((group) => (
          <View key={group.day} style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, styles.centered]}>{group.label}</Text>
            {group.messages.map((msg) => (
              <Bubble key={msg.id} msg={msg} onOpenImage={setViewerUrl} />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {thread.isClosed && <Text style={[typography.caption, { marginBottom: spacing.xs }]}>{m.closedNote}</Text>}
        {showQuick && (
          <View style={styles.quickPanel}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {!quickReplies && <ActivityIndicator style={{ padding: spacing.md }} color={colors.primary} />}
              {quickReplies?.length === 0 && <Text style={[typography.caption, { padding: spacing.sm }]}>{m.templates.empty}</Text>}
              {quickReplies?.map((r) => (
                <Pressable key={r.id} onPress={() => applyQuickReply(r)} style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.quickTitle}>
                    {r.title}
                    {r.missing.length > 0 && <Text style={styles.quickMissing}>{`  · ${m.templates.incomplete}`}</Text>}
                  </Text>
                  <Text style={typography.caption} numberOfLines={2}>
                    {r.text}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        <View style={styles.composer}>
          <Pressable onPress={chooseAttachment} disabled={isUploading} style={styles.roundButton} accessibilityLabel={m.attach}>
            {isUploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="image-outline" size={19} color={colors.inkMuted} />}
          </Pressable>
          <Pressable
            onPress={toggleQuickReplies}
            style={[styles.roundButton, showQuick && styles.roundButtonActive]}
            accessibilityLabel={m.templates.quickReplies}
          >
            <Ionicons name="flash-outline" size={18} color={showQuick ? colors.primary : colors.inkMuted} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={m.composerPlaceholder(providerName(thread.provider))}
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={5000}
            style={styles.input}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || isSending}
            style={[styles.sendButton, (!draft.trim() || isSending) && { opacity: 0.4 }]}
            accessibilityLabel={m.send}
          >
            {isSending ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="send" size={17} color={colors.onPrimary} />}
          </Pressable>
        </View>
      </View>

      <PhotoViewerModal uri={viewerUrl} onClose={() => setViewerUrl(null)} />
    </Screen>
  );
}

function Bubble({ msg, onOpenImage }: { msg: GuestMessage; onOpenImage: (url: string) => void }) {
  const m = useMessagesStrings();
  if (msg.sender === 'SYSTEM') {
    return <Text style={styles.systemBubble}>{msg.body}</Text>;
  }
  const mine = msg.sender === 'HOST';
  return (
    <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {!!msg.body && <Text style={[styles.bubbleText, mine && { color: colors.onPrimary }]}>{msg.body}</Text>}
        {msg.attachments.map((url) =>
          /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) ? (
            <Pressable key={url} onPress={() => onOpenImage(url)}>
              <Image source={{ uri: url }} style={styles.attachmentImage} />
            </Pressable>
          ) : (
            <Pressable key={url} onPress={() => Linking.openURL(url)} style={styles.attachmentLink}>
              <Ionicons name="attach" size={13} color={mine ? colors.onPrimary : colors.primary} />
              <Text style={[styles.attachmentText, mine && { color: colors.onPrimary }]}>{m.attachment}</Text>
            </Pressable>
          ),
        )}
        <Text style={[styles.bubbleMeta, mine && { color: 'rgba(255,255,255,0.75)' }]}>
          {mine && msg.sentByName ? `${msg.sentByName} · ` : ''}
          {new Date(msg.sentAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

/** Calendar date of a stay — stored as UTC midnight, so formatted in UTC. */
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function groupByDay(messages: GuestMessage[]) {
  const groups: { day: string; label: string; messages: GuestMessage[] }[] = [];
  for (const msg of messages) {
    const d = new Date(msg.sentAt);
    const day = d.toDateString();
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }), messages: [] };
      groups.push(group);
    }
    group.messages.push(msg);
  }
  return groups;
}

const styles = StyleSheet.create({
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  inquiryTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    backgroundColor: colors.accentBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  messages: { padding: spacing.md, gap: spacing.md },
  centered: { textAlign: 'center' },
  systemBubble: {
    alignSelf: 'center',
    maxWidth: '85%',
    textAlign: 'center',
    fontSize: 12,
    color: colors.inkMuted,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '82%', borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 8, gap: 6 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bubbleText: { fontSize: 15, lineHeight: 20, color: colors.ink },
  bubbleMeta: { fontSize: 10, color: colors.inkFaint, alignSelf: 'flex-end' },
  attachmentImage: { width: 200, height: 150, borderRadius: radius.sm, backgroundColor: colors.border },
  attachmentLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attachmentText: { fontSize: 13, fontWeight: '600', color: colors.primary, textDecorationLine: 'underline' },
  footer: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  quickPanel: {
    maxHeight: 220,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 4,
  },
  quickItem: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.sm },
  quickTitle: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  quickMissing: { fontSize: 11, fontWeight: '500', color: colors.warning },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: { backgroundColor: colors.successBg, borderColor: colors.primaryLight },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.sand,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.ink,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
