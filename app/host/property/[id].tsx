import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Linking,
  Alert,
  PixelRatio,
  useWindowDimensions,
} from 'react-native';
import { Text } from '@/components/text';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { downloadAndShare } from '@/lib/files';
import { bucketOf, groupByMonth } from '@/lib/checkin-groups';
import { rtlFlip } from '@/lib/rtl';
import { PROPERTY_STATUS_TONE, PropertyStatus } from '@/lib/status';
import { useLanguage } from '@/lib/i18n/language-context';
import { useHostAccess } from '@/lib/access';
import { ChannelMark } from '@/components/channel-mark';
import { useLargeTitle } from '@/lib/large-title';
import * as ImagePicker from 'expo-image-picker';

/**
 * The statuses a host can set by hand — the same four the web dashboard's
 * status menu offers. `OCCUPIED` covers a stay the system doesn't know
 * about (a direct or offline guest); like any override it sticks until
 * "Back to automatic", which the card always offers.
 */
const SETTABLE_STATUSES: PropertyStatus[] = ['OCCUPIED', 'NEEDS_CLEANING', 'IN_PROGRESS', 'READY'];

/**
 * Height of the cover photo, in logical points. A constant rather than a
 * number in the stylesheet because the image URL is built from it too —
 * if the two drift apart the server crops to one shape and the view draws
 * another, and the picture goes soft again.
 */
const COVER_HEIGHT = 170;

