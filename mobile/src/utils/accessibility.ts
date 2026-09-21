import type { AppColors } from './constants';
import type { PathAccessibility } from '../models';

export type AccessibilityLevel = 'accessible' | 'partial' | 'not_accessible' | 'unknown';

export interface AccessibilityBadge {
  level: AccessibilityLevel;
  color: string;
  bgColor: string;
  borderColor: string;
  /** Opaque background for badges drawn over photos (the tinted one gets lost). */
  onPhotoBgColor: string;
  icon: string;
  labelKey: string;
  /** Longer, self-contained phrasing for screen readers. */
  a11yLabelKey: string;
}

interface LevelMeta {
  icon: string;
  labelKey: string;
  a11yLabelKey: string;
}

// A route's level. Route-specific keys because Greek agrees the adjective with
// the noun: «διαδρομή» is feminine («Προσβάσιμη»), while the place labels
// below are neuter («Προσβάσιμο»). The partial label stays short («Μερικώς»)
// so "label · 67%" fits a card badge on one line; its a11y label is the full
// phrase.
const LEVEL_META: Record<AccessibilityLevel, LevelMeta> = {
  accessible: {
    icon: 'check-circle',
    labelKey: 'accessibility.routeAccessible',
    a11yLabelKey: 'accessibility.routeAccessible',
  },
  partial: {
    icon: 'alert-circle',
    labelKey: 'accessibility.routePartial',
    a11yLabelKey: 'accessibility.routePartialA11y',
  },
  not_accessible: {
    icon: 'close-circle',
    labelKey: 'accessibility.routeNotAccessible',
    a11yLabelKey: 'accessibility.routeNotAccessible',
  },
  unknown: {
    icon: 'help-circle',
    labelKey: 'accessibility.routeUnknown',
    a11yLabelKey: 'accessibility.routeUnknown',
  },
};

// Same levels, but phrased about one place rather than a whole route. The short
// label keeps the chip narrow; the a11y label says "wheelchair" out loud, which
// the icon alone cannot do for a screen-reader user.
const WHEELCHAIR_META: Record<AccessibilityLevel, LevelMeta> = {
  accessible: {
    icon: 'wheelchair-accessibility',
    labelKey: 'accessibility.accessible',
    a11yLabelKey: 'accessibility.wheelchairAccessible',
  },
  partial: {
    icon: 'wheelchair-accessibility',
    labelKey: 'accessibility.partial',
    a11yLabelKey: 'accessibility.wheelchairLimited',
  },
  not_accessible: {
    icon: 'wheelchair-accessibility',
    labelKey: 'accessibility.notAccessible',
    a11yLabelKey: 'accessibility.wheelchairNo',
  },
  unknown: {
    icon: 'help-circle',
    labelKey: 'accessibility.unknown',
    a11yLabelKey: 'accessibility.wheelchairUnknown',
  },
};

function buildBadge(
  level: AccessibilityLevel,
  colors: AppColors,
  meta: Record<AccessibilityLevel, LevelMeta>,
): AccessibilityBadge {
  const color =
    level === 'accessible' ? colors.accessibleGreen
    : level === 'partial' ? colors.accessibleOrange
    : level === 'not_accessible' ? colors.accessibleRed
    : colors.onSurfaceVariant;

  return {
    level,
    color,
    bgColor: `${color}1A`,
    borderColor: `${color}26`,
    onPhotoBgColor: colors.surface,
    ...meta[level],
  };
}

export function getAccessibilityBadge(
  score: number | null | undefined,
  colors: AppColors,
): AccessibilityBadge {
  let level: AccessibilityLevel;
  if (score == null) level = 'unknown';
  else if (score >= 0.7) level = 'accessible';
  else if (score >= 0.4) level = 'partial';
  else level = 'not_accessible';

  return buildBadge(level, colors, LEVEL_META);
}

type Translate = (key: string) => string;

/**
 * The text of a route's accessibility badge, identical on every screen that
 * shows one: "Partial · 67%" (the percentage is left out when the score is
 * unknown). `label` is what the badge shows; `a11yLabel` is the same with the
 * level spelled out for screen readers.
 */
