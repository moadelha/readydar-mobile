import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-device "I've dealt with this" state for Home's attention list.
 *
 * Why this isn't a delete: the check-in cards on Home are *upcoming*
 * arrivals, and the guest may already be holding that link. Deleting it to
 * tidy the screen would silently break the guest's check-in — so dismissing
 * hides the card and touches nothing on the server. Permanently removing a
 * link is a separate, explicit action on the Guests screen (see
 * `api.properties.deleteGuestCheckIn`).
 *
 * Why it isn't server state: there's no field for it on `GuestCheckIn` and
 * inventing one would mean a migration for what is really a local reading
 * preference. The cost is that dismissals don't follow a host to another
 * device, which is the right trade for now.
 *
 * Stored as a plain id list. `prune` keeps it from growing forever: once a
 * check-in is submitted or expires it drops out of `/checkins/pending`, so
 * its dismissal is dead weight and gets dropped with it.
 */
const KEY = 'darclean_dismissed_checkins';

export async function readDismissed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // A corrupt or unreadable store should never stop the screen loading —
    // worst case the host sees a card they'd previously dismissed.
    return [];
  }
}

export async function addDismissed(id: string): Promise<string[]> {
  const current = await readDismissed();
  if (current.includes(id)) return current;
  const next = [...current, id];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore — the in-memory filter still hides it for this session.
  }
  return next;
}

/** Brings every hidden card back — the undo for dismissing one by mistake. */
export async function clearDismissed(): Promise<string[]> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore — the caller clears its own in-memory copy regardless.
  }
  return [];
}

/** Drops dismissals for check-ins that are no longer live, so the list can't grow without bound. */
export async function pruneDismissed(liveIds: string[]): Promise<string[]> {
  const current = await readDismissed();
  const live = new Set(liveIds);
  const next = current.filter((id) => live.has(id));
  if (next.length !== current.length) {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Ignore.
    }
  }
  return next;
}
