import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { getFavorites, addFavorite, removeFavorite } from '../services/favoriteService';
import { useActiveProfile } from './useActiveProfileId';

interface ToggleVariables {
  routeId: number;
  isFavorite: boolean;
}

interface HomeFavoritesViewModel {
  /**
   * Route ids shown as favorited on the Home cards: the server's list with any
   * in-flight toggle already applied, so the heart answers the tap at once.
   */
  favoriteIds: Set<number>;
  /** Routes whose save/remove is still in flight; their heart ignores taps. */
  pendingIds: Set<number>;
  toggleFavorite: (routeId: number) => void;
  isToggling: boolean;
}

const TOGGLE_KEY = ['homeFavoriteToggle'];

/**
 * Favorite state for the Home route cards.
 *
 * Reads the same cache entry as the Favorites tab (`['favorites', profileId]`),
 * so the two screens share one fetch and always agree. Writes invalidate by the
 * `['favorites']` prefix, which refreshes every profile's entry and any other
 * observer of the favorites list.
 */
export function useHomeFavoritesViewModel(): HomeFavoritesViewModel {
  const queryClient = useQueryClient();
  const { profileId, isReady } = useActiveProfile();

  const { data } = useQuery({
    queryKey: ['favorites', profileId],
    queryFn: () => getFavorites(profileId),
    // Same entry the Favorites tab renders: it must be scored with the real
    // profile, never with the pedestrian default.
    enabled: isReady,
  });

  // Synchronous guard next to the pending state below: two taps inside one
  // frame both run before the re-render that would show the route as pending.
  const inFlight = useRef(new Set<number>());

  const serverIds = useMemo(
    () => new Set((data ?? []).map(route => route.id)),
    [data],
  );

  // The current state travels with the mutation, so the request matches the
  // heart the user saw when they tapped rather than a later render's state.
  const toggleMutation = useMutation({
    mutationKey: TOGGLE_KEY,
    mutationFn: ({ routeId, isFavorite }: ToggleVariables) =>
      isFavorite ? removeFavorite(routeId) : addFavorite(routeId),
    // Returning the refetch keeps the mutation pending until the list is
    // fresh, so the optimistic heart never flickers back to the old state
    // between the server's answer and the refetch.
    onSettled: (_data, _error, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['profileStats'] }),
      ]).finally(() => {
        inFlight.current.delete(variables.routeId);
      }),
  });

  const pendingToggles = useMutationState({
    filters: { mutationKey: TOGGLE_KEY, status: 'pending' },
    select: mutation => mutation.state.variables as ToggleVariables | undefined,
  });

  const { pendingIds, favoriteIds } = useMemo(() => {
    const pending = new Set<number>();
    const shown = new Set(serverIds);
    for (const toggle of pendingToggles) {
      if (!toggle) continue;
      pending.add(toggle.routeId);
      // Optimistic: show the state the tap asked for. On failure the mutation
      // stops being pending and the heart falls back to the server's list.
      if (toggle.isFavorite) shown.delete(toggle.routeId);
      else shown.add(toggle.routeId);
    }
    return { pendingIds: pending, favoriteIds: shown };
  }, [serverIds, pendingToggles]);

  const { mutate } = toggleMutation;
  const toggleFavorite = useCallback(
    (routeId: number) => {
      // A second tap while the first is in flight would send a duplicate
      // add (or a remove of a favorite not saved yet).
      if (inFlight.current.has(routeId) || pendingIds.has(routeId)) return;
      inFlight.current.add(routeId);
      mutate({ routeId, isFavorite: serverIds.has(routeId) });
    },
    [mutate, serverIds, pendingIds],
  );

  return {
    favoriteIds,
    pendingIds,
    toggleFavorite,
    isToggling: pendingIds.size > 0,
  };
}
