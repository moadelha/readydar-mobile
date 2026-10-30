import { Appearance, DevSettings } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Updates from 'expo-updates';

export type AppearancePref = 'system' | 'light' | 'dark';

/**
 * Light or dark is chosen once, when the app starts: every screen builds
 * its styles from `colors` (src/theme.ts) as it loads, so the palette has
 * to be known before the first one does. That's why the choice lives in a
 * small file read synchronously here, not in AsyncStorage, and why changing
 * it restarts the app (the same way switching to Arabic does).
 */
function prefFile() {
  return new File(Paths.document, 'appearance.txt');
}

export function readAppearancePref(): AppearancePref {
  try {
    const file = prefFile();
    if (!file.exists) return 'system';
    const v = file.textSync().trim();
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** The scheme this run of the app uses. 'system' follows the phone's setting. */
export function resolveScheme(pref: AppearancePref): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export async function setAppearancePref(pref: AppearancePref) {
  try {
    const file = prefFile();
    if (!file.exists) file.create();
    file.write(pref);
  } catch {
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // Development builds can't use expo-updates' reload.
    DevSettings?.reload?.();
  }
}
