import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFavorite, getFavorites } from '../services/favoriteService';
import { ratePOI } from '../services/poiService';
import { Route } from '../models';

interface RouteSummaryViewModel {
  /** Star value per POI id; 0 (absent) means not rated yet. */
  ratings: Record<number, number>;
  /**
   * Sets the stars optimistically and submits them. Resolves false when THIS
   * request failed and was the latest for the POI (stars rolled back) — the
   * caller shows the error. A stale failure resolves true: a newer request owns
   * the state.
   */
  rate: (poiId: number, value: number) => Promise<boolean>;
  /** True once the route is known to be in favorites (already, or just saved). */
  isFavorite: boolean;
  /** True until the favorites list has answered, so the button can't lie. */
  isFavoriteLoading: boolean;
  isSavingFavorite: boolean;
  /** Resolves false on failure — the caller shows the error. */
  saveFavorite: () => Promise<boolean>;
}

export function useRouteSummaryViewModel(route: Route): RouteSummaryViewModel {
  const queryClient = useQueryClient();
  const routeId = route.id;

  // Same query as the route details heart button (useRouteDetailsViewModel),
  // so both screens share one cache entry and agree on the favorite state.
  const { data: favorites, isLoading: isFavoriteLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => getFavorites(),
  });
  const isFavorite = (favorites ?? []).some((fav: Route) => fav.id === routeId);

  const addMutation = useMutation({
    mutationFn: () => addFavorite(routeId),
    onSuccess: () => {
      queryClient.setQueryData<Route[]>(['favorites'], old =>
        (old ?? []).some(r => r.id === routeId) ? old : [...(old ?? []), route],
      );
    },
    onSettled: () => {
      // Prefix match: also refreshes the Favorites tab list (['favorites', profileId]).
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      // The profile screen shows a favourites count.
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
    },
  });

  const { mutateAsync: addFavoriteAsync, isPending: isSavingFavorite } = addMutation;

  const saveFavorite = useCallback(async () => {
    if (isFavorite || isSavingFavorite) {
      return true;
    }
    try {
      await addFavoriteAsync();
      return true;
    } catch (err) {
      console.warn('Failed to save favorite:', err);
      return false;
    }
  }, [isFavorite, isSavingFavorite, addFavoriteAsync]);

  const [ratings, setRatings] = useState<Record<number, number>>({});
  // Monotonic per-POI request ids: only the LATEST in-flight rating request for
  // a POI may roll back state; stale failures are ignored.
  const rateRequestSeq = useRef<Record<number, number>>({});

  const rate = useCallback(async (poiId: number, value: number) => {
    const seq = (rateRequestSeq.current[poiId] ?? 0) + 1;
    rateRequestSeq.current[poiId] = seq;
    let previous = 0;
    setRatings(prev => {
      previous = prev[poiId] ?? 0;
      return { ...prev, [poiId]: value };
    });
    try {
      await ratePOI(poiId, { rating: value, accessibilityRating: value });
      // The profile screen counts the user's ratings; the POI's averages changed.
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
      queryClient.invalidateQueries({ queryKey: ['poi', poiId] });
      return true;
    } catch (err) {
      console.warn('Failed to submit rating:', err);
      if (rateRequestSeq.current[poiId] === seq) {
        setRatings(prev => ({ ...prev, [poiId]: previous }));
        return false;
      }
      return true;
    }
  }, [queryClient]);

  return {
    ratings,
    rate,
    isFavorite,
    isFavoriteLoading,
    isSavingFavorite,
    saveFavorite,
  };
}
