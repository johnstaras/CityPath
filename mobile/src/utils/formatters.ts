import i18n from 'i18next';

// Unit labels follow the active UI language. The formatter reads the shared
// i18next instance itself so callers keep the plain `formatDuration(minutes)`
// signature; before i18n is initialised (e.g. plain unit tests) it falls back
// to English.
function translate(key: string, fallback: string, options: Record<string, number>): string {
  if (!i18n.isInitialized) return fallback;
  const value = i18n.t(key, options);
  return typeof value === 'string' && value !== key ? value : fallback;
}

function isGreekUi(): boolean {
  return i18n.isInitialized && (i18n.language ?? '').startsWith('el');
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) {
    return translate('units.durationMinutes', `${m} min`, { count: m });
  }
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) {
    return translate('units.durationHours', `${h} h`, { count: h });
  }
  return translate('units.durationHoursMinutes', `${h} h ${rest} min`, {
    hours: h,
    count: rest,
  });
}

/**
 * A decimal number in the UI language's notation: "1.8" in English, "1,8" in
 * Greek. Plain string replacement rather than Intl, so the result does not
 * depend on the device's ICU data.
 */
export function formatDecimal(value: number, fractionDigits: number = 1): string {
  const fixed = value.toFixed(fractionDigits);
  return isGreekUi() ? fixed.replace('.', ',') : fixed;
}

/** SI symbols (m, km) in every language; only the decimal mark is localised. */
export function formatDistance(meters: number): string {
  const rounded = Math.round(meters);
  // Decide on the rounded value: 999.5 m must read "1.0 km", not "1000 m".
  if (rounded < 1000) return `${rounded} m`;
  return `${formatDecimal(meters / 1000, 1)} km`;
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * When a review was written, relative to `now`, in the UI language.
 *
 * Counted in calendar days, not 24-hour spans: a review from 23:00 yesterday
 * is "1 day ago" at 08:00 today, not "today". Older than 30 days it is an
 * absolute date in the UI language's format («27/3/2026», "Mar 27, 2026"),
 * not the device locale's.
 */
export function formatReviewDate(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // Round, not floor: a daylight-saving change makes one day 23 or 25 hours.
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(date)) / MS_PER_DAY));

  if (days === 0) {
    return translate('poi.dateToday', 'Today', {});
  }
  if (days < 7) {
    return translate('poi.dateDaysAgo', days === 1 ? '1 day ago' : `${days} days ago`, { count: days });
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return translate('poi.dateWeeksAgo', weeks === 1 ? '1 week ago' : `${weeks} weeks ago`, {
      count: weeks,
    });
  }
  if (isGreekUi()) {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }
  return `${EN_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
