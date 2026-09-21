import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Text from '../../components/AppText';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useReducedMotion } from '../../utils/motion';
import { setAppLanguage, type AppLanguage } from '../../i18n';
import { SPACING, RADIUS, TYPOGRAPHY, getShadows } from '../../utils/constants';
import ScreenHeader from '../../components/ScreenHeader';

// Scenic day/night toggle geometry + scene colors. The scene colors are
// illustrative content (a tiny sky picture), not theme tokens — like map
// tiles or photos, they render the same in both themes. // day/night scene
const SCENE_HEIGHT = 64;
const SCENE_KNOB = 52;
const SCENE_PADDING = (SCENE_HEIGHT - SCENE_KNOB) / 2;
const DAY_SKY = ['#7DD3FC', '#FDE68A']; // day/night scene
const NIGHT_SKY = ['#0B1220', '#1E3A5F']; // day/night scene
const SUN_KNOB = ['#FDE68A', '#F59E0B']; // day/night scene
const MOON_KNOB = ['#E6EDF7', '#94A3B8']; // day/night scene
const SCENE_STAR = '#FFFFFF'; // day/night scene
const STARS = [
  { left: 0.12, top: 12, size: 2 },
  { left: 0.22, top: 34, size: 3 },
  { left: 0.38, top: 18, size: 2 },
  { left: 0.52, top: 40, size: 2 },
  { left: 0.66, top: 14, size: 3 },
  { left: 0.8, top: 30, size: 2 },
];

interface ScenicThemeToggleProps {
  isDark: boolean;
  onToggle: (next: 'light' | 'dark', origin: { x: number; y: number }) => void;
  lightLabel: string;
  darkLabel: string;
}

/**
 * A day/night scene as a switch: warm daylight sky with clouds on one end,
 * starry night on the other, crossfading as the sun/moon knob slides.
 */
function ScenicThemeToggle({ isDark, onToggle, lightLabel, darkLabel }: ScenicThemeToggleProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View>(null);
  const knobTravel = Math.max(0, trackWidth - SCENE_KNOB - SCENE_PADDING * 2);

  // 0 = day, 1 = night. Drives knob position, scene crossfade, and icon swap.
  const slide = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: isDark ? 1 : 0,
      duration: reducedMotion ? 0 : 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isDark, slide, reducedMotion]);

  const handlePress = () => {
    const next = isDark ? 'light' : 'dark';
    trackRef.current?.measureInWindow((x, y, width, height) => {
      const knobCenterX =
        next === 'dark'
          ? x + width - SCENE_PADDING - SCENE_KNOB / 2
          : x + SCENE_PADDING + SCENE_KNOB / 2;
      onToggle(next, { x: knobCenterX, y: y + height / 2 });
    });
  };

  const nightOpacity = slide;
  const dayOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const knobRotation = slide.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      ref={trackRef}
      onPress={handlePress}
      onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      style={styles.sceneTrack}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? darkLabel : lightLabel}
    >
      {/* Day scene */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: dayOpacity }]}>
        <LinearGradient colors={DAY_SKY} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.cloud, styles.cloudOne]} />
        <View style={[styles.cloud, styles.cloudTwo]} />
        <View style={[styles.cloud, styles.cloudThree]} />
      </Animated.View>

      {/* Night scene */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: nightOpacity }]}>
        <LinearGradient colors={NIGHT_SKY} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
        {STARS.map((star, i) => (
          <View
            key={i}
            style={[
              styles.star,
              {
                left: `${star.left * 100}%`,
                top: star.top,
                width: star.size,
                height: star.size,
                borderRadius: star.size / 2,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Sun/moon knob */}
      <Animated.View
        style={[
          styles.sceneKnobWrap,
          {
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, knobTravel] }) },
              { rotate: knobRotation },
            ],
          },
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={{ opacity: dayOpacity, ...StyleSheet.absoluteFillObject }}>
          <LinearGradient colors={SUN_KNOB} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sceneKnob}>
            <MaterialIcon name="white-balance-sunny" size={26} color={SCENE_STAR} />
          </LinearGradient>
        </Animated.View>
        <Animated.View style={{ opacity: nightOpacity }}>
          <LinearGradient colors={MOON_KNOB} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sceneKnob}>
            <MaterialIcon name="weather-night" size={26} color={NIGHT_SKY[0]} />
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

interface SegmentOption {
  key: string;
  label?: string;
  icon?: string;
  accessibilityLabel: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  selectedKey: string;
  /** Receives the picked option and its center in window coordinates. */
  onSelect: (key: string, center: { x: number; y: number }) => void;
}

/**
 * Modern segmented control: soft borderless track, selection is a raised
 * thumb that glides beneath the options.
 */
