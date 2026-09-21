import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Text from './AppText';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  UserLocation,
  type CameraRef,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import { useTranslation } from 'react-i18next';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, getShadows } from '../utils/constants';

// Basemap tiles, both key-free.
//
// These were CARTO Voyager / Dark Matter. CARTO now gates its basemaps behind
// an API key and, rather than failing, still answers HTTP 200 — with
// "API KEY REQUIRED / carto.com/basemaps/apikey" stamped diagonally across
// every tile. It looked like a broken map during navigation.
//
// Light is OpenStreetMap's standard raster layer, which is also what the
// project spec calls for and what the app already attributes everywhere else.
// OSM has no dark counterpart, so dark uses Esri's Dark Gray Canvas — a muted
// base designed to sit under a coloured route line, which is exactly this use.
//
// Both are free and unauthenticated, but they are shared community/vendor
// services: the OSM tile policy requires an identifying User-Agent and rules
// out heavy bulk use, so anything beyond demo traffic should move to a
// self-hosted renderer or a keyed provider (one constant change).
const TILE_URLS = {
  light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
};

const ATTRIBUTION = {
  light: '© OpenStreetMap contributors',
  dark: '© OpenStreetMap contributors, © Esri',
};

const buildMapStyle = (scheme: 'light' | 'dark') => ({
  version: 8 as const,
  // Required by any symbol layer with text (POI order labels): without a
  // glyphs template, mbgl requests an empty URL ("Unable to parse resourceUrl").
  glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  sources: {
    base: {
      type: 'raster' as const,
      tiles: [TILE_URLS[scheme]],
      // Both providers serve 256 px tiles (the previous CARTO URLs were @2x).
      tileSize: 256,
      maxzoom: 19,
      attribution: ATTRIBUTION[scheme],
    },
  },
  layers: [
    {
      id: 'base-tiles',
      type: 'raster' as const,
      source: 'base',
    },
  ],
});

// Muted greens for the parts of the walk that are not "now". Visible enough to
// read the shape of the rest of the route, quiet enough that the leg to the
// next stop is unmistakably the line to follow.
const UPCOMING_LINE = { light: '#7FA093', dark: '#4C6259' };

// Stop pins: the next stop is deliberately the largest thing on the route.
const PIN_SIZE = { next: 34, upcoming: 28, visited: 24 };

// Order-number colour for the muted pins. They are pale sage in light mode and
// near-black in dark mode, so one fixed colour would fail contrast in whichever
// theme it was not picked for. The "next" pin uses the theme's own onPrimary,
// which is defined for exactly this pairing.
const PIN_LABEL = { light: '#0F1B2D', dark: '#FFFFFF' };

const WALKED_LINE = { light: '#C2D0CA', dark: '#36443E' };

export type MapPoiState = 'visited' | 'next' | 'upcoming';

export interface MapPoiMarker {
  lat: number;
  lng: number;
  /**
   * Where this stop sits in the walk. Drives its weight on the map: the next
   * stop is the one the walker is heading for and is drawn largest.
   */
  state?: MapPoiState;
}

interface MapViewProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  showUserLocation?: boolean;
  /**
   * Keep the camera centered on the user's position (native tracking).
   * `center`/`zoom` then only set the initial view until the first GPS fix.
   */
  followUser?: boolean;
  onPress?: (coordinate: { lat: number; lng: number }) => void;
  /**
   * The whole route, drawn in one weight. Use this on preview screens; during
   * navigation prefer the three-part split below, which tells the walker which
   * line to actually follow next.
   */
  routeGeoJSON?: GeoJSON.FeatureCollection | null;
  /** Already walked — drawn faintest. */
  walkedGeoJSON?: GeoJSON.FeatureCollection | null;
  /** The leg to the next stop — drawn boldest, on top. */
  activeLegGeoJSON?: GeoJSON.FeatureCollection | null;
  /** Everything after the next stop — drawn muted. */
  upcomingGeoJSON?: GeoJSON.FeatureCollection | null;
  /** POI stops rendered as numbered-order circle pins. */
  pois?: MapPoiMarker[];
  /**
   * Latest known position of the walker. Supplying it (or `onLocatePress`)
   * adds the "my location" control.
   */
  userPosition?: { lat: number; lng: number } | null;
  /**
   * Asks the screen to obtain a position, for screens that do not track one
   * continuously. The camera moves once `userPosition` arrives.
   */
  onLocatePress?: () => void;
  /**
   * Inset kept clear when fitting the route, in points. Screens with overlays
   * on top of the map raise the side those sit on, so a fitted route does not
   * end up underneath them.
   */
  fitPadding?: { top?: number; right?: number; bottom?: number; left?: number };
  style?: ViewStyle;
}

