import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPOI, ratePOI, POIDetail, RatePOIData } from '../services/poiService';
import { POIRating } from '../models';
import { logPOIRated } from '../services/firebaseService';

export function usePOIViewModel(poiId: number) {
  const queryClient = useQueryClient();

  const {
    data: poi,
    isLoading,
    error,
  } = useQuery<POIDetail>({
    queryKey: ['poi', poiId],
    queryFn: () => getPOI(poiId),
  });

  const rateMutation = useMutation({
    mutationFn: (data: RatePOIData) => ratePOI(poiId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['poi', poiId] });
      // The profile screen counts the user's ratings.
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
      logPOIRated(poiId, variables.rating).catch(() => {});
    },
  });

  // null means "no ratings yet" — the server reports 0 averages in that case.
  const rating = poi && poi.ratingStats.count > 0
    ? {
        average: poi.ratingStats.avgRating,
        averageAccessibility: poi.ratingStats.avgAccessibilityRating,
        count: poi.ratingStats.count,
      }
    : null;

  const reviews: POIRating[] = poi?.reviews ?? [];

  return {
    poi: poi ?? null,
    isLoading,
    error,
    rating,
    reviews,
    submitRating: rateMutation.mutate,
    isSubmitting: rateMutation.isPending,
  };
}
