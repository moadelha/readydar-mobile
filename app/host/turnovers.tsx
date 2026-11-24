import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Linking } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, PendingTurnoverItem } from '@/lib/api';
import { Screen, Card, EmptyState, LoadingScreen, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useHostAccess } from '@/lib/access';
import { useLanguage } from '@/lib/i18n/language-context';
import { useSetupStrings } from '@/lib/i18n/setup-strings';
import { formatDay } from '@/lib/dates';

type Kind = 'checkin' | 'reservation';
interface Row {
  kind: Kind;
  item: PendingTurnoverItem;
}

function guestLabel(item: PendingTurnoverItem, s: ReturnType<typeof useSetupStrings>['alerts']) {
  if (item.guestFirstName) return `${item.guestFirstName} ${item.guestLastName ?? ''}`.trim();
  return item.source ? s.channelGuest(item.source === 'AIRBNB' ? 'Airbnb' : 'Booking.com') : s.guest;
}

export default function TurnoversScreen() {
  const { t, lang } = useLanguage();
  const s = useSetupStrings().alerts;
  const { session } = useAuth();
  const router = useRouter();
  const { isManager } = useHostAccess();
  const [needsConfirmation, setNeedsConfirmation] = useState<Row[]>([]);
  const [readyToSend, setReadyToSend] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const data = await api.turnovers.listPending(session.accessToken);
      setNeedsConfirmation([
        ...data.needsConfirmation.guestCheckIns.map((item) => ({ kind: 'checkin' as const, item })),
        ...data.needsConfirmation.externalReservations.map((item) => ({ kind: 'reservation' as const, item })),
      ]);
      setReadyToSend([
        ...data.readyToSend.guestCheckIns.map((item) => ({ kind: 'checkin' as const, item })),
        ...data.readyToSend.externalReservations.map((item) => ({ kind: 'reservation' as const, item })),
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.loadError);
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

  async function handleConfirm(row: Row) {
    if (!session) return;
    setError(null);
    setBusyId(row.item.id);
    try {
      const { whatsapp } =
        row.kind === 'checkin'
          ? await api.turnovers.confirmCheckIn(row.item.id, session.accessToken)
          : await api.turnovers.confirmReservation(row.item.id, session.accessToken);
      if (!whatsapp.sent && whatsapp.waLink) {
        await Linking.openURL(whatsapp.waLink);
        if (row.kind === 'checkin') await api.turnovers.acknowledgeCheckIn(row.item.id, session.accessToken);
        else await api.turnovers.acknowledgeReservation(row.item.id, session.accessToken);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.notifyError);
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenReady(row: Row) {
    if (!session || !row.item.turnoverWaLink) return;
    setError(null);
    setBusyId(row.item.id);
    try {
      await Linking.openURL(row.item.turnoverWaLink);
      if (row.kind === 'checkin') await api.turnovers.acknowledgeCheckIn(row.item.id, session.accessToken);
      else await api.turnovers.acknowledgeReservation(row.item.id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.openError);
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <LoadingScreen />;

  const isEmpty = needsConfirmation.length === 0 && readyToSend.length === 0;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: s.title, headerBackTitle: t.common.back }} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={typography.bodyMuted}>
          {s.intro}
        </Text>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {isEmpty ? (
          <Card style={{ marginTop: spacing.lg }}>
            <EmptyState
              message={s.empty}
              actionLabel={isManager ? s.manage : undefined}
              onAction={isManager ? () => router.push('/host/cleaning-contacts') : undefined}
            />
          </Card>
        ) : (
          <>
            {needsConfirmation.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{s.toConfirm}</Text>
                {needsConfirmation.map((row) => (
                  <Card key={row.item.id} style={{ marginBottom: spacing.sm }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h3}>{guestLabel(row.item, s)}</Text>
                        <Text style={typography.bodyMuted}>{row.item.property.name}</Text>
                        <Text style={typography.caption}>
                          {s.checkout(formatDay((row.item.expectedCheckOut ?? row.item.checkOut)!, lang, { utc: true }))}
                        </Text>
                        {!row.item.property.defaultCleaningContact && (
                          <Text style={[typography.caption, { color: colors.danger, marginTop: 2 }]}>
                            {s.noContact}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Button
                      label={busyId === row.item.id ? s.notifying : s.confirm}
                      onPress={() => handleConfirm(row)}
                      loading={busyId === row.item.id}
                      disabled={!row.item.property.defaultCleaningContact}
                      style={{ marginTop: spacing.sm }}
                    />
                  </Card>
                ))}
              </>
            )}

            {readyToSend.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{s.ready}</Text>
                {readyToSend.map((row) => (
                  <Card key={row.item.id} style={{ marginBottom: spacing.sm }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h3}>{guestLabel(row.item, s)}</Text>
                        <Text style={typography.bodyMuted}>{row.item.property.name}</Text>
                      </View>
                    </View>
                    <Button
                      label={busyId === row.item.id ? s.opening : s.open}
                      onPress={() => handleOpenReady(row)}
                      loading={busyId === row.item.id}
                      variant="secondary"
                      style={{ marginTop: spacing.sm }}
                    />
                  </Card>
                ))}
              </>
            )}

            {isManager && (
            <Pressable onPress={() => router.push('/host/cleaning-contacts')} style={styles.linkAction}>
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              <Text style={styles.linkText}>{s.manage}</Text>
            </Pressable>
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
  linkAction: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: spacing.xl },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
