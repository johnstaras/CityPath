// 5a. Relative-luminance contrast ratios for the colour tokens in
// mobile/src/utils/constants.ts (transpiled on load), both themes.
// Usage: OUT=<dir> node 05-contrast.js
// Foregrounds: every token used as a text colour in the views/components
// (grep "color: colors.X") plus the badge colours and the on-X tokens.
// Backgrounds: every token used as a backgroundColor. rgba() tokens are
// composited over the theme's `surface`; route badges drawn with
// `${color}1A` (buildBadge in utils/accessibility.ts) are composited the same
// way.
const { save, requireTs } = require('./common');

const C = requireTs('utils/constants.ts', { 'react-native-config': { default: {}, __esModule: true } });

function parse(color) {
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map(s => s.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  }
  throw new Error(`unparsed colour ${color}`);
}
const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
const ch = v => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = c => 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
function ratio(fg, bg) {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const TEXT_FG = [
  'onSurface', 'onSurfaceVariant', 'textPrimary', 'textSecondary', 'onBackground',
  'primary', 'secondary', 'tertiary', 'onTertiaryContainer', 'onErrorContainer', 'error',
  'accessibleGreen', 'accessibleOrange', 'accessibleRed', 'outline',
];
const BG = [
  'surface', 'background', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'primaryContainer', 'tertiaryContainer', 'errorContainer',
];
const ON_PAIRS = [
  ['onPrimary', 'primary'], ['onSecondary', 'secondary'], ['onTertiary', 'tertiary'], ['onError', 'error'],
];

const out = { date: new Date().toISOString(), themes: {} };
for (const [theme, colors] of [['light', C.LIGHT_COLORS], ['dark', C.DARK_COLORS]]) {
  const surface = parse(colors.surface);
  const solid = token => over(parse(colors[token]), surface);
  const pairs = [];
  for (const fg of TEXT_FG) for (const bg of BG) pairs.push({ fg, bg, ratio: ratio(solid(fg), solid(bg)) });
  for (const [fg, bg] of ON_PAIRS) pairs.push({ fg, bg, ratio: ratio(solid(fg), solid(bg)) });
  // Tinted route badges: text = badge colour, background = colour at 0x1A alpha over surface.
  for (const token of ['accessibleGreen', 'accessibleOrange', 'accessibleRed', 'onSurfaceVariant']) {
    const tint = over(parse(`${colors[token]}1A`), surface);
    pairs.push({ fg: token, bg: `${token}1A (tint over surface)`, ratio: ratio(solid(token), tint) });
  }
  out.themes[theme] = {
    pairs: pairs.map(p => ({ ...p, ratio: Math.round(p.ratio * 100) / 100 })),
    below45: pairs.filter(p => p.ratio < 4.5).length,
    below3: pairs.filter(p => p.ratio < 3).length,
    total: pairs.length,
  };
  console.log(theme, 'pairs', pairs.length, '<4.5:', out.themes[theme].below45, '<3:', out.themes[theme].below3);
  for (const p of pairs.filter(x => x.ratio < 4.5)) console.log('  ', p.fg, 'on', p.bg, p.ratio.toFixed(2));
}
console.log('saved', save('contrast.json', out));
