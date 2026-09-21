import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../../components/AppText';
import { useRoute, useNavigation, usePreventRemove, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import MapView from '../../components/MapView';
import ProgressBar from '../../components/ProgressBar';
import AlternativeRoutesModal from '../../components/AlternativeRoutesModal';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import { useActiveRouteViewModel } from '../../viewmodels/useActiveRouteViewModel';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { splitRouteForNavigation, toLineFeature } from '../../utils/routeGeometry';
import { useDialog } from '../../context/DialogContext';
import { HomeStackParamList } from '../../navigation/HomeStack';
import { AlternativeRoute } from '../../services/routeService';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../../utils/constants';

type ActiveRouteRouteProp = RouteProp<HomeStackParamList, 'ActiveRoute'>;
type ActiveRouteNavProp = NativeStackNavigationProp<HomeStackParamList, 'ActiveRoute'>;

// Kept in sync with RouteDetailsScreen's POI_CATEGORY_ICONS for the categories
// they share (historical/cultural/nature); `tourism` is added here since the
// next-stop card can surface it and RouteDetailsScreen doesn't define it.
const POI_CATEGORY_ICONS: Record<string, string> = {
  historical: 'bank',
  tourism: 'bank',
  nature: 'tree',
  cultural: 'drama-masks',
};

function getPoiCategoryIcon(category?: string): string {
  return (category && POI_CATEGORY_ICONS[category]) || 'map-marker';
}

// Floating header back button (insets.top + SPACING.md, height SPACING.xxl)
// plus a breathing gap, so the next-turn overlay never collides with it.
const TURN_OVERLAY_CLEARANCE = SPACING.md + SPACING.xxl + SPACING.md;

// Space the fitted route leaves for the turn card: its offset from the top
// (safe-area inset + clearance) plus its own height and a small margin, so the
// first stops are never tucked underneath it.
const TURN_CARD_HEIGHT = 76;
const FIT_TOP_EXTRA = TURN_OVERLAY_CLEARANCE + TURN_CARD_HEIGHT + SPACING.md;

// Hex alpha appended to the theme's 6-digit surface colour (~90% opaque) for
// the scrim behind the status bar.
const STATUS_BAR_SCRIM_ALPHA = 'E6';

function ActiveRouteScreen(): React.JSX.Element {
  const { params } = useRoute<ActiveRouteRouteProp>();
  const navigation = useNavigation<ActiveRouteNavProp>();
  const routeData = params.route;
  const { colors, colorScheme } = useTheme();
  const shadows = getShadows(colorScheme);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();

  const {
    route,
    progress,
    isOffRoute,
    status,
    startError,
    userPosition,
    nextPoi,
    nextPoiDistance,
    remainingTime,
    remainingDistance,
    startRoute,
    pauseRoute,
    resumeRoute,
    stopRoute,
    isCompleted,
    completionData,
    showCheckpointModal,
    checkpointPercent,
    alternatives,
    selectAlternativeRoute,
    dismissCheckpoint,
  } = useActiveRouteViewModel(routeData);

  React.useEffect(() => {
    if (status === 'idle') {
      startRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set right before this screen navigates away on its own (summary on
  // completion, back after a confirmed Stop). Every other removal — Android
  // hardware back, the iOS swipe-back gesture — is intercepted below.
  const leavingRef = useRef(false);

  useEffect(() => {
    if (isCompleted && completionData) {
      leavingRef.current = true;
      navigation.replace('RouteSummary', { completionData });
    }
  }, [isCompleted, completionData, navigation]);

  const handleStop = useCallback(() => {
    dialog.confirm({
      title: t('activeRoute.stopTitle'),
      message: t('activeRoute.stopMessage'),
      confirmLabel: t('activeRoute.stop'),
      cancelLabel: t('activeRoute.cancel'),
      destructive: true,
      onConfirm: async () => {
        // False when auto-completion finished the session while the dialog
        // was open — the screen is moving to the summary instead.
        const stopped = await stopRoute();
        if (stopped && !leavingRef.current) {
          leavingRef.current = true;
          navigation.goBack();
        }
      },
    });
  }, [dialog, stopRoute, navigation, t]);

  // Leaving mid-walk must go through the same confirmation as the header back
  // arrow, or the session is left 'active' on the server. usePreventRemove
  // (not a BackHandler) also covers the iOS swipe-back, which native-stack
  // cancels natively while removal is prevented. The screen's own replace /
  // goBack re-dispatch the intercepted action once leavingRef is set.
  usePreventRemove(true, ({ data }) => {
    // After a failed start there is no session to stop or confirm.
    if (leavingRef.current || startError != null) {
      navigation.dispatch(data.action);
    } else {
      handleStop();
    }
  });

  // Seamless switch: the viewmodel swaps the journey in place — no
  // navigation, the session and tracking continue on this screen.
  const handleSelectAlternative = useCallback(
    async (selectedRoute: AlternativeRoute) => {
      await selectAlternativeRoute(selectedRoute);
    },
    [selectAlternativeRoute],
  );

  const handlePauseResume = useCallback(() => {
    if (status === 'active') {
      pauseRoute();
    } else if (status === 'paused') {
      resumeRoute();
    }
  }, [status, pauseRoute, resumeRoute]);

  // The bar only reports a walk that is being tracked: while starting, or
  // after a failed start, it shows no "on track" label.
  const progressBarStatus = status;

  const handleRetryStart = useCallback(() => {
    startRoute();
  }, [startRoute]);

  // Nothing to stop yet: leave without the stop confirmation.
  const handleLeaveAfterError = useCallback(() => {
    leavingRef.current = true;
    navigation.goBack();
  }, [navigation]);

  // Stable identity: `route.pois ?? []` makes a fresh array every render, which
  // would re-run the map memos below on every GPS tick.
  const pois = useMemo(() => route.pois ?? [], [route.pois]);
  const fitPadding = useMemo(() => ({ top: insets.top + FIT_TOP_EXTRA }), [insets.top]);

  // Where the camera starts. Native user tracking is only switched on once
  // this screen has a position of its own: MapLibre's location manager is a
  // process-wide singleton that replays its cached last location to every new
  // tracking camera, so tracking from mount sent the camera to where the
  // PREVIOUS walk ended, with no puck, until fresh fixes arrived. Until then
  // the camera sits on the start of the route; the map remounts (see `key`)
  // when the first fix lands and tracking takes over from that position.
  const hasFix = userPosition != null;
  const routeStart = useMemo(() => {
    const line =
      routeData.geometry && routeData.geometry.type === 'LineString'
        ? (routeData.geometry.coordinates as [number, number][])
        : null;
    if (line && line.length > 0) {
      return { lat: line[0][1], lng: line[0][0] };
    }
    const stops = routeData.pois ?? [];
    if (stops.length > 0) {
      return { lat: stops[0].lat, lng: stops[0].lng };
    }
    return routeData.lat != null && routeData.lng != null
      ? { lat: routeData.lat, lng: routeData.lng }
      : undefined;
  }, [routeData]);
  // With tracking on, `center` is only the initial view, so following the
  // live position here does not fight the native camera.
  const mapCenter = userPosition ?? routeStart;

  // Split the line into walked / leg-to-next-stop / everything after, so the
  // map can draw the one the walker should follow now in full strength and
  // keep the rest quiet. Recomputed as the walker moves and stops are reached.
  const { walkedGeoJSON, activeLegGeoJSON, upcomingGeoJSON } = useMemo(() => {
    const line =
      route.geometry && route.geometry.type === 'LineString'
        ? (route.geometry.coordinates as [number, number][])
        : null;

    if (!line) {
      return { walkedGeoJSON: null, activeLegGeoJSON: null, upcomingGeoJSON: null };
    }

    const { walked, activeLeg, upcoming } = splitRouteForNavigation(
      line,
      nextPoi,
      userPosition,
    );

    return {
      walkedGeoJSON: toLineFeature(walked),
      activeLegGeoJSON: toLineFeature(activeLeg),
      upcomingGeoJSON: toLineFeature(upcoming),
    };
  }, [route.geometry, nextPoi, userPosition]);

  // Mark each stop as done / heading-there / later so the pins carry the order
  // rather than all looking alike. Once every stop is behind the walker there
  // is no next one, and they are all visited.
  const mapPois = useMemo(() => {
    const nextIndex = nextPoi ? pois.findIndex(p => p.id === nextPoi.id) : pois.length;
    return pois.map((poi, index) => ({
      lat: poi.lat,
      lng: poi.lng,
      state:
        index === nextIndex ? ('next' as const)
        : index < nextIndex ? ('visited' as const)
        : ('upcoming' as const),
    }));
  }, [pois, nextPoi]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Map Section */}
      <View style={styles.mapContainer}>
        <MapView
          key={hasFix ? 'tracking' : 'route-start'}
          center={mapCenter}
          zoom={16}
          showUserLocation={hasFix}
          followUser={hasFix}
          walkedGeoJSON={walkedGeoJSON}
          activeLegGeoJSON={activeLegGeoJSON}
          upcomingGeoJSON={upcomingGeoJSON}
          pois={mapPois}
          userPosition={userPosition}
          // Clears the floating "next stop" card, which sits over the top of
          // the map and would otherwise hide the first stops of a fitted route.
          fitPadding={fitPadding}
          style={styles.map}
        />

        {/* The app draws edge-to-edge (targetSdk 36), so StatusBar's
            backgroundColor is ignored and the icons sat straight on the map
            tiles. A theme-surface scrim behind the top inset keeps them
            legible; ThemedStatusBar already picks icon colour per theme. */}
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[styles.statusBarScrim, { height: insets.top, backgroundColor: colors.surface + STATUS_BAR_SCRIM_ALPHA }]}
        />

        <ScreenHeader floating onBack={startError ? handleLeaveAfterError : handleStop} />

        {/* Top overlays stacked in one column, so they never overlap each
            other, and kept off the bottom of the map where the fit-route and
            locate-me buttons sit (the off-route notice used to cover them). */}
        <View
          pointerEvents="box-none"
          style={[styles.topOverlays, { top: insets.top + TURN_OVERLAY_CLEARANCE }]}
        >
          {/* Next Turn Overlay */}
          {nextPoi && (
            <View
              style={[
                styles.turnCard,
                shadows.card,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border },
              ]}
            >
              <View style={[styles.turnIconBox, { backgroundColor: colors.primary }]}>
                <MaterialIcon name="arrow-right" size={20} color={colors.onPrimary} />
              </View>
              <View style={styles.turnText}>
                <Text style={[TYPOGRAPHY.overlineSmall, { color: colors.onSurfaceVariant }]}>
                  {t('activeRoute.nextStop')}
                </Text>
                <Text
                  style={[TYPOGRAPHY.bodyBold, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {nextPoi.name}
                </Text>
              </View>
            </View>
          )}

          {/* Off-route notice: progress is paused until the user returns to
              the planned line (color + icon + text, never color alone). */}
          {isOffRoute && (
            <View
              style={[styles.offRouteBanner, shadows.card, { backgroundColor: colors.tertiaryContainer, borderColor: colors.tertiary }]}
              accessibilityLiveRegion="polite"
            >
              <MaterialIcon name="map-marker-alert" size={20} color={colors.tertiary} />
              <Text style={[TYPOGRAPHY.bodyBold, styles.offRouteText, { color: colors.onTertiaryContainer }]}>
                {t('activeRoute.offRoute')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Panel */}
      <View
        style={[
          styles.panel,
          shadows.bottomBar,
          {
            backgroundColor: colors.surfaceContainerLowest,
            // Tab bar is hidden on this screen (both tabs), so the panel sits on the
            // screen edge — give the buttons extra breathing room above it.
            paddingBottom: Math.max(insets.bottom, SPACING.lg) + SPACING.md,
          },
        ]}
      >
        {/* Progress */}
        <ProgressBar progress={progress} status={progressBarStatus} isOffRoute={isOffRoute} />

        {/* Next Destination */}
        {nextPoi && (
          <View style={[styles.nextDestination, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={styles.nextDestRow}>
              <View
                style={[
                  styles.nextDestIcon,
                  shadows.card,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <MaterialIcon
                  name={getPoiCategoryIcon(nextPoi.category)}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.nextDestText}>
                <Text
                  style={[TYPOGRAPHY.heading4, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {t('activeRoute.next', { name: nextPoi.name })}
                </Text>
                <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                  {nextPoiDistance != null ? formatDistance(nextPoiDistance) : '--'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
            ]}
          >
            <Text style={[TYPOGRAPHY.overline, styles.statCardLabel, { color: colors.onSurfaceVariant }]}>
              {t('activeRoute.remaining')}
            </Text>
            <Text style={[TYPOGRAPHY.heading2, { color: colors.primary }]}>
              {formatDuration(remainingTime)}
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
            ]}
          >
            <Text style={[TYPOGRAPHY.overline, styles.statCardLabel, { color: colors.onSurfaceVariant }]}>
              {t('activeRoute.distance')}
            </Text>
            <Text style={[TYPOGRAPHY.heading2, { color: colors.primary }]}>
              {formatDistance(remainingDistance)}
            </Text>
          </View>
        </View>

        {/* Pause and Stop share one slot (fitness-app pattern): while walking
            only Pause shows, so abandoning a route is a deliberate two-step —
            pause first, then Stop (which still confirms via dialog). The row
            wraps: two half-width buttons cut «Τερματισμός» to «Τερματισμ…» on
            a phone, so each keeps its natural width and the second moves to
            its own line when both do not fit. */}
        {status === 'paused' ? (
          <View style={[styles.buttonsRow, styles.buttonsRowWrap]}>
            <AppButton
              label={t('activeRoute.resume')}
              onPress={handlePauseResume}
              variant="secondary"
              icon="play"
              style={styles.wrapBtn}
            />
            <AppButton
              label={t('activeRoute.stop')}
              onPress={handleStop}
              variant="destructive"
              icon="stop"
              style={styles.wrapBtn}
            />
          </View>
        ) : status === 'active' ? (
          <View style={styles.buttonsRow}>
            <AppButton
              label={t('activeRoute.pause')}
              onPress={handlePauseResume}
              variant="secondary"
              icon="pause"
              style={styles.rowBtn}
            />
          </View>
        ) : startError ? (
          // Start failed (no location access, or the session could not be
          // created): say so and offer a retry or a way back — there is no
          // walk to pause.
          <View style={styles.startError} accessibilityLiveRegion="polite">
            <View style={styles.startErrorRow}>
              <MaterialIcon name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={[TYPOGRAPHY.body, styles.startErrorText, { color: colors.onSurface }]}>
                {t(startError === 'permission' ? 'activeRoute.startPermissionError' : 'activeRoute.startSessionError')}
              </Text>
            </View>
            <View style={[styles.buttonsRow, styles.buttonsRowWrap]}>
              <AppButton
                label={t('common.retry')}
                onPress={handleRetryStart}
                variant="primary"
                icon="refresh"
                style={styles.wrapBtn}
              />
              <AppButton
                label={t('common.back')}
                onPress={handleLeaveAfterError}
                variant="secondary"
                icon="arrow-left"
                style={styles.wrapBtn}
              />
            </View>
          </View>
        ) : (
          // Starting: permission prompt / session request in flight.
          <Text style={[TYPOGRAPHY.body, styles.startingText, { color: colors.onSurfaceVariant }]}>
            {t('common.loading')}
          </Text>
        )}
      </View>

      <AlternativeRoutesModal
        visible={showCheckpointModal}
        checkpoint={checkpointPercent}
        alternatives={alternatives}
        onSelectRoute={handleSelectAlternative}
        onContinue={dismissCheckpoint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // The map takes what the panel leaves. A fixed 55/45 split let panel
  // content that grows (wrapped buttons, a start error, large system fonts)
  // run off the bottom of the screen.
  mapContainer: {
    flex: 1,
    position: 'relative',
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
  topOverlays: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    gap: SPACING.sm,
  },
  offRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  offRouteText: {
    flex: 1,
  },
  turnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    gap: SPACING.md,
  },
  turnText: {
    flexShrink: 1,
  },
  turnIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    flexShrink: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    marginTop: -RADIUS.sheet,
  },
  nextDestination: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
  },
  nextDestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  nextDestIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextDestText: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  statCardLabel: {
    marginBottom: SPACING.xs,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  rowBtn: {
    flex: 1,
  },
  buttonsRowWrap: {
    flexWrap: 'wrap',
  },
  // Natural width, stretched to share the row; wraps instead of truncating.
  wrapBtn: {
    flexGrow: 1,
  },
  startError: {
    marginTop: SPACING.xl,
  },
  startErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  startErrorText: {
    flex: 1,
  },
  startingText: {
    marginTop: SPACING.xl,
    textAlign: 'center',
  },
});

export default ActiveRouteScreen;
