import React, { useCallback } from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import Text from './AppText';
import { remoteImageSource } from '../utils/remoteImage';
import { useTranslation } from 'react-i18next';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { POI } from '../models';
import { useTheme } from '../context/ThemeContext';
import { formatDistance, formatDuration } from '../utils/formatters';
import { getWheelchairBadge } from '../utils/accessibility';
import { toUpperCaseLabel } from '../utils/localization';
import { getPoiCategoryIcon } from '../utils/poiCategoryIcon';
import { RADIUS, SPACING, TYPOGRAPHY } from '../utils/constants';

const THUMB_SIZE = 56;
const MARKER_SIZE = 30;
const RAIL_WIDTH = 30;
// A number badge has nowhere to reflow, so it scales with the system font only
// up to the point where it still fits its circle. The stop name and meta text
// beside it scale without a cap.
const MARKER_MAX_SCALE = 1.5;

interface RouteStopItemProps {
  poi: POI;
  /** 0-based position in the route; displayed as index + 1. */
  index: number;
  isLast: boolean;
  onPress: (poi: POI) => void;
}

/**
 * One stop in the itinerary, drawn as a timeline entry.
 *
 * The number and the connecting rail carry what a flat list could not say:
 * these places have an order, and this is where this one falls in it. The same
 * numbers appear on the map markers, so "stop 3" means one thing in both views.
 *
 * Accessibility is stated per stop, not only for the route as a whole. A route
 * averaging "partial" can still contain one stop nobody in a wheelchair can
 * enter, and surfacing that is the point of the app. The chip carries icon,
 * colour and text together, never colour alone.
 */
function RouteStopItem({ poi, index, isLast, onPress }: RouteStopItemProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handlePress = useCallback(() => onPress(poi), [onPress, poi]);

  const badge = getWheelchairBadge(poi.wheelchair, colors);
  const isFirst = index === 0;
  const minutes = poi.estimatedArrivalMinutes;
  const atStart = isFirst || (minutes != null && minutes <= 0);

  let arrivalLabel: string | null = null;
  let arrivalA11y: string | null = null;
  if (atStart) {
    arrivalLabel = t('routeDetails.arrivalStart');
    arrivalA11y = t('routeDetails.arrivalStartA11y');
  } else if (minutes != null && minutes < 60) {
    arrivalLabel = t('routeDetails.arrivalMinutes', { count: minutes });
    arrivalA11y = t('routeDetails.arrivalMinutesA11y', { count: minutes });
  } else if (minutes != null) {
    // An hour or more reads like every other duration: «~1 ώ 27 λεπτά».
    const duration = formatDuration(minutes);
    arrivalLabel = t('routeDetails.arrivalDuration', { duration });
    arrivalA11y = t('routeDetails.arrivalDurationA11y', { duration });
  }

  const a11yLabel = t('routeDetails.stopA11y', {
    number: index + 1,
    name: poi.name,
    arrival: arrivalA11y ?? '',
    access: t(badge.a11yLabelKey),
  });

  return (
    <Pressable
      style={styles.row}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t('routeDetails.stopHintA11y')}
    >
      {/* Order rail: the number, and the line tying it to the next stop. */}
      <View style={styles.rail} importantForAccessibility="no-hide-descendants">
        <View
          style={[
            styles.marker,
            isFirst
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.primaryContainer, borderColor: colors.outlineVariant },
          ]}
        >
          <Text
            style={[
              TYPOGRAPHY.smallBold,
              styles.markerText,
              { color: isFirst ? colors.onPrimary : colors.onPrimaryContainer },
            ]}
            maxFontSizeMultiplier={MARKER_MAX_SCALE}
            numberOfLines={1}
          >
            {index + 1}
          </Text>
        </View>
        {!isLast ? (
          <View style={[styles.connector, { backgroundColor: colors.outlineVariant }]} />
        ) : null}
      </View>

      <View style={[styles.body, isLast ? null : styles.bodySpaced]}>
        <View style={styles.thumbWrap} importantForAccessibility="no-hide-descendants">
          {poi.photoUrl ? (
            <Image source={remoteImageSource(poi.photoUrl)} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View
              style={[
                styles.thumb,
                styles.thumbPlaceholder,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <MaterialIcon
                name={getPoiCategoryIcon(poi.category)}
                size={22}
                color={colors.onSurfaceVariant}
              />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={[TYPOGRAPHY.bodyBold, { color: colors.onSurface }]} numberOfLines={2}>
            {poi.name}
          </Text>

          <View style={styles.metaRow}>
            {arrivalLabel ? (
              <View style={styles.metaItem}>
                <MaterialIcon
                  name="clock-outline"
                  size={13}
                  color={colors.onSurfaceVariant}
                  importantForAccessibility="no-hide-descendants"
                />
                <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                  {arrivalLabel}
                </Text>
              </View>
            ) : null}

            {poi.distanceMeters != null ? (
              <View style={styles.metaItem}>
                <MaterialIcon
                  name="map-marker-distance"
                  size={13}
                  color={colors.onSurfaceVariant}
                  importantForAccessibility="no-hide-descendants"
                />
                <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                  {formatDistance(poi.distanceMeters)}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.accessChip,
                { backgroundColor: badge.bgColor, borderColor: badge.borderColor },
              ]}
            >
              <MaterialIcon
                name={badge.icon}
                size={13}
                color={badge.color}
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={[TYPOGRAPHY.overlineSmall, { color: badge.color }]}>
                {toUpperCaseLabel(t(badge.labelKey))}
              </Text>
            </View>
          </View>
        </View>

        <MaterialIcon
          name="chevron-right"
          size={22}
          color={colors.onSurfaceVariant}
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // No vertical padding on the row: the rail stretches to the row's full
  // height, so spacing lives on the body instead and the connector runs right
  // up to the next marker rather than stopping short in the gap.
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    textAlign: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: SPACING.xs,
    borderRadius: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  bodySpaced: {
    paddingBottom: SPACING.lg,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADIUS.input,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  accessChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
});

export default RouteStopItem;
