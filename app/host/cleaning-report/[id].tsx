import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, Image, Pressable, Alert, Share, PixelRatio, useWindowDimensions } from 'react-native';
import { Text } from '@/components/text';
import { useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, ApiError } from '@/lib/auth-context';
import {
  api,
  CleaningReport,
  CleaningReportPhoto,
  CalendarEvent,
  PickedFile,
  resolveUploadUrl,
  resolveThumbnailUrl,
  cleaningReportPdfUrl,
  resolveCleaningReportVerificationUrl,
} from '@/lib/api';
import { Screen, Card, LoadingScreen, StatusBadge, TextField, ErrorBanner, PhotoViewerModal } from '@/components/ui';
import { Button } from '@/components/Button';
import { downloadAndShare } from '@/lib/files';
import { useToast } from '@/lib/toast';
import { todayIso, addDaysIso, dateLocale } from '@/lib/calendar-visuals';
import { colors, radius, spacing, typography } from '@/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLanguage } from '@/lib/i18n/language-context';
import type { Lang } from '@/lib/i18n/language-context';
import type { Dict } from '@/lib/i18n/dictionary';
import { formatClock } from '@/lib/dates';

type RoomIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Room = { section: string; icon: RoomIcon };

/**
 * The rooms to photograph, as picture tiles — one per bedroom and bathroom
 * the property has, then the shared rooms. Picking a tile replaces typing an
 * area name: quicker for everyone, and usable by a cleaner who doesn't read
 * (the icon says the room). The room's name in the app's language becomes
 * the photo's section, which is what the PDF and the web viewer group by.
 */
function buildRooms(bedrooms: number, bathrooms: number, names: Dict['cleaningReports']['roomNames']): Room[] {
  const numbered = (count: number) => {
    const c = Math.min(Math.max(1, Math.round(count) || 1), 8);
    return c === 1 ? [null] : Array.from({ length: c }, (_, i) => i + 1);
  };
  return [
    ...numbered(bedrooms).map((n) => ({ section: names.bedroom(n), icon: 'bed-outline' as RoomIcon })),
    ...numbered(bathrooms).map((n) => ({ section: names.bathroom(n), icon: 'shower' as RoomIcon })),
    { section: names.kitchen, icon: 'stove' },
    { section: names.living, icon: 'sofa-outline' },
    { section: names.entrance, icon: 'door-open' },
    { section: names.outdoor, icon: 'flower-outline' },
  ];
}

/** Same formatting dashboard.tsx's checkout sheet uses for a property's configured check-in time (e.g. "3:00 PM"). Airbnb/Hospitable gives a check-in *date*, not a time — the time shown is the property's own expected check-in time, same as everywhere else in the app that shows one. */
function checkInTimeLabel(checkInTime: string | null | undefined, lang: Lang): string | null {
  const raw = checkInTime?.trim();
  return raw ? formatClock(raw, lang) : null;
}

/**
 * Logical size of a photo tile in the capture grid. Was 96 — hard to tell a
 * clean corner from a smudge at that size, especially checking your own
 * work right after taking the shot. Bumped up; still fits 2 per row
 * comfortably on a normal phone width with room for a partial 3rd.
 */
const PHOTO_SIZE = 150;

/** Groups photos by section, preserving the order sections were first added in — mirrors the PDF's own grouping and the web viewer's. */
function groupBySection(photos: CleaningReportPhoto[]): { section: string; photos: CleaningReportPhoto[] }[] {
  const order: string[] = [];
  const bySection = new Map<string, CleaningReportPhoto[]>();
  for (const p of photos) {
    if (!bySection.has(p.section)) {
      order.push(p.section);
      bySection.set(p.section, []);
    }
    bySection.get(p.section)!.push(p);
  }
  return order.map((section) => ({ section, photos: bySection.get(section)! }));
}

/**
 * The actual capture flow: name an area, tap "Take photo" (opens the
 * camera directly, and keeps reopening it until the host backs out). Each
 * shot then grabs a fresh GPS fix and uploads both together — never
 * batched, so the server's received-at clock stays close to the moment the
 * shutter was pressed. Once marked complete, the report
 * locks (no more add/remove) and this screen switches to showing the
 * verification link and a PDF share action instead.
 */
