import type { Dict } from './i18n/dictionary';
import type { Lang } from './i18n/language-context';
import { formatDay } from './dates';

/**
 * What "Copy link" puts on the clipboard: a short note asking the guest to
 * check in online, with the link last — ready to paste into an Airbnb or
 * Booking.com conversation, where a bare URL needed the host to type the
 * same sentence around it every time.
 *
 * `checkIn` is the stay's arrival date (a calendar date stored as UTC
 * midnight, hence `utc`).
 */
export function checkInCopyMessage(
  t: Dict,
  lang: Lang,
  stay: { propertyName?: string | null; checkIn?: string | null },
  url: string,
) {
  const arriving = stay.checkIn ? formatDay(stay.checkIn, lang, { utc: true }) : null;
  return t.common.checkInCopyMessage(stay.propertyName ?? null, arriving, url);
}
