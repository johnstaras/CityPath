import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Text from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import RouteCard from '../../components/RouteCard';
import FilterBar from '../../components/FilterBar';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import AiRoutesSection from '../../components/AiRoutesSection';
import { useRoutesViewModel } from '../../viewmodels/useRoutesViewModel';
import { useAiRoutesViewModel } from '../../viewmodels/useAiRoutesViewModel';
import { useHomeFavoritesViewModel } from '../../viewmodels/useHomeFavoritesViewModel';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../../utils/constants';
import { useReducedMotion } from '../../utils/motion';
import { toUpperCaseLabel } from '../../utils/localization';
import { Route } from '../../models';
import { HomeStackParamList } from '../../navigation/HomeStack';

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

interface AnimatedRouteCardProps {
  item: Route;
  index: number;
  shouldAnimate: boolean;
  onPress: () => void;
  isFavorite: boolean;
  isFavoritePending: boolean;
  onToggleFavorite: () => void;
}

// First-load list stagger: fades each card in with a small per-index delay.
// `shouldAnimate` is only ever true for the first render pass where real
// route data is present (see `staggerPlayedRef`/`shouldStagger` in
// HomeScreen) and is forced false when the user has reduced motion enabled,
// so this becomes an inert wrapper in that case.
function AnimatedRouteCard({
  item,
  index,
  shouldAnimate,
  onPress,
  isFavorite,
  isFavoritePending,
  onToggleFavorite,
}: AnimatedRouteCardProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;

  useEffect(() => {
    // `shouldAnimate` is read once at mount (this effect intentionally has no
    // deps). The theoretical race where `useReducedMotion()` is still
    // resolving when a card mounts is not reachable in practice here: cards
    // only mount once route data has arrived (data-arrival gating in
    // HomeScreen), which is well after the a11y check has resolved on cold
    // load, and on warm re-renders `shouldAnimate` is already false.
    if (!shouldAnimate) {
      return undefined;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      delay: Math.min(index, 5) * 60,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // Intentionally run once per card instance — this is a mount-time entrance effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{ opacity }}>
      <RouteCard
        route={item}
        onPress={onPress}
        isFavorite={isFavorite}
        isFavoritePending={isFavoritePending}
        onToggleFavorite={onToggleFavorite}
      />
    </Animated.View>
  );
}

function HomeScreen(): React.JSX.Element {
  const {
    routes,
    isLoading,
    isRefreshing,
    error,
    timeFilter,
    setTimeFilter,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    userLocation,
    refetch,
    refresh,
  } = useRoutesViewModel();

  const navigation = useNavigation<HomeNavProp>();
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // Stagger should play exactly once: on the first render pass where real
  // route data is present. On cold load that is well after screen mount
  // (skeleton shows while location+fetch resolve), so flip the ref only
  // after the first non-empty list has rendered.
  const staggerPlayedRef = useRef(false);
  const shouldStagger = !staggerPlayedRef.current && !reducedMotion;
  useEffect(() => {
    if (routes.length > 0) {
      staggerPlayedRef.current = true;
    }
  }, [routes.length]);

  const {
    favoriteIds,
    pendingIds: pendingFavoriteIds,
    toggleFavorite: handleToggleFavorite,
  } = useHomeFavoritesViewModel();

  const handleRoutePress = useCallback(
    (routeId: number) => {
      navigation.navigate('RouteDetails', { routeId });
    },
    [navigation],
  );

  const {
    routes: aiRoutes,
    isLoading: aiLoading,
    isGenerationEnabled,
    generate,
    isGenerating,
    refetch: refetchAiRoutes,
  } = useAiRoutesViewModel(userLocation);

  // Pull-to-refresh reloads both lists; each is its own query and retries
  // independently of the other.
  const handleRefresh = useCallback(() => {
    refresh();
    refetchAiRoutes();
  }, [refresh, refetchAiRoutes]);

  // The main list failing must not take the curated strip with it (UC-04):
  // the strip has its own query, so it stays in the list header and only the
  // list body is replaced by the error state.
  const showListError = error != null && !isLoading;

  // A generated route is a real row, so the natural thing to do on success is
  // open it like any other. Failures are surfaced rather than swallowed: the
  // request can legitimately come back with nothing (no accessible path near
  // this position for this profile), and silently doing nothing would read as
  // a broken button.
  const handleGenerate = useCallback(async () => {
    try {
      const route = await generate();
      navigation.navigate('RouteDetails', { routeId: route.id });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      Alert.alert(
        t('home.aiRoutes.errorTitle'),
        status === 404
          ? t('home.aiRoutes.errorNoPlaces')
          : status === 422
            ? t('home.aiRoutes.errorNoSuitable')
            : t('home.aiRoutes.errorGeneric'),
      );
    }
  }, [generate, navigation, t]);

  const renderRouteCard = useCallback(
    ({ item, index }: { item: Route; index: number }) => (
      <AnimatedRouteCard
        item={item}
        index={index}
        shouldAnimate={shouldStagger}
        onPress={() => handleRoutePress(item.id)}
        isFavorite={favoriteIds.has(item.id)}
        isFavoritePending={pendingFavoriteIds.has(item.id)}
        onToggleFavorite={() => handleToggleFavorite(item.id)}
      />
    ),
    [handleRoutePress, favoriteIds, pendingFavoriteIds, handleToggleFavorite, shouldStagger],
  );

  const keyExtractor = useCallback((item: Route) => String(item.id), []);

  // getItemLayout was removed when the curated-routes section became the
  // list header: it computed offsets as `(220 + gap) * index`, which assumes
  // the first card starts at y=0. A header of its own (variable) height makes
  // every one of those offsets wrong, which shows up as misplaced scrolling.
  // FlatList measures instead; the windowing props below still cap the work.

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      {/* Editorial header: overline + headline */}
      <View style={styles.headerSection}>
        <Text style={[TYPOGRAPHY.overline, styles.overline, { color: colors.onSurfaceVariant }]}>
          {toUpperCaseLabel(t('home.overline'))}
        </Text>
        <Text
          style={[TYPOGRAPHY.heading1, { color: colors.secondary }]}
          accessibilityRole="header"
        >
          {t('home.title')}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            getShadows(colorScheme).card,
            { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
          ]}
        >
          <MaterialIcon name="magnify" size={20} color={colors.outline} />
          <TextInput
            style={[styles.searchInput, TYPOGRAPHY.bodyMedium, { color: colors.onSurface }]}
            placeholder={t('home.search')}
            placeholderTextColor={colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel={t('home.search')}
          />
        </View>
      </View>

      {/* Filter Chips */}
      <FilterBar
        timeFilter={timeFilter}
        onTimeChange={setTimeFilter}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
      />

      {/* Route Cards */}
      <FlatList
        data={showListError ? [] : routes}
        renderItem={renderRouteCard}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={4}
        removeClippedSubviews
        ListHeaderComponent={
          <AiRoutesSection
            routes={aiRoutes}
            isLoading={aiLoading}
            onSelectRoute={handleRoutePress}
            isGenerationEnabled={isGenerationEnabled}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            canGenerate={userLocation != null}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          showListError ? (
            <View style={styles.centerContent} accessibilityRole="alert">
              <EmptyState
                icon="cloud-off-outline"
                title={t('home.errorTitle')}
                subtitle={t('home.errorSubtitle')}
                ctaLabel={t('common.retry')}
                onCta={refetch}
              />
            </View>
          ) : isLoading ? (
            <View style={styles.skeletonWrapper}>
              <Skeleton.RouteCard />
            </View>
          ) : (
            <View style={styles.centerContent}>
              <EmptyState icon="map-search-outline" title={t('home.noRoutes')} />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginLeft: SPACING.sm,
  },
  overline: {
    marginBottom: SPACING.xs,
  },
  searchSection: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.input,
    paddingHorizontal: SPACING.md,
    minHeight: 56,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    marginLeft: SPACING.sm + 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SPACING.xl,
    gap: SPACING.xl,
    flexGrow: 1,
  },
  centerContent: {
    flex: 1,
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonWrapper: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
});

export default HomeScreen;
