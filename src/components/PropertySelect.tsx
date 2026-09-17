import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { Chip } from './ui';
import { propertyCoverUrl, type Property } from '@/lib/api';
import { PropertyThumb } from './host-ui';

/** A pinned option shown above the property list (e.g. "All properties", "General"). */
export interface PropertySelectExtraOption {
  value: string;
  label: string;
}

interface PropertySelectProps {
  /** Field label shown above the control (only used in field mode, i.e. when chips aren't used). */
  label?: string;
  properties: Property[];
  /** Currently selected id — a property id, an extra option's value, or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Pinned options shown before the properties (e.g. "All properties", "General (no property)"). */
  extraOptions?: PropertySelectExtraOption[];
  /** Above this many properties, switch from a chip row to a tappable field + searchable modal. Default 6. */
  chipThreshold?: number;
}

function labelFor(value: string | null, properties: Property[], extraOptions: PropertySelectExtraOption[]) {
  if (value === null) {
    const none = extraOptions.find((o) => o.value === '__NONE__');
    return none?.label ?? 'Select a property';
  }
  const extra = extraOptions.find((o) => o.value === value);
  if (extra) return extra.label;
  const property = properties.find((p) => p.id === value);
  return property?.name ?? 'Select a property';
}

/**
 * Adaptive property picker. With a handful of properties it renders the
 * familiar chip row; once a host has more than `chipThreshold` properties
 * (the default assumes 20+ becomes unwieldy as chips), it switches to a
 * tappable field that opens a searchable full-screen modal list instead.
 */
export function PropertySelect({
  label,
  properties,
  value,
  onChange,
  extraOptions = [],
  chipThreshold = 6,
}: PropertySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const useChips = properties.length <= chipThreshold;

  const filteredProperties = useMemo(() => {
    if (!query.trim()) return properties;
    const q = query.trim().toLowerCase();
    return properties.filter((p) => p.name.toLowerCase().includes(q) || p.city?.name?.toLowerCase().includes(q));
  }, [properties, query]);

  const filteredExtras = useMemo(() => {
    if (!query.trim()) return extraOptions;
    const q = query.trim().toLowerCase();
    return extraOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [extraOptions, query]);

  if (useChips) {
    return (
      <View style={styles.chipRow}>
        {extraOptions.map((opt) => (
          <Chip key={opt.value} label={opt.label} active={value === opt.value} onPress={() => onChange(opt.value === '__NONE__' ? null : opt.value)} />
        ))}
        {properties.map((p) => (
          <Chip
            key={p.id}
            label={p.name}
            imageUrl={propertyCoverUrl(p, 64)}
            active={value === p.id}
            onPress={() => onChange(p.id)}
          />
        ))}
      </View>
    );
  }

  function handleSelect(nextValue: string | null) {
    onChange(nextValue);
    setQuery('');
    setIsOpen(false);
  }

  return (
    <>
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      <Pressable style={styles.field} onPress={() => setIsOpen(true)}>
        <Text style={styles.fieldValue} numberOfLines={1}>
          {labelFor(value, properties, extraOptions)}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.inkFaint} />
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={typography.h2}>{label || 'Select a property'}</Text>
            <Pressable onPress={() => setIsOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.inkFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search properties…"
              placeholderTextColor={colors.inkFaint}
              style={styles.searchInput}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.inkFaint} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={[
              ...filteredExtras.map((o) => ({ kind: 'extra' as const, id: o.value, label: o.label })),
              ...filteredProperties.map((p) => ({
                kind: 'property' as const,
                id: p.id,
                label: p.name,
                city: p.city?.name,
                photoUrl: propertyCoverUrl(p, 110),
              })),
            ]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[typography.bodyMuted, styles.emptyText]}>No properties match "{query}".</Text>
            }
            renderItem={({ item }) => {
              const resolvedValue = item.kind === 'extra' && item.id === '__NONE__' ? null : item.id;
              const selected = value === resolvedValue;
              return (
                <Pressable style={styles.row} onPress={() => handleSelect(resolvedValue)}>
                  {item.kind === 'property' && <PropertyThumb photoUrl={item.photoUrl} size={40} />}
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body}>{item.label}</Text>
                    {item.kind === 'property' && item.city && <Text style={typography.caption}>{item.city}</Text>}
                  </View>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fieldLabel: { ...typography.bodyMuted, fontWeight: '600', marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  fieldValue: { ...typography.body, flex: 1, marginRight: spacing.sm },
  modalScreen: { flex: 1, backgroundColor: colors.sand },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.ink },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyText: { textAlign: 'center', marginTop: spacing.xl },
});
