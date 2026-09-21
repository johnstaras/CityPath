import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFavorites, removeFavorite as removeFavoriteApi } from '../services/favoriteService';
import { useActiveProfile } from './useActiveProfileId';
import { Route } from '../models';

interface FavoritesViewModel {
  favorites: Route[];
  isLoading: boolean;
  /** True only during a user-initiated pull-to-refresh. */
  isRefreshing: boolean;
  error: Error | null;
  removeFavorite: (routeId: number) => void;
  isRemoving: boolean;
  /** Retry after an error (also retries a failed profile load). */
  refetch: () => void;
  /** Pull-to-refresh: drives `isRefreshing`. */
  refresh: () => void;
}

export function useFavoritesViewModel(): FavoritesViewModel {
  const queryClient = useQueryClient();

  // Score favorites against the same profile the Home list uses, so the
  // accessibility badges agree between screens.
  const {
    profileId: activeProfileId,
    isReady: profileReady,
    isError: profileFailed,
    error: profileError,
    refetch: refetchProfile,
  } = useActiveProfile();
  const [isUserRefreshing, setIsUserRefreshing] = useState(false);

  // The exact key this screen renders from. The optimistic update and its
  // rollback must target it: writing to the bare ['favorites'] key (the
  // details/summary cache entry) left this list untouched until the refetch.
  const listKey = ['favorites', activeProfileId] as const;

  const { data, error: listError, refetch: refetchList } = useQuery({
    queryKey: listKey,
    queryFn: () => getFavorites(activeProfileId),
    // Scored without the profile the badges would be the pedestrian's.
    enabled: profileReady,
  });

  const error = profileFailed ? profileError : (listError as Error | null);

  const refetch = useCallback(() => {
    if (profileFailed) refetchProfile();
    else refetchList();
  }, [profileFailed, refetchProfile, refetchList]);

  const refresh = useCallback(async () => {
    setIsUserRefreshing(true);
    try {
      await (profileFailed ? refetchProfile() : refetchList());
    } finally {
      setIsUserRefreshing(false);
    }
  }, [profileFailed, refetchProfile, refetchList]);

  const removeMutation = useMutation({
    mutationFn: (routeId: number) => removeFavoriteApi(routeId),
    onMutate: async (routeId: number) => {
      const key = listKey;
      // Prefix: an in-flight fetch of any favorites entry must not land on
      // top of the optimistic removal.
      await queryClient.cancelQueries({ queryKey: ['favorites'] });

      const previous = queryClient.getQueryData<Route[]>(key);

      queryClient.setQueryData<Route[]>(key, (old) =>
        (old ?? []).filter((route) => route.id !== routeId),
      );

      return { previous, key };
    },
    onError: (_err, _routeId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: () => {
      // Prefix match: the list, the details/summary heart state and the
      // profile's favourites count all come from the server again.
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
    },
  });

  const handleRemove = useCallback(
    (routeId: number) => {
      removeMutation.mutate(routeId);
    },
    [removeMutation],
  );

  return {
    favorites: data ?? [],
    // Also true while the profile is still loading.
    isLoading: data === undefined && error == null,
    isRefreshing: isUserRefreshing,
    error,
    removeFavorite: handleRemove,
    isRemoving: removeMutation.isPending,
    refetch,
    refresh,
  };
}
