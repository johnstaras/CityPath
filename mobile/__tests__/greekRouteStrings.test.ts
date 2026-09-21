import el from '../src/i18n/el.json';
import en from '../src/i18n/en.json';

describe('Greek route strings', () => {
  const all = JSON.stringify(el);

  it('calls a kerb «κράσπεδο», never «ρείθρο» (gutter)', () => {
    expect(all).not.toMatch(/ρείθρ/);
    expect(el.routeDetails.raisedKerbs).toBe('Ψηλά κράσπεδα στη διαδρομή: {{count}}');
    expect(el.routeDetails.rampsOnRoute).toBe('Ράμπες ή χαμηλωμένα κράσπεδα στη διαδρομή');
  });

  it('quotes titles with guillemets', () => {
    expect(el.favorites.removeMessage).toBe('Αφαίρεση «{{title}}» από τα αγαπημένα;');
  });

  it('writes the time filter chips like the card durations', () => {
    expect(el.home.timeFilter).toEqual({ '1h': '1 ώ', '2h': '2 ώ', '3h': '3 ώ+' });
    expect(en.home.timeFilter).toEqual({ '1h': '1 h', '2h': '2 h', '3h': '3 h+' });
  });

  it('has the location permission rationale in both languages', () => {
    for (const strings of [el, en]) {
      expect(Object.keys(strings.permissions).sort()).toEqual(
        ['allow', 'deny', 'locationMessage', 'locationTitle'],
      );
    }
  });
});
