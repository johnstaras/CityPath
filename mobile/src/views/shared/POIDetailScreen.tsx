import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import Text from '../../components/AppText';
import { remoteImageSource } from '../../utils/remoteImage';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePOIViewModel } from '../../viewmodels/usePOIViewModel';
import { useTheme } from '../../context/ThemeContext';
import { POIRating } from '../../models';
import { HomeStackParamList } from '../../navigation/HomeStack';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import {
  ON_SCRIM_WHITE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  getGradients,
  getShadows,
} from '../../utils/constants';
import { formatDecimal, formatReviewDate } from '../../utils/formatters';
import { getPoiCategoryIcon } from '../../utils/poiCategoryIcon';

type POIDetailRouteProp = RouteProp<HomeStackParamList, 'POIDetail'>;
type POIDetailNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'POIDetail'>;

// Hex alpha appended to the theme's 6-digit surface colour (~90% opaque).
const STATUS_BAR_SCRIM_ALPHA = 'E6';

function POIDetailScreen(): React.JSX.Element {
  const { params } = useRoute<POIDetailRouteProp>();
  const navigation = useNavigation<POIDetailNavigationProp>();
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const { poi, isLoading, error, rating, reviews } = usePOIViewModel(params.poiId);

  const renderStars = useCallback((ratingValue: number, size: number = 24): React.JSX.Element => {
    const stars: React.JSX.Element[] = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <MaterialIcon
          key={i}
          name="star"
          size={size}
          color={i <= Math.round(ratingValue) ? colors.tertiary : colors.outlineVariant}
        />,
      );
    }
    return (
      <View style={styles.starsRow} importantForAccessibility="no-hide-descendants">
        {stars}
      </View>
    );
  }, [colors]);

  const renderReviewItem = useCallback(({ review }: { review: POIRating }): React.JSX.Element => {
    const dateStr = formatReviewDate(review.createdAt);

    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.surfaceContainerLow }]}>
        <View style={styles.reviewHeader}>
          <View>
            <Text style={[TYPOGRAPHY.bodyBold, { color: colors.onSurface }]}>{review.user.name}</Text>
            <View style={styles.reviewStarsRow} importantForAccessibility="no-hide-descendants">
              {[1, 2, 3, 4, 5].map(i => (
                <MaterialIcon key={i} name="star" size={14} color={i <= Math.round(review.rating) ? colors.tertiary : colors.outlineVariant} />
              ))}
            </View>
          </View>
          <Text style={[TYPOGRAPHY.tabLabel, { color: colors.onSurfaceVariant }]}>{dateStr}</Text>
        </View>
        {review.comment ? (
          <Text style={[TYPOGRAPHY.caption, { color: colors.onSurfaceVariant }]}>{review.comment}</Text>
        ) : null}
      </View>
    );
    // formatReviewDate reads the UI language when called; no `t` needed here.
  }, [colors]);

  const handleRate = useCallback(() => {
    if (poi) {
      navigation.navigate('RatePOI', { poiId: poi.id, poiName: poi.name });
    }
  }, [poi, navigation]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Skeleton width="100%" height={220} radius={0} />
        <View style={styles.loadingContent}>
          <Skeleton width="60%" height={28} style={styles.loadingBlock} />
          <Skeleton width="100%" height={80} style={styles.loadingBlock} />
          <Skeleton width="40%" height={20} style={styles.loadingBlock} />
          <Skeleton width="100%" height={100} radius={RADIUS.card} style={styles.loadingBlock} />
        </View>
      </View>
    );
  }

  if (error || !poi) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]} accessibilityRole="alert">
        <EmptyState
          icon="alert-circle-outline"
          title={t('poi.notFound')}
          ctaLabel={t('poi.goBack')}
          onCta={handleGoBack}
        />
      </View>
    );
  }

  const showAccessibilitySection = poi.hasRamp || poi.hasTactilePaving;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Hero Photo */}
      <View style={[styles.heroSection, { backgroundColor: colors.surfaceContainerHigh }]}>
        {poi.photoUrl ? (
          <Image
            source={remoteImageSource(poi.photoUrl)}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t('common.photoOf', { name: poi.name })}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}
            accessible
            accessibilityLabel={t('poi.noPhoto')}
          >
            <MaterialIcon name={getPoiCategoryIcon(poi.category)} size={48} color={colors.onSurfaceVariant} />
          </View>
        )}
        <LinearGradient
          colors={getGradients(colorScheme).scrim}
          style={styles.heroScrim}
          pointerEvents="none"
        />
        {/* Edge-to-edge (targetSdk 36): without this the status bar icons sat
            straight on the photo. Same scrim as RouteDetailsScreen. */}
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[styles.statusBarScrim, { height: insets.top, backgroundColor: colors.surface + STATUS_BAR_SCRIM_ALPHA }]}
        />
        <ScreenHeader floating onBack={handleGoBack} />
        <View style={styles.heroContent}>
          <Text style={[TYPOGRAPHY.heading2, styles.heroTitle]} accessibilityRole="header" numberOfLines={2}>
            {poi.name}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        {poi.description ? (
          <View style={styles.descriptionSection}>
            <Text style={[TYPOGRAPHY.body, { color: colors.onSurfaceVariant }]}>{poi.description}</Text>
          </View>
        ) : null}

        {/* Accessibility Section — only when there is something to show */}
        {showAccessibilitySection && (
          <View style={styles.section}>
            <Text style={[TYPOGRAPHY.heading4, styles.sectionTitle, { color: colors.onSurface }]} accessibilityRole="header">
              {t('poi.accessibility')}
            </Text>
            <View style={styles.accessPills}>
              {poi.hasRamp && (
                <View style={[styles.accessPill, { backgroundColor: `${colors.accessibleGreen}1A`, borderColor: `${colors.accessibleGreen}26` }]}>
                  <MaterialIcon name="check-circle" size={16} color={colors.accessibleGreen} importantForAccessibility="no-hide-descendants" />
                  <Text style={[TYPOGRAPHY.small, { color: colors.accessibleGreen }]}>
                    {t('accessibility.ramps')}
                  </Text>
                </View>
              )}
              {poi.hasTactilePaving && (
                <View style={[styles.accessPill, { backgroundColor: `${colors.accessibleGreen}1A`, borderColor: `${colors.accessibleGreen}26` }]}>
                  <MaterialIcon name="check-circle" size={16} color={colors.accessibleGreen} importantForAccessibility="no-hide-descendants" />
                  <Text style={[TYPOGRAPHY.small, { color: colors.accessibleGreen }]}>
                    {t('accessibility.tactile')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={[TYPOGRAPHY.heading4, styles.sectionTitle, { color: colors.onSurface }]} accessibilityRole="header">
            {t('poi.rating')}
          </Text>
          {rating ? (
            <View style={[styles.ratingCard, getShadows(colorScheme).card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border }]}>
              {renderStars(rating.average, 24)}
              <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                {t('poi.ratingSummary', { average: formatDecimal(rating.average, 1), count: rating.count })}
              </Text>
              <Text style={[TYPOGRAPHY.small, styles.accessibilityAverage, { color: colors.onSurfaceVariant }]}>
                {t('poi.accessibilityAverage', { average: formatDecimal(rating.averageAccessibility, 1) })}
              </Text>
            </View>
          ) : (
            <Text style={[TYPOGRAPHY.caption, { color: colors.onSurfaceVariant }]}>
              {t('poi.noRatings')}
            </Text>
          )}
        </View>

        {/* User Reviews */}
        <View style={styles.section}>
          <Text style={[TYPOGRAPHY.heading4, styles.sectionTitle, { color: colors.onSurface }]} accessibilityRole="header">
            {t('poi.recentReviews')}
          </Text>
          {reviews.length > 0 ? (
            <View style={styles.reviewsList}>
              {reviews.slice(0, 3).map((review) => (
                <React.Fragment key={review.id}>
                  {renderReviewItem({ review })}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <EmptyState icon="comment-outline" title={t('poi.noReviews')} />
          )}
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={[styles.bottomBar, getShadows(colorScheme).bottomBar, { backgroundColor: colors.surfaceContainerLowest, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACING.xl) }]}>
        <AppButton
          label={t('poi.rate')}
          onPress={handleRate}
          variant="primary"
          icon="star"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBarScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  loadingContent: {
    padding: SPACING.lg,
  },
  loadingBlock: {
    marginBottom: SPACING.md,
  },
  heroSection: {
    width: '100%',
    height: 220,
    overflow: 'hidden',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  heroContent: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: SPACING.lg,
  },
  heroTitle: {
    color: ON_SCRIM_WHITE,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.lg,
  },
  descriptionSection: {
    paddingHorizontal: SPACING.lg,
  },
  section: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    marginBottom: SPACING.md,
  },
  accessPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm + 4,
  },
  accessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    minHeight: 44,
    borderWidth: 1,
  },
  ratingCard: {
    borderRadius: RADIUS.card,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  accessibilityAverage: {
    marginTop: SPACING.xs,
  },
  starsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  reviewsList: {
    gap: SPACING.lg,
  },
  reviewCard: {
    borderRadius: RADIUS.card,
    padding: SPACING.md + 4,
    gap: SPACING.sm + 4,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: SPACING.xs,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
  },
});

export default POIDetailScreen;
