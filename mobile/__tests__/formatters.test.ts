import i18n from 'i18next';
import {
  formatDecimal,
  formatDistance,
  formatDuration,
  formatReviewDate,
} from '../src/utils/formatters';
import en from '../src/i18n/en.json';
import el from '../src/i18n/el.json';

describe('formatDuration', () => {
  describe('before i18n is initialised (English fallback)', () => {
    it('formats sub-hour', () => expect(formatDuration(45)).toBe('45 min'));
    it('formats exact hours', () => expect(formatDuration(120)).toBe('2 h'));
    it('formats mixed', () => expect(formatDuration(90)).toBe('1 h 30 min'));
    it('clamps zero', () => expect(formatDuration(0)).toBe('0 min'));
  });

  describe('with i18n', () => {
    beforeAll(async () => {
      await i18n.init({
        resources: { en: { translation: en }, el: { translation: el } },
        lng: 'en',
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
      });
    });

    it('uses min/h in English', async () => {
      await i18n.changeLanguage('en');
      expect(formatDuration(23)).toBe('23 min');
      expect(formatDuration(1)).toBe('1 min');
      expect(formatDuration(120)).toBe('2 h');
      expect(formatDuration(70)).toBe('1 h 10 min');
    });

    it('uses Greek units in Greek, matching navigation wording', async () => {
      await i18n.changeLanguage('el');
      expect(formatDuration(23)).toBe('23 λεπτά');
      expect(formatDuration(1)).toBe('1 λεπτό');
      expect(formatDuration(0)).toBe('0 λεπτά');
      expect(formatDuration(60)).toBe('1 ώ');
      expect(formatDuration(70)).toBe('1 ώ 10 λεπτά');
      expect(formatDuration(121)).toBe('2 ώ 1 λεπτό');
      expect(formatDuration(70)).not.toMatch(/min|\bh\b/);
    });
  });
});

describe('formatDistance', () => {
  // i18n is initialised by the block above; pin the language per test.
  it('formats meters rounded', () => expect(formatDistance(847.32)).toBe('847 m'));

  it('uses a decimal point in English', async () => {
    await i18n.changeLanguage('en');
    expect(formatDistance(3200)).toBe('3.2 km');
    expect(formatDistance(1000)).toBe('1.0 km');
  });

  it('uses a decimal comma in Greek, keeping the SI symbols', async () => {
    await i18n.changeLanguage('el');
    expect(formatDistance(1800)).toBe('1,8 km');
    expect(formatDistance(1000)).toBe('1,0 km');
    expect(formatDistance(640)).toBe('640 m');
  });

  it('switches to km when the metres round up to 1000', async () => {
    await i18n.changeLanguage('el');
    expect(formatDistance(999.5)).toBe('1,0 km');
    expect(formatDistance(999.4)).toBe('999 m');
  });
});

describe('formatDecimal', () => {
  it('follows the UI language', async () => {
    await i18n.changeLanguage('el');
    expect(formatDecimal(5)).toBe('5,0');
    expect(formatDecimal(4.26)).toBe('4,3');
    await i18n.changeLanguage('en');
    expect(formatDecimal(5)).toBe('5.0');
  });
});

describe('formatReviewDate', () => {
  const now = new Date(2026, 8, 14, 8, 0); // 14 Sep 2026, 08:00 local

  it('counts calendar days, not 24-hour spans', async () => {
    await i18n.changeLanguage('el');
    expect(formatReviewDate(new Date(2026, 8, 14, 0, 30), now)).toBe('Σήμερα');
    // Ten hours ago, but yesterday.
    expect(formatReviewDate(new Date(2026, 8, 13, 22, 0), now)).toBe('πριν από 1 ημέρα');
    expect(formatReviewDate(new Date(2026, 8, 10, 12, 0), now)).toBe('πριν από 4 ημέρες');
    expect(formatReviewDate(new Date(2026, 7, 31, 12, 0), now)).toBe('πριν από 2 εβδομάδες');
  });

  it('writes older dates in the UI language, not the device locale', async () => {
    await i18n.changeLanguage('el');
    expect(formatReviewDate(new Date(2026, 2, 27, 12, 0), now)).toBe('27/3/2026');
    await i18n.changeLanguage('en');
    expect(formatReviewDate(new Date(2026, 2, 27, 12, 0), now)).toBe('Mar 27, 2026');
  });
});
