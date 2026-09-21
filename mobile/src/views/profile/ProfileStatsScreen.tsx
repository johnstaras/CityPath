import React from 'react';
import {
  View,
  Image,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import Text from '../../components/AppText';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { useAuthViewModel } from '../../viewmodels/useAuthViewModel';
import { useProfileViewModel } from '../../viewmodels/useProfileViewModel';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../utils/constants';
import { formatDistance } from '../../utils/formatters';
import {
  getAgeGroupLabel,
  getMobilityProfileName,
  toUpperCaseLabel,
} from '../../utils/localization';
import { MOBILITY_ICON_MAP as mobilityIcons } from '../../components/MobilityProfileSelector';
import AppButton from '../../components/AppButton';
import ScreenHeader from '../../components/ScreenHeader';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

import type { ProfileStackParamList } from '../../navigation/ProfileStack';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function ProfileStatsScreen(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user } = useAuth();
  const { logout } = useAuthViewModel();
  const { profile, stats, isLoading, statsError, refetchStats, isStatsRefreshing } =
    useProfileViewModel();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();

  function handleLogout() {
    dialog.confirm({
      title: t('profile.logoutTitle'),
      message: t('profile.logoutMessage'),
      confirmLabel: t('profile.logout'),
      destructive: true,
      onConfirm: () => logout(),
    });
  }

  const statTiles = [
    { key: 'routes', label: t('profile.routesCompleted'), value: String(stats?.completedRoutes ?? 0) },
    {
      key: 'distance',
      label: t('profile.totalDistance'),
      value: stats ? formatDistance(stats.totalDistanceMeters) : formatDistance(0),
    },
    { key: 'favorites', label: t('profile.favorites'), value: String(stats?.favoritesCount ?? 0) },
    { key: 'ratings', label: t('profile.ratings'), value: String(stats?.ratingsCount ?? 0) },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View
        style={[
          styles.headerWrapper,
          { paddingTop: insets.top, borderBottomColor: colors.border },
        ]}
      >
        <ScreenHeader title={t('tabs.profile')} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isStatsRefreshing}
            onRefresh={refetchStats}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContent}>
            <Skeleton.Row />
            <Skeleton.Row />
            <Skeleton.Row />
          </View>
        ) : (
          <>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.avatarImage}
                  accessibilityLabel={user?.name ?? t('profile.title')}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.surfaceContainer }]}>
                  <Text style={[TYPOGRAPHY.heading2, { color: colors.onSurface }]}>
                    {user?.name ? getInitials(user.name) : '?'}
                  </Text>
                </View>
              )}
              <Text style={[TYPOGRAPHY.heading2, styles.userName, { color: colors.textPrimary }]}>
                {user?.name ?? t('profile.defaultName')}
              </Text>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
                {user?.email ?? ''}
              </Text>
            </View>

            {/* Badges */}
            {profile && (
              <View style={styles.badgesSection}>
                {profile.ageGroup && (
                  <View style={[styles.badge, { backgroundColor: colors.surfaceContainerLow }]}>
                    <MaterialIcon
                      name="calendar-range"
                      size={14}
                      color={colors.textPrimary}
                      importantForAccessibility="no-hide-descendants"
                    />
                    <Text style={[TYPOGRAPHY.small, { color: colors.textPrimary }]}>
                      {getAgeGroupLabel(profile.ageGroup, t)}
                    </Text>
                  </View>
                )}
                {profile.mobilityProfiles.map(mp => (
                  <View key={mp.id} style={[styles.badge, { backgroundColor: colors.surfaceContainerLow }]}>
                    <MaterialIcon
                      name={mobilityIcons[mp.icon] ?? 'account-outline'}
                      size={14}
                      color={colors.textPrimary}
                      importantForAccessibility="no-hide-descendants"
                    />
                    <Text style={[TYPOGRAPHY.small, { color: colors.textPrimary }]}>
                      {getMobilityProfileName(mp, t)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsSection}>
              <Text style={[TYPOGRAPHY.heading3, styles.statsTitle, { color: colors.onSurface }]}>
                {t('profile.yourActivity')}
              </Text>
              {statsError ? (
                <View accessibilityRole="alert">
                  <EmptyState
                    icon="cloud-off-outline"
                    title={t('profile.statsErrorTitle')}
                    subtitle={t('profile.statsErrorSubtitle')}
                    ctaLabel={t('common.retry')}
                    onCta={refetchStats}
                  />
                </View>
              ) : (
                <View style={styles.statsGrid}>
                  <View style={styles.statsRow}>
                    {statTiles.slice(0, 2).map(tile => (
                      <View
                        key={tile.key}
                        style={[
                          styles.statTile,
                          { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[TYPOGRAPHY.heading2, { color: colors.primary }]}>{tile.value}</Text>
                        <Text style={[TYPOGRAPHY.overline, styles.statTileLabel, { color: colors.onSurfaceVariant }]}>
                          {toUpperCaseLabel(tile.label)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.statsRow}>
                    {statTiles.slice(2, 4).map(tile => (
                      <View
                        key={tile.key}
                        style={[
                          styles.statTile,
                          { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[TYPOGRAPHY.heading2, { color: colors.primary }]}>{tile.value}</Text>
                        <Text style={[TYPOGRAPHY.overline, styles.statTileLabel, { color: colors.onSurfaceVariant }]}>
                          {toUpperCaseLabel(tile.label)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Actions */}
            <AppButton
              label={t('profile.settings')}
              onPress={() => navigation.navigate('Settings')}
              variant="secondary"
              icon="cog-outline"
              style={styles.editButton}
            />
            <AppButton
              label={t('profile.editProfile')}
              onPress={() => navigation.navigate('EditProfile')}
              variant="secondary"
              style={styles.editButton}
            />
            <AppButton
              label={t('profile.logout')}
              onPress={handleLogout}
              variant="destructive"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerWrapper: {
    borderBottomWidth: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  loadingContent: {
    gap: SPACING.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: SPACING.md,
  },
  userName: {
    marginBottom: SPACING.xs,
  },
  badgesSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  statsSection: {
    marginBottom: SPACING.xl,
  },
  statsTitle: {
    marginBottom: SPACING.md,
  },
  statsGrid: {
    gap: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  statTileLabel: {
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  editButton: {
    marginBottom: SPACING.md,
  },
});

export default ProfileStatsScreen;
