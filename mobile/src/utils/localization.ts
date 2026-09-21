/**
 * Client-side localization helpers for values that are not plain i18n keys:
 * all-caps labels, stored age-group values and DB-named mobility profiles.
 */

type Translate = (key: string) => string;

// ─── Uppercase labels ───────────────────────────────────────
// Greek typography drops the tonos in all-caps ("Διάρκεια" → "ΔΙΑΡΚΕΙΑ").
// `textTransform: 'uppercase'` cannot be relied on for this: Android upper-cases
// with the *device* locale (TextTransform.kt, Locale.getDefault()), so a Greek
// UI on an English-locale device keeps the accents ("ΔΙΆΡΚΕΙΑ"), and JS
// `toUpperCase()` keeps them too. Upper-case label text through this helper.

const GREEK_TONOS_STRIP: Record<string, string> = {
  ά: 'α', έ: 'ε', ή: 'η', ί: 'ι', ό: 'ο', ύ: 'υ', ώ: 'ω',
  ΐ: 'ϊ', ΰ: 'ϋ',
  Ά: 'Α', Έ: 'Ε', Ή: 'Η', Ί: 'Ι', Ό: 'Ο', Ύ: 'Υ', Ώ: 'Ω',
};

// A tonos on the first vowel of a would-be diphthong (αι, ει, οι, υι, αυ, ευ,
// ου) marks the two vowels as pronounced separately. With the tonos gone, the
// second vowel takes a dialytika instead: "ρολόι" → "ΡΟΛΟΪ", "άυλος" → "ΑΫΛΟΣ".
const DIPHTHONG_FIRST = new Set(['ά', 'έ', 'ό', 'ύ', 'Ά', 'Έ', 'Ό', 'Ύ']);
const DIALYTIKA: Record<string, string> = { ι: 'ϊ', Ι: 'Ϊ', υ: 'ϋ', Υ: 'Ϋ' };

const COMBINING_ACUTE = '\u0301';
const COMBINING_DIALYTIKA_TONOS = '\u0344';
const COMBINING_DIAERESIS = '\u0308';

function isGreek(ch: string | undefined): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 0x0370 && code <= 0x03ff) || (code >= 0x1f00 && code <= 0x1fff);
}

/**
 * Upper-cases a label following Greek typographic rules (accents dropped,
 * dialytika kept or added where the tonos marked a hiatus). Non-Greek text is
 * upper-cased normally, so it is safe to call regardless of UI language.
 */
export function toUpperCaseLabel(text: string): string {
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const prev = chars[i - 1];
    const next = chars[i + 1];

    // Decomposed (NFD) input: drop a combining tonos that follows a Greek letter.
    if (ch === COMBINING_ACUTE && isGreek(prev)) continue;
    if (ch === COMBINING_DIALYTIKA_TONOS && isGreek(prev)) {
      out += COMBINING_DIAERESIS;
      continue;
    }

    out += GREEK_TONOS_STRIP[ch] ?? ch;

    // "ύυ" is not a diphthong; every other pairing listed above is.
    const sameVowel = GREEK_TONOS_STRIP[ch]?.toLowerCase() === next?.toLowerCase();
    if (DIPHTHONG_FIRST.has(ch) && next && DIALYTIKA[next] && !sameVowel) {
      out += DIALYTIKA[next];
      i++;
    }
  }
  return out.toUpperCase();
}

// ─── Age groups ─────────────────────────────────────────────
// UC-02 options. The column is free text server-side, so a stored value may be
// outside this list (e.g. 'adult' written by an API client); those still get a
// label where we know one, and are shown verbatim otherwise.

const AGE_GROUP_KEYS: Record<string, string> = {
  '18-25': 'ageGroups.age18to25',
  '25-35': 'ageGroups.age25to35',
  '35-50': 'ageGroups.age35to50',
  '50-65': 'ageGroups.age50to65',
  '65+': 'ageGroups.age65plus',
  adult: 'ageGroups.adult',
};

export function getAgeGroupLabel(value: string, t: Translate): string {
  const key = AGE_GROUP_KEYS[value.trim().toLowerCase()];
  return key ? t(key) : value;
}

// ─── Mobility profiles ──────────────────────────────────────
// Profile names are stored in Greek (server/prisma/seed.js). Localize by the
// seeded id; an unknown id falls back to the DB name.

const MOBILITY_PROFILE_KEYS: Record<number, string> = {
  1: 'mobilityProfiles.pedestrian',
  2: 'mobilityProfiles.elderly',
  3: 'mobilityProfiles.stroller',
  4: 'mobilityProfiles.wheelchair',
  5: 'mobilityProfiles.pregnant',
};

export function getMobilityProfileName(
  profile: { id: number; name: string },
  t: Translate,
): string {
  const key = MOBILITY_PROFILE_KEYS[profile.id];
  return key ? t(key) : profile.name;
}
