import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../utils/constants';
import AppButton from './AppButton';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

function EmptyState({ icon, title, subtitle, ctaLabel, onCta }: EmptyStateProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <MaterialIcon name={icon} size={48} color={colors.onSurfaceVariant} />
      <Text
        style={[TYPOGRAPHY.heading3, styles.title, { color: colors.onSurface }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[TYPOGRAPHY.body, styles.subtitle, { color: colors.onSurfaceVariant }]}>
          {subtitle}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <AppButton
          label={ctaLabel}
          onPress={onCta}
          variant="secondary"
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  title: {
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  cta: {
    marginTop: SPACING.lg,
  },
});

export default EmptyState;
