import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY, getShadows } from '../utils/constants';
import { getAgeGroupLabel } from '../utils/localization';

interface AgeGroupPickerProps {
  value: string | null;
  onChange: (ageGroup: string) => void;
  options: string[];
}

interface TriggerLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

function AgeGroupPicker({ value, onChange, options }: AgeGroupPickerProps): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const shadows = getShadows(colorScheme);
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<TriggerLayout | null>(null);

  // Stored values ('18-25', legacy 'adult', …) are data, not display text.
  const triggerLabel = value ? getAgeGroupLabel(value, t) : t('profileSetup.selectAge');

  function handleOpen(): void {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setLayout({ x, y, width, height });
      setOpen(true);
    });
  }

  function handleClose(): void {
    setOpen(false);
  }

  function handleSelect(option: string): void {
    onChange(option);
    setOpen(false);
  }

  return (
    <View>
      <Pressable
        ref={triggerRef}
        style={[
          styles.trigger,
          { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
        ]}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={triggerLabel}
      >
        <Text
          style={[
            TYPOGRAPHY.bodyMedium,
            { color: value ? colors.onSurface : colors.onSurfaceVariant },
          ]}
        >
          {triggerLabel}
        </Text>
        <MaterialIcon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.outline}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel={t('common.cancel')}
        >
          {layout ? (
            <View
              style={[
                styles.menu,
                shadows.card,
                {
                  top: layout.y + layout.height + SPACING.xs,
                  left: layout.x,
                  width: layout.width,
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="menu"
            >
              {options.map(option => {
                const selected = option === value;
                const optionLabel = getAgeGroupLabel(option, t);
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.menuItem,
                      selected && { backgroundColor: colors.surfaceContainerLow },
                    ]}
                    onPress={() => handleSelect(option)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    accessibilityLabel={optionLabel}
                  >
                    <Text
                      style={[
                        TYPOGRAPHY.body,
                        { color: selected ? colors.primary : colors.onSurface },
                      ]}
                    >
                      {optionLabel}
                    </Text>
                    {selected ? (
                      <MaterialIcon name="check" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.input,
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: RADIUS.input,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
});

export default AgeGroupPicker;
