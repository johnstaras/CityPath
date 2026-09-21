import React, { useMemo, useCallback, memo } from 'react';
import { StyleSheet } from 'react-native';
import { getFocusedRouteNameFromRoute, RouteProp } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import HomeStack from './HomeStack';
import FavoritesStack from './FavoritesStack';
import ProfileStack from './ProfileStack';
import { useTheme } from '../context/ThemeContext';
import { TYPOGRAPHY } from '../utils/constants';

type MainTabsParamList = {
  Home: undefined;
  Favorites: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Full-focus flows where the tab bar must not show, in every stack that hosts
// them: an accidental tab switch mid-navigation would hide the active route
// screen while tracking continues, and the RatePOI bottom sheet would sit
// underneath the bar with its stars and Submit out of reach.
const TAB_BAR_HIDDEN_SCREENS = ['ActiveRoute', 'RatePOI'];

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
  Home: { focused: 'map-marker-path', default: 'map-marker-outline' },
  Favorites: { focused: 'heart', default: 'heart-outline' },
  Profile: { focused: 'account-circle', default: 'account-circle-outline' },
};

// Memoized tab icon to prevent re-creating JSX on every render
const TabIcon = memo(function TabIcon({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return <MaterialIcon name={name} size={24} color={color} />;
});

function MainTabs(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        backgroundColor: colors.surfaceContainerLowest,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 8),
        height: 64 + Math.max(insets.bottom - 8, 0),
      },
    ],
    [colors.surfaceContainerLowest, colors.border, insets.bottom],
  );

  const homeLabel = useMemo(() => t('tabs.home'), [t]);
  const favoritesLabel = useMemo(() => t('tabs.favorites'), [t]);
  const profileLabel = useMemo(() => t('tabs.profile'), [t]);

  const homeIcon = useCallback(
    ({ focused, color }: { focused: boolean; color: string }) => (
      <TabIcon
        name={focused ? TAB_ICONS.Home.focused : TAB_ICONS.Home.default}
        color={color}
      />
    ),
    [],
  );

  const favoritesIcon = useCallback(
    ({ focused, color }: { focused: boolean; color: string }) => (
      <TabIcon
        name={
          focused ? TAB_ICONS.Favorites.focused : TAB_ICONS.Favorites.default
        }
        color={color}
      />
    ),
    [],
  );

  const profileIcon = useCallback(
    ({ focused, color }: { focused: boolean; color: string }) => (
      <TabIcon
        name={focused ? TAB_ICONS.Profile.focused : TAB_ICONS.Profile.default}
        color={color}
      />
    ),
    [],
  );

  // No Android ripple "bubble" on tab taps — quiet opacity feedback instead.
  const tabBarButton = useCallback(
    (props: BottomTabBarButtonProps) => (
      <PlatformPressable {...props} pressColor="transparent" pressOpacity={0.7} />
    ),
    [],
  );

  const screenOptions = useMemo(
    () => ({
      headerShown: false as const,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.onSurfaceVariant,
      tabBarStyle,
      tabBarLabelStyle: styles.tabLabel,
      tabBarButton,
      // NOTE: freezeOnBlur deliberately NOT used — it has documented JS-FPS
      // and memory regressions with 3+ bottom tabs (react-native-screens
      // #2971/#2384). Smoothness comes from cheap scene renders instead.
    }),
    [colors.primary, colors.onSurfaceVariant, tabBarStyle, tabBarButton],
  );

  // Tab bar style for a tab whose stack may focus a full-focus screen. Before
  // the stack has state the focused name is undefined, i.e. its first screen.
  const stackTabBarStyle = useCallback(
    (route: RouteProp<MainTabsParamList, keyof MainTabsParamList>) => {
      const focused = getFocusedRouteNameFromRoute(route);
      return focused && TAB_BAR_HIDDEN_SCREENS.includes(focused)
        ? { display: 'none' as const }
        : tabBarStyle;
    },
    [tabBarStyle],
  );

  const homeOptions = useCallback(
    ({ route }: { route: RouteProp<MainTabsParamList, 'Home'> }) => ({
      tabBarLabel: homeLabel,
      tabBarIcon: homeIcon,
      tabBarStyle: stackTabBarStyle(route),
    }),
    [homeLabel, homeIcon, stackTabBarStyle],
  );

  // Routes can be started and POIs rated from Favorites too.
  const favoritesOptions = useCallback(
    ({ route }: { route: RouteProp<MainTabsParamList, 'Favorites'> }) => ({
      tabBarLabel: favoritesLabel,
      tabBarIcon: favoritesIcon,
      tabBarStyle: stackTabBarStyle(route),
    }),
    [favoritesLabel, favoritesIcon, stackTabBarStyle],
  );

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={homeOptions}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesStack}
        options={favoritesOptions}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarLabel: profileLabel, tabBarIcon: profileIcon }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  tabLabel: {
    ...TYPOGRAPHY.tabLabel,
  },
});

export default MainTabs;
