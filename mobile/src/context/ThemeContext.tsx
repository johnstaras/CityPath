import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColors, type AppColors } from '../utils/constants';
import { useReducedMotion } from '../utils/motion';

type ColorScheme = 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'themePreference';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  colorScheme: ColorScheme;
  /**
   * Explicitly switch theme (persisted, overrides the system setting).
   * With `origin` (tap position in window coords) a circular reveal grows
   * from that point in the new theme's background, the theme flips while
   * covered, then the bubble dissolves. Without `origin`, a plain
   * full-screen crossfade. Skipped entirely under reduce-motion.
   */
  setColorScheme: (scheme: ColorScheme, origin?: { x: number; y: number }) => void;
  /** True when the user has explicitly picked a theme (system setting ignored). */
  isThemeOverridden: boolean;
  /** Drop the explicit preference and follow the system setting again. */
  clearColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const systemColorScheme = useColorScheme();
  const reducedMotion = useReducedMotion();

  // null = follow the system setting (default until the user picks a theme).
  const [override, setOverride] = useState<ColorScheme | null>(null);

  const colorScheme: ColorScheme =
    override ?? (systemColorScheme === 'dark' ? 'dark' : 'light');
  const isDark = colorScheme === 'dark';

  // Load the persisted preference once on startup.
  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then(saved => {
        if (saved === 'light' || saved === 'dark') {
          setOverride(saved);
        }
      })
      .catch(() => {});
  }, []);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Transition overlay, tinted to the TARGET theme's background. Two shapes:
  // a bubble (circular reveal growing from the tap point) or a full-screen
  // fade. Either way the theme flips while the screen is covered, then the
  // overlay dissolves — no hard flash.
  const BUBBLE_SIZE = 48;
  // Translucent veil: the bubble is see-through, tinted with the target
  // theme's background — content ghosts beneath the wavefront, the theme
  // flips at full coverage, then the veil melts away.
  const BUBBLE_OPACITY = 0.8;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const [overlay, setOverlay] = useState<
    | { kind: 'fade'; color: string }
    | { kind: 'bubble'; color: string; x: number; y: number; targetScale: number }
    | null
  >(null);
  const transitioningRef = useRef(false);

  const finishTransition = useCallback(
    (next: ColorScheme | null) => {
      setOverride(next);
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => {
        transitioningRef.current = false;
        setOverlay(null);
      });
    },
    [overlayOpacity],
  );

  const setColorScheme = useCallback(
    (next: ColorScheme, origin?: { x: number; y: number }) => {
      if (next === colorScheme || transitioningRef.current) {
        return;
      }
      AsyncStorage.setItem(THEME_PREFERENCE_KEY, next).catch(() => {});

      if (reducedMotion) {
        setOverride(next);
        return;
      }

      transitioningRef.current = true;
      const color = getColors(next).background;

      if (origin) {
        // Radius that reaches the farthest screen corner from the tap point.
        const maxDist = Math.max(
          Math.hypot(origin.x, origin.y),
          Math.hypot(windowWidth - origin.x, origin.y),
          Math.hypot(origin.x, windowHeight - origin.y),
          Math.hypot(windowWidth - origin.x, windowHeight - origin.y),
        );
        const radius = maxDist * 1.05;
        const targetScale = (radius * 2) / BUBBLE_SIZE;

        setOverlay({ kind: 'bubble', color, x: origin.x, y: origin.y, targetScale });
        bubbleScale.setValue(0);
        overlayOpacity.setValue(BUBBLE_OPACITY);
        Animated.timing(bubbleScale, {
          toValue: targetScale,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => finishTransition(next));
      } else {
        setOverlay({ kind: 'fade', color });
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start(() => finishTransition(next));
      }
    },
    [colorScheme, reducedMotion, overlayOpacity, bubbleScale, windowWidth, windowHeight, finishTransition],
  );

  const clearColorScheme = useCallback(() => {
    AsyncStorage.removeItem(THEME_PREFERENCE_KEY).catch(() => {});
    const systemScheme: ColorScheme = systemColorScheme === 'dark' ? 'dark' : 'light';
    if (systemScheme === colorScheme || reducedMotion) {
      setOverride(null);
      return;
    }
    if (transitioningRef.current) {
      return;
    }
    // Visible change — soften it with the crossfade.
    transitioningRef.current = true;
    setOverlay({ kind: 'fade', color: getColors(systemScheme).background });
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => finishTransition(null));
  }, [systemColorScheme, colorScheme, reducedMotion, overlayOpacity, finishTransition]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: getColors(colorScheme),
      isDark,
      colorScheme,
      setColorScheme,
      isThemeOverridden: override != null,
      clearColorScheme,
    }),
    [colorScheme, isDark, setColorScheme, override, clearColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {overlay?.kind === 'fade' && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: overlay.color, opacity: overlayOpacity },
          ]}
        />
      )}
      {overlay?.kind === 'bubble' && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: overlay.x - BUBBLE_SIZE / 2,
            top: overlay.y - BUBBLE_SIZE / 2,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: BUBBLE_SIZE / 2,
            backgroundColor: overlay.color,
            opacity: overlayOpacity,
            transform: [{ scale: bubbleScale }],
          }}
        />
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