const DEFAULT_CENTER = { lat: 37.9755, lng: 23.7348 };
const DEFAULT_ZOOM = 14;

const CAMERA_MS = 600;
/** Zoom used when moving to a single point, where there is no extent to fit. */
const FOCUS_ZOOM = 16;
/** Keeps fitted routes clear of the header, overlays and map controls. */
const BOUNDS_PADDING = { top: 80, right: 72, bottom: 96, left: 56 };
/**
 * Degrees below which a bounding box counts as a single point (~11 m). Fitting
 * a zero-size box drives the camera to maximum zoom, so those focus instead.
 */
const MIN_BOUNDS_SPAN = 0.0001;

/** Diameter of the walker's dot on screens that do not track continuously. */
const USER_DOT_SIZE = 18;

function MapView({
  center,
  zoom,
  showUserLocation,
  followUser,
  onPress,
  routeGeoJSON,
  walkedGeoJSON,
  activeLegGeoJSON,
  upcomingGeoJSON,
  pois,
  userPosition,
  onLocatePress,
  fitPadding,
  style,
}: MapViewProps): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);
  // Native location tracking owns the camera while it is on, so "whole route"
  // has to switch it off or the next GPS fix would snap straight back.
  const [isTracking, setIsTracking] = useState(!!followUser);
  // Set when "my location" is pressed before any fix exists, so the camera
  // moves when one arrives — and only then. Without it, every background
  // position update would yank the camera away from a user who has panned.
  const pendingLocateRef = useRef(false);
  // Stop numbers are mounted only after the map reports it finished loading.
  // Mounted before that they bind to a projection that is not ready and stay
  // at the wrong place for the life of the screen — they translate with pans
  // but never re-project.
  const [mapReady, setMapReady] = useState(false);
  const handleMapLoaded = useCallback(() => setMapReady(true), []);
  const mapCenter = center ?? DEFAULT_CENTER;
  const mapZoom = zoom ?? DEFAULT_ZOOM;
  const centerCoord = useMemo(
    () => [mapCenter.lng, mapCenter.lat] as [number, number],
    [mapCenter.lng, mapCenter.lat],
  );

  const mapStyle = useMemo(() => buildMapStyle(colorScheme), [colorScheme]);

  // All route segments live in ONE source, tagged by `segment`, with a layer
  // per tag filtering on it.
  //
  // Not a style preference: this version of maplibre-react-native
  // (11.0.0-alpha.47) silently drops additional GeoJSON line sources — four
  // sibling <GeoJSONSource> blocks with valid 299-point geometry rendered only
  // the last one, with no error logged. One source and filtered layers is also
  // the idiomatic MapLibre shape, so it is the fix rather than a workaround.
  const routeSegmentsGeoJSON: GeoJSON.FeatureCollection | null = useMemo(() => {
    const features: GeoJSON.Feature[] = [];
    const add = (collection: GeoJSON.FeatureCollection | null | undefined, segment: string) => {
      const feature = collection?.features?.[0];
      if (feature) {
        features.push({ ...feature, properties: { segment } });
      }
    };
    // Order here is paint order within each layer; the layers below stack them.
    add(routeGeoJSON, 'full');
    add(walkedGeoJSON, 'walked');
    add(upcomingGeoJSON, 'upcoming');
    add(activeLegGeoJSON, 'active');
    return features.length > 0 ? { type: 'FeatureCollection', features } : null;
  }, [routeGeoJSON, walkedGeoJSON, upcomingGeoJSON, activeLegGeoJSON]);

  const poiGeoJSON: GeoJSON.FeatureCollection | null = useMemo(
    () =>
      pois && pois.length > 0
        ? {
            type: 'FeatureCollection',
            features: pois.map((poi, index) => ({
              type: 'Feature',
              properties: { order: String(index + 1), state: poi.state ?? 'upcoming' },
              geometry: { type: 'Point', coordinates: [poi.lng, poi.lat] },
            })),
          }
        : null,
    [pois],
  );

  // Everything the route occupies: the drawn line plus every stop, so a stop
  // set slightly off the path still ends up inside the frame.
  const routeBounds = useMemo<LngLatBounds | null>(() => {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    let seen = 0;

    const visit = (lng: number, lat: number) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return;
      }
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      seen += 1;
    };

    routeSegmentsGeoJSON?.features.forEach(feature => {
      if (feature.geometry.type === 'LineString') {
        (feature.geometry.coordinates as [number, number][]).forEach(coord =>
          visit(coord[0], coord[1]),
        );
      }
    });
    pois?.forEach(poi => visit(poi.lng, poi.lat));

    return seen > 0 ? [west, south, east, north] : null;
  }, [routeSegmentsGeoJSON, pois]);

  const moveToPosition = useCallback((position: { lat: number; lng: number }) => {
    cameraRef.current?.flyTo({
      center: [position.lng, position.lat],
      zoom: FOCUS_ZOOM,
      duration: CAMERA_MS,
    });
  }, []);

  const handleFitRoute = useCallback(() => {
    if (!routeBounds) {
      return;
    }
    setIsTracking(false);
    const [west, south, east, north] = routeBounds;
    if (east - west < MIN_BOUNDS_SPAN && north - south < MIN_BOUNDS_SPAN) {
      moveToPosition({ lat: south, lng: west });
      return;
    }
    cameraRef.current?.fitBounds(routeBounds, {
      padding: { ...BOUNDS_PADDING, ...fitPadding },
      duration: CAMERA_MS,
    });
  }, [routeBounds, moveToPosition, fitPadding]);

  const handleLocate = useCallback(() => {
    onLocatePress?.();
    if (userPosition) {
      setIsTracking(true);
      moveToPosition(userPosition);
    } else {
      pendingLocateRef.current = true;
    }
  }, [onLocatePress, userPosition, moveToPosition]);

  useEffect(() => {
    if (pendingLocateRef.current && userPosition) {
      pendingLocateRef.current = false;
      setIsTracking(true);
      moveToPosition(userPosition);
    }
  }, [userPosition, moveToPosition]);

  const canLocate = !!userPosition || !!onLocatePress;
  const canFitRoute = !!routeBounds;

  return (
    <View style={[styles.container, style]}>
    <Map
      style={styles.map}
      mapStyle={mapStyle}
      logo={false}
      attribution={true}
      onDidFinishLoadingMap={handleMapLoaded}
      onPress={
        onPress
          ? (event) => {
              const { lngLat } = event.nativeEvent;
              onPress({ lat: lngLat[1], lng: lngLat[0] });
            }
          : undefined
      }
    >
      {followUser ? (
        // Tracking owns the camera: a controlled center would fight every
        // native re-center, so the requested view is only the starting point.
        // Tracking is dropped when the user asks to see the whole route, and
        // restored when they ask for their location again.
        <Camera
          ref={cameraRef}
          initialViewState={{ center: centerCoord, zoom: mapZoom }}
          trackUserLocation={isTracking ? 'default' : undefined}
        />
      ) : (
        // `centerCoord` is memoised so this stays a stable prop. Rebuilding the
        // array each render re-applies the camera on every re-render, which
        // would undo an imperative fitBounds/flyTo moments after it ran.
        <Camera ref={cameraRef} center={centerCoord} zoom={mapZoom} />
      )}

      {routeSegmentsGeoJSON && (
        <GeoJSONSource id="route" data={routeSegmentsGeoJSON}>
          {/* Two unfiltered layers whose PAINT varies per feature, rather than
              one layer per segment.
              maplibre-react-native 11.0.0-alpha.47 silently drops both extra
              GeoJSON line sources and any layer carrying a `filter` — in both
              cases the layer is created but never painted and nothing is
              logged. Data-driven paint expressions do work (the stop markers
              below rely on them), so the segment weighting is expressed there.
              Casing width collapses to 0 for the segments that should not have
              one, which is how a single layer serves all of them. */}
          <Layer
            id="route-casing"
            source="route"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': colorScheme === 'dark' ? '#0B1220' : '#FFFFFF', // map style
              'line-width': [
                'match',
                ['get', 'segment'],
                'active', 11,
                'full', 7,
                0,
              ],
              'line-opacity': [
                'match',
                ['get', 'segment'],
                'active', 0.95,
                'full', 0.9,
                0,
              ],
            }}
          />
          <Layer
            id="route-line"
            source="route"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': [
                'match',
                ['get', 'segment'],
                'walked', WALKED_LINE[colorScheme],
                'upcoming', UPCOMING_LINE[colorScheme],
                colors.primary,
              ],
              'line-width': [
                'match',
                ['get', 'segment'],
                'active', 6,
                'walked', 4,
                'upcoming', 4,
                4,
              ],
              'line-opacity': [
                'match',
                ['get', 'segment'],
                'walked', 0.8,
                'upcoming', 0.85,
                1,
              ],
            }}
          />
        </GeoJSONSource>
      )}

      {poiGeoJSON && (
        <GeoJSONSource id="route-pois" data={poiGeoJSON}>
          <Layer
            id="route-poi-circles"
            source="route-pois"
            type="circle"
            paint={{
              'circle-radius': [
                'match', ['get', 'state'],
                'next', PIN_SIZE.next / 2,
                'visited', PIN_SIZE.visited / 2,
                PIN_SIZE.upcoming / 2,
              ],
              'circle-color': [
                'match', ['get', 'state'],
                'next', colors.primary,
                'visited', WALKED_LINE[colorScheme],
                UPCOMING_LINE[colorScheme],
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF', // map style
            }}
          />
        </GeoJSONSource>
      )}

      {/* The order number is a real RN view rather than a symbol layer's
          `text-field`, which never paints on this wrapper version even with
          the glyph server responding. The circle beneath comes from the layer
          above, so the number only has to sit on top of it. Routes have a
          handful of stops, so real views cost nothing here. */}
      {mapReady &&
        pois?.map((poi, index) => {
          const isNext = (poi.state ?? 'upcoming') === 'next';
          return (
            <Marker
              key={`stop-${index}`}
              id={`stop-${index}`}
              lngLat={[poi.lng, poi.lat]}
              // "center" is the natural choice and the default, but the Android
              // manager positions a marker as `screenPos - viewSize * anchor`,
              // and the view still measures 0 when the marker is first placed.
              // A centred marker therefore lands half a box down-and-right and
              // only snaps into place if the camera later moves. "top-left"
              // makes that term zero whether or not the view has measured; the
              // transform on the box does the centring in JS instead, where it
              // cannot depend on native layout timing.
              anchor="top-left"
            >
              <View style={styles.stopNumberBox}>
                <Text
                  style={[
                    styles.stopNumber,
                    isNext ? styles.stopNumberNext : null,
                    { color: isNext ? colors.onPrimary : PIN_LABEL[colorScheme] },
                  ]}
                  allowFontScaling={false}
                  accessibilityLabel={String(index + 1)}
                >
                  {index + 1}
                </Text>
              </View>
            </Marker>
          );
        })}

      {/* A one-shot position, drawn by us rather than by <UserLocation>.
          UserLocation only paints when it is mounted before the map finishes
          loading — the same late-mount failure as the stop numbers — and on a
          preview screen the position arrives long after that, when the user
          asks for it. Screens that track continuously mount the native puck
          from the start and keep it; this is only for the ones that do not. */}
      {mapReady && !showUserLocation && userPosition && (
        <Marker id="user-position" lngLat={[userPosition.lng, userPosition.lat]} anchor="top-left">
          <View
            style={[
              styles.userDot,
              { backgroundColor: colors.primary, borderColor: colors.onPrimary },
            ]}
          />
        </Marker>
      )}

      {showUserLocation && (
        // animated must stay false: the v11 alpha's AnimatedPoint subclasses
        // RN's private Animated internals, which changed in RN 0.84 — the
        // first animated update crashes with "undefined is not a function".
        <UserLocation animated={false}>
          {/* Custom puck: bigger than the library default and brand-colored
              so it reads against both tile themes. Child layers inherit the
              annotation's point source. */}
          <Layer
            id="user-location-halo"
            type="circle"
            paint={{
              'circle-radius': 16,
              'circle-color': colors.primary,
              'circle-opacity': 0.2,
              'circle-pitch-alignment': 'map',
            }}
          />
          <Layer
            id="user-location-ring"
            type="circle"
            paint={{
              'circle-radius': 10,
              'circle-color': '#FFFFFF', // map style
              'circle-pitch-alignment': 'map',
            }}
          />
          <Layer
            id="user-location-dot"
            type="circle"
            paint={{
              'circle-radius': 7,
              'circle-color': colors.primary,
              'circle-pitch-alignment': 'map',
            }}
          />
        </UserLocation>
      )}
    </Map>

      {(canFitRoute || canLocate) && (
        <View style={styles.controls} pointerEvents="box-none">
          {canFitRoute && (
            <Pressable
              style={[
                styles.controlButton,
                getShadows(colorScheme).card,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border },
              ]}
              onPress={handleFitRoute}
              accessibilityRole="button"
              accessibilityLabel={t('map.fitRouteA11y')}
            >
              <MaterialIcon name="arrow-expand-all" size={22} color={colors.onSurface} />
            </Pressable>
          )}
          {canLocate && (
            <Pressable
              style={[
                styles.controlButton,
                getShadows(colorScheme).card,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border },
              ]}
              onPress={handleLocate}
              accessibilityRole="button"
              accessibilityLabel={t('map.locateMeA11y')}
            >
              <MaterialIcon
                name="crosshairs-gps"
                size={22}
                color={isTracking ? colors.primary : colors.onSurface}
              />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sized so the Marker anchors on the circle's centre. allowFontScaling is off
  // deliberately: this label sits inside a fixed-diameter dot on the map, and
  // scaling it would push the digit outside the dot.
  stopNumberBox: {
    width: PIN_SIZE.next,
    height: PIN_SIZE.next,
    alignItems: 'center',
    justifyContent: 'center',
    // Centres the box on its coordinate — see the anchor note on <Marker>. Done
    // as a transform rather than negative margins so it never feeds back into
    // the layout the native side measures.
    transform: [
      { translateX: -PIN_SIZE.next / 2 },
      { translateY: -PIN_SIZE.next / 2 },
    ],
  },
  stopNumber: {
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  stopNumberNext: {
    fontSize: 16,
  },
  userDot: {
    width: USER_DOT_SIZE,
    height: USER_DOT_SIZE,
    borderRadius: RADIUS.full,
    borderWidth: 3,
    // Centred on its coordinate — see the anchor note on the stop markers.
    transform: [
      { translateX: -USER_DOT_SIZE / 2 },
      { translateY: -USER_DOT_SIZE / 2 },
    ],
  },
  container: {
    minHeight: 200,
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.xl,
    gap: SPACING.sm,
  },
  controlButton: {
    // 44pt minimum touch target.
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MapView;
