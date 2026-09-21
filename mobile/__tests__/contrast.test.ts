import { LIGHT_COLORS, DARK_COLORS } from '../src/utils/constants';

// WCAG 2.x relative luminance + contrast ratio for 6-digit hex colors.
function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) throw new Error(`not a 6-digit hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// Spec §7: body-text token pairs must clear WCAG AA (4.5:1) in BOTH themes.
const CASES: Array<[string, string, string]> = [
  ['onSurface', 'surface', 'primary text'],
  ['onSurfaceVariant', 'surface', 'secondary text'],
  ['onSurfaceVariant', 'background', 'secondary text on bg'],
  ['primary', 'surface', 'accent text'],
  ['tertiary', 'surface', 'tertiary accents'],
  // dark tertiaryContainer is an alpha-tint rgba() (not 6-digit hex), so the
  // notice-card pair is checked against the opaque `background` token instead.
  ['onTertiaryContainer', 'background', 'notice card text'],
];

// Accessibility badges: coloured text on a 10% tint (alpha 0x1A) of the same
// colour over the screen background, and on the opaque surface used over photos.
function blendOver(fg: string, bg: string, alpha: number): string {
  const f = parseInt(fg.slice(1), 16);
  const b = parseInt(bg.slice(1), 16);
  const mix = (shift: number) =>
    Math.round(((f >> shift) & 255) * alpha + ((b >> shift) & 255) * (1 - alpha));
  return '#' + [16, 8, 0].map(s => mix(s).toString(16).padStart(2, '0')).join('');
}
const BADGES = ['accessibleGreen', 'accessibleOrange', 'accessibleRed'];

describe.each([
  ['light', LIGHT_COLORS],
  ['dark', DARK_COLORS],
] as const)('%s theme accessibility badges (WCAG AA)', (_name, colors) => {
  const c = colors as unknown as Record<string, string>;
  // Dark surfaces are rgba() tints; `background` is the opaque ground behind them.
  const grounds = ['background', ...(/^#[0-9A-Fa-f]{6}$/.test(c.surface) ? ['surface'] : [])];
  it.each(BADGES)('%s text on its tint and on the opaque surface >= 4.5:1', badge => {
    for (const ground of grounds) {
      expect(contrast(c[badge], c[ground])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c[badge], blendOver(c[badge], c[ground], 0x1a / 255))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe.each([
  ['light', LIGHT_COLORS],
  ['dark', DARK_COLORS],
] as const)('%s theme contrast (WCAG AA)', (_name, colors) => {
  it.each(CASES)('%s on %s (%s) >= 4.5:1', (fg, bg, _label) => {
    const c = colors as unknown as Record<string, string>;
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
