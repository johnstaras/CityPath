import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRoutes,
  getAiRouteStatus,
  generateRoute,
  RouteDetail,
} from '../services/routeService';
import { useActiveProfile } from './useActiveProfileId';
import { Route } from '../models';

/**
 * The curated-routes section on Home.
 *
 * Two independent concerns, deliberately kept apart:
 *
 *  - `routes` is the curated catalogue already in the database. It is static,
 *    hand-curated data seeded offline (no language model produced it) and needs
 *    no credentials, so this list is populated on every install and is what the
 *    section actually shows. Routes generated live land in the same bucket and
 *    are told apart by `isLiveAi`.
 *    It is its own query, separate from the main browse list, so either one
 *    failing leaves the other on screen.
 *  - `isGenerationEnabled` reflects the backend switch for LIVE generation. It
 *    only gates the "generate one for me" button. When the switch is off the
 *    section still renders its catalogue — the feature degrades to read-only
 *    rather than disappearing.
 */
export function useAiRoutesViewModel(userLocation: { lat: number; lng: number } | null) {
  const {
    profileId: activeProfileId,
    isReady: profileReady,
    isError: profileFailed,
  } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['aiRouteStatus'],
    queryFn: getAiRouteStatus,
    // The switch is deployment configuration, not user data: it changes when the
    // server restarts, so there is no value in refetching it on every focus.
    staleTime: Infinity,
    retry: false,
  });

  const filters = {
    createdBy: 'ai' as const,
    ...(activeProfileId != null ? { mobilityProfileId: activeProfileId } : {}),
  };

  const { data, error, refetch } = useQuery({
    queryKey: ['routes', filters],
    queryFn: () => getRoutes(filters),
    // Scored without the profile every card would read as the pedestrian's
    // "accessible · 100%". A failed profile is shown by the main list's error
    // state; the strip just stays empty.
    enabled: profileReady,
  });

  const generateMutation = useMutation({
    mutationFn: (prompt?: string) => {
      if (!userLocation) {
        throw new Error('Location is not available yet');
      }
      return generateRoute({
        lat: userLocation.lat,
        lng: userLocation.lng,
        mobilityProfileId: activeProfileId ?? undefined,
        prompt,
      });
    },
    onSuccess: () => {
      // A generated route is a normal row, so every list that could contain it
      // is now stale — including the main browse list, which is unfiltered.
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  return {
    routes: (data ?? []) as Route[],
    isLoading: data === undefined && error == null && !profileFailed,
    refetch,

    isGenerationEnabled: status?.enabled === true,
    generate: (prompt?: string): Promise<RouteDetail> =>
      generateMutation.mutateAsync(prompt),
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error as Error | null,
    resetGenerateError: generateMutation.reset,
  };
}
