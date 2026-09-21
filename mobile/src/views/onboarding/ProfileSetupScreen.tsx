import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Text from '../../components/AppText';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../../utils/constants';
import { useProfileViewModel } from '../../viewmodels/useProfileViewModel';
import MobilityProfileSelector from '../../components/MobilityProfileSelector';
import AgeGroupPicker from '../../components/AgeGroupPicker';
import AppButton from '../../components/AppButton';
import Skeleton from '../../components/Skeleton';

const AGE_GROUPS = ['18-25', '25-35', '35-50', '50-65', '65+'];

// Footer clears: top padding + button height + safe-area-aware bottom padding
const FOOTER_CLEARANCE = SPACING.md + 56 + SPACING.xl + SPACING.lg;

function ProfileSetupScreen(): React.JSX.Element {
  const auth = useAuth();
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const {
    mobilityProfiles,
    isLoading,
    selectedProfileIds,
    toggleProfile,
    selectedAgeGroup,
    setSelectedAgeGroup,
    saveProfile,
    isSaving,
  } = useProfileViewModel();

  const canSave = !!selectedAgeGroup && selectedProfileIds.length > 0;

  async function handleSave() {
    try {
      await saveProfile();
      auth.setHasProfile(true);
    } catch {
      dialog.alert(t('common.error'), t('editProfile.error'));
    }
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.surface, paddingTop: insets.top + SPACING.md },
        ]}
      >
        <View style={styles.loadingContent}>
          <Skeleton height={36} width="70%" />
          <Skeleton height={20} width="90%" style={styles.loadingGap} />
          <Skeleton height={56} radius={RADIUS.input} style={styles.loadingGap} />
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <View style={styles.headerLeft}>
          <MaterialIcon name="walk" size={24} color={colors.secondary} />
          <Text style={[styles.headerTitle, { color: colors.secondary }]}>
            {t('login.title')}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title with left border */}
        <View style={[styles.titleSection, { borderLeftColor: colors.primary }]}>
          <Text style={[TYPOGRAPHY.display, styles.title, { color: colors.onSurface }]}>
            {t('profileSetup.title')}
          </Text>
          <Text style={[TYPOGRAPHY.bodyLarge, styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {t('profileSetup.subtitle')}
          </Text>
        </View>

        {/* Age Group Section */}
        <View style={styles.ageSection}>
          <Text style={[TYPOGRAPHY.heading4, styles.sectionLabel, { color: colors.onSurface }]}>
            {t('profileSetup.ageGroup')}
          </Text>
          <AgeGroupPicker
            value={selectedAgeGroup || null}
            onChange={setSelectedAgeGroup}
            options={AGE_GROUPS}
          />
        </View>

        {/* Mobility Type Section */}
        <View style={styles.mobilitySection}>
          <Text style={[TYPOGRAPHY.heading4, styles.sectionLabel, { color: colors.onSurface }]}>
            {t('profileSetup.mobilityType')}
          </Text>
          <Text style={[TYPOGRAPHY.small, styles.sectionSubLabel, { color: colors.onSurfaceVariant }]}>
            {t('profileSetup.selectAllApply')}
          </Text>
          <MobilityProfileSelector
            profiles={mobilityProfiles}
            selectedIds={selectedProfileIds}
            onToggle={toggleProfile}
          />
        </View>

        {/* Accessibility Notice */}
        <View
          style={[
            styles.accessNotice,
            { borderLeftColor: colors.tertiary, backgroundColor: colors.tertiaryContainer },
          ]}
        >
          <MaterialIcon
            name="information"
            size={24}
            color={colors.tertiary}
            importantForAccessibility="no-hide-descendants"
          />
          <View style={styles.accessNoticeTextContainer}>
            <Text style={[TYPOGRAPHY.smallBold, styles.accessNoticeLabel, { color: colors.onTertiaryContainer }]}>
              {t('profileSetup.accessibilityNotice')}
            </Text>
            <Text style={[TYPOGRAPHY.caption, styles.accessNoticeText, { color: colors.onSurfaceVariant }]}>
              {t('profileSetup.accessibilityNoticeText')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer Action Bar */}
      <View
        style={[
          styles.footerBar,
          getShadows(colorScheme).bottomBar,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, SPACING.xl),
          },
        ]}
      >
        <AppButton
          label={t('profileSetup.save')}
          onPress={handleSave}
          variant="primary"
          icon="arrow-right"
          loading={isSaving}
          disabled={!canSave}
          accessibilityLabel={t('profileSetup.save')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingContent: {
    paddingHorizontal: SPACING.lg,
  },
  loadingGap: {
    marginTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl + SPACING.sm,
    paddingBottom: FOOTER_CLEARANCE,
  },
  titleSection: {
    marginBottom: SPACING.xl + SPACING.sm,
    paddingLeft: SPACING.lg,
    borderLeftWidth: 4,
  },
  title: {
    marginBottom: SPACING.sm,
  },
  subtitle: {},
  ageSection: {
    marginBottom: SPACING.xl + SPACING.sm,
  },
  sectionLabel: {
    marginBottom: SPACING.sm + 4,
  },
  sectionSubLabel: {
    marginBottom: SPACING.md,
  },
  mobilitySection: {
    marginBottom: SPACING.xl,
  },
  accessNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderLeftWidth: 4,
    gap: SPACING.md,
    marginBottom: SPACING.xl + SPACING.sm,
  },
  accessNoticeTextContainer: {
    flex: 1,
  },
  accessNoticeLabel: {
    letterSpacing: 0.5,
  },
  accessNoticeText: {
    marginTop: SPACING.xs,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
});

export default ProfileSetupScreen;
