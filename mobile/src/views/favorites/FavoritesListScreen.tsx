import React, { useCallback, useState } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import Text from '../../components/AppText';
import { remoteImageSource } from '../../utils/remoteImage';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ON_SCRIM_GLASS,
  ON_SCRIM_WHITE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  getGradients,
  getShadows,
} from '../../utils/constants';
import { useFavoritesViewModel } from '../../viewmodels/useFavoritesViewModel';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { Route } from '../../models';
import { FavoritesStackParamList } from '../../navigation/FavoritesStack';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { toUpperCaseLabel } from '../../utils/localization';
import { getAccessibilityBadge, getRouteBadgeText } from '../../utils/accessibility';
import AppButton from '../../components/AppButton';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

type FavoritesNavProp = NavigationProp<FavoritesStackParamList, 'FavoritesList'>;

function FavoritesListScreen(): React.JSX.Element {
  const navigation = useNavigation<FavoritesNavProp>();
  const { favorites, isLoading, isRefreshing, error, removeFavorite, refetch, refresh } =
    useFavoritesViewModel();
  // Photos that failed to load fall back to the map icon, as on the Home cards.
  const [failedImageIds, setFailedImageIds] = useState<ReadonlySet<number>>(() => new Set());
  const handleImageError = useCallback((routeId: number) => {
    setFailedImageIds(prev => new Set(prev).add(routeId));
  }, []);
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();

  const handleRoutePress = useCallback(
    (route: Route) => {
      navigation.navigate('RouteDetails', { routeId: route.id });
    },
    [navigation],
  );

  const handleRemove = useCallback(
    (route: Route) => {
      dialog.confirm({
        title: t('favorites.removeTitle'),
        message: t('favorites.removeMessage', { title: route.title }),
        confirmLabel: t('favorites.remove'),
        destructive: true,
        onConfirm: () => removeFavorite(route.id),
      });
    },
    [dialog, removeFavorite, t],
  );

  const handleExplore = useCallback(() => {
    // Jump to the Home tab — goBack() is a no-op on a tab root.
    (navigation as unknown as NavigationProp<{ Home: undefined }>).navigate('Home');
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: Route }) => {
      const badge = getAccessibilityBadge(item.accessibilityScore, colors);
      // Same "label · 67%" text as the Home and details badges.
      const { label: badgeLabel, a11yLabel: badgeA11yLabel } = getRouteBadgeText(
        badge,
        item.accessibilityScore,
        t,
      );
      const isLiveAi = item.isLiveAi === true;
      return (
        <Pressable
          style={[styles.card, getShadows(colorScheme).card, { backgroundColor: colors.surfaceContainerLowest }]}
          onPress={() => handleRoutePress(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${formatDuration(item.estimatedDurationMinutes)}, ${formatDistance(item.distanceMeters)}, ${badgeA11yLabel}${isLiveAi ? `, ${t('home.aiRoutes.badgeA11y')}` : ''}`}
        >
          {/* Place photo (falls back to a map icon if missing/unavailable) */}
          {item.imageUrl && !failedImageIds.has(item.id) ? (
            <Image
              source={remoteImageSource(item.imageUrl)}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              fadeDuration={0}
              accessibilityLabel={t('common.photoOf', { name: item.title })}
              onError={() => handleImageError(item.id)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
              <MaterialIcon name="map-outline" size={48} color={colors.onSurfaceVariant} />
            </View>
          )}

          <LinearGradient
            colors={getGradients(colorScheme).scrim}
            style={styles.scrim}
            pointerEvents="none"
          />

          {/* Accessibility badge, top-left */}
          <View style={[styles.badge, { backgroundColor: badge.onPhotoBgColor, borderColor: badge.color }]}>
            <MaterialIcon name={badge.icon} size={16} color={badge.color} />
            <Text style={[styles.badgeText, { color: badge.color }]} numberOfLines={1}>
              {toUpperCaseLabel(badgeLabel)}
            </Text>
          </View>

          {/* Remove-from-favorites, top-right glass circle */}
          <View style={styles.heartCircle}>
            <Pressable
              style={styles.heartPressable}
              onPress={() => handleRemove(item)}
              accessibilityRole="button"
              accessibilityLabel={t('favorites.removeA11y', { title: item.title })}
              hitSlop={8}
            >
              <MaterialIcon name="heart" size={20} color={colors.error} />
            </Pressable>
          </View>

          {/* Title + meta chips, bottom over scrim */}
          <View style={styles.bottomContent}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <MaterialIcon name="clock-outline" size={14} color={ON_SCRIM_WHITE} />
                <Text style={styles.metaText}>{formatDuration(item.estimatedDurationMinutes)}</Text>
              </View>
              <View style={styles.metaChip}>
                <MaterialIcon name="map-marker-distance" size={14} color={ON_SCRIM_WHITE} />
                <Text style={styles.metaText}>{formatDistance(item.distanceMeters)}</Text>
              </View>
              {/* Provenance, keyed on isLiveAi exactly like RouteCard. */}
              {isLiveAi && (
                <View style={styles.metaChip}>
                  <MaterialIcon name="creation" size={14} color={ON_SCRIM_WHITE} />
                  <Text style={styles.metaText}>{t('home.aiRoutes.badge')}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [handleRoutePress, handleRemove, handleImageError, failedImageIds, colors, colorScheme, t],
  );

  const keyExtractor = useCallback((item: Route) => item.id.toString(), []);

  // Fixed-height cards (180) + list gap (SPACING.lg): precomputed layout
  // keeps tab switches and fast scrolls smooth.
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: 180,
      offset: (180 + SPACING.lg) * index,
      index,
    }),
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      {/* Editorial Header */}
      <View style={styles.headerSection}>
        <Text
          style={[TYPOGRAPHY.heading1, { color: colors.onBackground }]}
          accessibilityRole="header"
        >
          {t('favorites.title')}
        </Text>
        <Text style={[TYPOGRAPHY.body, styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>
          {t('favorites.subtitle')}
        </Text>
      </View>

      {error ? (
        <View style={styles.centerContent} accessibilityRole="alert">
          <EmptyState
            icon="alert-circle-outline"
            title={t('favorites.error')}
            ctaLabel={t('favorites.retry')}
            onCta={refetch}
          />
        </View>
      ) : isLoading && favorites.length === 0 ? (
        <View style={styles.skeletonWrapper}>
          <Skeleton.RouteCard />
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={
            favorites.length === 0 ? styles.emptyContainer : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={4}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <EmptyState
                icon="heart-outline"
                title={t('favorites.emptyTitle')}
                subtitle={t('favorites.emptySubtitle')}
                ctaLabel={t('favorites.exploreCta')}
                onCta={handleExplore}
              />
            </View>
          }
          ListFooterComponent={
            favorites.length > 0 ? (
              <View style={styles.footerSection}>
                <AppButton
                  label={t('favorites.exploreCta')}
                  onPress={handleExplore}
                  variant="secondary"
                  icon="compass-outline"
                />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    marginBottom: SPACING.xl + SPACING.sm,
  },
  headerSubtitle: {
    marginTop: SPACING.sm,
    maxWidth: 280,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  skeletonWrapper: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
    flexGrow: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    height: 180,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  badge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    maxWidth: '70%',
  },
  badgeText: {
    ...TYPOGRAPHY.overline,
  },
  heartCircle: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: ON_SCRIM_GLASS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartPressable: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContent: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.heading3,
    color: ON_SCRIM_WHITE,
    marginBottom: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: ON_SCRIM_GLASS,
  },
  metaText: {
    ...TYPOGRAPHY.small,
    color: ON_SCRIM_WHITE,
  },
  footerSection: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
});

export default FavoritesListScreen;
