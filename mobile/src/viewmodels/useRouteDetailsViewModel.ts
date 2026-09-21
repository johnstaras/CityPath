import { useCallback, useState } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteById, RouteDetail } from '../services/routeService';
import { useActiveProfile } from './useActiveProfileId';
import { ensureLocationPermission } from '../utils/permissions';
import { addFavorite, removeFavorite, getFavorites } from '../services/favoriteService';
import { Route } from '../models';

interface RouteDetailsViewModel {
  route: RouteDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  /** The server answered 404: the route does not exist (any more). */
  isNotFound: boolean;
  /** Retry after a load error that is not a 404. */
  retry: () => void;
  isFavorite: boolean;
  toggleFavorite: () => void;
  /** Null until the user asks to be located. */
  userPosition: { lat: number; lng: number } | null;
  locateUser: () => void;
}

export function useRouteDetailsViewModel(routeId: number): RouteDetailsViewModel {
  const queryClient = useQueryClient();

  // Score route details against the most restrictive selected mobility
  // profile, matching the home list.
  const {
    profileId: activeProfileId,
    isReady: profileReady,
    isError: profileFailed,
    error: profileError,
    refetch: refetchProfile,
  } = useActiveProfile();

  const {
    data: route,
    error: routeError,
    refetch: refetchRoute,
  } = useQuery({
    queryKey: ['route', routeId, activeProfileId],
    queryFn: () => getRouteById(routeId, activeProfileId),
    // Wait for the profile: the badge scored without it is the pedestrian's.
    enabled: routeId > 0 && profileReady,
    // A 404 will not change on retry; anything else (network) may.
    retry: (failureCount, err) =>
      (err as { response?: { status?: number } })?.response?.status !== 404 && failureCount < 2,
  });

  const error = profileFailed ? profileError : (routeError as Error | null);
  const status = (routeError as { response?: { status?: number } } | null)?.response?.status;
  const isNotFound = !profileFailed && (routeId <= 0 || status === 404);

  const retry = useCallback(() => {
    if (profileFailed) refetchProfile();
    else refetchRoute();
  }, [profileFailed, refetchProfile, refetchRoute]);

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => getFavorites(),
  });

  const isFavorite = (favorites ?? []).some((fav: Route) => fav.id === routeId);

  const addMutation = useMutation({
    mutationFn: () => addFavorite(routeId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<Route[]>(['favorites']);

      if (route) {
        queryClient.setQueryData<Route[]>(['favorites'], (old) => [
          ...(old ?? []),
          route,
        ]);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      // Profile stats count favourites.
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFavorite(routeId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<Route[]>(['favorites']);

      queryClient.setQueryData<Route[]>(['favorites'], (old) =>
        (old ?? []).filter((r) => r.id !== routeId),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      // Profile stats count favourites.
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
    },
  });

  const toggleFavorite = useCallback(() => {
    if (isFavorite) {
      removeMutation.mutate();
    } else {
      addMutation.mutate();
    }
  }, [isFavorite, addMutation, removeMutation]);

  // Fetched on demand rather than on mount: this is a preview screen, and
  // prompting for location every time someone opens a route would be a
  // permission dialog they did not ask for. Nothing here needs a live watch —
  // one fix is enough to show where they are relative to the route.
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);

  const locateUser = useCallback(() => {
    const run = async () => {
      const granted = await ensureLocationPermission();
      if (!granted) {
        return;
      }
      Geolocation.getCurrentPosition(
        position =>
          setUserPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        geoError => console.warn('Geolocation error:', geoError.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
      );
    };
    run().catch(err => console.warn('Location permission error:', err));
  }, []);

  return {
    route,
    isLoading: route === undefined && error == null && routeId > 0,
    error,
    isNotFound,
    retry,
    isFavorite,
    toggleFavorite,
    userPosition,
    locateUser,
  };
}
