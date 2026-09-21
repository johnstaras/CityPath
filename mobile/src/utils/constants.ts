import Config from 'react-native-config';

export const API_URL = Config.API_URL || 'http://10.0.2.2:3000/api';

// Design tokens — Night Navigator (spec §2 "Design tokens")
// Dark = hero theme, Light = twin theme. Token NAMES are unchanged from the
// original CityPaths spec (Section 11) so every `colors.*` call site keeps
// compiling; only the values were reworked.
export const LIGHT_COLORS = {
  // Primary
  primary: '#0F766E',
  primaryContainer: 'rgba(13,148,136,0.12)',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#0F766E',

  // Secondary (Sky)
  secondary: '#0369A1',
  secondaryContainer: 'rgba(3,105,161,0.10)',
  onSecondary: '#FFFFFF',

  // Tertiary (Amber)
  tertiary: '#B45309',
  tertiaryContainer: '#FEF3C7',
  onTertiary: '#FFFFFF',
  onTertiaryContainer: '#92400E',

  // Error
  error: '#DC2626',
  errorContainer: '#FEE2E2',
  onError: '#ffffff',
  onErrorContainer: '#991B1B',

  // Surfaces
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceDim: '#E4EAF2',
  surfaceContainer: '#F7FAFD',
  surfaceContainerHigh: '#EFF4FA',
  surfaceContainerLow: '#F7FAFD',
  surfaceContainerLowest: '#FFFFFF',

  // Text
  onBackground: '#0F1B2D',
  onSurface: '#0F1B2D',
  onSurfaceVariant: '#5A6B85',
  textPrimary: '#0F1B2D',
  textSecondary: '#5A6B85',

  // Outlines
  outline: '#7B8AA3',
  outlineVariant: '#E1E8F2',
  border: '#E1E8F2',

  // Inverse
  inverseSurface: '#0F1B2D',
  inversePrimary: '#5EEAD4',

  // Accessibility badges. Badge text sits on a 10% tint of its own colour
  // (and on photos over an opaque surface), so these must clear 4.5:1 on the
  // tint too — the brighter 600 shades measured 2.7–4.1:1.
  accessibleGreen: '#166534',
  accessibleOrange: '#B43C0A',
  accessibleRed: '#B91C1C',

  // Legacy aliases (for backward compatibility)
  primaryDark: '#0F766E',
  accent: '#D97706',
};

export const DARK_COLORS: typeof LIGHT_COLORS = {
  // Primary
  primary: '#2DD4BF',
  primaryContainer: 'rgba(45,212,191,0.16)',
  onPrimary: '#062821',
  onPrimaryContainer: '#5EEAD4',

  // Secondary (Sky)
  secondary: '#7DD3FC',
  secondaryContainer: 'rgba(125,211,252,0.16)',
  onSecondary: '#082F49',

  // Tertiary (Amber)
  tertiary: '#FDE68A',
  tertiaryContainer: 'rgba(253,230,138,0.16)',
  onTertiary: '#422006',
  onTertiaryContainer: '#FDE68A',

  // Error
  error: '#FCA5A5',
  errorContainer: 'rgba(252,165,165,0.16)',
  onError: '#450A0A',
  onErrorContainer: '#FEE2E2',

  // Surfaces
  background: '#0B1220',
  surface: '#0B1220',
  surfaceDim: '#060B14',
  surfaceContainer: 'rgba(255,255,255,0.08)',
  surfaceContainerHigh: 'rgba(255,255,255,0.10)',
  surfaceContainerLow: 'rgba(255,255,255,0.06)',
  surfaceContainerLowest: '#0F1B2E',

  // Text
  onBackground: '#E6EDF7',
  onSurface: '#E6EDF7',
  onSurfaceVariant: '#9FB1C9',
  textPrimary: '#E6EDF7',
  textSecondary: '#9FB1C9',

  // Outlines
  outline: '#5B6B85',
  outlineVariant: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',

  // Inverse
  inverseSurface: '#E6EDF7',
  inversePrimary: '#0D9488',

  // Accessibility badges
  accessibleGreen: '#4ADE80',
  accessibleOrange: '#FB923C',
  accessibleRed: '#F87171',

  // Legacy aliases (for backward compatibility)
  primaryDark: '#7DD3FC',
  accent: '#FDE68A',
};

export type AppColors = typeof LIGHT_COLORS;

