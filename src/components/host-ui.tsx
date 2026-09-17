import { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { AnimatedPressable } from './ui';

/**
 * Shared host-side building blocks — the section headers, rows, tags and
 * filters the Home screen is assembled from, kept here rather than inline so
 * the Property Detail redesign can use the same vocabulary instead of
 * growing its own. See the project's duplication rule.
 *
 * Note for anyone reading the history: this file previously also exported
 * `StatFilterBlock`, `AttentionCard` and `SourceBadge`, built for the Part 31
 * Home screen. Part 36 replaced that layout with the sectioned design the
 * user asked for, leaving all three unused, so they were removed rather than
 * left as dead code.
 */

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'danger';

const TONE_COLOR: Record<Tone, string> = {
  neutral: colors.inkMuted,
  primary: colors.primary,
  accent: '#B45309',
  success: colors.primary,
  danger: colors.danger,
};

const TONE_BG: Record<Tone, string> = {
  neutral: 'rgba(27,31,35,0.06)',
  primary: colors.successBg,
  accent: colors.accentBg,
  success: colors.successBg,
  danger: colors.dangerBg,
};

/**
 * A property's cover photo as a square thumbnail, falling back to a tinted
 * placeholder when it has none (a property added by hand and never given a
 * photo, rather than an error).
 *
 * One implementation for every list in the app that shows a property —
 * Home, Properties, Calendar's listings, the Guests screen, the property
 * picker — so they can't drift apart in size, corner radius or placeholder.
 */
export function PropertyThumb({
  photoUrl,
  size = 56,
  icon = 'home-outline',
}: {
  photoUrl?: string | null;
  size?: number;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const shape = { width: size, height: size, borderRadius: Math.round(size * 0.26) };
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={shape} />;
  return (
    <View style={[shape, styles.thumbPlaceholder]}>
      <Ionicons name={icon} size={Math.round(size * 0.42)} color={colors.inkFaint} />
    </View>
  );
}

/**
 * The heading above each of Home's sections: an icon, a title, a line
 * explaining what the section is for, and an optional "View all" pill.
 *
 * The subtitle earns its place — a host shouldn't have to infer that
 * "Apartments not ready" means "before the next guest arrives".
 */
export function SectionHeader({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {actionLabel && onAction && (
        <AnimatedPressable onPress={onAction} scaleTo={0.94} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

/** A small status pill — "Needs cleaning", "Not ready", "Same-day turnover". */
export function StatusTag({
  label,
  tone = 'accent',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: TONE_BG[tone] }]}>
      {icon && <Ionicons name={icon} size={11} color={TONE_COLOR[tone]} />}
      <Text style={[styles.tagText, { color: TONE_COLOR[tone] }]}>{label}</Text>
    </View>
  );
}

/**
 * A compact dropdown filter — the pill that reads "All statuses" until a
 * filter is picked.
 *
 * Deliberately a modal list rather than an inline expanding menu: this sits
 * inside a scrolling screen, where an absolutely-positioned menu either gets
 * clipped by its parent or scrolls away from its trigger.
 */
export function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.value === value);
  return (
    <>
      <AnimatedPressable onPress={() => setOpen(true)} scaleTo={0.96} style={styles.dropdown}>
        <Text style={styles.dropdownText} numberOfLines={1}>
          {active?.label ?? options[0]?.label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.inkMuted} />
      </AnimatedPressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  style={styles.dropdownRow}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownRowText, selected && styles.dropdownRowTextActive]}>{opt.label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * One property row: photo, name, a location line, optional meta chips and
 * tags, and whatever belongs on the right (a status tag, a button).
 *
 * Every list on Home is built from this so they stay visually identical —
 * the only differences between the three sections are what they put in
 * `meta`, `tags` and `right`.
 */
export function PropertyRow({
  photoUrl,
  title,
  subtitle,
  meta,
  tags,
  right,
  topBadge,
  onPress,
  onDismiss,
  showChevron = true,
}: {
  photoUrl?: string | null;
  title: string;
  subtitle?: string;
  /** Small icon+text pairs under the subtitle — guest count, check-in time, link status. */
  meta?: { icon: keyof typeof Ionicons.glyphMap; label: string; tone?: Tone }[];
  /** Status pills rendered under the meta row. */
  tags?: { label: string; tone?: Tone; icon?: keyof typeof Ionicons.glyphMap }[];
  /** Rendered at the row's right edge — a status tag or an action button. */
  right?: React.ReactNode;
  /** A small pill sitting on the photo's top-left, e.g. "Today". */
  topBadge?: { label: string; tone?: Tone };
  onPress?: () => void;
  /** Adds a small X in the row's top-right. Dismissal only — never destructive. */
  onDismiss?: () => void;
  showChevron?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      <View>
        <PropertyThumb photoUrl={photoUrl} size={56} />
        {topBadge && (
          <View style={[styles.topBadge, { backgroundColor: TONE_COLOR[topBadge.tone ?? 'primary'] }]}>
            <Text style={styles.topBadgeText}>{topBadge.label}</Text>
          </View>
        )}
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {meta && meta.length > 0 && (
          <View style={styles.metaRow}>
            {meta.map((m) => (
              <View key={m.label} style={styles.metaItem}>
                <Ionicons name={m.icon} size={12} color={m.tone ? TONE_COLOR[m.tone] : colors.inkFaint} />
                <Text style={[styles.metaText, m.tone ? { color: TONE_COLOR[m.tone] } : null]}>{m.label}</Text>
              </View>
            ))}
          </View>
        )}
        {tags && tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <StatusTag key={t.label} label={t.label} tone={t.tone} icon={t.icon} />
            ))}
          </View>
        )}
      </View>

      {right}
      {showChevron && <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />}
      {onDismiss && (
        // Generous hitSlop: a deliberately small mark sitting on a row that
        // is itself tappable.
        <Pressable onPress={onDismiss} hitSlop={12} style={styles.dismiss}>
          <Ionicons name="close" size={15} color={colors.inkFaint} />
        </Pressable>
      )}
    </View>
  );

  if (!onPress) return <View style={styles.rowCard}>{body}</View>;
  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.985} style={styles.rowCard}>
      {body}
    </AnimatedPressable>
  );
}

