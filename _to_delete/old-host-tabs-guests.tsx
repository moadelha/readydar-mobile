import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, PendingWelcomeItem } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, TextField } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

function guestLabel(item: PendingWelcomeItem) {
  if (item.guestFirstName) return `${item.guestFirstName} ${item.guestLastName ?? ''}`.trim();
  return item.guestNameHint || 'Guest';
}

export default function GuestsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [needsConfirmation, setNeedsConfirmation] = useState<PendingWelcomeItem[]>([]);
  const [readyToSend, setReadyToSend] = useState<PendingWelcomeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const data = await api.guestWelcome.listPending(session.accessToken);
    setNeedsConfirmation(data.needsConfirmation);
    setReadyToSend(data.readyToSend);
    setIsLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleExpand(item: PendingWelcomeItem) {
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

  async function handleSend(item: PendingWelcomeItem) {
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

  async function handleOpenReady(item: PendingWelcomeItem) {
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

  const isEmpty = needsConfirmation.length === 0 && readyToSend.length === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={typography.h1}>Guests</Text>
        <Text style={[typography.bodyMuted, { marginTop: 2 }]}>
          Send access-info welcome messages once a guest completes online check-in.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isEmpty ? (
          <Card style={{ marginTop: spacing.lg }}>
            <EmptyState message="No guest welcome messages pending right now. They'll show up here as soon as a guest completes their online check-in." />
            <Pressable onPress={() => router.push('/(host-tabs)/properties')} style={styles.linkAction}>
              <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.linkText}>Start a guest's online check-in from a property</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            {needsConfirmation.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Needs your review</Text>
                {needsConfirmation.map((item) => {
                  const expanded = expandedId === item.id;
                  return (
                    <Card key={item.id} style={{ marginBottom: spacing.sm }}>
                      <Pressable onPress={() => handleExpand(item)}>
                        <View style={styles.row}>
                          <View style={{ flex: 1 }}>
                            <Text style={typography.h3}>{guestLabel(item)}</Text>
                            <Text style={typography.bodyMuted}>{item.property.name}</Text>
                            <Text style={typography.caption}>
                              Check-in {new Date(item.expectedCheckIn).toLocaleDateString()}
                            </Text>
                          </View>
                          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkFaint} />
                        </View>
                      </Pressable>

                      {expanded && (
                        <View style={{ marginTop: spacing.md }}>
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
                                onPress={() => handleSend(item)}
                                loading={busyId === item.id}
                              />
                            </>
                          )}
                        </View>
                      )}
                    </Card>
                  );
                })}
              </>
            )}

            {readyToSend.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Ready to send</Text>
                {readyToSend.map((item) => (
                  <Card key={item.id} style={{ marginBottom: spacing.sm }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h3}>{guestLabel(item)}</Text>
                        <Text style={typography.bodyMuted}>{item.property.name}</Text>
                      </View>
                    </View>
                    <Button
                      label={busyId === item.id ? 'Opening…' : 'Open WhatsApp'}
                      onPress={() => handleOpenReady(item)}
                      loading={busyId === item.id}
                      variant="secondary"
                      style={{ marginTop: spacing.sm }}
                    />
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionTitle: { ...typography.h2, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  linkAction: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: spacing.md },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
});
