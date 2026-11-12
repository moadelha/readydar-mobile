import { dateLocale } from './calendar-visuals';

type Lang = 'EN' | 'FR' | 'AR';

/**
 * Dates as a host reads them — "Sat 29 Aug", with the year only when it
 * isn't this one — in the app's language rather than the phone's. A bare
 * `toLocaleDateString()` follows the phone, which on most phones means
 * "8/29/2026": ambiguous outside the US, and not how ReadyDar writes dates
 * anywhere else.
 *
 * `utc` is for calendar dates stored as UTC midnight (a job's scheduled
 * day, a stay's check-in): read in local time they land on the previous
 * day for anyone west of Greenwich. Leave it off for real timestamps.
 */
export function formatDay(value: string | Date, lang: Lang, { utc = false, weekday = true } = {}) {
  const d = typeof value === 'string' ? new Date(value) : value;
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  return d.toLocaleDateString(dateLocale(lang), {
    weekday: weekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: year === new Date().getFullYear() ? undefined : 'numeric',
    timeZone: utc ? 'UTC' : undefined,
  });
}

/** A job's slot — "Sat 29 Aug · 12:00". */
export function formatJobSlot(scheduledDate: string, scheduledTime: string | null | undefined, lang: Lang) {
  const day = formatDay(scheduledDate, lang, { utc: true });
  return scheduledTime ? `${day} · ${scheduledTime}` : day;
}

/** A "HH:mm" time of day as the app's language writes it — "11:00" / "11:00 AM". */
export function formatClock(hhmm: string, lang: Lang) {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const d = new Date(2024, 0, 1, h, Number.isFinite(m) ? m : 0);
  return d.toLocaleTimeString(dateLocale(lang), { hour: 'numeric', minute: '2-digit' });
}