export function getRouteBadgeText(
  badge: AccessibilityBadge,
  score: number | null | undefined,
  t: Translate,
): { label: string; a11yLabel: string } {
  const percent = score != null ? ` · ${Math.round(score * 100)}%` : '';
  return {
    label: t(badge.labelKey) + percent,
    a11yLabel: t(badge.a11yLabelKey) + percent,
  };
}

const WHEELCHAIR_LEVELS: Record<string, AccessibilityLevel> = {
  yes: 'accessible',
  designated: 'accessible',
  limited: 'partial',
  no: 'not_accessible',
  unknown: 'unknown',
};

/**
 * Accessibility of a single place, read straight from its OSM `wheelchair` tag.
 *
 * Distinct from `getAccessibilityBadge`, which grades a whole route from a
 * computed 0-1 score. Here there is no score to threshold — one tag maps to one
 * level.
 *
 * The tag is free-form upstream and the database does hold values outside the
 * documented set, so anything unrecognised resolves to `unknown`. Claiming
 * "accessible" from a value we do not understand is the one failure mode this
 * app must not have.
 */
export function getWheelchairBadge(
  wheelchair: string | null | undefined,
  colors: AppColors,
): AccessibilityBadge {
  const level = WHEELCHAIR_LEVELS[wheelchair ?? ''] ?? 'unknown';
  return buildBadge(level, colors, WHEELCHAIR_META);
}

export type PathBadgeTone = 'good' | 'warning' | 'bad' | 'unknown';

export interface PathBadge {
  labelKey: string;
  params?: Record<string, number>;
  icon: string;
  tone: PathBadgeTone;
}

/**
 * Accessibility chips for a route's details screen.
 *
 * Every walking-surface claim ("no steps", ramps, kerbs, cobblestone) is about
 * the WHOLE path, from the server's path measurement — never inferred from the
 * stops. A wheelchair user decides whether the walk is possible from "no steps
 * on the route", so it is shown only when the path has 0 m of ramp-less steps.
 * Only the last chip is about the stops, and its wording says so.
 */
export function getRoutePathBadges(
  path: PathAccessibility | null | undefined,
  stops: Array<{ wheelchair?: string | null }>,
): PathBadge[] {
  const badges: PathBadge[] = [];

  if (!path || !path.measured) {
    badges.push({ labelKey: 'routeDetails.pathNoData', icon: 'help-circle', tone: 'unknown' });
  } else {
    const steps = path.stepsMeters ?? 0;
    if (steps === 0) {
      badges.push({ labelKey: 'routeDetails.stepsFree', icon: 'check-circle', tone: 'good' });
      // Ramps only reassure on an otherwise step-free path; next to "383 m of
      // steps" they would read as "accessible" and mislead.
      if ((path.rampedStepsMeters ?? 0) > 0 || (path.loweredKerbs ?? 0) > 0) {
        badges.push({ labelKey: 'routeDetails.rampsOnRoute', icon: 'wheelchair-accessibility', tone: 'good' });
      }
    } else {
      badges.push({
        labelKey: 'routeDetails.stepsOnRoute',
        params: { meters: steps },
        icon: 'stairs',
        tone: 'bad',
      });
    }
    if ((path.raisedKerbs ?? 0) > 0) {
      badges.push({
        labelKey: 'routeDetails.raisedKerbs',
        params: { count: path.raisedKerbs ?? 0 },
        icon: 'alert',
        tone: 'warning',
      });
    }
    if ((path.cobblestonePercent ?? 0) > 0) {
      badges.push({
        labelKey: 'routeDetails.cobblestone',
        params: { percent: path.cobblestonePercent ?? 0 },
        icon: 'alert',
        tone: 'warning',
      });
    }
  }

  if (stops.length > 0 && stops.every(s => s.wheelchair === 'yes' || s.wheelchair === 'designated')) {
    badges.push({ labelKey: 'routeDetails.allStopsWheelchair', icon: 'check-circle', tone: 'good' });
  }
  return badges;
}
