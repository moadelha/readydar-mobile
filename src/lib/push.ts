import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/**
 * Push notifications on this phone: permission, the Android channel, and
 * the Expo push token the API sends to (POST /notifications/push-tokens).
 * What gets sent, and when, is decided by the API — see its
 * NotificationsService. The tap handling lives in
 * src/components/push-notifications.tsx.
 */

const TOKEN_KEY = 'darclean_push_token';
/** When we last explained notifications and offered the system prompt. */
const ASKED_AT_KEY = 'darclean_push_asked_at';
/** "Not now" isn't forever: offer again after this long. */
const ASK_AGAIN_MS = 14 * 24 * 3600 * 1000;

export const pushSupported = Platform.OS !== 'web';

if (pushSupported) {
  // A notification that arrives while the app is open still shows as a banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

type Prompt = { title: string; body: string; allow: string; notNow: string };

/**
 * Whether the app may show notifications. The system prompt is offered
 * only after one line of why (a cold system prompt mostly gets "Don't
 * allow", which is final on iOS), and not again for two weeks after
 * "Not now".
 */
async function ensurePermission(prompt: Prompt): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const askedAt = Number((await AsyncStorage.getItem(ASKED_AT_KEY).catch(() => null)) ?? 0);
  if (Date.now() - askedAt < ASK_AGAIN_MS) return false;
  await AsyncStorage.setItem(ASKED_AT_KEY, String(Date.now())).catch(() => {});
  const wants = await new Promise<boolean>((resolve) =>
    Alert.alert(
      prompt.title,
      prompt.body,
      [
        { text: prompt.notNow, style: 'cancel', onPress: () => resolve(false) },
        { text: prompt.allow, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (!wants) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Saves this phone for the signed-in user. Safe to call on every launch:
 * the API upserts, which also keeps the token pointing at whoever is
 * signed in now.
 */
export async function registerPushForSession(accessToken: string, prompt: Prompt) {
  if (!pushSupported || !Device.isDevice) return; // simulators can't receive pushes
  // Android 13+ only shows the permission prompt once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ReadyDar',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#033E35',
    });
  }
  if (!(await ensurePermission(prompt))) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.notifications.registerPushToken(pushToken, Platform.OS === 'ios' ? 'ios' : 'android', accessToken);
  await AsyncStorage.setItem(TOKEN_KEY, pushToken).catch(() => {});
}

/** On sign-out: this phone stops getting the account's notifications. Best-effort. */
export async function unregisterPush(accessToken: string) {
  if (!pushSupported) return;
  const pushToken = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!pushToken) return;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  await api.notifications.removePushToken(pushToken, accessToken).catch(() => {});
}
