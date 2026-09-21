import React, { memo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Text from './AppText';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { MobilityProfile } from '../models';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../utils/constants';
import { getMobilityProfileName } from '../utils/localization';

// Map DB icon names to MaterialCommunityIcons
export const MOBILITY_ICON_MAP: Record<string, string> = {
  walk: 'walk',
  elderly: 'human-cane',
  stroller: 'baby-carriage',
  wheelchair: 'wheelchair-accessibility',
  pregnant: 'human-pregnant',
};
const DEFAULT_ICON = 'account-outline';

function getMobilityIcon(iconName?: string): string {
  if (!iconName) return DEFAULT_ICON;
  return MOBILITY_ICON_MAP[iconName] ?? DEFAULT_ICON;
}

interface MobilityProfileSelectorProps {
  profiles: MobilityProfile[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

const MobilityProfileSelector = memo(function MobilityProfileSelector({
  profiles,
  selectedIds,
  onToggle,
}: MobilityProfileSelectorProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {profiles.map(profile => {
        const isSelected = selectedIds.includes(profile.id);
        const name = getMobilityProfileName(profile, t);
        return (
          <Pressable
            key={profile.id}
            style={[
              styles.card,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border },
              isSelected && {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => onToggle(profile.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={t('common.mobilityProfileA11y', { name })}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colors.surfaceContainer },
                isSelected && { backgroundColor: colors.primary },
              ]}
            >
              <MaterialIcon
                name={getMobilityIcon(profile.icon)}
                size={24}
                color={isSelected ? colors.onPrimary : colors.onSurfaceVariant}
              />
            </View>

            <Text
              style={[styles.name, { color: isSelected ? colors.primary : colors.onSurface }]}
            >
              {name}
            </Text>

            {isSelected ? (
              <MaterialIcon
                name="check-circle"
                size={22}
                color={colors.primary}
                style={styles.checkBadge}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    minHeight: 56,
    borderRadius: RADIUS.card,
    borderWidth: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  name: {
    ...TYPOGRAPHY.heading4,
    flex: 1,
    paddingRight: SPACING.xl,
  },
  checkBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
});

export default MobilityProfileSelector;