export function getColors(colorScheme: 'light' | 'dark'): AppColors {
  return colorScheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

export const SPACING = {
  xs: 4,    // 0.175rem
  sm: 8,    // 0.5rem
  md: 16,   // 1rem
  lg: 24,   // 1.5rem
  xl: 32,   // 2rem
  xxl: 44,  // 2.75rem
  section: 56, // 3.5rem
};

export const RADIUS = {
  // Night Navigator scale
  input: 12,
  card: 16,
  sheet: 24,
  full: 9999,

  // Legacy aliases (kept so unmigrated files compile)
  sm: 4,
  md: 8,
  lg: 12,
  xl: 24,
};

// ─── Typography Scale ───────────────────────────────────────
// Headings/emphasis use the Space Grotesk display face (Task 1); body/caption
// stay on the system font. NOTE: never pair `fontFamily: 'SpaceGrotesk-…'`
// with `fontWeight` — Android double-applies synthetic bold in that case.
import { TextStyle, ViewStyle } from 'react-native';

export const TYPOGRAPHY = {
  // Display — large hero titles (Profile Setup title)
  display: {
    fontSize: 36,
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: -0.9,
    lineHeight: 44,
  } as TextStyle,

  // Heading 1 — screen-level headlines ("Curated Journeys", "Route Completed!")
  heading1: {
    fontSize: 30,
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: -0.75,
    lineHeight: 36,
  } as TextStyle,

  // Heading 2 — section titles, modal headers ("Zappeion", "Edit Profile")
  heading2: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: -0.6,
    lineHeight: 32,
  } as TextStyle,

  // Heading 3 — card titles, nav headers ("Riverside Architecture Walk")
  heading3: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: -0.5,
    lineHeight: 28,
  } as TextStyle,

  // Heading 4 — section labels ("Age Group", "Mobility Type")
  heading4: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 28,
  } as TextStyle,

  // Body Large — subtitles, intro text
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28,
  } as TextStyle,

  // Body — default body text
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  } as TextStyle,

  // Body Medium — slightly emphasized body text, input text
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  } as TextStyle,

  // Body Bold — emphasized body text, POI names, button text
  bodyBold: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 24,
  } as TextStyle,

  // Small — meta info, secondary text ("45m", "3.2 km")
  small: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  } as TextStyle,

  // Small Bold — rating text, links ("Details", "4.9")
  smallBold: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-Medium',
    lineHeight: 20,
  } as TextStyle,

  // Caption — descriptions, helper text
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  } as TextStyle,

  // Overline — uppercase labels ("DURATION", "ACCESSIBLE", "OVERALL RATING").
  // Pass the text through toUpperCaseLabel() (utils/localization): Android's
  // textTransform upper-cases with the device locale, not the app language, so
  // Greek labels would keep their accents ("ΔΙΆΡΚΕΙΑ"). textTransform stays as a
  // no-op safety net for already upper-cased text.
  overline: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Medium',
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: 'uppercase',
  } as TextStyle,

  // Overline Small — small uppercase tags ("ACTIVE FILTER", "LOW EXERTION")
  overlineSmall: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk-Medium',
    letterSpacing: -0.275,
    lineHeight: 16,
    textTransform: 'uppercase',
  } as TextStyle,

  // Tab Label
  tabLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Medium',
    lineHeight: 18,
    letterSpacing: 0.3,
  } as TextStyle,
};

// ─── Gradients ──────────────────────────────────────────────
// Hero gradient (dark theme brighter/cooler, light theme deeper/richer) and
// the photo-card scrim (identical in both themes — photos are always
// dark-scrimmed for legible overlay text).

type GradientColors = [string, string];

export const GRADIENTS: {
  primary: { light: GradientColors; dark: GradientColors };
  scrim: GradientColors;
} = {
  primary: {
    dark: ['#7DD3FC', '#2DD4BF'],
    light: ['#0369A1', '#0D9488'],
  },
  scrim: ['transparent', 'rgba(6,12,24,0.94)'],
};

export function getGradients(
  scheme: 'light' | 'dark',
): { primary: GradientColors; scrim: GradientColors } {
  return {
    primary: scheme === 'dark' ? GRADIENTS.primary.dark : GRADIENTS.primary.light,
    scrim: GRADIENTS.scrim,
  };
}

// ─── On-scrim content ───────────────────────────────────────
// Photo-on-scrim content (hero titles, meta chip icons/text, heart glyph) is
// white/glass in both themes by design — on-scrim content never follows the
// theme. Shared by RouteCard, FavoritesListScreen, POIDetailScreen.
export const ON_SCRIM_WHITE = '#FFFFFF';
export const ON_SCRIM_GLASS = 'rgba(255,255,255,0.14)';

// ─── Shadows ────────────────────────────────────────────────
// Light theme keeps the original elevation shadows. Dark theme is glass-first
// — depth comes from the `border`/`outlineVariant` hairline, not shadows —
// so every dark shadow token collapses to `{ elevation: 0 }`.

export const SHADOWS = {
  card: {
    shadowColor: 'rgba(30,41,59,0.06)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 2,
  } as ViewStyle,

  elevated: {
    shadowColor: 'rgba(30,41,59,0.06)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  } as ViewStyle,

  button: {
    shadowColor: 'rgba(37,99,235,0.2)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 4,
  } as ViewStyle,

  bottomBar: {
    shadowColor: 'rgba(30,41,59,0.06)',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  } as ViewStyle,

  fab: {
    shadowColor: 'rgba(0,74,198,0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6,
  } as ViewStyle,
};

const DARK_SHADOWS: typeof SHADOWS = {
  card: { elevation: 0 } as ViewStyle,
  elevated: { elevation: 0 } as ViewStyle,
  button: { elevation: 0 } as ViewStyle,
  bottomBar: { elevation: 0 } as ViewStyle,
  fab: { elevation: 0 } as ViewStyle,
};

export function getShadows(scheme: 'light' | 'dark'): typeof SHADOWS {
  return scheme === 'dark' ? DARK_SHADOWS : SHADOWS;
}

// ─── Common Layout Patterns ─────────────────────────────────

export const LAYOUT = {
  screenPadding: 24,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    minHeight: 56,
    paddingBottom: 12,
  } as ViewStyle,

  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  } as ViewStyle,

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  } as ViewStyle,

  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  outlineButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  } as ViewStyle,

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  } as ViewStyle,

  card: {
    borderRadius: 12,
    overflow: 'hidden',
  } as ViewStyle,
};
