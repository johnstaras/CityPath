import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Text from './AppText';
import { useTranslation } from 'react-i18next';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../utils/constants';
import { useReducedMotion } from '../utils/motion';
import { toUpperCaseLabel } from '../utils/localization';

interface ProgressBarProps {
  progress: number; // 0-100
  /** 'idle': tracking has not started (or could not) — no status label. */
  status: 'idle' | 'active' | 'paused';
  /** Off the planned line: the label must not claim "on track". */
  isOffRoute?: boolean;
}

const CHECKPOINTS = [25, 50, 75];

function ProgressBar({ progress, status, isOffRoute = false }: ProgressBarProps): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  const shadows = getShadows(colorScheme);
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const animatedProgress = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    if (reducedMotion) {
      animatedProgress.setValue(clampedProgress);
      return;
    }
    Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, reducedMotion, animatedProgress]);

  const fillWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clampedProgress),
      }}
      accessibilityLabel={t('activeRoute.progressLabel', { percent: Math.round(clampedProgress) })}
    >
      <View style={styles.labelsRow}>
        <Text style={[TYPOGRAPHY.overline, { color: colors.onSurfaceVariant }]}>0%</Text>
        {/* Before tracking is active nothing is known about the walk, so
            the bar must not claim "on track". */}
        {status !== 'idle' && (
          <Text
            style={[
              TYPOGRAPHY.overline,
              { color: status === 'paused' ? colors.onSurfaceVariant : isOffRoute ? colors.tertiary : colors.primary },
            ]}
          >
            {toUpperCaseLabel(
              status === 'paused'
                ? t('activeRoute.pausedLabel')
                : isOffRoute
                  ? t('activeRoute.offRouteShort')
                  : t('activeRoute.onTrack'),
            )}
          </Text>
        )}
        <Text style={[TYPOGRAPHY.overline, { color: colors.onSurfaceVariant }]}>100%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}>
        <Animated.View
          style={[
            styles.fill,
            { width: fillWidth, backgroundColor: colors.primary },
          ]}
        />
        {CHECKPOINTS.map(cp => {
          const isPassed = clampedProgress >= cp;
          return (
            <View
              key={cp}
              style={[
                styles.checkpoint,
                { left: `${cp}%`, marginLeft: isPassed ? -8 : -4 },
              ]}
              accessibilityLabel={t('activeRoute.checkpoint', { percent: cp })}
            >
              {isPassed ? (
                <View
                  style={[
                    styles.checkpointDotReached,
                    shadows.button,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <MaterialIcon name="check" size={10} color={colors.onPrimary} />
                </View>
              ) : (
                <View
                  style={[
                    styles.checkpointDot,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  track: {
    height: 12,
    borderRadius: RADIUS.full,
    overflow: 'visible',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: RADIUS.full,
  },
  checkpoint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkpointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  checkpointDotReached: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProgressBar;
