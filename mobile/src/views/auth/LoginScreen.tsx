import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../../components/AppText';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuthViewModel } from '../../viewmodels/useAuthViewModel';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';
import AppButton from '../../components/AppButton';
import { RADIUS, SPACING, TYPOGRAPHY, getGradients } from '../../utils/constants';

function LoginScreen(): React.JSX.Element {
  const { login, isLoading, error } = useAuthViewModel();
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Decorative hero glow — token-pure gradient, no photo asset */}
      <LinearGradient
        colors={getGradients(colorScheme).primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGlow}
        pointerEvents="none"
      />

      <View style={styles.main}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcon name="walk" size={36} color={colors.onPrimaryContainer} />
          </View>
          <Text
            style={[TYPOGRAPHY.display, styles.appName, { color: colors.secondary }]}
            accessibilityRole="header"
          >
            CityPaths
          </Text>
          <Text style={[TYPOGRAPHY.bodyMedium, styles.tagline, { color: colors.onSurfaceVariant }]}>
            {t('login.subtitle')}
          </Text>
        </View>

        {/* Call to Action Section */}
        <View style={styles.ctaSection}>
          {/* Accessibility Info Card */}
          <View
            style={[
              styles.accessCard,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
            ]}
          >
            <View style={styles.accessIconContainer}>
              <MaterialIcon name="wheelchair-accessibility" size={30} color={colors.tertiary} />
            </View>
            <View style={styles.accessTextContainer}>
              <Text style={[TYPOGRAPHY.overline, styles.accessLabel, { color: colors.tertiary }]}>
                {t('login.inclusiveTravel')}
              </Text>
              <Text style={[TYPOGRAPHY.caption, styles.accessDescription, { color: colors.onSurfaceVariant }]}>
                {t('login.inclusiveTravelDesc')}
              </Text>
            </View>
          </View>

          {error && (
            <View
              style={[styles.errorCard, { backgroundColor: colors.errorContainer }]}
              accessibilityRole="alert"
            >
              <Text style={[TYPOGRAPHY.small, styles.errorText, { color: colors.onErrorContainer }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Login Button */}
          <AppButton
            label={t('login.signIn')}
            onPress={login}
            variant="primary"
            icon="google"
            loading={isLoading}
            accessibilityLabel={t('login.signIn')}
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[TYPOGRAPHY.tabLabel, styles.footerText, { color: colors.onSurfaceVariant }]}>
          {t('login.terms')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroGlow: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
    width: 340,
    height: 340,
    borderRadius: RADIUS.full,
    opacity: 0.16,
  },
  main: {
    width: '100%',
    maxWidth: 448,
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl + SPACING.sm,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appName: {
    textAlign: 'center',
  },
  tagline: {
    marginTop: SPACING.sm,
    maxWidth: 240,
    textAlign: 'center',
  },
  ctaSection: {
    width: '100%',
    gap: SPACING.lg,
    marginTop: SPACING.md,
  },
  accessCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  accessIconContainer: {
    // Container for the accessibility icon
  },
  accessTextContainer: {
    flex: 1,
  },
  accessLabel: {
    marginBottom: 2,
  },
  accessDescription: {},
  errorCard: {
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  errorText: {
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
  },
});

export default LoginScreen;
