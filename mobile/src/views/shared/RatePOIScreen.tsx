import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Text from '../../components/AppText';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePOIViewModel } from '../../viewmodels/usePOIViewModel';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { HomeStackParamList } from '../../navigation/HomeStack';
import AppButton from '../../components/AppButton';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../../utils/constants';
import { toUpperCaseLabel } from '../../utils/localization';

type RatePOIRouteProp = RouteProp<HomeStackParamList, 'RatePOI'>;
type RatePOINavigationProp = NativeStackNavigationProp<HomeStackParamList, 'RatePOI'>;

// A modal backdrop is inherently translucent black — shared with
// AlternativeRoutesModal for a consistent scrim across sheets.
const SHEET_SCRIM = 'rgba(6,12,24,0.6)'; // sheet scrim

interface StarInputProps {
  label: string;
  iconName: string;
  iconColor: string;
  activeColor: string;
  value: number;
  onChange: (value: number) => void;
  labelColor: string;
  inactiveColor: string;
}

function StarInput({ label, iconName, iconColor, activeColor, value, onChange, labelColor, inactiveColor }: StarInputProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <View>
      <View style={styles.starLabelRow}>
        <MaterialIcon name={iconName} size={20} color={iconColor} importantForAccessibility="no-hide-descendants" />
        <Text style={[TYPOGRAPHY.overline, styles.starLabel, { color: labelColor }]}>{toUpperCaseLabel(label)}</Text>
      </View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            style={styles.starTouchTarget}
            accessibilityRole="button"
            accessibilityLabel={t('common.starRating', { count: star })}
            accessibilityState={{ selected: star <= value }}
          >
            <MaterialIcon
              name="star"
              size={32}
              color={star <= value ? activeColor : inactiveColor}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RatePOIScreen(): React.JSX.Element {
  const { params } = useRoute<RatePOIRouteProp>();
  const navigation = useNavigation<RatePOINavigationProp>();
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();

  const { submitRating, isSubmitting } = usePOIViewModel(params.poiId);

  const [overallRating, setOverallRating] = useState(0);
  const [accessibilityRating, setAccessibilityRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = useCallback(() => {
    if (overallRating === 0) {
      dialog.alert(t('poi.ratingRequired'), t('poi.selectOverall'));
      return;
    }
    if (accessibilityRating === 0) {
      dialog.alert(t('poi.ratingRequired'), t('poi.selectAccessibility'));
      return;
    }

    submitRating(
      {
        rating: overallRating,
        accessibilityRating,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          navigation.goBack();
        },
        onError: () => {
          dialog.alert(t('common.error'), t('poi.submitError'));
        },
      },
    );
  }, [overallRating, accessibilityRating, comment, submitRating, navigation, dialog, t]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: SHEET_SCRIM }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        style={styles.spacer}
        onPress={handleCancel}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss')}
      />

      {/* Bottom Sheet */}
      <View style={[styles.sheet, getShadows(colorScheme).bottomBar, { backgroundColor: colors.surfaceContainerLowest }]}>
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[TYPOGRAPHY.heading2, { color: colors.onSurface }]}>{params.poiName}</Text>
          <Text style={[TYPOGRAPHY.caption, styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>
            {t('poi.rateSubtitle')}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          // The sheet reaches the screen edge (edge-to-edge, no tab bar), so
          // keep Cancel clear of the gesture / navigation bar.
          contentContainerStyle={[styles.scrollContent, { paddingBottom: SPACING.section + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StarInput
            label={t('poi.overallRating')}
            iconName="star"
            iconColor={colors.primary}
            activeColor={colors.tertiary}
            value={overallRating}
            onChange={setOverallRating}
            labelColor={colors.onSurfaceVariant}
            inactiveColor={colors.outlineVariant}
          />

          <StarInput
            label={t('poi.accessibilityRating')}
            iconName="wheelchair-accessibility"
            iconColor={colors.onSurfaceVariant}
            activeColor={colors.tertiary}
            value={accessibilityRating}
            onChange={setAccessibilityRating}
            labelColor={colors.onSurfaceVariant}
            inactiveColor={colors.outlineVariant}
          />

          {/* Comment */}
          <View>
            <Text style={[TYPOGRAPHY.overline, styles.commentLabel, { color: colors.onSurfaceVariant }]}>
              {toUpperCaseLabel(t('poi.comment'))}
            </Text>
            <TextInput
              style={[styles.commentInput, TYPOGRAPHY.body, {
                backgroundColor: colors.surfaceContainerLow,
                color: colors.onSurface,
                borderBottomColor: colors.outlineVariant,
              }]}
              value={comment}
              onChangeText={setComment}
              placeholder={t('poi.sharePlaceholder')}
              placeholderTextColor={colors.outline}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel={t('poi.comment')}
            />
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <AppButton
              label={t('poi.submit')}
              onPress={handleSubmit}
              variant="primary"
              loading={isSubmitting}
              accessibilityLabel={isSubmitting ? t('poi.submitting') : t('poi.submit')}
            />
            <AppButton
              label={t('poi.cancel')}
              onPress={handleCancel}
              variant="secondary"
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  spacer: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    maxHeight: '85%',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: RADIUS.full,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  headerSubtitle: {
    marginTop: SPACING.xs,
  },
  // Size to content and only shrink when the sheet hits its maxHeight.
  // `flex: 1` collapsed the list to zero height, because the sheet itself has
  // no fixed height — leaving just the handle and title visible.
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.section,
    gap: SPACING.xl,
  },
  starLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  starLabel: {
    letterSpacing: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  starTouchTarget: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.input,
  },
  commentLabel: {
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  commentInput: {
    borderTopLeftRadius: RADIUS.input,
    borderTopRightRadius: RADIUS.input,
    borderBottomWidth: 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    minHeight: 100,
  },
  actionsContainer: {
    gap: SPACING.md,
    paddingTop: SPACING.md,
  },
});

export default RatePOIScreen;