type Fix = { latitude: number; longitude: number; accuracy?: number };
/** A photo taken and waiting to go up, with the area and position of its burst. */
type Shot = { reportId: string; section: string; uri: string; capturedAt: string; fix: Fix };

/** Where a burst's area and position are kept while the camera is open (see the recovery effect). */
const burstKey = (reportId: string) => `darclean_cleaning_burst_${reportId}`;

/**
 * Where the phone is: a fix from the last two minutes if the phone has one
 * (instant), else a fresh one — given up on after 15 seconds rather than
 * leaving the host staring at a frozen button.
 */
async function currentFix(): Promise<Fix | null> {
  const toFix = (p: Location.LocationObject): Fix => ({
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: p.coords.accuracy ?? undefined,
  });
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 150 });
    if (last) return toFix(last);
  } catch {
    // fall through to a fresh fix
  }
  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000)),
    ]);
    return fresh ? toFix(fresh) : null;
  } catch {
    return null;
  }
}

export default function CleaningReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const toast = useToast();
  const { t, lang } = useLanguage();

  const { width: windowWidth } = useWindowDimensions();
  const [report, setReport] = useState<CleaningReport | null>(null);
  const [sectionInput, setSectionInput] = useState('');
  /** The "Other" tile's name field, open or not. */
  const [otherOpen, setOtherOpen] = useState(false);
  /** Bedroom and bathroom counts, for the room tiles. One of each until the property loads (or if it can't be read). */
  const [roomCounts, setRoomCounts] = useState({ bedrooms: 1, bathrooms: 1 });
  /** Set while a burst is getting its location fix, so a second tap doesn't start another. */
  const [startingBurst, setStartingBurst] = useState(false);
  /** Shots still uploading in the background — the camera doesn't wait for them, but "Mark complete" does. */
  /** Photos waiting to go up, or going up now. */
  const [pendingUploads, setPendingUploads] = useState(0);
  /** Photos that still failed after retries — kept here so they can be sent again. */
  const [failedShots, setFailedShots] = useState<Shot[]>([]);
  const queue = useRef<Shot[]>([]);
  const draining = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  /** The next confirmed guest stay for this property after today, if any — see the effect below. Silently absent (not an error) for a co-host without CALENDAR permission, or a property with nothing booked yet. */
  const [nextGuest, setNextGuest] = useState<{ event: CalendarEvent; checkInTime: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!session || !id) return;
    setError(null);
    try {
      const data = await api.cleaningReports.getDetail(id, session.accessToken);
      // Every fetch signs fresh URLs, and a changed URL makes <Image> fetch
      // the tile all over again — after each burst shot, every photo on the
      // screen re-downloaded. Tiles already on screen keep the preview URL
      // they loaded with (still cached by the image loader); only new
      // photos, or one whose preview has just been made, take the new one.
      setReport((prev) => {
        const shown = new Map((prev?.photos ?? []).map((p) => [p.id, p.thumbUrl]));
        return {
          ...data,
          photos: data.photos?.map((p) => {
            const kept = shown.get(p.id);
            return kept ? { ...p, thumbUrl: kept } : p;
          }),
        };
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cleaningReports.loadError);
    }
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Who's arriving next, and when — so a cleaner working through this
   * report can see straight away whether there's a same-day turnover to
   * hurry for. Mirrors the exact "next booking" lookup the Home screen's
   * checkout card already does (dashboard.tsx): the calendar feed 30 days
   * out, filtered to this property's non-blocked guest stays, soonest
   * first. `checkInTime` comes from the property's own configured
   * check-in time, not the reservation — Airbnb/Hospitable only ever gives
   * a check-in *date*.
   *
   * Both calls need CALENDAR permission, which a co-host can now lack
   * while still having CLEANING_REPORTS (see HostTeamPermission) — that
   * 403s here, and this section just doesn't show rather than failing the
   * whole report screen over a permission gap.
   */
  useEffect(() => {
    if (!session || !report) return;
    let cancelled = false;
    // Read on its own so the room tiles still get the right number of
    // bedrooms when the calendar call below is refused.
    const propertyCall = api.properties.getOne(report.propertyId, session.accessToken);
    propertyCall
      .then((p) => {
        if (!cancelled) setRoomCounts({ bedrooms: p.bedrooms ?? 1, bathrooms: p.bathrooms ?? 1 });
      })
      .catch(() => {});
    Promise.all([
      propertyCall,
      api.properties.getCalendar(todayIso(), addDaysIso(todayIso(), 30), session.accessToken),
    ])
      .then(([property, events]) => {
        if (cancelled) return;
        const next = events
          .filter((e) => e.propertyId === report.propertyId && e.kind === 'GUEST_STAY' && !e.isBlocked)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        setNextGuest(next ? { event: next, checkInTime: checkInTimeLabel(property.checkInTime, lang) } : null);
      })
      .catch(() => {
        if (!cancelled) setNextGuest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session, report?.propertyId]);

  /**
   * Sends queued photos one at a time, oldest first. One at a time on
   * purpose: several full-size photos racing over a phone connection all
   * crawl, and a burst of eight used to leave eight half-finished uploads.
   * A network failure is retried twice (2 s, then 5 s later); a refusal
   * from the server (report completed, too many photos…) isn't. What still
   * fails stays in `failedShots` with a Retry button — never lost silently.
   * The report reloads once the queue is empty, not after every photo.
   */
  async function drainQueue() {
    if (draining.current || !session) return;
    draining.current = true;
    try {
      while (queue.current.length) {
        const shot = queue.current[0];
        let sent = false;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3 && !sent; attempt++) {
          if (attempt) await new Promise((r) => setTimeout(r, attempt === 1 ? 2000 : 5000));
          try {
            const file: PickedFile = { uri: shot.uri, name: 'photo.jpg', type: 'image/jpeg' };
            const uploaded = await api.cleaningReports.uploadPhoto(
              shot.reportId,
              {
                section: shot.section,
                capturedAt: shot.capturedAt,
                latitude: shot.fix.latitude,
                longitude: shot.fix.longitude,
                accuracyMeters: shot.fix.accuracy,
              },
              file,
              session.accessToken,
            );
            sent = true;
            if (uploaded.timestampSuspicious) toast.show(t.cleaningReports.clockDriftWarning, 'info');
          } catch (err) {
            lastError = err;
            if (err instanceof ApiError && err.status >= 400 && err.status < 500) break;
          }
        }
        queue.current.shift();
        setPendingUploads((n) => n - 1);
        if (!sent) {
          setFailedShots((prev) => [...prev, shot]);
          setError(lastError instanceof ApiError ? lastError.message : t.cleaningReports.uploadError);
        }
      }
    } finally {
      draining.current = false;
    }
    await load();
  }

  function enqueue(shots: Shot[]) {
    if (!shots.length) return;
    queue.current.push(...shots);
    setPendingUploads((n) => n + shots.length);
    void drainQueue();
  }

  function retryFailed() {
    const shots = failedShots;
    setFailedShots([]);
    setError(null);
    enqueue(shots);
  }

  /**
   * Android can close the app while the camera is open (low memory). The
   * photo then comes back on the next start instead of to the burst loop —
   * it used to be dropped. It's picked up here, with the area and position
   * saved when that burst began.
   */
  const recovered = useRef(false);
  useEffect(() => {
    if (!report || recovered.current) return;
    recovered.current = true;
    (async () => {
      const pending = await ImagePicker.getPendingResultAsync().catch(() => null);
      if (!pending || !('assets' in pending) || pending.canceled || !pending.assets?.length) return;
      const saved = await AsyncStorage.getItem(burstKey(report.id)).catch(() => null);
      if (!saved) return;
      const { section, fix } = JSON.parse(saved) as { section: string; fix: Fix };
      enqueue(pending.assets.map((a) => ({ reportId: report.id, section, uri: a.uri, capturedAt: new Date().toISOString(), fix })));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id]);

  /**
   * Burst capture for one area: the camera reopens by itself after every
   * shot, so a host can take several photos of the same room without
   * tapping "Take photo" again each time. Backing out of the camera ends
   * the burst — then they name the next area and go again.
   *
   * The position is found once, here, while the app is on screen. It used
   * to be asked for after every shot — by then the camera was open again,
   * the app was in the background, and with "while using the app" location
   * Android held or failed the request: the first photo went up, the rest
   * waited until the burst ended, or never went. One burst is one area, so
   * one position serves all its photos.
   */
  async function startBurst(section: string) {
    if (!session || !report || startingBurst) return;
    if (!section) {
      Alert.alert(t.cleaningReports.nameAreaTitle, t.cleaningReports.nameAreaBody);
      return;
    }

    setStartingBurst(true);
    let fix: Fix | null = null;
    try {
      // Asked up front (not after the first shot) so the burst isn't
      // interrupted by a permission dialog between photos.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.cleaningReports.locationNeededTitle, t.cleaningReports.locationNeededBody);
        return;
      }
      setError(null);
      fix = await currentFix();
      if (!fix) {
        Alert.alert(t.cleaningReports.locationFixTitle, t.cleaningReports.locationFixBody);
        return;
      }
    } finally {
      setStartingBurst(false);
    }
    await AsyncStorage.setItem(burstKey(report.id), JSON.stringify({ section, fix })).catch(() => {});
    while (true) {
      // 0.5: about half the bytes of 0.7, still sharp enough to show damage.
      const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (result.canceled || !result.assets[0]) break;
      enqueue([{ reportId: report.id, section, uri: result.assets[0].uri, capturedAt: new Date().toISOString(), fix }]);
    }
    await AsyncStorage.removeItem(burstKey(report.id)).catch(() => {});
  }

  function handleRemovePhoto(photo: CleaningReportPhoto) {
    if (!session || !report) return;
    Alert.alert(t.cleaningReports.removeTitle, t.cleaningReports.removeBody, [
      { text: t.cleaningReports.cancel, style: 'cancel' },
      {
        text: t.cleaningReports.remove,
        style: 'destructive',
        onPress: async () => {
          setRemovingId(photo.id);
          setError(null);
          try {
            await api.cleaningReports.removePhoto(report.id, photo.id, session.accessToken);
            await load();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : t.cleaningReports.removeError);
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  }

  async function handleComplete() {
    if (!session || !report) return;
    setIsCompleting(true);
    setError(null);
    try {
      await api.cleaningReports.complete(report.id, session.accessToken);
      await load();
      toast.show(t.cleaningReports.completeSuccess);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cleaningReports.completeError);
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleCopyLink() {
    if (!report) return;
    const url = resolveCleaningReportVerificationUrl(report.verificationCode);
    await Clipboard.setStringAsync(url);
    setCopied(true);
    toast.show(t.cleaningReports.linkCopied);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareLink() {
    if (!report) return;
    const url = resolveCleaningReportVerificationUrl(report.verificationCode);
    await Share.share({ message: url });
  }

  async function handleSharePdf() {
    if (!session || !report || isSharingPdf) return;
    setIsSharingPdf(true);
    setError(null);
    try {
      await downloadAndShare(cleaningReportPdfUrl(report.id), `cleaning-report-${report.id}.pdf`, 'application/pdf', {
        Authorization: `Bearer ${session.accessToken}`,
      });
    } catch {
      setError(t.cleaningReports.pdfError);
    } finally {
      setIsSharingPdf(false);
    }
  }

  if (!report) {
    // Same fix as the property page: a permission gap (a co-host without
    // CLEANING_REPORTS, say) or any other load failure used to leave this
    // screen spinning forever instead of showing what went wrong.
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

  const isInProgress = report.status === 'IN_PROGRESS';
  const sections = groupBySection(report.photos ?? []);
  const photoCount = report.photos?.length ?? 0;
  const photoCountBySection = new Map(sections.map((s) => [s.section, s.photos.length]));
  const rooms = buildRooms(roomCounts.bedrooms, roomCounts.bathrooms, t.cleaningReports.roomNames);
  const roomsDone = rooms.filter((r) => photoCountBySection.has(r.section)).length;
  // Three tiles to a row across the content width (24 padding each side, 8 between).
  const tileWidth = Math.floor((windowWidth - spacing.lg * 2 - spacing.sm * 2) / 3);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: report.property?.name ?? t.cleaningReports.titleFallback,
          headerBackTitle: t.cleaningReports.back,
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {report.property && (
          <Text style={typography.bodyMuted}>
            {report.property.addressLine}
            {report.property.city ? `, ${report.property.city.name}` : ''}
          </Text>
        )}
        <View style={styles.statusRow}>
          <StatusBadge
            label={isInProgress ? t.cleaningReports.statusInProgress : t.cleaningReports.statusCompleted}
            tone={isInProgress ? 'accent' : 'primary'}
          />
          <Text style={typography.caption}>{t.cleaningReports.photoCount(photoCount)}</Text>
        </View>

        {nextGuest && (
          <Card style={styles.nextGuestCard}>
            <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nextGuestLabel}>
                {t.cleaningReports.nextGuest}
                {nextGuest.event.source === 'AIRBNB' ? ' · Airbnb' : ''}
              </Text>
              <Text style={typography.h3} numberOfLines={1}>
                {nextGuest.event.title || t.cleaningReports.guestStay}
              </Text>
              <Text style={typography.bodyMuted}>
                {new Date(nextGuest.event.date).toLocaleDateString(dateLocale(lang), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
                {nextGuest.checkInTime ? ` · ${t.cleaningReports.checkInAt(nextGuest.checkInTime)}` : ''}
              </Text>
            </View>
          </Card>
        )}

        {error && <ErrorBanner message={error} />}

        {isInProgress && (
          <View style={{ marginTop: spacing.lg }}>
            <View style={styles.roomsHeader}>
              <Text style={typography.label}>{t.cleaningReports.roomsTitle}</Text>
              <Text style={[typography.caption, typography.number]}>
                {t.cleaningReports.roomsDone(roomsDone, rooms.length)}
              </Text>
            </View>
            <View
              style={styles.progressRow}
              accessible
              accessibilityLabel={t.cleaningReports.roomsDone(roomsDone, rooms.length)}
            >
              {rooms.map((r) => (
                <View key={r.section} style={[styles.progressSeg, photoCountBySection.has(r.section) && styles.progressSegDone]} />
              ))}
            </View>
            <View style={styles.roomGrid}>
              {[...rooms, null].map((room) => {
                const count = room ? photoCountBySection.get(room.section) ?? 0 : 0;
                const done = count > 0;
                const label = room ? room.section : t.cleaningReports.otherRoom;
                return (
                  <Pressable
                    key={room?.section ?? '__other'}
                    onPress={() => (room ? startBurst(room.section) : setOtherOpen((o) => !o))}
                    disabled={startingBurst}
                    style={({ pressed }) => [
                      styles.roomTile,
                      { width: tileWidth },
                      done && styles.roomTileDone,
                      !room && styles.roomTileOther,
                      pressed && { backgroundColor: colors.surface2 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={done ? `${label}, ${t.cleaningReports.photoCount(count)}` : label}
                  >
                    <MaterialCommunityIcons
                      name={room ? room.icon : 'pencil-outline'}
                      size={34}
                      color={done ? colors.success : colors.ink}
                    />
                    <Text style={styles.roomLabel} numberOfLines={2}>
                      {label}
                    </Text>
                    <View style={[styles.roomBadge, done && styles.roomBadgeDone]}>
                      {done ? (
                        <Text style={styles.roomBadgeCount}>{count}</Text>
                      ) : (
                        <Ionicons name="camera-outline" size={13} color={colors.inkMuted} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {otherOpen && (
              <Card style={{ marginTop: spacing.sm }}>
                <TextField
                  label={t.cleaningReports.areaLabel}
                  placeholder={t.cleaningReports.areaPlaceholder}
                  value={sectionInput}
                  onChangeText={setSectionInput}
                />
                <Button
                  label={t.cleaningReports.otherRoomGo}
                  onPress={() => startBurst(sectionInput.trim())}
                  variant="outline"
                  disabled={startingBurst}
                />
              </Card>
            )}
            <Text style={[typography.caption, { marginTop: spacing.sm }]}>
              {pendingUploads > 0 ? t.cleaningReports.uploadingCount(pendingUploads) : t.cleaningReports.roomsHint}
            </Text>
            {failedShots.length > 0 && pendingUploads === 0 && (
              <View style={styles.failedRow}>
                <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
                <Text style={[typography.caption, { flex: 1, color: colors.warning }]}>
                  {t.cleaningReports.notSentCount(failedShots.length)}
                </Text>
                <Pressable onPress={retryFailed} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.retryText}>{t.cleaningReports.retryUpload}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {sections.length === 0 ? (
          <Text style={[typography.bodyMuted, { marginTop: spacing.lg }]}>{t.cleaningReports.noPhotosYet}</Text>
        ) : (
          sections.map(({ section, photos }) => (
            <View key={section} style={{ marginTop: spacing.lg }}>
              <Text style={typography.h3}>{section}</Text>
              <View style={styles.photoGrid}>
                {photos.map((p) => (
                  <View key={p.id} style={styles.photoWrap}>
                    <Pressable onPress={() => p.url && setViewerUrl(resolveUploadUrl(p.url))}>
                      {p.url ? (
                        <Image
                          // The server's small preview copy when there is one —
                          // the full photo is several MB and only needed in
                          // the full-screen viewer.
                          source={{ uri: p.thumbUrl ? p.thumbUrl : resolveThumbnailUrl(p.url, PixelRatio.getPixelSizeForLayoutSize(PHOTO_SIZE)) }}
                          style={styles.photo}
                        />
                      ) : (
                        <View style={styles.photo} />
                      )}
                    </Pressable>
                    {isInProgress && (
                      <Pressable
                        onPress={() => handleRemovePhoto(p)}
                        disabled={removingId === p.id}
                        style={styles.removeBadge}
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={13} color={colors.onPrimary} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        {isInProgress && (
          <Button
            label={isCompleting ? t.cleaningReports.completing : t.cleaningReports.markComplete}
            onPress={handleComplete}
            loading={isCompleting}
            disabled={photoCount === 0 || pendingUploads > 0}
            style={{ marginTop: spacing.lg }}
          />
        )}

        {!isInProgress && (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={typography.h3}>{t.cleaningReports.verification}</Text>
            <Text style={[typography.bodyMuted, { marginTop: 4 }]}>{t.cleaningReports.verificationBody}</Text>
            <View style={styles.linkRow}>
              <Pressable onPress={handleCopyLink} style={styles.linkButton}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={colors.primary} />
                <Text style={styles.linkButtonText}>
                  {copied ? t.cleaningReports.copied : t.cleaningReports.copyLink}
                </Text>
              </Pressable>
              <Pressable onPress={handleShareLink} style={styles.linkButton}>
                <Ionicons name="share-outline" size={15} color={colors.primary} />
                <Text style={styles.linkButtonText}>{t.cleaningReports.share}</Text>
              </Pressable>
            </View>
            <Button
              label={isSharingPdf ? t.cleaningReports.preparingPdf : t.cleaningReports.exportPdf}
              onPress={handleSharePdf}
              loading={isSharingPdf}
              variant="outline"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}
      </ScrollView>
      <PhotoViewerModal uri={viewerUrl} onClose={() => setViewerUrl(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  nextGuestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.successBg,
  },
  nextGuestLabel: { ...typography.caption, color: colors.primary, fontWeight: '600', marginBottom: 1 },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  roomsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressRow: { flexDirection: 'row', gap: 4, marginTop: spacing.sm },
  progressSeg: { flex: 1, height: 6, borderRadius: radius.full, backgroundColor: colors.border },
  progressSegDone: { backgroundColor: colors.success },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  roomTile: {
    height: 104,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  roomTileDone: { borderWidth: 2, borderColor: colors.success },
  roomTileOther: { borderStyle: 'dashed' },
  roomLabel: { fontSize: 12, lineHeight: 15, fontWeight: '500', color: colors.ink, textAlign: 'center' },
  roomBadge: {
    position: 'absolute',
    top: 6,
    end: 6,
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomBadgeDone: { backgroundColor: colors.success },
  roomBadgeCount: { fontSize: 12, fontWeight: '600', color: colors.onPrimary, ...typography.number },
  retryText: { fontSize: 13, fontWeight: '600', color: colors.green700 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  photoWrap: { position: 'relative' },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: radius.sm, backgroundColor: colors.border },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  linkButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
