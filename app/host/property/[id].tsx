import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Linking,
  Alert,
  PixelRatio,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, ApiError } from '@/lib/auth-context';
import {
  api,
  Property,
  PropertyStatusItem,
  GuestCheckIn,
  resolveUploadUrl,
  resolveThumbnailUrl,
  propertyCoverUrl,
  resolveCheckInUrl,
  checkInPdfUrl,
  contractPdfUrl,
} from '@/lib/api';
import { Screen, Card, LoadingScreen, StatusBadge, TextField, ErrorBanner, PhotoViewerModal } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { downloadAndShare } from '@/lib/files';
import { groupByMonth } from '@/lib/checkin-groups';
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONE, PropertyStatus } from '@/lib/status';

/**
 * The statuses a host can set by hand.
 *
 * `OCCUPIED` is deliberately not offered: it means "a guest is in there
 * right now", which the backend already knows from the reservation, and
 * forcing it would stick a property in that state after the guest leaves.
 * The three here are the ones a host has real knowledge of that the system
 * doesn't — "I've cleaned it", "it needs doing", "someone's on it".
 */
const SETTABLE_STATUSES: PropertyStatus[] = ['READY', 'NEEDS_CLEANING', 'IN_PROGRESS'];

/**
 * Height of the cover photo, in logical points. A constant rather than a
 * number in the stylesheet because the image URL is built from it too —
 * if the two drift apart the server crops to one shape and the view draws
 * another, and the picture goes soft again.
 */
const COVER_HEIGHT = 170;

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

/**
 * Whether a stored ID-photo value is a directly-loadable image URL.
 *
 * Guest ID documents now upload to Cloudinary's *authenticated* delivery
 * type, so what comes back on a guest record is a bare `public_id` with no
 * scheme or host — useless as an image source, and silently so (it renders
 * as a broken image rather than erroring). Photos captured before that
 * change still hold a full https:// URL and keep working as they always
 * did, so both shapes have to be handled for as long as old submissions
 * are still in the window the property page shows.
 */
function isAbsolutePhotoUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export default function PropertyDetailScreen() {
  // `checkin` is optional and only ever set when something linked straight to
  // one — Home's notification bell, today. It opens that check-in's month
  // group and scrolls to it, so a host who taps "Sarah completed their
  // check-in" lands on Sarah's card rather than the top of the page.
  const { id, checkin: focusCheckInId } = useLocalSearchParams<{ id: string; checkin?: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [property, setProperty] = useState<Property | null>(null);
  const [checkIns, setCheckIns] = useState<GuestCheckIn[]>([]);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expandedCheckInId, setExpandedCheckInId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [welcomeBusyId, setWelcomeBusyId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [contractPdfBusyId, setContractPdfBusyId] = useState<string | null>(null);
  /** `${checkInId}:${guestId}` while that one photo's signed URL is in flight. */
  const [photoBusyKey, setPhotoBusyKey] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  /** Explicitly-toggled month groups; absent means "use the default" (nearest month open). */
  const [openCheckInMonths, setOpenCheckInMonths] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<ScrollView>(null);
  /**
   * Measured offsets, so a linked-to check-in can be scrolled into view.
   *
   * `onLayout` reports y relative to the immediate parent, so neither of
   * these is a content offset on its own: a month group's y is relative to
   * the scroll content (it's a direct child of it), a card's y is relative
   * to its month group, and the two are summed at scroll time.
   */
  const groupTops = useRef<Record<string, number>>({});
  const cardTops = useRef<Record<string, number>>({});
  /** The linked-to check-in, tinted briefly so it's obvious which row was meant. */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  /** Guards the scroll so it happens once per arrival, not on every re-render. */
  const didFocusScroll = useRef(false);

  /** The status the backend worked out, from the overview — see `load`. */
  const [derivedStatus, setDerivedStatus] = useState<PropertyStatus | null>(null);
  /** Which status chip is mid-save, so only that one shows a spinner. */
  const [statusBusy, setStatusBusy] = useState<PropertyStatus | 'CLEAR' | null>(null);

  /**
   * What the badge shows. The override wins, exactly as the backend applies
   * it, so the badge can't disagree with the rest of the app.
   */
  const effectiveStatus: PropertyStatus =
    (property?.manualStatusOverride as PropertyStatus | null) ?? derivedStatus ?? 'READY';

  async function handleSetStatus(next: PropertyStatus | null) {
    if (!session || !id) return;
    setError(null);
    setStatusBusy(next ?? 'CLEAR');
    try {
      const updated = await api.properties.setStatus(id, next, session.accessToken);
      // The endpoint returns the updated property, so the override lands
      // without a refetch — but the derived status behind it may have moved
      // too, so reload to keep the badge honest once the override is cleared.
      setProperty(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the status.');
    } finally {
      setStatusBusy(null);
    }
  }

  const load = useCallback(async () => {
    if (!session || !id) return;
    setError(null);
    try {
      const [propertyData, checkInList, overview] = await Promise.all([
        api.properties.getOne(id, session.accessToken),
        api.checkins.listForProperty(id, session.accessToken),
        // `GET /properties/:id` returns the stored record, which carries the
        // manual override but not the status the backend actually works out
        // from bookings and reservations. Only the overview has that, so the
        // badge would otherwise be guesswork. Tolerated on its own: a failure
        // here costs the badge, not the page.
        api.properties.getStatusOverview(session.accessToken).catch(() => [] as PropertyStatusItem[]),
      ]);
      setProperty(propertyData);
      setCheckIns(checkInList);
      setDerivedStatus(overview.find((o) => o.property.id === id)?.status ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this property.');
    }
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** This property's check-in links bucketed by the month the stay starts in. */
  const checkInMonths = useMemo(() => groupByMonth(checkIns, (c) => c.expectedCheckIn), [checkIns]);

  /**
   * Open and reveal the check-in a `?checkin=` link points at.
   *
   * Its month group is found by searching the groups rather than
   * recomputing a month key — `groupByMonth` owns that rule and a second
   * copy of it here would be one more thing to keep in step.
   *
   * The scroll waits on `cardTops`, which is only filled once the group is
   * actually rendered, so it runs on a short delay rather than immediately.
   */
  useEffect(() => {
    if (!focusCheckInId || didFocusScroll.current) return;
    const group = checkInMonths.find((g) => g.items.some((c) => c.id === focusCheckInId));
    if (!group) return;
    didFocusScroll.current = true;
    setOpenCheckInMonths((prev) => ({ ...prev, [group.key]: true }));
    setHighlightId(focusCheckInId);
    const scroll = setTimeout(() => {
      const groupY = groupTops.current[group.key];
      const cardY = cardTops.current[focusCheckInId];
      // Nothing measured yet (the group never rendered) — leave the page
      // where it is rather than scrolling somewhere arbitrary. The month is
      // open and the card is tinted either way.
      if (groupY == null || cardY == null) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, groupY + cardY - 90), animated: true });
    }, 350);
    // The tint is a "here it is", not a persistent state — it fades out on
    // its own so the card doesn't stay visually flagged forever.
    const fade = setTimeout(() => setHighlightId(null), 2800);
    return () => {
      clearTimeout(scroll);
      clearTimeout(fade);
    };
  }, [focusCheckInId, checkInMonths]);

  async function handleMarkReady() {
    if (!session || !id) return;
    setError(null);
    setIsMarkingReady(true);
    try {
      await api.properties.markReady(id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the property.');
    } finally {
      setIsMarkingReady(false);
    }
  }

  async function handleShareCheckIn(checkIn: GuestCheckIn) {
    setSharingId(checkIn.id);
    try {
      const url = resolveCheckInUrl(checkIn.token);
      const arriving = new Date(checkIn.expectedCheckIn).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const text = `Hi! Please complete your online check-in${property ? ` for ${property.name}` : ''}, arriving ${arriving}: ${url}`;
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } finally {
      setSharingId(null);
    }
  }

  async function handleExpandWelcome(checkIn: GuestCheckIn) {
    if (!session) return;
    if (expandedCheckInId === checkIn.id) {
      setExpandedCheckInId(null);
      return;
    }
    setExpandedCheckInId(checkIn.id);
    setError(null);
    setIsPreviewLoading(true);
    try {
      const { text } = await api.guestWelcome.preview(checkIn.id, session.accessToken);
      setPreviewText(text);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the message preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleSendWelcome(checkIn: GuestCheckIn) {
    if (!session) return;
    setError(null);
    setWelcomeBusyId(checkIn.id);
    try {
      const { whatsapp } = await api.guestWelcome.send(checkIn.id, previewText, session.accessToken);
      if (!whatsapp.sent && whatsapp.waLink) {
        await Linking.openURL(whatsapp.waLink);
        await api.guestWelcome.acknowledge(checkIn.id, session.accessToken);
      }
      setExpandedCheckInId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the welcome message.');
    } finally {
      setWelcomeBusyId(null);
    }
  }

  async function handleOpenReadyWelcome(checkIn: GuestCheckIn) {
    if (!session || !checkIn.welcomeWaLink) return;
    setError(null);
    setWelcomeBusyId(checkIn.id);
    try {
      await Linking.openURL(checkIn.welcomeWaLink);
      await api.guestWelcome.acknowledge(checkIn.id, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open WhatsApp.');
    } finally {
      setWelcomeBusyId(null);
    }
  }

  /**
   * Opens one privately-stored guest ID photo.
   *
   * The signed URL the backend hands back is short-lived by design, so it's
   * fetched at the moment the host taps rather than eagerly for every photo
   * on the screen — which would also mean a burst of requests on a property
   * with several submitted check-ins, most of which the host never looks at.
   */
  async function handleViewIdPhoto(checkInId: string, guestId: string) {
    if (!session || photoBusyKey) return;
    setError(null);
    setPhotoBusyKey(`${checkInId}:${guestId}`);
    try {
      const { url } = await api.checkins.guestPhotoUrl(checkInId, guestId, session.accessToken);
      setViewerUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open that ID photo.');
    } finally {
      setPhotoBusyKey(null);
    }
  }

  /**
   * Permanently deletes a check-in link. Offered only where `status` is
   * PENDING — a submitted check-in is the host's only copy of that guest's
   * ID documents and signed contract, and the backend delete takes those
   * with it.
   */
  async function handleDeleteCheckIn(checkIn: GuestCheckIn) {
    if (!session || deleteBusyId) return;
    const label = checkIn.guestNameHint?.trim() || 'this guest';
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Delete check-in link?',
        `The link for ${label} will stop working and can't be recovered. The guest hasn't submitted anything yet, so no guest details are lost.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!confirmed) return;

    setError(null);
    setDeleteBusyId(checkIn.id);
    try {
      await api.properties.deleteGuestCheckIn(checkIn.id, session.accessToken);
      setCheckIns((prev) => prev.filter((c) => c.id !== checkIn.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that check-in link.');
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function handleDownloadPdf(checkIn: GuestCheckIn) {
    if (!session || pdfBusyId) return;
    setError(null);
    setPdfBusyId(checkIn.id);
    try {
      await downloadAndShare(checkInPdfUrl(checkIn.id), `checkin-${checkIn.id}.pdf`, 'application/pdf', {
        Authorization: `Bearer ${session.accessToken}`,
      });
    } catch (err) {
      setError('Could not download the PDF. Please try again.');
    } finally {
      setPdfBusyId(null);
    }
  }

  async function handleDownloadContract(checkIn: GuestCheckIn) {
    if (!session || contractPdfBusyId) return;
    setError(null);
    setContractPdfBusyId(checkIn.id);
    try {
      await downloadAndShare(contractPdfUrl(checkIn.id), `contract-${checkIn.id}.pdf`, 'application/pdf', {
        Authorization: `Bearer ${session.accessToken}`,
      });
    } catch (err) {
      setError('Could not download the contract. Please try again.');
    } finally {
      setContractPdfBusyId(null);
    }
  }

  if (!property) return <LoadingScreen />;

  const doorPhotos = property.photos?.filter((p) => p.type === 'DOOR_PHOTO') ?? [];

  /**
   * The cover photo, asked for at the size it's actually drawn at.
   *
   * It used to request a flat 800px wide with `c_limit`, which on a 3x
   * phone is an upscale — the hero is the full content width (~342pt →
   * ~1030 real pixels), so the device was stretching an 800px image to
   * fill it and then cropping it to 170pt tall itself. That is why a big
   * photo looked worse than the small thumbnails of the same image
   * elsewhere in the app.
   *
   * Now it asks for the real pixel dimensions and lets the server do the
   * crop, so what arrives is exactly what gets drawn. Capped at 2000px
   * so a future tablet or a very high-density screen can't request
   * something absurd.
   */
  const heroWidthPx = Math.min(
    2000,
    PixelRatio.getPixelSizeForLayoutSize(windowWidth - spacing.lg * 2),
  );
  const coverUrl = propertyCoverUrl(property, heroWidthPx, {
    height: PixelRatio.getPixelSizeForLayoutSize(COVER_HEIGHT),
    crop: 'lfill',
    quality: 'auto:good',
  });

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: property.name,
          headerBackTitle: 'Back',
          headerRight: () => (
            <Pressable onPress={() => router.push(`/host/property-settings/${property.id}`)} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl * 2 + insets.bottom }]}
      >
        {/* The cover photo the Hospitable sync already imports — shown here
            so the property page opens on something recognisable rather than
            a wall of text. Properties with no photo just start at the name,
            no placeholder box. */}
        {coverUrl && <Image source={{ uri: coverUrl }} style={styles.cover} />}
        <Text style={typography.h1}>{property.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
          <Text style={typography.bodyMuted}>
            {property.addressLine}, {property.city.name}
          </Text>
        </View>
        <Text style={typography.caption}>
          {property.bedrooms} bed · {property.bathrooms} bath · up to {property.maxGuests} guests
        </Text>
        {property.nightlyRate && <Text style={styles.rate}>{Number(property.nightlyRate).toFixed(0)} MAD / night</Text>}

        {property.hospitableListingId && (
          <View style={styles.syncNotice}>
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={[typography.caption, { flex: 1 }]}>
              Imported from Airbnb — name, address, and room counts sync automatically. Edit those on Airbnb, not here.
            </Text>
          </View>
        )}

        {error && <ErrorBanner message={error} onRetry={load} />}

        {/* Status, and a way to set it by hand.

            Worth understanding before changing this: picking a status writes
            `manualStatusOverride` on the property, and the backend applies
            that override *last*, after everything it works out from
            bookings and reservations. So it sticks — a property set to
            "Needs cleaning" stays that way even after a cleaning is
            completed, until it's put back on automatic. That's why the
            override is called out on screen rather than left silent, and
            why "Back to automatic" is always offered. */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <StatusBadge
              label={PROPERTY_STATUS_LABELS[effectiveStatus] ?? effectiveStatus}
              tone={PROPERTY_STATUS_TONE[effectiveStatus] ?? 'neutral'}
            />
          </View>
          <View style={styles.statusChips}>
            {SETTABLE_STATUSES.map((s) => (
              <Pressable
                key={s}
                disabled={statusBusy !== null}
                onPress={() => handleSetStatus(s)}
                style={[styles.statusChip, property.manualStatusOverride === s && styles.statusChipActive]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    property.manualStatusOverride === s && styles.statusChipTextActive,
                  ]}
                >
                  {statusBusy === s ? '…' : PROPERTY_STATUS_LABELS[s]}
                </Text>
              </Pressable>
            ))}
          </View>
          {property.manualStatusOverride ? (
            <Pressable onPress={() => handleSetStatus(null)} disabled={statusBusy !== null}>
              <Text style={styles.statusAuto}>
                Set by you — it won't change on its own. Tap to go back to automatic.
              </Text>
            </Pressable>
          ) : (
            <Text style={typography.caption}>Working itself out from bookings and cleanings.</Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <Button
            label="Request a cleaning"
            onPress={() => router.push({ pathname: '/host/booking/new', params: { propertyId: property.id } })}
            style={{ flex: 1 }}
          />
          <Button
            label={isMarkingReady ? '…' : 'Mark ready'}
            onPress={handleMarkReady}
            loading={isMarkingReady}
            variant="outline"
            style={{ flex: 1 }}
          />
        </View>

        <Button
          label="Log an expense for this property"
          onPress={() => router.push({ pathname: '/host/expense/new', params: { propertyId: property.id } })}
          variant="outline"
          style={{ marginTop: spacing.sm }}
        />

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Guest check-ins</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/host/checkin/new', params: { propertyId: property.id } })}
            style={styles.addButton}
          >
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        </View>

        {checkIns.length === 0 ? (
          <Card>
            <Text style={typography.bodyMuted}>
              No check-in links yet. Add one to collect the guest's arrival details and ID before you meet them.
            </Text>
          </Card>
        ) : (
          // Collapsed into months rather than one long flat list: a property
          // that has been synced with Airbnb for a while accumulates a link
          // per reservation, and the ones a host wants are nearly always in
          // the current month. Nearest month opens by default; the rest are
          // one tap away. Same grouping helper the Guests screen uses.
          checkInMonths.map((group, groupIndex) => {
            const open = openCheckInMonths[group.key] ?? groupIndex === 0;
            return (
              <View
                key={group.key}
                onLayout={(e) => {
                  groupTops.current[group.key] = e.nativeEvent.layout.y;
                }}
              >
                <Pressable
                  style={styles.monthHeader}
                  onPress={() => setOpenCheckInMonths((prev) => ({ ...prev, [group.key]: !open }))}
                >
                  <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={15} color={colors.primary} />
                  <Text style={styles.monthLabel}>{group.label}</Text>
                  <Text style={styles.monthCount}>{group.items.length}</Text>
                </Pressable>
                {open &&
                  group.items.map((c) => (
          <View
            key={c.id}
            onLayout={(e) => {
              // Relative to this month group; the group's own offset is
              // recorded above and the two are summed when scrolling.
              cardTops.current[c.id] = e.nativeEvent.layout.y;
            }}
          >
            <Card style={[{ marginBottom: spacing.sm }, highlightId === c.id && styles.highlightedCheckIn]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={styles.checkinTitleRow}>
                    <Text style={typography.h3}>
                      {c.guestFirstName ? `${c.guestFirstName} ${c.guestLastName ?? ''}`.trim() : c.guestNameHint || 'Guest'}
                    </Text>
                    {c.externalReservationId && (
                      <View style={styles.syncBadge}>
                        <Ionicons name="link-outline" size={11} color={colors.primary} />
                        <Text style={styles.syncBadgeText}>Airbnb</Text>
                      </View>
                    )}
                  </View>
                  <Text style={typography.bodyMuted}>
                    {new Date(c.expectedCheckIn).toLocaleDateString()} → {new Date(c.expectedCheckOut).toLocaleDateString()}
                    {c.guestCount > 1 ? ` · ${c.guestCount} guests` : ''}
                  </Text>
                </View>
                <StatusBadge label={CHECKIN_STATUS_LABEL[c.status] ?? c.status} tone={CHECKIN_STATUS_TONE[c.status] ?? 'neutral'} />
              </View>

              {c.externalReservationId && c.status === 'PENDING' && (
                <Text style={[typography.caption, { marginTop: 4 }]}>
                  Created automatically from an Airbnb booking — share the link below to collect the guest's details.
                </Text>
              )}

              {c.status === 'SUBMITTED' && (
                <View style={{ marginTop: spacing.sm }}>
                  {c.guestPhone && <Text style={styles.detailLine}>Phone: {c.guestPhone}</Text>}
                  {c.nationality && (
                    <Text style={styles.detailLine}>
                      {c.nationality} · {c.idType === 'passport' ? 'Passport' : 'National ID'} {c.idNumber}
                    </Text>
                  )}

                  {(() => {
                    // Newer submissions carry one entry per guest in
                    // `guests` (each with its own ID photo). Older
                    // submissions only ever populated the legacy
                    // single-guest `idPhotoUrl` field — fall back to that
                    // as a synthetic one-entry list so their photo still
                    // shows up here too. `guestId` is what the signed-URL
                    // endpoint wants, and it takes the literal string
                    // 'legacy' for exactly that fallback case.
                    const idPhotos: { key: string; guestId: string; idPhotoUrl: string }[] =
                      c.guests && c.guests.length > 0
                        ? c.guests.map((g) => ({ key: g.id, guestId: g.id, idPhotoUrl: g.idPhotoUrl }))
                        : c.idPhotoUrl
                          ? [{ key: c.id, guestId: 'legacy', idPhotoUrl: c.idPhotoUrl }]
                          : [];
                    if (idPhotos.length === 0) return null;
                    return (
                      <View style={{ marginTop: spacing.sm }}>
                        <Text style={styles.idPhotoLabel}>ID photo{idPhotos.length > 1 ? 's' : ''}</Text>
                        <View style={styles.photoGrid}>
                          {idPhotos.map((g) => {
                            // Two storage eras live side by side here. Photos
                            // taken before ID documents moved to Cloudinary's
                            // authenticated delivery still hold a full,
                            // directly-loadable URL. Newer ones hold an opaque
                            // public_id that resolves to nothing on its own —
                            // those need a short-lived signed URL fetched at
                            // view time, so they render as a tap-to-open tile
                            // rather than a thumbnail.
                            if (isAbsolutePhotoUrl(g.idPhotoUrl)) {
                              return (
                                <Pressable key={g.key} onPress={() => setViewerUrl(resolveUploadUrl(g.idPhotoUrl))}>
                                  <Image
                                    source={{ uri: resolveThumbnailUrl(g.idPhotoUrl, 130) }}
                                    style={styles.idPhotoThumb}
                                  />
                                </Pressable>
                              );
                            }
                            const busy = photoBusyKey === `${c.id}:${g.guestId}`;
                            return (
                              <Pressable
                                key={g.key}
                                style={[styles.idPhotoThumb, styles.idPhotoLocked]}
                                disabled={busy}
                                onPress={() => handleViewIdPhoto(c.id, g.guestId)}
                              >
                                <Ionicons
                                  name={busy ? 'hourglass-outline' : 'eye-outline'}
                                  size={20}
                                  color={colors.primary}
                                />
                                <Text style={styles.idPhotoLockedText}>{busy ? 'Opening…' : 'View ID'}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}

                  <Pressable
                    onPress={() => handleDownloadPdf(c)}
                    style={styles.pdfRow}
                    disabled={pdfBusyId === c.id}
                  >
                    <Ionicons
                      name={pdfBusyId === c.id ? 'hourglass-outline' : 'document-text-outline'}
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                      {pdfBusyId === c.id ? 'Preparing PDF…' : 'Download check-in PDF'}
                    </Text>
                  </Pressable>

                  {c.contract && (
                    <Pressable
                      onPress={() => handleDownloadContract(c)}
                      style={styles.pdfRow}
                      disabled={contractPdfBusyId === c.id}
                    >
                      <Ionicons
                        name={contractPdfBusyId === c.id ? 'hourglass-outline' : 'document-lock-outline'}
                        size={15}
                        color={colors.primary}
                      />
                      <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                        {contractPdfBusyId === c.id ? 'Preparing contract…' : 'Download signed contract'}
                      </Text>
                    </Pressable>
                  )}

                  {c.welcomeWhatsappSent ? (
                    <View style={styles.welcomeStatusRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                      <Text style={typography.caption}>Welcome message sent</Text>
                    </View>
                  ) : c.welcomeNotifiedAt && c.welcomeWaLink ? (
                    <Button
                      label={welcomeBusyId === c.id ? 'Opening…' : 'Open WhatsApp — welcome message ready'}
                      onPress={() => handleOpenReadyWelcome(c)}
                      loading={welcomeBusyId === c.id}
                      variant="secondary"
                      style={{ marginTop: spacing.sm }}
                    />
                  ) : (
                    <>
                      <Pressable onPress={() => handleExpandWelcome(c)} style={styles.welcomeStatusRow}>
                        <Ionicons
                          name={expandedCheckInId === c.id ? 'chevron-up' : 'chatbubble-ellipses-outline'}
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                          {expandedCheckInId === c.id ? 'Hide welcome message' : 'Send welcome message'}
                        </Text>
                      </Pressable>

                      {expandedCheckInId === c.id && (
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
                                label={welcomeBusyId === c.id ? 'Sending…' : 'Send via WhatsApp'}
                                onPress={() => handleSendWelcome(c)}
                                loading={welcomeBusyId === c.id}
                              />
                            </>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {c.status === 'PENDING' && (
                <>
                  <Button
                    label={sharingId === c.id ? 'Opening…' : 'Share via WhatsApp'}
                    onPress={() => handleShareCheckIn(c)}
                    loading={sharingId === c.id}
                    variant="outline"
                    style={{ marginTop: spacing.sm }}
                  />
                  {/* Only ever on a PENDING link — see handleDeleteCheckIn. */}
                  <Pressable
                    style={styles.deleteRow}
                    onPress={() => handleDeleteCheckIn(c)}
                    disabled={deleteBusyId === c.id}
                  >
                    <Ionicons
                      name={deleteBusyId === c.id ? 'hourglass-outline' : 'trash-outline'}
                      size={14}
                      color={colors.danger}
                    />
                    <Text style={styles.deleteText}>
                      {deleteBusyId === c.id ? 'Deleting…' : 'Delete this link'}
                    </Text>
                  </Pressable>
                </>
              )}
            </Card>
          </View>
                  ))}
              </View>
            );
          })
        )}

        {(property.checkInTime || property.checkOutTime) && (
          <>
            <Text style={styles.sectionTitle}>Check-in / check-out</Text>
            <Card>
              <Text style={typography.body}>
                Check-in {property.checkInTime ?? '—'} · Check-out {property.checkOutTime ?? '—'}
              </Text>
            </Card>
          </>
        )}

        {(property.gateCode || property.doorAccessCode || property.apartmentNumber || property.accessInstructions) && (
          <>
            <Text style={styles.sectionTitle}>Access details</Text>
            <Card>
              {property.apartmentNumber && <Text style={styles.detailLine}>Unit / apartment: {property.apartmentNumber}</Text>}
              {property.gateCode && <Text style={styles.detailLine}>Gate code: {property.gateCode}</Text>}
              {property.doorAccessCode && <Text style={styles.detailLine}>Door code: {property.doorAccessCode}</Text>}
              {property.accessInstructions && (
                <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{property.accessInstructions}</Text>
              )}
            </Card>
          </>
        )}

        {property.wifiInfo && (
          <>
            <Text style={styles.sectionTitle}>Wifi</Text>
            <Card>
              <Text style={typography.body}>{property.wifiInfo}</Text>
            </Card>
          </>
        )}

        {property.houseRules && (
          <>
            <Text style={styles.sectionTitle}>House rules</Text>
            <Card>
              <Text style={typography.body}>{property.houseRules}</Text>
            </Card>
          </>
        )}

        {doorPhotos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Door / access photos</Text>
            <View style={styles.photoGrid}>
              {doorPhotos.map((p) => (
                <Pressable key={p.id} onPress={() => setViewerUrl(resolveUploadUrl(p.url))}>
                  <Image source={{ uri: resolveThumbnailUrl(p.url, 170) }} style={styles.photo} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Button
          label="Automation settings"
          onPress={() => router.push(`/host/property-settings/${property.id}`)}
          variant="outline"
          style={{ marginTop: spacing.xl }}
        />

        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
          <Text style={[typography.bodyMuted, { flex: 1 }]}>
            iCal sync and general property photos are managed from the ReadyDar web dashboard for now.
          </Text>
        </View>
      </ScrollView>

      <PhotoViewerModal uri={viewerUrl} onClose={() => setViewerUrl(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /**
   * `paddingTop` is deliberately larger than `padding`: this page opens on
   * a big wrapping property name directly under the navigation header, and
   * at the plain `lg` it read as jammed against it.
   *
   * `paddingBottom` is set at render time from the safe-area inset rather
   * than here — see the ScrollView. `Screen` only applies the `top` edge,
   * so on a phone with a gesture bar the last control on a pushed screen
   * ends up sitting on the system back key.
   */
  container: { padding: spacing.lg, paddingTop: spacing.xl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  rate: { marginTop: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: 13 },
  checkinTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  syncBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  syncNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  detailLine: { ...typography.body, marginBottom: 2 },
  welcomeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photo: { width: 84, height: 84, borderRadius: radius.sm },
  idPhotoLabel: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  monthLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.ink },
  monthCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkMuted,
    backgroundColor: 'rgba(27,31,35,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(27,31,35,0.06)',
  },
  idPhotoThumb: { width: 64, height: 64, borderRadius: radius.sm },
  idPhotoLocked: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,109,119,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  idPhotoLockedText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  deleteText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.xl },
  statusCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  statusHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { ...typography.bodyMuted, fontWeight: '700', fontSize: 12, letterSpacing: 0.4 },
  statusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.sand,
  },
  statusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  statusChipTextActive: { color: colors.white },
  statusAuto: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  /** Brief tint on the check-in a notification linked to — see the ?checkin= effect. */
  highlightedCheckIn: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.successBg,
  },
});
