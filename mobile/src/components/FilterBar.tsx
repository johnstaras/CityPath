import React, { memo } from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import Text from './AppText';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../utils/constants';
import { TimeFilter, CategoryFilter } from '../viewmodels/useRoutesViewModel';

interface FilterBarProps {
  timeFilter: TimeFilter;
  onTimeChange: (value: TimeFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
}

interface ChipConfig<T> {
  value: T;
  labelKey: string;
  icon?: string;
}

const TIME_CHIPS: ChipConfig<NonNullable<TimeFilter>>[] = [
  { value: '60', labelKey: 'home.timeFilter.1h', icon: 'clock-outline' },
  { value: '120', labelKey: 'home.timeFilter.2h' },
  { value: '180+', labelKey: 'home.timeFilter.3h' },
];

const CATEGORY_CHIPS: ChipConfig<NonNullable<CategoryFilter>>[] = [
  { value: 'historical', labelKey: 'home.category.historical', icon: 'bank' },
  { value: 'cultural', labelKey: 'home.category.cultural', icon: 'drama-masks' },
  { value: 'nature', labelKey: 'home.category.nature', icon: 'tree' },
];

const FilterBar = memo(function FilterBar({
  timeFilter,
  onTimeChange,
  categoryFilter,
  onCategoryChange,
}: FilterBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {TIME_CHIPS.map((chip) => {
        const selected = timeFilter === chip.value;
        const label = t(chip.labelKey);
        return (
          <Pressable
            key={chip.value}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: colors.primaryContainer, borderColor: colors.primary, borderWidth: 1.5 }
                : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => onTimeChange(selected ? null : chip.value)}
            accessibilityRole="button"
            accessibilityLabel={t('common.filterBy', { label })}
            accessibilityState={{ selected }}
          >
            {selected ? (
              <MaterialIcon name="check" size={16} color={colors.primary} />
            ) : (
              chip.icon && <MaterialIcon name={chip.icon} size={16} color={colors.onSurfaceVariant} />
            )}
            <Text
              style={[
                styles.chipText,
                { color: selected ? colors.primary : colors.onSurfaceVariant },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}

      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {CATEGORY_CHIPS.map((chip) => {
        const selected = categoryFilter === chip.value;
        const label = t(chip.labelKey);
        return (
          <Pressable
            key={chip.value}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: colors.primaryContainer, borderColor: colors.primary, borderWidth: 1.5 }
                : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => onCategoryChange(selected ? null : chip.value)}
            accessibilityRole="button"
            accessibilityLabel={t('common.filterBy', { label })}
            accessibilityState={{ selected }}
          >
            {selected ? (
              <MaterialIcon name="check" size={16} color={colors.primary} />
            ) : (
              chip.icon && <MaterialIcon name={chip.icon} size={16} color={colors.onSurfaceVariant} />
            )}
            <Text
              style={[
                styles.chipText,
                { color: selected ? colors.primary : colors.onSurfaceVariant },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scrollView: {
    marginBottom: SPACING.md,
    flexGrow: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    minHeight: 44,
  },
  chipText: {
    ...TYPOGRAPHY.smallBold,
  },
  separator: {
    width: 1,
    height: 32,
    alignSelf: 'center',
    marginHorizontal: SPACING.xs,
  },
});

export default FilterBar;
