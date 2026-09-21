import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Text from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useProfileViewModel } from '../../viewmodels/useProfileViewModel';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../../utils/constants';
import { toUpperCaseLabel } from '../../utils/localization';
import MobilityProfileSelector from '../../components/MobilityProfileSelector';
import AgeGroupPicker from '../../components/AgeGroupPicker';
import AppButton from '../../components/AppButton';
import Skeleton from '../../components/Skeleton';
import ScreenHeader from '../../components/ScreenHeader';

const AGE_GROUPS = ['18-25', '25-35', '35-50', '50-65', '65+'];

// Footer clears: top padding + button height + safe-area-aware bottom padding
const FOOTER_CLEARANCE = SPACING.md + 56 + SPACING.xl + SPACING.lg;

function EditProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const {
    mobilityProfiles,
    isLoading,
    selectedProfileIds,
    showsStepFreeNote,
    toggleProfile,
    selectedAgeGroup,
    setSelectedAgeGroup,
    saveProfile,
    isSaving,
  } = useProfileViewModel();

  async function handleSave() {
    try {
      await saveProfile();
      navigation.goBack();
    } catch {
      dialog.alert(t('common.error'), t('editProfile.error'));
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.loadingHeader, { paddingTop: insets.top }]} />
        <View style={styles.loadingContent}>
          <Skeleton height={32} width="60%" />
          <Skeleton height={20} width="90%" style={styles.loadingGap} />
          <Skeleton height={56} radius={RADIUS.input} style={styles.loadingGap} />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <ScreenHeader title={t('editProfile.title')} onBack={() => navigation.goBack()} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Intro */}
        <View style={styles.introSection}>
          <Text style={[TYPOGRAPHY.heading1, styles.introTitle, { color: colors.primary }]}>
            {t('editProfile.tailorTitle')}
          </Text>
          <Text style={[TYPOGRAPHY.body, styles.introSubtitle, { color: colors.onSurfaceVariant }]}>
            {t('editProfile.tailorSubtitle')}
          </Text>
        </View>

        {/* Age Group */}
        <View style={styles.formSection}>
          <Text style={[TYPOGRAPHY.heading4, styles.sectionLabel, { color: colors.onSurface }]}>
            {t('profileSetup.ageGroup')}
          </Text>
          <AgeGroupPicker
            value={selectedAgeGroup || null}
            onChange={setSelectedAgeGroup}
            options={AGE_GROUPS}
          />
        </View>

        {/* Mobility Needs */}
        <View style={styles.formSection}>
          <View style={styles.mobilityHeader}>
            <Text style={[TYPOGRAPHY.heading4, styles.sectionLabel, { color: colors.onSurface }]}>
              {t('editProfile.mobilityNeeds')}
            </Text>
            <Text style={[TYPOGRAPHY.overline, { color: colors.onSurfaceVariant }]}>
              {toUpperCaseLabel(t('editProfile.selectAllApply'))}
            </Text>
          </View>
          <MobilityProfileSelector
            profiles={mobilityProfiles}
            selectedIds={selectedProfileIds}
            onToggle={toggleProfile}
          />
        </View>

        {/* Accessibility Note — only for profiles the score treats as step-free */}
        {showsStepFreeNote && (
          <View
            style={[
              styles.accessNote,
              { backgroundColor: colors.tertiaryContainer, borderColor: colors.border },
            ]}
          >
            <MaterialIcon
              name="information"
              size={28}
              color={colors.tertiary}
              importantForAccessibility="no-hide-descendants"
            />
            <View style={styles.accessNoteTextContainer}>
              <Text style={[TYPOGRAPHY.smallBold, styles.accessNoteLabel, { color: colors.onTertiaryContainer }]}>
                {t('editProfile.accessibilityNoteTitle')}
              </Text>
              <Text style={[TYPOGRAPHY.caption, { color: colors.onSurfaceVariant }]}>
                {t('editProfile.accessibilityNoteText')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View
        style={[
          styles.bottomBar,
          getShadows(colorScheme).bottomBar,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, SPACING.xl),
          },
        ]}
      >
        <AppButton
          label={t('editProfile.saveChanges')}
          onPress={handleSave}
          variant="primary"
          loading={isSaving}
          accessibilityLabel={t('editProfile.saveChanges')}
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
  loadingHeader: {
    minHeight: 56,
  },
  loadingContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  loadingGap: {
    marginTop: SPACING.md,
  },
  headerWrapper: {
    borderBottomWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: FOOTER_CLEARANCE,
  },
  introSection: {
    marginBottom: SPACING.xl + SPACING.sm,
    marginTop: SPACING.md,
  },
  introTitle: {
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.lg,
  },
  introSubtitle: {
    marginLeft: SPACING.lg,
  },
  formSection: {
    marginBottom: SPACING.xl + SPACING.md,
  },
  sectionLabel: {
    marginBottom: SPACING.md,
    marginLeft: SPACING.sm,
  },
  mobilityHeader: {
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  accessNote: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    gap: SPACING.md,
    borderWidth: 1,
  },
  accessNoteTextContainer: {
    flex: 1,
  },
  accessNoteLabel: {
    marginBottom: SPACING.xs,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
});

export default EditProfileScreen;
