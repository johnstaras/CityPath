import React, { useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Text from '../../components/AppText';
import { useRoute, useNavigation, RouteProp, NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import MapView from '../../components/MapView';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import RouteStopItem from '../../components/RouteStopItem';
import { useRouteDetailsViewModel } from '../../viewmodels/useRouteDetailsViewModel';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { splitRouteForNavigation, toLineFeature } from '../../utils/routeGeometry';
import { POI } from '../../models';
import { HomeStackParamList } from '../../navigation/HomeStack';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../../utils/constants';
import { formatDistance, formatDuration } from '../../utils/formatters';
import {
  getAccessibilityBadge,
  getRouteBadgeText,
  getRoutePathBadges,
  PathBadgeTone,
} from '../../utils/accessibility';
import { toUpperCaseLabel } from '../../utils/localization';

type RouteDetailsRouteProp = RouteProp<HomeStackParamList, 'RouteDetails'>;
type RouteDetailsNavigationProp = NavigationProp<HomeStackParamList, 'RouteDetails'>;

// Clearance for the floating bottom bar: its padding (24) + button (56) +
// its own bottom padding (>=24), plus breathing room.
const BOTTOM_BAR_CLEARANCE = SPACING.lg + 56 + SPACING.lg + SPACING.md; // 120

// Hex alpha appended to the theme's 6-digit surface colour (~90% opaque) for
// the scrim behind the status bar.
const STATUS_BAR_SCRIM_ALPHA = 'E6';

function RouteDetailsScreen(): React.JSX.Element {
  const { params } = useRoute<RouteDetailsRouteProp>();
  const navigation = useNavigation<RouteDetailsNavigationProp>();
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const {
    route,
    isLoading,
    isNotFound,
    retry,
    isFavorite,
    toggleFavorite,
    userPosition,
    locateUser,
  } = useRouteDetailsViewModel(params.routeId);

  const handlePoiPress = useCallback((poi: POI) => {
    navigation.navigate('POIDetail', { poiId: poi.id });
  }, [navigation]);

  const handleStartRoute = useCallback(() => {
    if (route) {
      navigation.navigate('ActiveRoute', { route });
    }
  }, [route, navigation]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // All hooks MUST be called before any early return.
  //
  // Nothing has been walked yet on this screen, so the split is simply "the
  // leg to stop 1" against "the rest of the walk" — a preview of where to
  // start, matching how the same route will be drawn once navigation begins.
  const { activeLegGeoJSON, upcomingGeoJSON } = useMemo(() => {
    const line =
      route?.geometry && route.geometry.type === 'LineString'
        ? (route.geometry.coordinates as [number, number][])
        : null;

    if (!line) {
      return { activeLegGeoJSON: null, upcomingGeoJSON: null };
    }

    // Highlight the first leg the walker will actually cover. Stop 1 usually
    // sits at the very start of the line, so slicing there would produce a
    // zero-length highlight — slice at stop 2 instead, giving "start here, walk
    // this bit first".
    const stops = route?.pois ?? [];
    const legEnd = stops[1] ?? stops[0] ?? null;
    const { activeLeg, upcoming } = splitRouteForNavigation(line, legEnd, null);
    return {
      activeLegGeoJSON: toLineFeature(activeLeg),
      upcomingGeoJSON: toLineFeature(upcoming),
    };
  }, [route?.geometry, route?.pois]);

  const mapPois = useMemo(
    () =>
      (route?.pois ?? []).map((poi, index) => ({
        lat: poi.lat,
        lng: poi.lng,
        state: index === 0 ? ('next' as const) : ('upcoming' as const),
      })),
    [route?.pois],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Skeleton width="100%" height={300} radius={0} />
        <View style={styles.loadingContent}>
          <Skeleton width="70%" height={28} style={styles.loadingBlock} />
          <Skeleton width="45%" height={16} style={styles.loadingBlock} />
          <Skeleton width="100%" height={140} radius={RADIUS.card} style={styles.loadingBlock} />
          <Skeleton width="100%" height={140} radius={RADIUS.card} style={styles.loadingBlock} />
        </View>
      </View>
    );
  }

  if (!route) {
    // "Not found" only when the server said so. A network or server error is
    // not a missing route, and it can be retried.
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.surface }]}
        accessibilityRole="alert"
      >
        {isNotFound ? (
          <EmptyState
            icon="alert-circle-outline"
            title={t('routeDetails.notFound')}
            ctaLabel={t('routeDetails.goBack')}
            onCta={handleGoBack}
          />
        ) : (
          <>
            <EmptyState
              icon="cloud-off-outline"
              title={t('routeDetails.loadErrorTitle')}
              subtitle={t('routeDetails.loadErrorSubtitle')}
              ctaLabel={t('common.retry')}
              onCta={retry}
            />
            <AppButton
              label={t('routeDetails.goBack')}
              onPress={handleGoBack}
              variant="secondary"
              style={styles.errorBack}
            />
          </>
        )}
      </View>
    );
  }

  const pois = route.pois ?? [];
  const mapCenter =
    pois.length > 0
      ? { lat: pois[0].lat, lng: pois[0].lng }
      : route.lat != null && route.lng != null
        ? { lat: route.lat, lng: route.lng }
        : undefined;

  const pathBadges = getRoutePathBadges(route.pathAccessibility, pois);
  const toneColor: Record<PathBadgeTone, string> = {
    good: colors.accessibleGreen,
    warning: colors.accessibleOrange,
    bad: colors.accessibleRed,
    unknown: colors.onSurfaceVariant,
  };
  const badge = getAccessibilityBadge(route.accessibilityScore, colors);
  const { label: badgeLabel, a11yLabel: badgeA11yLabel } = getRouteBadgeText(
    badge,
    route.accessibilityScore,
    t,
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Map Section */}
      <View style={styles.mapContainer}>
        <MapView
          center={mapCenter}
          zoom={14}
          // Left off deliberately: the native puck only paints when mounted
          // before the map loads, and here the position arrives later, on
          // demand. MapView draws `userPosition` itself instead.
          showUserLocation={false}
          activeLegGeoJSON={activeLegGeoJSON}
          upcomingGeoJSON={upcomingGeoJSON}
          pois={mapPois}
          userPosition={userPosition}
          onLocatePress={locateUser}
          style={styles.map}
        />
        {/* Edge-to-edge (targetSdk 36) ignores StatusBar's backgroundColor, so
            the icons sat straight on the map tiles. A theme-surface scrim
            behind the top inset keeps them legible. */}
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[styles.statusBarScrim, { height: insets.top, backgroundColor: colors.surface + STATUS_BAR_SCRIM_ALPHA }]}
        />
        <ScreenHeader floating onBack={handleGoBack} />
      </View>

      {/* Content Card */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: BOTTOM_BAR_CLEARANCE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.contentCard,
            getShadows(colorScheme).elevated,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
        >
          <Text
            style={[TYPOGRAPHY.heading2, styles.title, { color: colors.onSurface }]}
            accessibilityRole="header"
          >
            {route.title}
          </Text>

          {/* Metadata Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialIcon
                name="clock-outline"
                size={16}
                color={colors.primary}
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                {formatDuration(route.estimatedDurationMinutes)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcon
                name="map-marker-distance"
                size={16}
                color={colors.primary}
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                {formatDistance(route.distanceMeters)}
              </Text>
            </View>
            {/* Accessibility Badge */}
            <View
              style={[styles.accessBadge, { backgroundColor: badge.bgColor, borderColor: badge.borderColor }]}
              accessible
              accessibilityLabel={badgeA11yLabel}
            >
              <MaterialIcon
                name={badge.icon}
                size={14}
                color={badge.color}
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={[TYPOGRAPHY.overline, { color: badge.color }]}>
                {toUpperCaseLabel(badgeLabel)}
              </Text>
            </View>
          </View>

          {/* About */}
          {route.description ? (
            <View style={styles.section}>
              <Text style={[TYPOGRAPHY.heading4, styles.sectionTitle, { color: colors.onSurface }]}>
                {t('routeDetails.about')}
              </Text>
              <Text style={[TYPOGRAPHY.body, { color: colors.onSurfaceVariant }]}>
                {route.description}
              </Text>
            </View>
          ) : null}

          {/* Accessibility Info */}
          <View style={styles.section}>
            <Text style={[TYPOGRAPHY.heading4, styles.sectionTitle, { color: colors.onSurface }]}>
              {t('routeDetails.accessibility')}
            </Text>
            <View style={styles.badgesContainer}>
              {pathBadges.map(infoBadge => (
                // Colour + icon + text. The text stays on the body colour so it
                // keeps 4.5:1 contrast; the tone colour marks icon and border.
                <View
                  key={infoBadge.labelKey}
                  style={[styles.infoBadge, { backgroundColor: colors.surfaceContainer, borderColor: toneColor[infoBadge.tone] }]}
                >
                  <MaterialIcon
                    name={infoBadge.icon}
                    size={14}
                    color={toneColor[infoBadge.tone]}
                    importantForAccessibility="no-hide-descendants"
                  />
                  <Text style={[TYPOGRAPHY.small, { color: colors.onSurface }]}>
                    {t(infoBadge.labelKey, infoBadge.params)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Stops */}
          <View style={styles.section}>
            <View style={styles.stopsHeader}>
              <Text style={[TYPOGRAPHY.heading4, { color: colors.onSurface }]}>
                {t('routeDetails.stops')}
              </Text>
              {pois.length > 0 ? (
                <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                  {t('routeDetails.stopsCount', { count: pois.length })}
                </Text>
              ) : null}
            </View>
            {pois.length > 0 ? (
              <View>
                {pois.map((poi, idx) => (
                  <RouteStopItem
                    key={poi.id}
                    poi={poi}
                    index={idx}
                    isLast={idx === pois.length - 1}
                    onPress={handlePoiPress}
                  />
                ))}
              </View>
            ) : (
              <Text style={[TYPOGRAPHY.caption, styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {t('routeDetails.noPois')}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View
        style={[
          styles.bottomBar,
          getShadows(colorScheme).bottomBar,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, SPACING.lg),
          },
        ]}
      >
        <AppButton
          label={t('routeDetails.favorite')}
          onPress={toggleFavorite}
          variant="secondary"
          icon={isFavorite ? 'heart' : 'heart-outline'}
          iconOnly
          accessibilityLabel={
            isFavorite
              ? t('routeDetails.favoriteSelectedA11y', { label: t('routeDetails.favorite') })
              : t('routeDetails.favorite')
          }
        />
        <AppButton
          label={t('routeDetails.start')}
          onPress={handleStartRoute}
          variant="primary"
          icon="navigation-variant"
          style={styles.startBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  errorBack: {
    marginTop: SPACING.md,
  },
  loadingContent: {
    padding: SPACING.lg,
    marginTop: -SPACING.lg,
  },
  loadingBlock: {
    marginBottom: SPACING.md,
  },
  mapContainer: {
    height: 300,
    width: '100%',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  statusBarScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrollView: {
    flex: 1,
    marginTop: -SPACING.lg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  contentCard: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    padding: SPACING.lg,
  },
  title: {
    marginBottom: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
  },
  accessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs + 2,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    marginBottom: SPACING.md,
  },
  stopsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  infoBadge: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.input,
    gap: SPACING.xs + 2,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
  },
  startBtn: {
    flex: 1,
  },
});

export default RouteDetailsScreen;