function SegmentedControl({ options, selectedKey, onSelect }: SegmentedControlProps): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View>(null);

  const selectedIndex = Math.max(0, options.findIndex(o => o.key === selectedKey));
  const segmentWidth = trackWidth > 0 ? (trackWidth - SEGMENT_PADDING * 2) / options.length : 0;

  const thumbPosition = useRef(new Animated.Value(selectedIndex)).current;
  useEffect(() => {
    Animated.timing(thumbPosition, {
      toValue: selectedIndex,
      duration: reducedMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, thumbPosition, reducedMotion]);

  const handlePress = (key: string, index: number) => {
    trackRef.current?.measureInWindow((x, y, _w, h) => {
      onSelect(key, {
        x: x + SEGMENT_PADDING + segmentWidth * index + segmentWidth / 2,
        y: y + h / 2,
      });
    });
  };

  return (
    <View
      ref={trackRef}
      style={[styles.segTrack, { backgroundColor: colors.surfaceContainerHigh }]}
      onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segThumb,
            getShadows(colorScheme).card,
            {
              width: segmentWidth,
              backgroundColor: colors.surfaceContainerLowest,
              transform: [
                {
                  translateX: thumbPosition.interpolate({
                    inputRange: [0, Math.max(1, options.length - 1)],
                    outputRange: [0, segmentWidth * Math.max(1, options.length - 1)],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {options.map((opt, index) => {
        const selected = index === selectedIndex;
        const tint = selected ? colors.primary : colors.onSurfaceVariant;
        return (
          <Pressable
            key={opt.key}
            style={styles.segment}
            onPress={() => handlePress(opt.key, index)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.accessibilityLabel}
          >
            {opt.icon != null && <MaterialIcon name={opt.icon} size={22} color={tint} />}
            {opt.label != null && (
              <Text style={[TYPOGRAPHY.bodyBold, { color: tint }]}>{opt.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { colors, colorScheme, setColorScheme, isThemeOverridden, clearColorScheme } = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const activeLanguage: AppLanguage = i18n.language.startsWith('el') ? 'el' : 'en';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <ScreenHeader title={t('profile.settings')} onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Language island */}
        <View style={[styles.island, { backgroundColor: colors.surfaceContainerLow }]}>
          <View style={styles.islandHeader}>
            <MaterialIcon
              name="translate"
              size={20}
              color={colors.primary}
              importantForAccessibility="no-hide-descendants"
            />
            <Text
              style={[TYPOGRAPHY.bodyBold, { color: colors.onSurface }]}
              accessibilityRole="header"
            >
              {t('profile.language')}
            </Text>
          </View>
          <SegmentedControl
            options={[
              // Language names render in their own language — proper names,
              // not translatable strings.
              { key: 'en', label: 'English', accessibilityLabel: 'English' },
              { key: 'el', label: 'Ελληνικά', accessibilityLabel: 'Ελληνικά' },
            ]}
            selectedKey={activeLanguage}
            onSelect={key => setAppLanguage(key as AppLanguage)}
          />
        </View>

        {/* Appearance island */}
        <View style={[styles.island, { backgroundColor: colors.surfaceContainerLow }]}>
          <View style={styles.islandHeader}>
            <MaterialIcon
              name="theme-light-dark"
              size={20}
              color={colors.primary}
              importantForAccessibility="no-hide-descendants"
            />
            <Text
              style={[TYPOGRAPHY.bodyBold, { color: colors.onSurface }]}
              accessibilityRole="header"
            >
              {t('profile.theme')}
            </Text>
          </View>
          <ScenicThemeToggle
            isDark={colorScheme === 'dark'}
            onToggle={(next, origin) => setColorScheme(next, origin)}
            lightLabel={t('profile.themeLight')}
            darkLabel={t('profile.themeDark')}
          />
          {isThemeOverridden && (
            <Pressable
              onPress={clearColorScheme}
              style={styles.systemLink}
              accessibilityRole="button"
              accessibilityLabel={t('profile.themeSystem')}
            >
              <MaterialIcon
                name="cellphone-cog"
                size={16}
                color={colors.onSurfaceVariant}
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={[TYPOGRAPHY.small, { color: colors.onSurfaceVariant }]}>
                {t('profile.themeSystem')}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const SEGMENT_PADDING = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  island: {
    borderRadius: RADIUS.sheet,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  islandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  segTrack: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    padding: SEGMENT_PADDING,
    height: 56,
  },
  segThumb: {
    position: 'absolute',
    left: SEGMENT_PADDING,
    top: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    borderRadius: RADIUS.full,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 44,
  },
  sceneTrack: {
    height: SCENE_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    height: 10,
    borderRadius: RADIUS.full,
    backgroundColor: SCENE_STAR,
    opacity: 0.55,
  },
  cloudOne: { left: '18%', top: 14, width: 34 },
  cloudTwo: { left: '30%', top: 38, width: 24 },
  cloudThree: { left: '58%', top: 20, width: 30 },
  star: {
    position: 'absolute',
    backgroundColor: SCENE_STAR,
  },
  sceneKnobWrap: {
    position: 'absolute',
    left: SCENE_PADDING,
    top: SCENE_PADDING,
    width: SCENE_KNOB,
    height: SCENE_KNOB,
  },
  sceneKnob: {
    width: SCENE_KNOB,
    height: SCENE_KNOB,
    borderRadius: SCENE_KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 44,
  },
});

export default SettingsScreen;
