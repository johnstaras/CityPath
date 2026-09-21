import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../utils/constants';

interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  floating?: boolean;
}

function ScreenHeader({ title, onBack, right, floating }: ScreenHeaderProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (floating) {
    return (
      <View style={[styles.floatingContainer, { top: insets.top + SPACING.md }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={[
              styles.floatingBack,
              {
                backgroundColor: `${colors.surfaceContainerLowest}E6`,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={4}
          >
            <MaterialIcon name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={4}
        >
          <MaterialIcon name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
      ) : (
        <View style={styles.backButton} />
      )}
      {title ? (
        <Text
          style={[TYPOGRAPHY.heading3, styles.title, { color: colors.onSurface }]}
          accessibilityRole="header"
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  floatingContainer: {
    position: 'absolute',
    left: SPACING.md,
    zIndex: 10,
  },
  floatingBack: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ScreenHeader;
