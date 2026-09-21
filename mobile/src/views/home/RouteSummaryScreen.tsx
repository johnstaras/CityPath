import React, { useCallback } from 'react';
import {
  View,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Text from '../../components/AppText';
import { remoteImageSource } from '../../utils/remoteImage';
import { useRoute, useNavigation, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { HomeStackParamList } from '../../navigation/HomeStack';
import { planBackToStackRoot } from '../../navigation/stackRoot';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { RADIUS, SPACING, TYPOGRAPHY, getGradients, getShadows } from '../../utils/constants';
import AppButton from '../../components/AppButton';
import { useRouteSummaryViewModel } from '../../viewmodels/useRouteSummaryViewModel';
import { POI } from '../../models';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { toUpperCaseLabel } from '../../utils/localization';

type RouteSummaryRouteProp = RouteProp<HomeStackParamList, 'RouteSummary'>;
type RouteSummaryNavProp = NativeStackNavigationProp<HomeStackParamList, 'RouteSummary'>;

interface StarRatingProps {
  rating: number;
  onRate: (value: number) => void;
  poiName: string;
}

function StarRating({ rating, onRate, poiName }: StarRatingProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={styles.starsRow}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel={t('summary.currentRating', { value: rating, poi: poiName })}
      accessibilityValue={{ min: 0, max: 5, now: rating }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'increment' && rating < 5) {
          onRate(rating + 1);
        } else if (event.nativeEvent.actionName === 'decrement' && rating > 1) {
          onRate(rating - 1);
        }
      }}
      importantForAccessibility="yes"
    >
      <View style={styles.starsRowInner} importantForAccessibility="no-hide-descendants">
        {[1, 2, 3, 4, 5].map(star => (
          <Pressable
            key={star}
            onPress={() => onRate(star)}
            accessibilityRole="button"
            accessibilityLabel={t('routeSummary.rateStarA11y', { count: star })}
            accessibilityState={{ selected: star <= rating }}
            style={styles.starButton}
          >
            <MaterialIcon
              name="star"
              size={20}
              color={star <= rating ? colors.tertiary : colors.outlineVariant}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface PoiRatingCardProps {
  poi: POI;
  rating: number;
  onRate: (value: number) => void;
  onDetails: () => void;
  detailsLabel: string;
}

function PoiRatingCard({ poi, rating, onRate, onDetails, detailsLabel }: PoiRatingCardProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.poiCard, { backgroundColor: colors.surfaceContainerLow }]}>
      <View style={styles.poiCardHeader}>
        <View style={styles.poiCardLeft}>
          <View style={[styles.poiCardThumb, { backgroundColor: colors.surfaceContainer }]}>
            {poi.photoUrl ? (
              <Image
                source={remoteImageSource(poi.photoUrl)}
                style={styles.poiCardPhoto}
                resizeMode="cover"
                accessibilityLabel={t('common.photoOf', { name: poi.name })}
              />
            ) : (
              <MaterialIcon
                name="image-outline"
                size={20}
                color={colors.onSurfaceVariant}
                accessibilityLabel={t('poi.noPhoto')}
              />
            )}
          </View>
          <Text style={[styles.poiName, { color: colors.onSurface }]} numberOfLines={2}>
            {poi.name}
          </Text>
        </View>
        <Pressable
          onPress={onDetails}
          accessibilityRole="link"
          accessibilityLabel={`${detailsLabel} ${poi.name}`}
          hitSlop={8}
          style={styles.detailsButton}
        >
          <Text style={[styles.detailsLink, { color: colors.primary }]}>{detailsLabel}</Text>
        </Pressable>
      </View>
      {/* Stars get their own row. Sharing the header row with the thumbnail and
          the Details link left them ~30 dp short on a phone-width screen, so the
          link was drawn over stars 4-5 and a tap there opened the place instead
          of rating it. */}
      <View style={styles.poiCardStars}>
        <StarRating rating={rating} onRate={onRate} poiName={poi.name} />
      </View>
    </View>
  );
}

function RouteSummaryScreen(): React.JSX.Element {
  const { params } = useRoute<RouteSummaryRouteProp>();
  const navigation = useNavigation<RouteSummaryNavProp>();
  const { completionData } = params;
  const { durationMinutes, distanceMeters, visitedPois, totalPois, route } = completionData;
  const { colors, colorScheme } = useTheme();
  const shadows = getShadows(colorScheme);
  const { t } = useTranslation();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();

  const { ratings, rate, isFavorite, isFavoriteLoading, isSavingFavorite, saveFavorite } =
    useRouteSummaryViewModel(route);

  const handleRate = useCallback(
    async (poiId: number, value: number) => {
      const ok = await rate(poiId, value);
      if (!ok) {
        dialog.alert(t('common.error'), t('summary.ratingFailed'));
      }
    },
    [rate, dialog, t],
  );

  const handleSaveFavorite = useCallback(async () => {
    const ok = await saveFavorite();
    if (!ok) {
      dialog.alert(t('common.error'), t('routeSummary.saveError'));
    }
  }, [saveFavorite, dialog, t]);

  const handleBackToHome = useCallback(() => {
    // This screen lives in BOTH the Home and Favorites stacks (a route can be
    // started from either tab), so "home" is the first screen of THIS stack
    // (HomeMain or FavoritesList), per UC-11 step 5 — see planBackToStackRoot.
    const plan = planBackToStackRoot(navigation.getState());
    if (plan.type === 'popToTop') {
      navigation.popToTop();
    } else {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: plan.rootName as keyof HomeStackParamList }] }),
      );
    }
  }, [navigation]);

  const handlePoiDetails = useCallback(
    (poiId: number) => {
      navigation.navigate('POIDetail', { poiId });
    },
    [navigation],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + SPACING.lg }]}
      >
        {/* Success Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={getGradients(colorScheme).primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.checkCircle, shadows.elevated]}
          >
            <MaterialIcon name="check-bold" size={32} color={colors.onPrimary} />
          </LinearGradient>
          <Text
            style={[TYPOGRAPHY.heading1, styles.title, { color: colors.onBackground }]}
            accessibilityRole="header"
          >
            {t('routeSummary.completed')}
          </Text>
          <Text style={[TYPOGRAPHY.bodyMedium, { color: colors.onSurfaceVariant }]}>
            {t('summary.subtitle')}
          </Text>
        </View>

        {/* Stats: one row of three. Two rows (duration full width, then
            distance + stops) pushed the rating section below the fold. */}
        <View style={styles.statsRow}>
          {[
            { icon: 'timer-outline', label: t('routeSummary.duration'), a11y: t('routeSummary.duration'), value: formatDuration(durationMinutes) },
            { icon: 'map-marker', label: t('routeSummary.distance'), a11y: t('routeSummary.distance'), value: formatDistance(distanceMeters) },
            // A third of the row is too narrow for "Σημεία που επισκέφτηκες":
            // it broke mid-word over three lines. Screen readers get the full label.
            { icon: 'map-marker-check', label: t('routeSummary.poisVisitedShort'), a11y: t('routeSummary.poisVisited'), value: `${visitedPois.length}/${totalPois}` },
          ].map(stat => (
            <View
              key={stat.icon}
              style={[styles.statCard, shadows.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border }]}
              accessible={true}
              accessibilityLabel={`${stat.a11y}: ${stat.value}`}
            >
              <MaterialIcon name={stat.icon} size={20} color={colors.primary} />
              <Text style={[TYPOGRAPHY.overline, styles.statLabel, { color: colors.onSurfaceVariant }]}>
                {toUpperCaseLabel(stat.label)}
              </Text>
              {/* Allowed to wrap («1 ώ 23 λεπτά» in a third of the row) —
                  never shrunk to fit: adjustsFontSizeToFit is avoided app-wide
                  (Android line breaking, see AppText). The label above grows,
                  so the values stay bottom-aligned across the three cards. */}
              <Text style={[TYPOGRAPHY.heading3, { color: colors.primary }]}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>

        {/* POI Ratings */}
        {visitedPois.length > 0 && (
          <View style={styles.ratingSection}>
            <Text style={[styles.ratingHeader, { color: colors.onSurface }]}>
              {t('routeSummary.rateVisited')}
            </Text>
            <View style={styles.poiList}>
              {visitedPois.map(poi => (
                <PoiRatingCard
                  key={poi.id}
                  poi={poi}
                  rating={ratings[poi.id] ?? 0}
                  onRate={value => handleRate(poi.id, value)}
                  onDetails={() => handlePoiDetails(poi.id)}
                  detailsLabel={t('common.details')}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions. In the layout flow below the ScrollView, not overlaid
          on it: as an absolute overlay it covered the "rate the places you
          visited" section, which then sat entirely below the fold. */}
      <View
        style={[
          styles.bottomBar,
          shadows.bottomBar,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, SPACING.lg),
          },
        ]}
      >
        <AppButton
          label={isFavorite ? t('routeSummary.saved') : t('routeSummary.saveFavorite')}
          onPress={handleSaveFavorite}
          variant="secondary"
          icon={isFavorite ? 'heart' : 'heart-outline'}
          disabled={isFavorite || isFavoriteLoading}
          loading={isSavingFavorite}
        />

        <AppButton
          label={t('routeSummary.backHome')}
          onPress={handleBackToHome}
          variant="primary"
          icon="home-outline"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  // Grows so the values line up at the bottom even if a label wraps
  // (e.g. at large system font sizes).
  statLabel: {
    flexGrow: 1,
  },
  ratingSection: {
    marginBottom: 48,
  },
  ratingHeader: {
    ...TYPOGRAPHY.heading3,
    marginBottom: SPACING.lg,
    marginLeft: SPACING.xs,
  },
  poiList: {
    gap: SPACING.lg,
  },
  poiCard: {
    borderRadius: RADIUS.card,
    padding: SPACING.md,
  },
  poiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  poiCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  poiCardThumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.input,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  poiCardPhoto: {
    width: '100%',
    height: '100%',
  },
  poiName: {
    ...TYPOGRAPHY.bodyBold,
    flex: 1,
  },
  // Aligned under the name: thumbnail width + the row gap.
  poiCardStars: {
    marginLeft: 48 + SPACING.md,
    marginTop: SPACING.xs,
  },
  starsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  starsRowInner: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  starButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  detailsLink: {
    ...TYPOGRAPHY.smallBold,
  },
  bottomBar: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    gap: SPACING.sm + SPACING.xs,
  },
});

export default RouteSummaryScreen;
