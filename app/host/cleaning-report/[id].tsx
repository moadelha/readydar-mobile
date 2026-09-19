import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Alert, Share } from 'react-native';
import { useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { useAuth, ApiError } from '@/lib/auth-context';
import {
  api,
  CleaningReport,
  CleaningReportPhoto,
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
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

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
 * camera directly), which then grabs a fresh GPS fix and uploads both
 * together — never batched, so the server's received-at clock stays close
 * to the moment the shutter was pressed. Once marked complete, the report
 * locks (no more add/remove) and this screen switches to showing the
 * verification link and a PDF share action instead.
 */
export default function CleaningReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const toast = useToast();

  const [report, setReport] = useState<CleaningReport | null>(null);
  const [sectionInput, setSectionInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !id) return;
    const data = await api.cleaningReports.getDetail(id, session.accessToken);
    setReport(data);
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleAddPhoto() {
    if (!session || !report) return;
    if (!sectionInput.trim()) {
      Alert.alert('Name this area', 'Enter what area this photo is of (e.g. Kitchen) before taking the photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location needed',
        'This report needs your location to verify the photo was taken at the property. Enable location access and try again.',
      );
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const pos = await Location.getCurrentPositionAsync({});
      const file: PickedFile = { uri: result.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' };
      const uploaded = await api.cleaningReports.uploadPhoto(
        report.id,
        {
          section: sectionInput.trim(),
          capturedAt: new Date().toISOString(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? undefined,
        },
        file,
        session.accessToken,
      );
      if (uploaded.timestampSuspicious) {
        toast.show("This photo's device clock looks off — you may want to retake it.", 'info');
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload this photo.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemovePhoto(photo: CleaningReportPhoto) {
    if (!session || !report) return;
    Alert.alert('Remove this photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(photo.id);
          setError(null);
          try {
            await api.cleaningReports.removePhoto(report.id, photo.id, session.accessToken);
            await load();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not remove this photo.');
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
      toast.show('Report completed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this report.');
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleCopyLink() {
    if (!report) return;
    const url = resolveCleaningReportVerificationUrl(report.verificationCode);
    await Clipboard.setStringAsync(url);
    setCopied(true);
    toast.show('Verification link copied');
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
      setError('Could not generate the PDF. Please try again.');
    } finally {
      setIsSharingPdf(false);
    }
  }

  if (!report) return <LoadingScreen />;

  const isInProgress = report.status === 'IN_PROGRESS';
  const sections = groupBySection(report.photos ?? []);
  const photoCount = report.photos?.length ?? 0;

  return (
    <Screen>
      <Stack.Screen
        options={{ headerShown: true, title: report.property?.name ?? 'Cleaning Report', headerBackTitle: 'Back' }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {report.property && (
          <Text style={typography.bodyMuted}>
            {report.property.addressLine}
            {report.property.city ? `, ${report.property.city.name}` : ''}
          </Text>
        )}
        <View style={styles.statusRow}>
          <StatusBadge label={isInProgress ? 'In progress' : 'Completed'} tone={isInProgress ? 'accent' : 'primary'} />
          <Text style={typography.caption}>
            {photoCount} photo{photoCount === 1 ? '' : 's'}
          </Text>
        </View>

        {error && <ErrorBanner message={error} />}

        {isInProgress && (
          <Card style={{ marginTop: spacing.md }}>
            <TextField
              label="Area"
              placeholder="e.g. Kitchen, Bathroom 1, Bedroom 2"
              value={sectionInput}
              onChangeText={setSectionInput}
            />
            <Button
              label={isUploading ? 'Uploading…' : 'Take photo'}
              onPress={handleAddPhoto}
              loading={isUploading}
              variant="outline"
            />
          </Card>
        )}

        {sections.length === 0 ? (
          <Text style={[typography.bodyMuted, { marginTop: spacing.lg }]}>
            No photos yet — tap &ldquo;Take photo&rdquo; above to start.
          </Text>
        ) : (
          sections.map(({ section, photos }) => (
            <View key={section} style={{ marginTop: spacing.lg }}>
              <Text style={typography.h3}>{section}</Text>
              <View style={styles.photoGrid}>
                {photos.map((p) => (
                  <View key={p.id} style={styles.photoWrap}>
                    <Pressable onPress={() => p.url && setViewerUrl(resolveUploadUrl(p.url))}>
                      {p.url ? (
                        <Image source={{ uri: resolveThumbnailUrl(p.url, 150) }} style={styles.photo} />
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
                        <Ionicons name="close" size={13} color={colors.white} />
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
            label={isCompleting ? 'Completing…' : 'Mark report complete'}
            onPress={handleComplete}
            loading={isCompleting}
            disabled={photoCount === 0}
            variant="outline"
            style={{ marginTop: spacing.lg }}
          />
        )}

        {!isInProgress && (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={typography.h3}>Verification</Text>
            <Text style={[typography.bodyMuted, { marginTop: 4 }]}>
              Share this link with Airbnb or the guest to independently confirm this report is authentic.
            </Text>
            <View style={styles.linkRow}>
              <Pressable onPress={handleCopyLink} style={styles.linkButton}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={colors.primary} />
                <Text style={styles.linkButtonText}>{copied ? 'Copied' : 'Copy link'}</Text>
              </Pressable>
              <Pressable onPress={handleShareLink} style={styles.linkButton}>
                <Ionicons name="share-outline" size={15} color={colors.primary} />
                <Text style={styles.linkButtonText}>Share</Text>
              </Pressable>
            </View>
            <Button
              label={isSharingPdf ? 'Preparing PDF…' : 'Export PDF'}
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
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  photoWrap: { position: 'relative' },
  photo: { width: 96, height: 96, borderRadius: radius.sm, backgroundColor: colors.border },
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
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  linkButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
