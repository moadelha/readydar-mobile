import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Downloads a remote file (a PDF, an ID photo, etc — anything reachable by
 * URL) to a local temp file, then opens the native share/save sheet so the
 * host can save it to Files, share it via WhatsApp/email, print it, etc.
 * There's no direct "save to Downloads" API on either platform without
 * extra permissions, so the share sheet (which every app on both platforms
 * offers a "Save to Files"/"Save to device" option through) is the
 * standard, permission-free way to hand a file to the user.
 *
 * `headers` is for authenticated endpoints (e.g. the check-in PDF, which
 * requires the host's bearer token) — omit it for public URLs like a
 * Cloudinary-hosted photo.
 */
export async function downloadAndShare(
  url: string,
  filename: string,
  mimeType: string,
  headers?: Record<string, string>,
) {
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  const { uri } = await FileSystem.downloadAsync(url, fileUri, headers ? { headers } : undefined);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
}
