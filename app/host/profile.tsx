import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, AuthUser } from '@/lib/api';
import { Screen, Card, LoadingScreen, TextField, StatusBadge, ErrorBanner, LanguagePicker } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/lib/i18n/language-context';

export default function HostProfileScreen() {
  const { session, logout, updateSessionUser } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const HOST_ROLE_LABEL: Record<string, string> = {
    OWNER: t.profileHost.ownerRole,
    MANAGER: t.profileHost.managerRole,
    STAFF: t.profileHost.staffRole,
  };

  const load = useCallback(() => {
    if (!session) return;
    setError(null);
    api.users
      .getMe(session.accessToken)
      .then((user) => {
        setMe(user);
        setEmail(user.email);
        setPhone(user.phone ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t.profileHost.loadError));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSave() {
    if (!session) return;
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    try {
      const updated = await api.users.updateProfile({ email, phone: phone || null }, session.accessToken);
      setMe(updated);
      updateSessionUser({ email: updated.email, phone: updated.phone });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.profileHost.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  if (!me) return <LoadingScreen />;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t.common.profile, headerBackTitle: t.common.back }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={typography.h1}>
          {me.firstName} {me.lastName}
        </Text>
        {me.hostRole && (
          <View style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}>
            <StatusBadge label={HOST_ROLE_LABEL[me.hostRole] ?? me.hostRole} tone="primary" />
          </View>
        )}

        <Card style={{ marginTop: spacing.lg }}>
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+212 6XX XXX XXX" />

          {error && <ErrorBanner message={error} onRetry={load} />}
          {success && !error && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{t.profileHost.saved}</Text>
            </View>
          )}

          <Button
            label={isSaving ? t.profileHost.savingChanges : t.profileHost.saveChanges}
            onPress={handleSave}
            loading={isSaving}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Text style={styles.sectionTitle}>{t.profileHost.manage}</Text>
        <Pressable onPress={() => router.push('/host/cleaning-contacts')}>
          <Card style={styles.menuRow}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={[typography.body, { flex: 1 }]}>{t.profileHost.cleaningContacts}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </Card>
        </Pressable>
        <Pressable onPress={() => router.push('/host/turnovers')}>
          <Card style={styles.menuRow}>
            <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
            <Text style={[typography.body, { flex: 1 }]}>{t.profileHost.turnoverAlerts}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </Card>
        </Pressable>

        <Card style={{ marginTop: spacing.md }}>
          <LanguagePicker />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
            <Text style={[typography.bodyMuted, { flex: 1 }]}>{t.profileHost.notOnMobileYet}</Text>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Button label={t.common.logOut} onPress={() => logout()} variant="danger" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionTitle: { ...typography.h3, marginTop: spacing.xl, marginBottom: spacing.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  successBox: { backgroundColor: colors.successBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  successText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
