import {
  getAgeGroupLabel,
  getMobilityProfileName,
  toUpperCaseLabel,
} from '../src/utils/localization';
import en from '../src/i18n/en.json';
import el from '../src/i18n/el.json';

describe('toUpperCaseLabel', () => {
  it('drops the tonos from Greek labels seen in the app', () => {
    expect(toUpperCaseLabel('Προσβάσιμο')).toBe('ΠΡΟΣΒΑΣΙΜΟ');
    expect(toUpperCaseLabel('Ολοκληρωμένες Διαδρομές')).toBe('ΟΛΟΚΛΗΡΩΜΕΝΕΣ ΔΙΑΔΡΟΜΕΣ');
    expect(toUpperCaseLabel('Διάρκεια')).toBe('ΔΙΑΡΚΕΙΑ');
    expect(toUpperCaseLabel('Απόσταση')).toBe('ΑΠΟΣΤΑΣΗ');
    expect(toUpperCaseLabel('Σημεία που επισκέφτηκες')).toBe('ΣΗΜΕΙΑ ΠΟΥ ΕΠΙΣΚΕΦΤΗΚΕΣ');
    expect(toUpperCaseLabel('Γενική Αξιολόγηση')).toBe('ΓΕΝΙΚΗ ΑΞΙΟΛΟΓΗΣΗ');
  });

  it('maps every accented vowel to its bare capital', () => {
    expect(toUpperCaseLabel('άέήίόύώ')).toBe('ΑΕΗΙΟΥΩ');
    expect(toUpperCaseLabel('ΆΈΉΊΌΎΏ')).toBe('ΑΕΗΙΟΥΩ');
  });

  it('keeps the dialytika when dropping dialytika-tonos', () => {
    expect(toUpperCaseLabel('ΐ')).toBe('Ϊ');
    expect(toUpperCaseLabel('ΰ')).toBe('Ϋ');
    expect(toUpperCaseLabel('ταΐζω')).toBe('ΤΑΪΖΩ');
    expect(toUpperCaseLabel('προϊόν')).toBe('ΠΡΟΪΟΝ');
  });

  it('adds a dialytika where the tonos marked a hiatus', () => {
    expect(toUpperCaseLabel('ρολόι')).toBe('ΡΟΛΟΪ');
    expect(toUpperCaseLabel('τσάι')).toBe('ΤΣΑΪ');
    expect(toUpperCaseLabel('άυλος')).toBe('ΑΫΛΟΣ');
  });

  it('leaves real diphthongs alone', () => {
    expect(toUpperCaseLabel('είναι')).toBe('ΕΙΝΑΙ');
    expect(toUpperCaseLabel('ούτε')).toBe('ΟΥΤΕ');
  });

  it('handles final sigma and already upper-cased text', () => {
    expect(toUpperCaseLabel('Αγαπημένες')).toBe('ΑΓΑΠΗΜΕΝΕΣ');
    expect(toUpperCaseLabel('ΕΠΟΜΕΝΗ ΣΤΑΣΗ')).toBe('ΕΠΟΜΕΝΗ ΣΤΑΣΗ');
  });

  it('strips decomposed (NFD) Greek tonos', () => {
    expect(toUpperCaseLabel('Δια\u0301ρκεια')).toBe('ΔΙΑΡΚΕΙΑ');
    expect(toUpperCaseLabel('\u03B9\u0344')).toBe('\u0399\u0308');
  });

  it('upper-cases non-Greek text normally', () => {
    expect(toUpperCaseLabel('Accessible · 85%')).toBe('ACCESSIBLE · 85%');
    expect(toUpperCaseLabel('café')).toBe('CAFÉ');
  });
});

// Resolve keys against the real resource files so a missing key fails here.
function translatorFor(resources: Record<string, unknown>) {
  return (key: string): string => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], resources);
    if (typeof value !== 'string') throw new Error(`missing i18n key ${key}`);
    return value;
  };
}

describe('getAgeGroupLabel', () => {
  const tEn = translatorFor(en);
  const tEl = translatorFor(el);

  it('labels every UC-02 age group in both languages', () => {
    for (const value of ['18-25', '25-35', '35-50', '50-65', '65+']) {
      expect(getAgeGroupLabel(value, tEn)).toMatch(/years$/);
      expect(getAgeGroupLabel(value, tEl)).toMatch(/ετών$/);
    }
    expect(getAgeGroupLabel('65+', tEl)).toBe('65+ ετών');
  });

  it('labels the legacy stored value "adult"', () => {
    expect(getAgeGroupLabel('adult', tEn)).toBe('Adult');
    expect(getAgeGroupLabel('adult', tEl)).toBe('Ενήλικας');
  });

  it('shows an unknown value verbatim', () => {
    expect(getAgeGroupLabel('teen', tEn)).toBe('teen');
  });
});

describe('getMobilityProfileName', () => {
  const tEn = translatorFor(en);
  const tEl = translatorFor(el);

  it('localizes the seeded profiles by id', () => {
    const seeded = [
      { id: 1, name: 'Πεζός', en: 'Pedestrian' },
      { id: 2, name: 'Ηλικιωμένος', en: 'Elderly' },
      { id: 3, name: 'Γονέας με καρότσι', en: 'Parent with stroller' },
      { id: 4, name: 'Χρήστης αναπηρικού αμαξιδίου', en: 'Wheelchair user' },
      { id: 5, name: 'Έγκυος', en: 'Pregnant' },
    ];
    for (const p of seeded) {
      expect(getMobilityProfileName(p, tEn)).toBe(p.en);
      expect(getMobilityProfileName(p, tEl)).toBe(p.name);
    }
  });

  it('falls back to the DB name for an unknown id', () => {
    expect(getMobilityProfileName({ id: 99, name: 'Τυφλός' }, tEn)).toBe('Τυφλός');
  });
});
