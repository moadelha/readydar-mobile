import type { GuestReview } from './api';

/**
 * Figures for the Reviews pages, worked out on the phone from the guests'
 * own ratings — no AI, and no dependency on a newer API.
 */

const DAY = 86_400_000;

/** A review's score out of 5: Booking.com's exact /10 score halved when there is one, else the stars. */
export function scoreOf(r: GuestReview): number | null {
  const d = r.detailedRatings as { scale?: number; overall?: number | null } | null | undefined;
  if (d && d.scale === 10 && typeof d.overall === 'number') return d.overall / 2;
  return typeof r.rating === 'number' ? r.rating : null;
}

export function dateOf(r: GuestReview): number {
  return new Date(r.submittedAt ?? r.createdAt).getTime();
}

export function hasText(r: GuestReview) {
  return !!(r.publicText?.trim() || r.privateText?.trim());
}

const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

export interface ScoreStats {
  /** Average over the last 90 days (null without rated reviews then). */
  score90: number | null;
  /** score90 minus the 90 days before; null when either window is empty. */
  trend: number | null;
  /** Average over every rated review. */
  overall: number | null;
  reviews30: number;
  /** Share of the last 90 days' rated reviews at five stars (0–1). */
  fiveStarShare: number | null;
  /** Average per month, oldest first, for the last `months` months (null for a month with no rated review). */
  monthly: (number | null)[];
  /** Five-star split, index 0 = 5 stars … 4 = 1 star, as shares (0–1). */
  distribution: number[];
  latestAt: number | null;
}

export function scoreStats(reviews: GuestReview[], months = 6, now = Date.now()): ScoreStats {
  const scored = reviews
    .map((r) => ({ s: scoreOf(r), at: dateOf(r) }))
    .filter((x): x is { s: number; at: number } => x.s !== null);
  const last90 = scored.filter((x) => now - x.at <= 90 * DAY);
  const prev90 = scored.filter((x) => now - x.at > 90 * DAY && now - x.at <= 180 * DAY);
  const score90 = average(last90.map((x) => x.s));
  const prev = average(prev90.map((x) => x.s));

  const monthly: (number | null)[] = [];
  const today = new Date(now);
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1).getTime();
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1).getTime();
    monthly.push(average(scored.filter((x) => x.at >= start && x.at < end).map((x) => x.s)));
  }

  const counts = [0, 0, 0, 0, 0];
  for (const x of scored) counts[5 - Math.min(5, Math.max(1, Math.round(x.s)))]++;
  const total = scored.length || 1;

  return {
    score90,
    trend: score90 !== null && prev !== null ? score90 - prev : null,
    overall: average(scored.map((x) => x.s)),
    reviews30: reviews.filter((r) => now - dateOf(r) <= 30 * DAY).length,
    fiveStarShare: last90.length ? last90.filter((x) => x.s >= 4.75).length / last90.length : null,
    monthly,
    distribution: counts.map((c) => c / total),
    latestAt: reviews.length ? Math.max(...reviews.map(dateOf)) : null,
  };
}

/** Maps a channel's own category name onto the few the app labels. */
function categoryKey(raw: string): string | null {
  const k = raw.toLowerCase();
  if (k.includes('clean')) return 'cleanliness';
  if (k.includes('check')) return 'checkin';
  if (k.includes('communic')) return 'communication';
  if (k.includes('location')) return 'location';
  if (k.includes('value') || k.includes('price')) return 'value';
  if (k.includes('accura')) return 'accuracy';
  if (k.includes('comfort')) return 'comfort';
  if (k.includes('staff')) return 'staff';
  if (k.includes('facilit') || k.includes('amenit')) return 'facilities';
  return null;
}

/**
 * Average per category, out of 5, from what the channels send:
 * Booking.com (via the channel manager) gives `{ scale: 10, scores: [{ category, score }] }`,
 * Airbnb gives a list whose exact shape varies — read loosely, anything
 * unrecognised is skipped. The four best-covered categories, in a stable order.
 */
export function subRatings(reviews: GuestReview[]): { key: string; score: number }[] {
  const sums = new Map<string, { total: number; n: number }>();
  for (const r of reviews) {
    const d = r.detailedRatings as unknown;
    let scale = 5;
    let items: unknown[] = [];
    if (Array.isArray(d)) items = d;
    else if (d && typeof d === 'object') {
      const o = d as { scale?: number; scores?: unknown };
      if (o.scale === 10) scale = 10;
      if (Array.isArray(o.scores)) items = o.scores;
    }
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Record<string, unknown>;
      const name = (o.category ?? o.type ?? o.name) as unknown;
      const value = (o.score ?? o.rating ?? o.value) as unknown;
      if (typeof name !== 'string' || typeof value !== 'number') continue;
      const key = categoryKey(name);
      if (!key) continue;
      const s = sums.get(key) ?? { total: 0, n: 0 };
      s.total += scale === 10 || value > 5 ? value / 2 : value;
      s.n++;
      sums.set(key, s);
    }
  }
  const order = ['cleanliness', 'checkin', 'communication', 'location', 'value', 'accuracy', 'comfort', 'staff', 'facilities'];
  return [...sums.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 4)
    .map(([key, s]) => ({ key, score: s.total / s.n }))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

/** "4,38" / "4.38" — two decimals in the app's language. */
export function formatScore(n: number, lang: string, digits = 2) {
  return n.toLocaleString(lang === 'FR' ? 'fr-FR' : lang === 'AR' ? 'ar-MA' : 'en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
