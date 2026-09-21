import React from 'react';
import {
  View,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Text from './AppText';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AlternativeRoute } from '../services/routeService';
import { useTheme } from '../context/ThemeContext';
import { formatDistance, formatDuration } from '../utils/formatters';
import { toUpperCaseLabel } from '../utils/localization';
import { getAccessibilityBadge } from '../utils/accessibility';
import AppButton from './AppButton';
import EmptyState from './EmptyState';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../utils/constants';

interface AlternativeRoutesModalProps {
  visible: boolean;
  checkpoint: number;
  /**
   * `estimatedDurationMinutes` is the time to FINISH via that POI (walk plus
   * the stop visit), matching what «remaining» shows after switching.
   */
  alternatives: AlternativeRoute[];
  onSelectRoute: (route: AlternativeRoute) => void;
  onContinue: () => void;
}

// A modal backdrop is inherently translucent black — shared with
// RatePOIScreen for a consistent scrim across sheets.
const SHEET_SCRIM = 'rgba(6,12,24,0.6)'; // sheet scrim

function AlternativeRoutesModal({
  visible,
  checkpoint,
  alternatives,
  onSelectRoute,
  onContinue,
}: AlternativeRoutesModalProps): React.JSX.Element | null {
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Don't mount the native Modal at all while hidden: on the new
  // architecture a mounted Modal can ghost-render its content even with
  // visible={false} (seen on RN 0.84 — sheet painted, untouchable).
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onContinue}
      // Extend the modal window edge-to-edge: without these the underlying
      // screen peeks through in the status/navigation bar strips (the
      // sheet's own safe-area padding keeps content clear of the bars).
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: SHEET_SCRIM }]}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss')}
      >
        <Pressable
          style={[
            styles.sheet,
            getShadows(colorScheme).bottomBar,
            {
              backgroundColor: colors.surfaceContainerLowest,
              // The modal draws behind the system navigation bar — without
              // the inset the action buttons hide underneath it.
              paddingBottom: Math.max(insets.bottom, SPACING.lg) + SPACING.md,
            },
          ]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.surfaceContainerHigh }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialIcon name="map-marker" size={20} color={colors.primary} importantForAccessibility="no-hide-descendants" />
              <Text style={[TYPOGRAPHY.heading3, { color: colors.onSurface }]}>
                {t('checkpoint.title', { percent: checkpoint })}
              </Text>
            </View>
            <Text style={[TYPOGRAPHY.bodyLarge, { color: colors.onSurfaceVariant }]}>
              {t('checkpoint.subtitle')}
            </Text>
          </View>

          {/* Route Suggestions */}
          {alternatives.length > 0 ? (
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {alternatives.map((route, index) => {
                const isRecommended = index === 0;
                const badge = getAccessibilityBadge(route.accessibilityScore, colors);
                const badgeLabel = t(badge.labelKey);
                const timeToFinish = t('checkpoint.timeToFinish', {
                  duration: formatDuration(route.estimatedDurationMinutes),
                });

                return (
                  <Pressable
                    key={route.id}
                    style={[
                      styles.routeCard,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
                      isRecommended && {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.primary,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => onSelectRoute(route)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isRecommended ? `${t('checkpoint.recommended')}: ` : ''}${route.title}, ${timeToFinish}, ${formatDistance(route.distanceMeters)}, ${badgeLabel}`}
                  >
                    <View style={styles.routeCardHeader}>
                      <View style={styles.routeCardLeft}>
                        {isRecommended && (
                          <Text style={[TYPOGRAPHY.overline, { color: colors.primary }]}>
                            {toUpperCaseLabel(t('checkpoint.recommended'))}
                          </Text>
                        )}
                        <Text style={[TYPOGRAPHY.heading4, { color: colors.onSurface }]} numberOfLines={3}>
                          {route.title}
                        </Text>
                      </View>
                      <View style={[styles.accessPill, { backgroundColor: badge.bgColor, borderColor: badge.borderColor }]}>
                        <MaterialIcon name={badge.icon} size={14} color={badge.color} importantForAccessibility="no-hide-descendants" />
                        <Text style={[TYPOGRAPHY.overline, { color: badge.color }]}>{toUpperCaseLabel(badgeLabel)}</Text>
                      </View>
                    </View>
                    <View style={styles.routeInfoRow}>
                      <View style={styles.routeInfoItem}>
                        <MaterialIcon name="clock-outline" size={16} color={colors.onSurfaceVariant} importantForAccessibility="no-hide-descendants" />
                        <Text style={[TYPOGRAPHY.small, styles.routeInfoText, { color: colors.onSurfaceVariant }]}>
                          {timeToFinish}
                        </Text>
                      </View>
                      <View style={styles.routeInfoItem}>
                        <MaterialIcon name="map-marker-distance" size={16} color={colors.onSurfaceVariant} importantForAccessibility="no-hide-descendants" />
                        <Text style={[TYPOGRAPHY.small, styles.routeInfoText, { color: colors.onSurfaceVariant }]}>
                          {formatDistance(route.distanceMeters)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <EmptyState icon="routes" title={t('checkpoint.noAlternatives')} />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {alternatives.length > 0 && (
              <AppButton
                label={t('checkpoint.changeToRecommended')}
                onPress={() => onSelectRoute(alternatives[0])}
                variant="primary"
              />
            )}
            <AppButton
              label={t('checkpoint.continue')}
              onPress={onContinue}
              variant="secondary"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm + 4,
    maxHeight: '75%',
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  listContainer: {
    marginBottom: SPACING.xl,
    // Let the list shrink and scroll instead of pushing the action buttons
    // past the sheet's maxHeight (three tall cards overflow otherwise).
    flexGrow: 0,
    flexShrink: 1,
  },
  emptyContainer: {
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  routeCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.card,
    marginBottom: SPACING.md,
    borderWidth: 1,
    minHeight: 44,
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  routeCardLeft: {
    flex: 1,
    gap: SPACING.xs,
  },
  accessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: SPACING.xs + 2,
    borderWidth: 1,
  },
  // Wraps: «Έως το τέλος: 1 ώ 5 λεπτά» and the distance may not share a line.
  routeInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: SPACING.md,
    rowGap: SPACING.xs,
  },
  // maxWidth + a shrinkable label: a long «Έως το τέλος: …» wraps instead of
  // losing its unit at the card edge.
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    maxWidth: '100%',
  },
  routeInfoText: {
    flexShrink: 1,
  },
  actionsContainer: {
    gap: SPACING.md,
  },
});

export default AlternativeRoutesModal;
