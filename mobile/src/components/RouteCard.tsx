import React, { useCallback, useMemo, useRef, useState, memo } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { remoteImageSource } from '../utils/remoteImage';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Route } from '../models';
import { useTheme } from '../context/ThemeContext';
import {
  ON_SCRIM_GLASS,
  ON_SCRIM_WHITE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  getGradients,
  getShadows,
} from '../utils/constants';
import { formatDistance, formatDuration } from '../utils/formatters';
import { getAccessibilityBadge, getRouteBadgeText } from '../utils/accessibility';
import { toUpperCaseLabel } from '../utils/localization';
import { useReducedMotion } from '../utils/motion';

interface RouteCardProps {
  route: Route;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** A save/remove for this route is in flight: the heart ignores taps. */
  isFavoritePending?: boolean;
}

const RouteCard = memo(function RouteCard({
  route,
  onPress,
  isFavorite,
  onToggleFavorite,
  isFavoritePending = false,
}: RouteCardProps) {
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [imageError, setImageError] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  const badge = useMemo(
    () => getAccessibilityBadge(route.accessibilityScore, colors),
    [route.accessibilityScore, colors],
  );

  const { label: badgeLabel, a11yLabel: badgeA11yLabel } = getRouteBadgeText(
    badge,
    route.accessibilityScore,
    t,
  );

  const imageSource = useMemo(
    () => route.imageUrl ? remoteImageSource(route.imageUrl) : undefined,
    [route.imageUrl],
  );

  const handleToggleFavorite = useCallback(() => {
    if (isFavoritePending) {
      return;
    }
    if (!reducedMotion) {
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.25, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    onToggleFavorite?.();
  }, [isFavoritePending, reducedMotion, onToggleFavorite, heartScale]);

  return (
    <Pressable
      style={[styles.card, getShadows(colorScheme).card, { backgroundColor: colors.surfaceContainerLowest }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${route.title}, ${formatDuration(route.estimatedDurationMinutes)}, ${formatDistance(route.distanceMeters)}, ${badgeA11yLabel}${route.isLiveAi === true ? `, ${t('home.aiRoutes.badgeA11y')}` : ''}`}
    >
      {imageSource && !imageError ? (
        <Image
          source={imageSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          fadeDuration={0}
          accessibilityLabel={t('common.photoOf', { name: route.title })}
          onError={() => setImageError(true)}
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

      {/* Favorite toggle, top-right glass circle */}
      <Animated.View style={[styles.heartCircle, { transform: [{ scale: heartScale }] }]}>
        <Pressable
          style={styles.heartPressable}
          onPress={handleToggleFavorite}
          disabled={isFavoritePending}
          accessibilityRole="button"
          accessibilityState={{ disabled: isFavoritePending, busy: isFavoritePending }}
          accessibilityLabel={isFavorite ? t('common.removeFavorite') : t('common.addFavorite')}
          hitSlop={8}
        >
          <MaterialIcon
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? colors.error : ON_SCRIM_WHITE}
          />
        </Pressable>
      </Animated.View>

      {/* Title + meta chips, bottom over scrim */}
      <View style={styles.bottomContent}>
        <Text style={styles.title} numberOfLines={2}>
          {route.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <MaterialIcon name="clock-outline" size={14} color={ON_SCRIM_WHITE} />
            <Text style={styles.metaText}>{formatDuration(route.estimatedDurationMinutes)}</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialIcon name="map-marker-distance" size={14} color={ON_SCRIM_WHITE} />
            <Text style={styles.metaText}>{formatDistance(route.distanceMeters)}</Text>
          </View>
          {/* Provenance, shown wherever a route card appears: live-generated
              routes also sit in the main browse list, and a reader should be
              able to tell how a route was composed without opening it. Keyed
              on `isLiveAi`, not `createdBy === 'ai'`: the curated catalogue
              shares that bucket but was never produced by a language model. */}
          {route.isLiveAi === true && (
            <View style={styles.metaChip}>
              <MaterialIcon name="creation" size={14} color={ON_SCRIM_WHITE} />
              <Text style={styles.metaText}>{t('home.aiRoutes.badge')}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    height: 220,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    marginHorizontal: SPACING.lg,
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
});

export default RouteCard;
