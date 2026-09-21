import React, { useCallback } from 'react';
import {
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Text from './AppText';
import { useTranslation } from 'react-i18next';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Route } from '../models';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { formatDistance, formatDuration } from '../utils/formatters';
import { getAccessibilityBadge, getRouteBadgeText } from '../utils/accessibility';
import { toUpperCaseLabel } from '../utils/localization';
import Skeleton from './Skeleton';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../utils/constants';

const CARD_WIDTH = 240;
const DISABLED_OPACITY = 0.6;

interface AiRoutesSectionProps {
  routes: Route[];
  isLoading: boolean;
  onSelectRoute: (routeId: number) => void;
  /** Live generation switch. When false, the section is catalogue-only. */
  isGenerationEnabled: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
}

interface AiRouteCardProps {
  route: Route;
  onPress: () => void;
}

function AiRouteCard({ route, onPress }: AiRouteCardProps): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const badge = getAccessibilityBadge(route.accessibilityScore, colors);
  const isLiveAi = route.isLiveAi === true;

  const { label: badgeLabel, a11yLabel: badgeA11yLabel } = getRouteBadgeText(
    badge,
    route.accessibilityScore,
    t,
  );

  return (
    <Pressable
      style={[
        styles.card,
        getShadows(colorScheme).card,
        { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${route.title}, ${formatDuration(route.estimatedDurationMinutes)}, ${formatDistance(route.distanceMeters)}, ${badgeA11yLabel}${isLiveAi ? `, ${t('home.aiRoutes.badgeA11y')}` : ''}`}
    >
      <View style={styles.cardBadgeRow}>
        <View style={[styles.cardBadge, { backgroundColor: badge.onPhotoBgColor, borderColor: badge.color }]}>
          <MaterialIcon name={badge.icon} size={14} color={badge.color} />
          {/* Upper-cased through the Greek-aware helper, like the badge on
              RouteCard, so the two card styles on Home read the same. */}
          <Text style={[styles.cardBadgeText, { color: badge.color }]} numberOfLines={1}>
            {toUpperCaseLabel(badgeLabel)}
          </Text>
        </View>
        {/* Only a route the language model actually composed carries the AI
            mark. Most of this strip is the curated catalogue, which is not. */}
        {isLiveAi && (
          <View style={[styles.cardBadge, { borderColor: colors.secondary }]}>
            <MaterialIcon name="creation" size={14} color={colors.secondary} />
            <Text style={[styles.cardBadgeText, { color: colors.secondary }]} numberOfLines={1}>
              {t('home.aiRoutes.badge')}
            </Text>
          </View>
        )}
      </View>

      <Text
        style={[TYPOGRAPHY.bodyBold, styles.cardTitle, { color: colors.onSurface }]}
        numberOfLines={2}
      >
        {route.title}
      </Text>

      <View style={styles.cardMeta}>
        <MaterialIcon name="clock-outline" size={14} color={colors.onSurfaceVariant} />
        <Text style={[TYPOGRAPHY.caption, { color: colors.onSurfaceVariant }]}>
          {formatDuration(route.estimatedDurationMinutes)}
        </Text>
        <MaterialIcon name="map-marker-distance" size={14} color={colors.onSurfaceVariant} />
        <Text style={[TYPOGRAPHY.caption, { color: colors.onSurfaceVariant }]}>
          {formatDistance(route.distanceMeters)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The curated-routes strip on Home.
 *
 * Its list is the curated 100-route catalogue: static, hand-curated stop
 * selections seeded into the database, which no language model produced (plus
 * any route generated live, which is marked individually by `isLiveAi`). It
 * renders whenever that list has content, independently of whether live
 * generation is switched on. `isGenerationEnabled` gates only the leading
 * "create a route with AI" tile, which is the one AI feature here, so a
 * deployment with no credentials shows a complete, working section rather
 * than an error or an empty space.
 */
function AiRoutesSection({
  routes,
  isLoading,
  onSelectRoute,
  isGenerationEnabled,
  isGenerating,
  onGenerate,
  canGenerate,
}: AiRoutesSectionProps): React.JSX.Element | null {
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const dialog = useDialog();

  const renderItem = useCallback(
    ({ item }: { item: Route }) => (
      <AiRouteCard route={item} onPress={() => onSelectRoute(item.id)} />
    ),
    [onSelectRoute],
  );

  const keyExtractor = useCallback((item: Route) => `curated-${item.id}`, []);

  // Live generation calls an external language-model provider and saves a new
  // route to the database, so it must never fire from a single stray tap.
  // Nothing is sent until the user confirms.
  const handleGeneratePress = useCallback(() => {
    dialog.confirm({
      title: t('home.aiRoutes.confirmTitle', { defaultValue: 'Create a new route with AI?' }),
      message: t('home.aiRoutes.confirmMessage', {
        defaultValue:
          'A new route will be created with AI from places near you and added to the route list. This may take a few seconds.',
      }),
      confirmLabel: t('home.aiRoutes.confirmAction', { defaultValue: 'Create route' }),
      cancelLabel: t('common.cancel'),
      onConfirm: onGenerate,
    });
  }, [dialog, onGenerate, t]);

  const generateDisabled = !canGenerate || isGenerating;
  const generateOpacity = generateDisabled ? DISABLED_OPACITY : 1;

  if (!isLoading && routes.length === 0 && !isGenerationEnabled) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialIcon name="map-marker-path" size={18} color={colors.secondary} />
        <Text
          style={[TYPOGRAPHY.heading4, styles.sectionTitle, { color: colors.onSurface }]}
          accessibilityRole="header"
        >
          {t('home.aiRoutes.title')}
        </Text>
        {/* Where AI is and is not involved is a claim users of an
            accessibility app are entitled to interrogate. This says plainly
            that the list is curated, what the model decides when the user asks
            for a new route (which places, in what order, the wording) and what
            it never decides (anything about whether a place is accessible). */}
        <Pressable
          onPress={() =>
            dialog.alert(t('home.aiRoutes.explainTitle'), t('home.aiRoutes.explainBody'))
          }
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('home.aiRoutes.explainA11y')}
        >
          <MaterialIcon name="information-outline" size={18} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
      <Text style={[TYPOGRAPHY.caption, styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
        {t('home.aiRoutes.subtitle')}
      </Text>

      {isLoading ? (
        <View style={styles.skeletonRow}>
          <Skeleton.RouteCard />
        </View>
      ) : (
        <FlatList
          data={routes}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          initialNumToRender={3}
          windowSize={3}
          // Leads the strip rather than trailing it. As a footer it sat behind
          // the whole catalogue — with 100 generated routes in the list, six
          // swipes only reached the tenth card, so the action was in practice
          // unreachable. It is the one thing here the user can act on, so it
          // comes first.
          ListHeaderComponent={
            isGenerationEnabled ? (
              <Pressable
                style={[
                  styles.generateTile,
                  getShadows(colorScheme).card,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.secondary,
                    opacity: generateOpacity,
                  },
                ]}
                onPress={handleGeneratePress}
                disabled={generateDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: generateDisabled, busy: isGenerating }}
                accessibilityLabel={t('home.aiRoutes.generate')}
                accessibilityHint={t('home.aiRoutes.generateHint')}
              >
                {isGenerating ? (
                  <>
                    <ActivityIndicator color={colors.secondary} />
                    <Text
                      style={[TYPOGRAPHY.caption, styles.generateLabel, { color: colors.onSurfaceVariant }]}
                      numberOfLines={2}
                    >
                      {t('home.aiRoutes.generating')}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialIcon name="creation" size={28} color={colors.secondary} />
                    <Text
                      style={[TYPOGRAPHY.bodyBold, styles.generateLabel, { color: colors.secondary }]}
                      numberOfLines={2}
                    >
                      {t('home.aiRoutes.generate')}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    flexShrink: 1,
  },
  sectionSubtitle: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  skeletonRow: {
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
    minHeight: 132,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    marginTop: SPACING.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  generateTile: {
    width: 150,
    minHeight: 132,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  generateLabel: {
    textAlign: 'center',
  },
});

export default AiRoutesSection;
