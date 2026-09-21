import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Text from './AppText';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, TYPOGRAPHY, getGradients } from '../utils/constants';
import { useReducedMotion } from '../utils/motion';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Square button showing only the icon; `label` still feeds the a11y label. */
  iconOnly?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  iconOnly,
  style,
  accessibilityLabel,
}: AppButtonProps): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  };

  const handlePressOut = (): void => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const textColor =
    variant === 'primary' ? colors.onPrimary
    : variant === 'destructive' ? colors.error
    : colors.onSurface;

  const content = (
    <View style={[styles.content, iconOnly && styles.contentIconOnly]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <MaterialIcon name={icon} size={iconOnly ? 24 : 20} color={textColor} /> : null}
          {!iconOnly && (
            // One line; a label that really does not fit ends in "…".
            <Text
              style={[TYPOGRAPHY.bodyBold, styles.label, { color: textColor }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          )}
        </>
      )}
    </View>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled ? styles.disabled : null, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        style={[
          styles.base,
          iconOnly && styles.square,
          variant === 'secondary' && {
            backgroundColor: colors.surfaceContainerLow,
            borderWidth: 1,
            borderColor: colors.border,
          },
          variant === 'destructive' && {
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: colors.error,
          },
        ]}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={getGradients(colorScheme).primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientFill}
          >
            {content}
          </LinearGradient>
        ) : (
          content
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // minHeight, not height: a system font scaled up must grow the button
  // instead of being clipped by it.
  base: {
    minHeight: 56,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  square: {
    width: 56,
    height: 56,
  },
  disabled: {
    opacity: 0.5,
  },
  gradientFill: {
    alignSelf: 'stretch',
    flexGrow: 1,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  label: {
    flexShrink: 1,
  },
  // The 56pt square has no room for horizontal padding — without this the
  // icon gets clipped to the 8px left between the paddings.
  contentIconOnly: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});

export default AppButton;