/**
 * A tinted circular icon, sized and cornered to match `PropertyThumb` so the
 * two line up in the same list — the stand-in for a row whose subject isn't a
 * property with a photo (an unaccepted cleaning job, a turnover).
 */
export function ToneIcon({
  icon,
  tone = 'primary',
  size = 42,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        backgroundColor: TONE_BG[tone],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.44)} color={TONE_COLOR[tone]} />
    </View>
  );
}

/**
 * The bell in Home's header, with an unread count.
 *
 * The badge is capped at "9+" rather than growing: past a handful the exact
 * number tells a host nothing they'll act on differently, and a three-digit
 * badge would push the bell off its own alignment. A zero count renders no
 * badge at all — a bell wearing a "0" reads as broken.
 */
export function NotificationBell({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.9} style={styles.bell} hitSlop={10}>
      <Ionicons
        name={count > 0 ? 'notifications' : 'notifications-outline'}
        size={21}
        color={count > 0 ? colors.primary : colors.inkMuted}
      />
      {count > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  thumbPlaceholder: {
    backgroundColor: 'rgba(27,31,35,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...typography.h2, fontSize: 18 },
  sectionSubtitle: { ...typography.bodyMuted, fontSize: 12, marginTop: 1 },
  sectionAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionActionText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tagText: { fontSize: 11, fontWeight: '700' },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    maxWidth: 170,
  },
  dropdownText: { fontSize: 12, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dropdownSheet: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  dropdownRowText: { ...typography.body },
  dropdownRowTextActive: { color: colors.primary, fontWeight: '700' },

  rowCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.h3, fontSize: 15 },
  rowSubtitle: { ...typography.bodyMuted, fontSize: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '600', color: colors.inkMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  topBadge: {
    position: 'absolute',
    top: -6,
    left: -4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.white,
  },
  topBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },
  dismiss: { padding: 2, alignSelf: 'flex-start' },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },
});
