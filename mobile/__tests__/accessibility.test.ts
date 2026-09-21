import { getAccessibilityBadge, getRouteBadgeText, getWheelchairBadge } from '../src/utils/accessibility';
import el from '../src/i18n/el.json';
import { DARK_COLORS } from '../src/utils/constants';

describe('getAccessibilityBadge', () => {
  it('maps >=0.7 to accessible/green/check', () => {
    const b = getAccessibilityBadge(0.92, DARK_COLORS);
    expect(b.level).toBe('accessible');
    expect(b.color).toBe(DARK_COLORS.accessibleGreen);
    expect(b.icon).toBe('check-circle');
    expect(b.labelKey).toBe('accessibility.routeAccessible');
  });
  it('maps 0.4..0.7 to partial/orange/alert', () => {
    const b = getAccessibilityBadge(0.5, DARK_COLORS);
    expect(b.level).toBe('partial');
    expect(b.icon).toBe('alert-circle');
  });
  it('maps <0.4 to not_accessible/red/close', () => {
    expect(getAccessibilityBadge(0.1, DARK_COLORS).icon).toBe('close-circle');
  });
  it('maps null to unknown/help', () => {
    const b = getAccessibilityBadge(null, DARK_COLORS);
    expect(b.level).toBe('unknown');
    expect(b.icon).toBe('help-circle');
  });
  it('derives translucent bg from color', () => {
    const b = getAccessibilityBadge(0.9, DARK_COLORS);
    expect(b.bgColor).toBe(`${DARK_COLORS.accessibleGreen}1A`);
  });
  it('treats exactly 0.7 as accessible', () => {
    expect(getAccessibilityBadge(0.7, DARK_COLORS).level).toBe('accessible');
  });
  it('treats exactly 0.4 as partial', () => {
    expect(getAccessibilityBadge(0.4, DARK_COLORS).level).toBe('partial');
  });
  it('treats 0 as not_accessible (not unknown)', () => {
    expect(getAccessibilityBadge(0, DARK_COLORS).level).toBe('not_accessible');
  });
  it('maps undefined to unknown', () => {
    expect(getAccessibilityBadge(undefined, DARK_COLORS).level).toBe('unknown');
  });
  it('maps each level to its color and labelKey', () => {
    expect(getAccessibilityBadge(0.5, DARK_COLORS).color).toBe(DARK_COLORS.accessibleOrange);
    expect(getAccessibilityBadge(0.5, DARK_COLORS).labelKey).toBe('accessibility.routePartial');
    expect(getAccessibilityBadge(0.1, DARK_COLORS).color).toBe(DARK_COLORS.accessibleRed);
    expect(getAccessibilityBadge(0.1, DARK_COLORS).labelKey).toBe('accessibility.routeNotAccessible');
    expect(getAccessibilityBadge(null, DARK_COLORS).color).toBe(DARK_COLORS.onSurfaceVariant);
    expect(getAccessibilityBadge(null, DARK_COLORS).labelKey).toBe('accessibility.routeUnknown');
  });
  it('derives borderColor from color', () => {
    const b = getAccessibilityBadge(0.9, DARK_COLORS);
    expect(b.borderColor).toBe(`${DARK_COLORS.accessibleGreen}26`);
  });
});

describe('route badge wording', () => {
  const tEl = (key: string): string => {
    const value = key.split('.').reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      el,
    );
    return typeof value === 'string' ? value : key;
  };

  it('agrees with the feminine «διαδρομή» in Greek', () => {
    expect(tEl(getAccessibilityBadge(0.9, DARK_COLORS).labelKey)).toBe('Προσβάσιμη');
    expect(tEl(getAccessibilityBadge(0.1, DARK_COLORS).labelKey)).toBe('Μη προσβάσιμη');
    expect(tEl(getAccessibilityBadge(null, DARK_COLORS).labelKey)).toBe('Άγνωστη');
    expect(tEl(getAccessibilityBadge(0.5, DARK_COLORS).a11yLabelKey)).toBe('Μερικώς προσβάσιμη');
  });

  it('keeps the neuter wording for places', () => {
    expect(tEl(getWheelchairBadge('yes', DARK_COLORS).labelKey)).toBe('Προσβάσιμο');
    expect(tEl(getWheelchairBadge('no', DARK_COLORS).labelKey)).toBe('Μη προσβάσιμο');
  });

  it('builds the same "label · percent" text for every screen', () => {
    const badge = getAccessibilityBadge(0.67, DARK_COLORS);
    expect(getRouteBadgeText(badge, 0.67, tEl)).toEqual({
      label: 'Μερικώς · 67%',
      a11yLabel: 'Μερικώς προσβάσιμη · 67%',
    });
    const unknown = getAccessibilityBadge(null, DARK_COLORS);
    expect(getRouteBadgeText(unknown, null, tEl).label).toBe('Άγνωστη');
  });
});
