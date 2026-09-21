import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING } from '../utils/constants';
import { useReducedMotion } from '../utils/motion';

interface SkeletonProps {
  width?: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
}

function SkeletonBase({ width = '100%', height, radius = RADIUS.input, style }: SkeletonProps): React.JSX.Element {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 0.7 : 0.5)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.7);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceContainerHigh,
          opacity,
        },
        style,
      ]}
    />
  );
}

function RouteCardSkeleton(): React.JSX.Element {
  return (
    <View style={styles.routeCardStack}>
      <SkeletonBase width="100%" height={220} radius={16} />
      <SkeletonBase width="100%" height={220} radius={16} />
      <SkeletonBase width="100%" height={220} radius={16} />
    </View>
  );
}

function RowSkeleton(): React.JSX.Element {
  return (
    <View style={styles.row}>
      <SkeletonBase width={44} height={44} radius={RADIUS.full} />
      <View style={styles.rowLines}>
        <SkeletonBase width="60%" height={16} radius={4} />
        <SkeletonBase width="40%" height={14} radius={4} />
      </View>
    </View>
  );
}

const Skeleton = Object.assign(SkeletonBase, {
  RouteCard: RouteCardSkeleton,
  Row: RowSkeleton,
});

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
  routeCardStack: {
    gap: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rowLines: {
    flex: 1,
    gap: SPACING.xs,
  },
});

export default Skeleton;
