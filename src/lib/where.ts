/**
 * Where the phone is, as a first guess for a new account or property — the
 * same rules as the website (apps/web/src/lib/guess-country.ts and
 * components/selling-fields.tsx). Always editable afterwards.
 */
const ZONE_COUNTRY: Record<string, string> = {
  'Africa/Casablanca': 'MA',
  'Africa/El_Aaiun': 'MA',
  'Asia/Dubai': 'AE',
  'Africa/Tunis': 'TN',
  'Africa/Algiers': 'DZ',
  'Africa/Dakar': 'SN',
  'Africa/Abidjan': 'CI',
  'Africa/Cairo': 'EG',
  'Asia/Amman': 'JO',
  'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Rome': 'IT',
  'Europe/Istanbul': 'TR',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Brussels': 'BE',
  'Europe/Amsterdam': 'NL',
  'Europe/Zurich': 'CH',
};

const COUNTRIES = [
  'MA', 'FR', 'ES', 'PT', 'IT', 'DE', 'NL', 'BE', 'CH', 'AT', 'GB', 'IE', 'GR', 'HR', 'PL', 'CZ', 'HU', 'DK', 'SE', 'NO', 'FI', 'TR',
  'AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'JO', 'LB', 'EG', 'TN', 'DZ', 'SN', 'CI', 'ZA', 'KE', 'US', 'CA', 'MX', 'BR', 'AU', 'JP', 'TH', 'SG',
];

const COUNTRY_CURRENCY: Record<string, string> = {
  MA: 'MAD', CH: 'CHF', GB: 'GBP', DK: 'DKK', SE: 'SEK', NO: 'NOK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', TR: 'TRY',
  AE: 'AED', SA: 'SAR', QA: 'QAR', EG: 'EGP', TN: 'TND', ZA: 'ZAR', US: 'USD', CA: 'CAD', AU: 'AUD', JP: 'JPY', TH: 'THB',
};
const EURO = ['FR', 'ES', 'PT', 'IT', 'DE', 'NL', 'BE', 'AT', 'IE', 'GR', 'HR', 'FI'];

export function phoneTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** ISO country from the phone's time zone, else its region (fr-MA → MA). */
export function guessCountry(): string | undefined {
  const tz = phoneTimezone();
  if (tz && ZONE_COUNTRY[tz]) return ZONE_COUNTRY[tz];
  try {
    const region = Intl.DateTimeFormat().resolvedOptions().locale.split('-').pop();
    return region && /^[A-Z]{2}$/.test(region) ? region : undefined;
  } catch {
    return undefined;
  }
}

/** A new property's starting country: the guess when ReadyDar lists it, else Morocco. */
export function defaultCountry(): string {
  const guess = guessCountry();
  return guess && COUNTRIES.includes(guess) ? guess : 'MA';
}

export function currencyForCountry(country: string): string {
  return COUNTRY_CURRENCY[country] ?? (EURO.includes(country) ? 'EUR' : 'USD');
}
