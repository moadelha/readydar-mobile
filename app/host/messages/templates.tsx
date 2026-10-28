import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Card, LoadingScreen, ErrorBanner, TextField } from '@/components/ui';
import { Button } from '@/components/Button';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, MessageTemplate } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useMessagesStrings } from '@/lib/i18n/messages-strings';
import { colors, radius, spacing, typography } from '@/theme';

type Editing = { id: string | null; title: string; body: string };

/**
 * Saved quick replies for the guest inbox — add, edit, delete. The
 * {{placeholders}} are filled per conversation by the API when a reply is
 * inserted (GET /messaging/threads/:id/templates), not here.
 */
export default function QuickRepliesScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const m = useMessagesStrings();
  const tm = m.templates;
  const insets = useSafeAreaInsets();
  const token = session?.accessToken;

  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setTemplates(await api.messaging.templates(token));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : m.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function startEditing(next: Editing) {
    setEditing(next);
    setSelection(null);
  }

  /** Inserts `{{key}}` where the cursor is in the message, or at the end. */
  function insertPlaceholder(key: string) {
    if (!editing) return;
    const tag = `{{${key}}}`;
    const start = selection?.start ?? editing.body.length;
    const end = selection?.end ?? start;
    const body = editing.body.slice(0, start) + tag + editing.body.slice(end);
    setEditing({ ...editing, body });
    setSelection({ start: start + tag.length, end: start + tag.length });
  }

  async function save() {
    if (!token || !editing || !editing.title.trim() || !editing.body.trim()) return;
    setIsSaving(true);
    try {
      const data = { title: editing.title.trim(), body: editing.body.trim() };
      if (editing.id) {
        const updated = await api.messaging.updateTemplate(editing.id, data, token);
        setTemplates((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
      } else {
        const created = await api.messaging.createTemplate(data, token);
        setTemplates((prev) => [...(prev ?? []), created]);
      }
      setEditing(null);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : m.actionError, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function remove(template: MessageTemplate) {
    if (!token) return;
    Alert.alert(tm.deleteConfirm(template.title), undefined, [
      { text: m.cancel, style: 'cancel' },
      {
        text: tm.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.messaging.deleteTemplate(template.id, token);
            setTemplates((prev) => prev?.filter((x) => x.id !== template.id) ?? null);
          } catch (err) {
            toast.show(err instanceof ApiError ? err.message : m.actionError, 'error');
          }
        },
      },
    ]);
  }

  if (!templates) {
    if (error) {
      return (
        <Screen>
          <Stack.Screen options={{ headerShown: true, title: tm.title }} />
          <View style={{ padding: spacing.lg }}>
            <ErrorBanner message={error} onRetry={load} />
          </View>
        </Screen>
      );
    }
    return <LoadingScreen />;
  }

  const editor = editing && (
    <Card style={styles.editor}>
      <TextField
        label={tm.titleLabel}
        placeholder={tm.titlePlaceholder}
        value={editing.title}
        onChangeText={(title) => setEditing({ ...editing, title })}
        maxLength={80}
        autoCapitalize="sentences"
      />
      <Text style={styles.label}>{tm.bodyLabel}</Text>
      <TextInput
        value={editing.body}
        onChangeText={(body) => setEditing({ ...editing, body })}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder={tm.bodyPlaceholder}
        placeholderTextColor={colors.inkFaint}
        multiline
        maxLength={2000}
        style={styles.bodyInput}
        textAlignVertical="top"
      />
      <Text style={[typography.caption, { marginTop: spacing.sm }]}>{tm.insertHint}</Text>
      <View style={styles.chips}>
        {(Object.keys(tm.placeholders) as (keyof typeof tm.placeholders)[]).map((key) => (
          <Pressable key={key} onPress={() => insertPlaceholder(key)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}>
            <Text style={styles.chipText}>{tm.placeholders[key]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.editorActions}>
        <Button label={m.cancel} onPress={() => setEditing(null)} variant="outline" style={{ flex: 1 }} />
        <Button
          label={tm.save}
          onPress={save}
          loading={isSaving}
          disabled={!editing.title.trim() || !editing.body.trim()}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: tm.title }} />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl * 2 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={typography.bodyMuted}>{tm.subtitle}</Text>
        {error && <ErrorBanner message={error} onRetry={load} />}

        {templates.map((tpl) =>
          editing?.id === tpl.id ? (
            <View key={tpl.id}>{editor}</View>
          ) : (
            <Card key={tpl.id} style={{ marginTop: spacing.sm }}>
              <View style={styles.templateHeader}>
                <Text style={[typography.h3, { flex: 1 }]}>{tpl.title}</Text>
                <Pressable onPress={() => startEditing({ id: tpl.id, title: tpl.title, body: tpl.body })} hitSlop={8} accessibilityLabel={tm.edit}>
                  <Ionicons name="create-outline" size={19} color={colors.inkMuted} />
                </Pressable>
                <Pressable onPress={() => remove(tpl)} hitSlop={8} accessibilityLabel={tm.delete}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
              <Text style={[typography.bodyMuted, { marginTop: 4 }]}>{tpl.body}</Text>
            </Card>
          ),
        )}

        {editing && !editing.id ? (
          editor
        ) : !editing ? (
          <Pressable onPress={() => startEditing({ id: null, title: '', body: '' })} style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.6 }]}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addText}>{tm.add}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.xs },
  templateHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  editor: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.primaryLight },
  label: { ...typography.caption, fontWeight: '600', color: colors.inkMuted, marginBottom: 6 },
  bodyInput: {
    minHeight: 120,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.sand,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.successBg },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  editorActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  addButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primaryLight,
  },
  addText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
