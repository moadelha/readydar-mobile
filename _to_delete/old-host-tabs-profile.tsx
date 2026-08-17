import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, AuthUser } from '@/lib/api';
import { Screen, Card, LoadingScreen, TextField, StatusBadge } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

const HOST_ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

export default function HostProfileScreen() {
  const { session, logout, updateSessionUser } = useAuth();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    api.users.getMe(session.accessToken).then((user) => {
      setMe(user);
      setEmail(user.email);
      setPhone(user.phone ?? '');
    });
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
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!me) return <LoadingScreen />;

  return (
    <Screen>
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

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {success && !error && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>Saved.</Text>
            </View>
          )}

          <Button label={isSaving ? 'Saving…' : 'Save changes'} onPress={handleSave} loading={isSaving} />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
            <Text style={[typography.bodyMuted, { flex: 1 }]}>
              Team members, billing/subscription, and reports aren't in the mobile app yet — manage those from the
              DarClean web dashboard.
            </Text>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Button label="Log out" onPress={() => logout()} variant="danger" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  successBox: { backgroundColor: colors.successBg, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.md },
  successText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
