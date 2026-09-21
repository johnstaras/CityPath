import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../components/AppText';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import { useReducedMotion } from '../utils/motion';
import { SPACING, RADIUS, TYPOGRAPHY, getShadows } from '../utils/constants';
import AppButton from '../components/AppButton';

// Dialog scrim — a modal backdrop is inherently translucent black, shared
// with the app's sheet scrims. // sheet scrim
const DIALOG_SCRIM = 'rgba(6,12,24,0.6)';

interface DialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  onPress?: () => void;
}

interface DialogOptions {
  title: string;
  message?: string;
  actions: DialogAction[];
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

interface DialogContextValue {
  /** Fully custom dialog. */
  show: (options: DialogOptions) => void;
  /** Single-button info dialog (replacement for Alert.alert(title, msg)). */
  alert: (title: string, message?: string) => void;
  /** Two-button confirm; cancel is always safe and dismisses. */
  confirm: (options: ConfirmOptions) => void;
  hide: () => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (options == null) {
      return;
    }
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [options, reducedMotion, scale, opacity]);

  const hide = useCallback(() => setOptions(null), []);

  const show = useCallback((next: DialogOptions) => setOptions(next), []);

  const alert = useCallback(
    (title: string, message?: string) =>
      setOptions({
        title,
        message,
        actions: [{ label: t('common.ok'), variant: 'primary' }],
      }),
    [t],
  );

  const confirm = useCallback(
    ({ title, message, confirmLabel, cancelLabel, destructive, onConfirm }: ConfirmOptions) =>
      setOptions({
        title,
        message,
        actions: [
          { label: cancelLabel ?? t('common.cancel'), variant: 'secondary' },
          { label: confirmLabel, variant: destructive ? 'destructive' : 'primary', onPress: onConfirm },
        ],
      }),
    [t],
  );

  const value = useMemo<DialogContextValue>(
    () => ({ show, alert, confirm, hide }),
    [show, alert, confirm, hide],
  );

  // The card never grows past the safe area (status bar, navigation bar) plus
  // the scrim's own margin. A long message scrolls inside it, so the buttons
  // stay reachable at any length and at 200% font scale.
  const cardMaxHeight = Math.max(
    0,
    windowHeight - insets.top - insets.bottom - SPACING.lg * 2,
  );

  const handleAction = (action: DialogAction) => {
    setOptions(null);
    action.onPress?.();
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal visible={options != null} transparent animationType="none" onRequestClose={hide}>
        <Animated.View
          style={[
            styles.scrim,
            { opacity, paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={hide}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
          />
          {options != null && (
            <Animated.View
              style={[
                styles.card,
                getShadows(colorScheme).elevated,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.border,
                  maxHeight: cardMaxHeight,
                  transform: [{ scale }],
                },
              ]}
              accessibilityRole="alert"
            >
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator
              >
                <Text style={[TYPOGRAPHY.heading3, { color: colors.onSurface }]}>
                  {options.title}
                </Text>
                {options.message != null && (
                  <Text style={[TYPOGRAPHY.body, styles.message, { color: colors.onSurfaceVariant }]}>
                    {options.message}
                  </Text>
                )}
              </ScrollView>
              <View style={styles.actions}>
                {options.actions.map((action, index) => (
                  <AppButton
                    key={index}
                    label={action.label}
                    variant={action.variant ?? 'primary'}
                    onPress={() => handleAction(action)}
                    style={styles.actionButton}
                  />
                ))}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: DIALOG_SCRIM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.sheet,
    borderWidth: 1,
    paddingVertical: SPACING.lg,
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: SPACING.lg,
  },
  message: {
    marginTop: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  actionButton: {
    flex: 1,
  },
});