/** Dot and label colour for each check-in's status in the compact rows. */
const STAY_TONE: Record<string, string> = {
  PENDING: colors.warning,
  SUBMITTED: colors.success,
  EXPIRED: colors.inkFaint,
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

/**
 * A door photo thumbnail that falls back to a plain tile when the image
 * won't load — a dead link used to leave an empty gap under the heading.
 */
function DoorPhotoThumb({ uri, onPress, onLongPress }: { uri: string; onPress: () => void; onLongPress?: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      {broken ? (
        <View style={[styles.photo, styles.photoBroken]}>
          <Ionicons name="image-outline" size={20} color={colors.inkFaint} />
        </View>
      ) : (
        <Image source={{ uri }} style={styles.photo} onError={() => setBroken(true)} />
      )}
    </Pressable>
  );
}

export default function PropertyDetailScreen() {
  const largeTitle = useLargeTitle();
  // `checkin` is optional and only ever set when something linked straight to
  // one — Home's notification bell, today. It opens that check-in's month
  // group and scrolls to it, so a host who taps "Sarah completed their
  // check-in" lands on Sarah's card rather than the top of the page.
  const { id, checkin: focusCheckInId } = useLocalSearchParams<{ id: string; checkin?: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'FR' ? 'fr-FR' : lang === 'AR' ? 'ar-MA' : 'en-GB';
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { isManager, has } = useHostAccess();
  const canCheckins = has('CHECKINS');
  const canExpenses = has('EXPENSES');
  const canCleaningReports = has('CLEANING_REPORTS');
  const [property, setProperty] = useState<Property | null>(null);
  const [checkIns, setCheckIns] = useState<GuestCheckIn[]>([]);
  // Gates the Cleaning Reports button below — undefined while loading,
  // true on fetch failure (fail open; CleaningReportsService enforces the
  // real check server-side on report creation regardless of this).
  const [cleaningReportsEnabled, setCleaningReportsEnabled] = useState<boolean | undefined>(undefined);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expandedCheckInId, setExpandedCheckInId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [welcomeBusyId, setWelcomeBusyId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  /** Which photo is uploading — the cover, or a new door photo. */
  const [photoBusy, setPhotoBusy] = useState<'cover' | 'door' | null>(null);
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
  /** Each open month's row list, relative to its month group. */
  const listTops = useRef<Record<string, number>>({});
  /** The check-in row whose details are open (one at a time). */
  const [openRowId, setOpenRowId] = useState<string | null>(null);
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
      // Only the override is taken from the response. The endpoint returns
      // the bare property row — no `city`, no `photos` — and swapping that in
      // whole made the render read `property.city.name` off undefined, which
      // crashed the screen to black. The reload right after brings the full
      // record and the derived status behind the override.
      setProperty((prev) => (prev ? { ...prev, manualStatusOverride: updated.manualStatusOverride } : prev));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorSetStatus);
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
        // A Staff co-host can have CALENDAR (which is all this page itself
        // needs) without CHECKINS — that 403s here. Tolerated the same way
        // getStatusOverview already is just below: the check-ins section
        // just renders empty for them instead of the whole page failing to
        // load over one section they don't have access to.
        api.checkins.listForProperty(id, session.accessToken).catch(() => [] as GuestCheckIn[]),
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
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorLoad);
    }
  }, [session, id]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    api.billing
      .getEntitlements(session.accessToken)
      .then((e) => { if (!cancelled) setCleaningReportsEnabled(e.cleaningReportsEnabled); })
      .catch(() => { if (!cancelled) setCleaningReportsEnabled(true); });
    return () => { cancelled = true; };
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** This property's check-in links bucketed by the month the stay starts in. */
  const checkInMonths = useMemo(() => groupByMonth(checkIns, (c) => c.expectedCheckIn, t), [checkIns, t]);

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
    setOpenRowId(focusCheckInId);
    const scroll = setTimeout(() => {
      const groupY = groupTops.current[group.key];
      const listY = listTops.current[group.key] ?? 0;
      const cardY = cardTops.current[focusCheckInId];
      // Nothing measured yet (the group never rendered) — leave the page
      // where it is rather than scrolling somewhere arbitrary. The month is
      // open and the card is tinted either way.
      if (groupY == null || cardY == null) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, groupY + listY + cardY - 90), animated: true });
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
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorMarkReady);
    } finally {
      setIsMarkingReady(false);
    }
  }

  /** Picks a photo from the library and saves it as the cover or as a new door/access photo. */
  async function handleAddPhoto(kind: 'cover' | 'door') {
    if (!session || !id) return;
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    } catch {
      setError(t.propertyDetail.errorPhotoAccess);
      return;
    }
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const file = { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' };
    setError(null);
    setPhotoBusy(kind);
    try {
      if (kind === 'cover') await api.properties.uploadCoverPhoto(id, file, session.accessToken);
      else await api.properties.uploadDoorPhoto(id, file, session.accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorUploadPhoto);
    } finally {
      setPhotoBusy(null);
    }
  }

  function confirmDeleteDoorPhoto(photoId: string) {
    Alert.alert(t.propertyDetail.deleteDoorPhotoTitle, t.propertyDetail.deleteDoorPhotoMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.propertyDetail.deleteDoorPhotoConfirm,
        style: 'destructive',
        onPress: async () => {
          if (!session || !id) return;
          try {
            await api.properties.deleteDoorPhoto(id, photoId, session.accessToken);
            await load();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : t.propertyDetail.errorUploadPhoto);
          }
        },
      },
    ]);
  }

  async function handleShareCheckIn(checkIn: GuestCheckIn) {
    setSharingId(checkIn.id);
    try {
      const url = resolveCheckInUrl(checkIn.token);
      // timeZone UTC — calendar date stored as UTC midnight; goes into the
      // guest's WhatsApp. Same note as (host-tabs)/dashboard.tsx.
      const arriving = new Date(checkIn.expectedCheckIn).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      });
      const text = t.propertyDetail.checkInShareMessage(property ? property.name : null, arriving, url);
      // Target the guest's own number directly when known — see the
      // matching comment on dashboard.tsx's handleShareCheckInLink. Without
      // this, wa.me/?text=... has no recipient and just opens WhatsApp's
      // contact picker even when checkIn.guestPhone is already on file.
      const digits = checkIn.guestPhone?.replace(/[^\d]/g, '');
      const target = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
      await Linking.openURL(`${target}?text=${encodeURIComponent(text)}`);
    } finally {
      setSharingId(null);
    }
  }

  /**
   * Opens a WhatsApp chat straight to the guest's own number — as opposed to
   * `handleShareCheckIn`, which shares the check-in *link* for the guest to
   * fill in themselves. This only ever shows for a check-in whose phone came
   * from Hospitable's synced reservation data (a guest who hasn't submitted
   * the online check-in form yet has no other way to be reached), so the
   * host can message them ("what time will you arrive?", an early
   * check-in question, etc.) well before the guest ever opens the form.
   */
  function handleMessageGuestWhatsApp(checkIn: GuestCheckIn) {
    if (!checkIn.guestPhone) return;
    const digits = checkIn.guestPhone.replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${digits}`);
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
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorPreview);
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
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorSendWelcome);
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
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorOpenWhatsApp);
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
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorOpenIdPhoto);
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
    const label = checkIn.guestNameHint?.trim() || t.propertyDetail.guestFallback;
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t.propertyDetail.deleteCheckInTitle,
        t.propertyDetail.deleteCheckInMessage(label),
        [
          { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
          { text: t.propertyDetail.deleteThisLink, style: 'destructive', onPress: () => resolve(true) },
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
      setError(err instanceof ApiError ? err.message : t.propertyDetail.errorDeleteCheckIn);
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
      setError(t.propertyDetail.errorDownloadPdf);
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
      setError(t.propertyDetail.errorDownloadContract);
    } finally {
      setContractPdfBusyId(null);
    }
  }

  if (!property) {
    // A permission gap (a Staff co-host without CALENDAR, say) or any other
    // load failure used to leave this screen spinning forever: `error` was
    // set, but nothing ever checked it before this point, and `property`
    // never arrives to get past it. Surface it instead of spinning.
    if (error) {
      return (
        <Screen>
          <View style={{ padding: spacing.lg }}>
            <ErrorBanner message={error} onRetry={load} />
          </View>
        </Screen>
      );
    }
    return <LoadingScreen />;
  }

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
          title: largeTitle.headerTitle(property.name),
          headerBackTitle: t.propertyDetail.headerBack,
          // Settings (rate, welcome message, access codes, turnover alerts)
          // are all @MinHostRole('MANAGER') on the API.
          headerRight: !isManager ? undefined : () => (
            <Pressable onPress={() => router.push(`/host/property-settings/${property.id}`)} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        {...largeTitle.scrollProps}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl * 2 + insets.bottom }]}
      >
        {/* The cover photo (imported from Airbnb, or added here) — so the
            page opens on the place itself rather than a wall of text.
            Without one, managers get a quiet box to add it; anyone else
            just starts at the name. */}
        {coverUrl ? (
          <View>
            <Image source={{ uri: coverUrl }} style={styles.cover} />
            {isManager && (
              <Pressable
                onPress={() => handleAddPhoto('cover')}
                disabled={photoBusy !== null}
                style={styles.coverChange}
                accessibilityRole="button"
              >
                <Ionicons name="camera-outline" size={14} color={colors.ink} />
                <Text style={styles.coverChangeText}>
                  {photoBusy === 'cover' ? t.propertyDetail.uploadingPhoto : t.propertyDetail.changeCoverPhoto}
                </Text>
              </Pressable>
            )}
          </View>
        ) : isManager ? (
          <Pressable
            onPress={() => handleAddPhoto('cover')}
            disabled={photoBusy !== null}
            style={({ pressed }) => [styles.coverEmpty, pressed && { backgroundColor: colors.surface2 }]}
            accessibilityRole="button"
          >
            <Ionicons name="image-outline" size={22} color={colors.inkFaint} />
            <Text style={styles.coverEmptyText}>
              {photoBusy === 'cover' ? t.propertyDetail.uploadingPhoto : t.propertyDetail.addCoverPhoto}
            </Text>
          </Pressable>
        ) : null}
        <Text style={typography.h1} {...largeTitle.titleProps}>{property.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
          <Text style={typography.bodyMuted}>
            {property.addressLine}, {property.city.name}
          </Text>
        </View>
        <Text style={typography.caption}>
          {t.propertiesList.bedBathGuests(property.bedrooms, property.bathrooms, property.maxGuests)}
        </Text>
        {property.nightlyRate && <Text style={styles.rate}>{t.propertiesList.ratePerNight(Math.round(Number(property.nightlyRate)), property.currency ?? 'MAD')}</Text>}

        {property.hospitableListingId && (
          <View style={styles.syncNotice}>
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={[typography.caption, { flex: 1 }]}>
              {t.propertyDetail.syncNotice}
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
            <Text style={styles.statusLabel}>{t.propertyDetail.statusLabel}</Text>
            <StatusBadge
              label={t.propertyStatus[effectiveStatus] ?? effectiveStatus}
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
                  {statusBusy === s ? '…' : t.propertyStatus[s]}
                </Text>
              </Pressable>
            ))}
          </View>
          {property.manualStatusOverride ? (
            <Pressable onPress={() => handleSetStatus(null)} disabled={statusBusy !== null}>
              <Text style={styles.statusAuto}>
                {t.propertyDetail.statusAuto}
              </Text>
            </Pressable>
          ) : (
            <Text style={typography.caption}>{t.propertyDetail.statusWorkingItOut}</Text>
          )}
        </View>

        {/*
          One button, for the one thing this place may be waiting on: once
          it's cleaned, Mark ready. Everything else is a quiet list below —
          four bordered buttons of equal weight read as a wall, and none of
          them stood out as the thing to do.
        */}
        {effectiveStatus !== 'READY' && (
          <Button
            label={isMarkingReady ? '…' : t.propertyDetail.markReady}
            onPress={handleMarkReady}
            loading={isMarkingReady}
            style={{ marginTop: spacing.lg }}
          />
        )}

        {(canExpenses || canCleaningReports) && (
        <View style={styles.actionList}>
          {[
            canExpenses && {
              key: 'expense',
              icon: 'receipt-outline' as const,
              label: t.propertyDetail.logExpense,
              onPress: () => router.push({ pathname: '/host/expense/new', params: { propertyId: property.id } }),
            },
            canCleaningReports && {
              key: 'reports',
              icon: 'document-text-outline' as const,
              label: t.propertyDetail.cleaningReports,
              onPress: () =>
                cleaningReportsEnabled === false
                  ? Alert.alert(t.cleaningReports.upgradeTitle, t.cleaningReports.upgradeBody)
                  : router.push({ pathname: '/host/cleaning-reports', params: { propertyId: property.id } }),
            },
          ]
            .filter((a): a is Exclude<typeof a, false> => !!a)
            .map((a, i) => (
              <Pressable
                key={a.key}
                onPress={a.onPress}
                style={({ pressed }) => [styles.actionItem, i > 0 && styles.actionDivider, pressed && { backgroundColor: colors.surface2 }]}
                accessibilityRole="button"
              >
                <Ionicons name={a.icon} size={18} color={colors.inkMuted} />
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} style={rtlFlip} />
              </Pressable>
            ))}
        </View>
        )}

        {canCheckins && (
        <>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>{t.propertyDetail.guestCheckIns}</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/host/checkin/new', params: { propertyId: property.id } })}
            hitSlop={8}
            style={({ pressed }) => [styles.newLink, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={16} color={colors.green700} />
            <Text style={styles.newLinkText}>{t.propertyDetail.newCheckInLink}</Text>
          </Pressable>
        </View>

        {checkIns.length === 0 ? (
          <Card>
            <Text style={typography.bodyMuted}>
              {t.propertyDetail.noCheckInsYet}
            </Text>
          </Card>
        ) : (
          // Collapsed into months rather than one long flat list: a property
          // that has been synced with Airbnb for a while accumulates a link
          // per reservation, and the ones a host wants are nearly always in
          // the current month. Nearest month opens by default; the rest are
          // one tap away. Same grouping helper the Guests screen uses.
          //
          // Each stay is one compact row (date, guest, stay length, status);
          // its details and actions open in place on tap, so a month of
          // bookings reads as a list rather than a wall of buttons.
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
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <Text style={styles.monthLabel}>
                    {group.label}
                    <Text style={styles.monthCount}>{`  ${group.items.length}`}</Text>
                  </Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkFaint} />
                </Pressable>
                {open && (
                  <View
                    style={styles.stayList}
                    onLayout={(e) => {
                      listTops.current[group.key] = e.nativeEvent.layout.y;
                    }}
                  >
                    {group.items.map((c, i) => {
                      const name = c.guestFirstName
                        ? `${c.guestFirstName} ${c.guestLastName ?? ''}`.trim()
                        : c.guestNameHint || t.propertyDetail.guestFallback;
                      // UTC — these are calendar dates; see the note on `arriving` above.
                      const start = new Date(c.expectedCheckIn);
                      const end = new Date(c.expectedCheckOut);
                      const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
                      const short = (d: Date) => d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
                      const meta = [
                        `${short(start)} → ${short(end)}`,
                        nights > 0 ? t.calendarHost.nightsCount(nights) : null,
                        c.guestCount > 1 ? t.common.guestsCount(c.guestCount) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      // The label follows the Guests screen's rule: a link still
                      // PENDING after its stay has ended reads as expired —
                      // otherwise last month's guests show "Waiting" here and
                      // "Expired" there. The actions still follow the stored
                      // status, so a stale link can still be shared or deleted.
                      const bucket = bucketOf(c);
                      const shownStatus = bucket === 'UPCOMING' ? 'PENDING' : bucket;
                      const expandable = c.status === 'PENDING' || c.status === 'SUBMITTED';
                      const expanded = expandable && openRowId === c.id;
                      const tone = STAY_TONE[shownStatus];
                      return (
                        <View
                          key={c.id}
                          style={[i > 0 && styles.stayDivider, highlightId === c.id && styles.highlightedCheckIn]}
                          onLayout={(e) => {
                            // Relative to this month's list; the list's and
                            // the group's own offsets are added when scrolling.
                            cardTops.current[c.id] = e.nativeEvent.layout.y;
                          }}
                        >
                          <Pressable
                            disabled={!expandable}
                            onPress={() => setOpenRowId(expanded ? null : c.id)}
                            style={({ pressed }) => [styles.stayRow, pressed && { backgroundColor: colors.surface2 }]}
                            accessibilityRole="button"
                            accessibilityState={{ expanded }}
                          >
                            <View style={styles.dateBlock}>
                              <Text style={styles.dateDay}>{start.getUTCDate()}</Text>
                              <Text style={styles.dateWeekday}>
                                {start.toLocaleDateString(dateLocale, { weekday: 'short', timeZone: 'UTC' })}
                              </Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={styles.stayNameRow}>
                                {c.externalReservationId && <ChannelMark provider="AIRBNB" size={16} />}
                                <Text style={styles.stayName} numberOfLines={1}>
                                  {name}
                                </Text>
                              </View>
                              <Text style={styles.stayMeta} numberOfLines={1}>
                                {meta}
                              </Text>
                              <View style={styles.stayStatus}>
                                <View style={[styles.statusDot, { backgroundColor: tone }]} />
                                <Text style={[styles.statusText, { color: tone }]}>
                                  {t.propertyDetail.checkInStatusShort[shownStatus]}
                                </Text>
                              </View>
                            </View>
                            {expandable && (
                              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkFaint} />
                            )}
                          </Pressable>

                          {expanded && c.status === 'PENDING' && (
                            <View style={styles.stayPanel}>
                              {c.externalReservationId && <Text style={styles.panelNote}>{t.propertyDetail.createdFromAirbnb}</Text>}
                              {c.guestPhone && <Text style={styles.detailLine}>{t.propertyDetail.phoneLabel(c.guestPhone)}</Text>}
                              <View style={styles.panelActions}>
                                <Button
                                  label={sharingId === c.id ? t.propertyDetail.openingEllipsis : t.propertyDetail.shareLink}
                                  onPress={() => handleShareCheckIn(c)}
                                  loading={sharingId === c.id}
                                  style={{ flex: 1 }}
                                />
                                {c.guestPhone && (
                                  <Button
                                    label={t.propertyDetail.whatsappGuest}
                                    onPress={() => handleMessageGuestWhatsApp(c)}
                                    variant="secondary"
                                    style={{ flex: 1 }}
                                  />
                                )}
                              </View>
                              {/* Only ever on a PENDING link — see handleDeleteCheckIn. */}
                              <Pressable
                                style={styles.panelLink}
                                onPress={() => handleDeleteCheckIn(c)}
                                disabled={deleteBusyId === c.id}
                                hitSlop={6}
                              >
                                <Ionicons
                                  name={deleteBusyId === c.id ? 'hourglass-outline' : 'trash-outline'}
                                  size={15}
                                  color={colors.danger}
                                />
                                <Text style={[styles.panelLinkText, { color: colors.danger }]}>
                                  {deleteBusyId === c.id ? t.propertyDetail.deletingEllipsis : t.propertyDetail.deleteThisLink}
                                </Text>
                              </Pressable>
                            </View>
                          )}

                          {expanded && c.status === 'SUBMITTED' && (
                            <View style={styles.stayPanel}>
                              {c.guestPhone && <Text style={styles.detailLine}>{t.propertyDetail.phoneLabel(c.guestPhone)}</Text>}
                              {c.nationality && (
                                <Text style={styles.detailLine}>
                                  {t.propertyDetail.nationalityIdLine(c.nationality, c.idType === 'passport' ? t.propertyDetail.passport : t.propertyDetail.nationalId, c.idNumber ?? '')}
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
                                    <Text style={styles.idPhotoLabel}>{idPhotos.length > 1 ? t.propertyDetail.idPhotos : t.propertyDetail.idPhoto}</Text>
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
                                              size={18}
                                              color={colors.inkMuted}
                                            />
                                            <Text style={styles.idPhotoLockedText}>{busy ? t.propertyDetail.openingEllipsis : t.propertyDetail.viewId}</Text>
                                          </Pressable>
                                        );
                                      })}
                                    </View>
                                  </View>
                                );
                              })()}

                              <View style={styles.docRow}>
                                <Pressable
                                  onPress={() => handleDownloadPdf(c)}
                                  style={({ pressed }) => [styles.docChip, pressed && { backgroundColor: colors.surface2 }]}
                                  disabled={pdfBusyId === c.id}
                                >
                                  <Ionicons
                                    name={pdfBusyId === c.id ? 'hourglass-outline' : 'document-text-outline'}
                                    size={15}
                                    color={colors.inkMuted}
                                  />
                                  <Text style={styles.docChipText}>
                                    {pdfBusyId === c.id ? t.propertyDetail.preparingPdf : t.propertyDetail.checkInPdf}
                                  </Text>
                                </Pressable>
                                {c.contract && (
                                  <Pressable
                                    onPress={() => handleDownloadContract(c)}
                                    style={({ pressed }) => [styles.docChip, pressed && { backgroundColor: colors.surface2 }]}
                                    disabled={contractPdfBusyId === c.id}
                                  >
                                    <Ionicons
                                      name={contractPdfBusyId === c.id ? 'hourglass-outline' : 'document-lock-outline'}
                                      size={15}
                                      color={colors.inkMuted}
                                    />
                                    <Text style={styles.docChipText}>
                                      {contractPdfBusyId === c.id ? t.propertyDetail.preparingContract : t.propertyDetail.contractPdf}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>

                              {c.welcomeWhatsappSent ? (
                                <View style={styles.panelLink}>
                                  <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                                  <Text style={[styles.panelLinkText, { color: colors.success }]}>{t.propertyDetail.welcomeMessageSent}</Text>
                                </View>
                              ) : c.welcomeNotifiedAt && c.welcomeWaLink ? (
                                <Button
                                  label={welcomeBusyId === c.id ? t.propertyDetail.openingEllipsis : t.propertyDetail.openWhatsAppWelcomeReady}
                                  onPress={() => handleOpenReadyWelcome(c)}
                                  loading={welcomeBusyId === c.id}
                                  style={{ marginTop: 12 }}
                                />
                              ) : (
                                <>
                                  <Pressable onPress={() => handleExpandWelcome(c)} style={styles.panelLink} hitSlop={6}>
                                    <Ionicons
                                      name={expandedCheckInId === c.id ? 'chevron-up' : 'chatbubble-ellipses-outline'}
                                      size={15}
                                      color={colors.green700}
                                    />
                                    <Text style={styles.panelLinkText}>
                                      {expandedCheckInId === c.id ? t.propertyDetail.hideWelcomeMessage : t.propertyDetail.sendWelcomeMessage}
                                    </Text>
                                  </Pressable>

                                  {expandedCheckInId === c.id && (
                                    <View style={{ marginTop: spacing.sm }}>
                                      {isPreviewLoading ? (
                                        <Text style={typography.bodyMuted}>{t.propertyDetail.loadingPreview}</Text>
                                      ) : (
                                        <>
                                          <TextField
                                            label={t.propertyDetail.messageEditLabel}
                                            value={previewText}
                                            onChangeText={setPreviewText}
                                            multiline
                                            numberOfLines={6}
                                          />
                                          <Button
                                            label={welcomeBusyId === c.id ? t.propertyDetail.sendingEllipsis : t.propertyDetail.sendViaWhatsApp}
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
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
        </>
        )}

        {(property.checkInTime || property.checkOutTime) && (
          <>
            <Text style={styles.sectionTitle}>{t.propertyDetail.checkInOutTitle}</Text>
            <Card>
              <Text style={typography.body}>
                {t.propertyDetail.checkInOutLine(property.checkInTime ?? '—', property.checkOutTime ?? '—')}
              </Text>
            </Card>
          </>
        )}

        {(property.gateCode || property.doorAccessCode || property.apartmentNumber || property.accessInstructions) && (
          <>
            <Text style={styles.sectionTitle}>{t.propertyDetail.accessDetailsTitle}</Text>
            <Card>
              {property.apartmentNumber && <Text style={styles.detailLine}>{t.propertyDetail.unitApartment(property.apartmentNumber)}</Text>}
              {property.gateCode && <Text style={styles.detailLine}>{t.propertyDetail.gateCode(property.gateCode)}</Text>}
              {property.doorAccessCode && <Text style={styles.detailLine}>{t.propertyDetail.doorCode(property.doorAccessCode)}</Text>}
              {property.accessInstructions && (
                <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{property.accessInstructions}</Text>
              )}
            </Card>
          </>
        )}

        {property.wifiInfo && (
          <>
            <Text style={styles.sectionTitle}>{t.propertyDetail.wifiTitle}</Text>
            <Card>
              <Text style={typography.body}>{property.wifiInfo}</Text>
            </Card>
          </>
        )}

        {property.houseRules && (
          <>
            <Text style={styles.sectionTitle}>{t.propertyDetail.houseRulesTitle}</Text>
            <Card>
              <Text style={typography.body}>{property.houseRules}</Text>
            </Card>
          </>
        )}

        {(doorPhotos.length > 0 || isManager) && (
          <>
            <Text style={styles.sectionTitle}>{t.propertyDetail.doorPhotosTitle}</Text>
            {doorPhotos.length === 0 && (
              <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>{t.propertyDetail.doorPhotosEmpty}</Text>
            )}
            <View style={styles.photoGrid}>
              {doorPhotos.map((p) => (
                <DoorPhotoThumb
                  key={p.id}
                  uri={resolveThumbnailUrl(p.url, 170)}
                  onPress={() => setViewerUrl(resolveUploadUrl(p.url))}
                  onLongPress={isManager ? () => confirmDeleteDoorPhoto(p.id) : undefined}
                />
              ))}
              {isManager && (
                <Pressable
                  onPress={() => handleAddPhoto('door')}
                  disabled={photoBusy !== null}
                  style={({ pressed }) => [styles.photo, styles.addPhotoTile, pressed && { backgroundColor: colors.surface2 }]}
                  accessibilityRole="button"
                  accessibilityLabel={t.propertyDetail.addPhoto}
                >
                  <Ionicons name={photoBusy === 'door' ? 'hourglass-outline' : 'add'} size={22} color={colors.inkMuted} />
                  <Text style={styles.addPhotoText}>{t.propertyDetail.addPhoto}</Text>
                </Pressable>
              )}
            </View>
            {isManager && doorPhotos.length > 0 && <Text style={[typography.caption, { marginTop: spacing.xs }]}>{t.propertyDetail.doorPhotosHint}</Text>}
          </>
        )}

        {isManager && (
        <Button
          label={t.propertyDetail.automationSettings}
          onPress={() => router.push(`/host/property-settings/${property.id}`)}
          variant="outline"
          style={{ marginTop: spacing.xl }}
        />
        )}

        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
          <Text style={[typography.bodyMuted, { flex: 1 }]}>
            {t.propertyDetail.icalNotice}
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
  syncNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  actionList: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  actionDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  actionLabel: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: '500' },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  detailLine: { fontSize: 14, lineHeight: 20, color: colors.ink, marginBottom: 2 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photo: { width: 84, height: 84, borderRadius: radius.sm },
  idPhotoLabel: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs },
  sectionHeading: { ...typography.h2, fontSize: 18, lineHeight: 24 },
  newLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  newLinkText: { fontSize: 14, fontWeight: '500', color: colors.green700 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  monthLabel: { ...typography.label, flex: 1, color: colors.inkMuted },
  monthCount: { color: colors.inkFaint, ...typography.number },
  stayList: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stayDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  stayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  dateBlock: {
    width: 44,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: 'center',
  },
  dateDay: { fontSize: 18, lineHeight: 22, fontWeight: '600', color: colors.ink, ...typography.number },
  dateWeekday: { fontSize: 11, lineHeight: 14, fontWeight: '500', color: colors.inkMuted },
  stayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stayName: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  stayMeta: { fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginTop: 1, ...typography.number },
  stayStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  // Lines up under the guest's name, past the date block (44 + 12 gap + 14 padding).
  stayPanel: { paddingLeft: 70, paddingRight: 14, paddingBottom: 14 },
  panelNote: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.sm },
  panelActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  panelLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  panelLinkText: { fontSize: 13, fontWeight: '500', color: colors.green700 },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 12 },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docChipText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface2,
  },
  coverChange: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.md + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  coverChangeText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  coverEmpty: {
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  coverEmptyText: { fontSize: 14, fontWeight: '500', color: colors.inkMuted },
  addPhotoTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoText: { fontSize: 11, fontWeight: '500', color: colors.inkMuted },
  photoBroken: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  idPhotoThumb: { width: 64, height: 64, borderRadius: radius.sm },
  idPhotoLocked: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idPhotoLockedText: { fontSize: 10, fontWeight: '500', color: colors.inkMuted },
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
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.sand,
  },
  statusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  statusChipTextActive: { color: colors.onPrimary },
  statusAuto: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  /** Brief tint on the check-in a notification linked to — see the ?checkin= effect. */
  highlightedCheckIn: {
    backgroundColor: colors.successBg,
  },
});
