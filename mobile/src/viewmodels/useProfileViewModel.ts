import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMobilityProfiles,
  getProfile,
  updateProfile,
  getStats,
} from '../services/profileService';
import { MobilityProfile } from '../models';

/**
 * Whether any selected profile is scored for step-free access (steps on the
 * route make it "not accessible"). Only then is the accessibility note true.
 */
export function hasStepFreeSelection(
  profiles: MobilityProfile[],
  selectedIds: number[],
): boolean {
  return profiles.some(
    p => selectedIds.includes(p.id) && (p.avoidStairs || p.requiresRamps),
  );
}

export function useProfileViewModel() {
  const queryClient = useQueryClient();

  const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('');

  const mobilityProfilesQuery = useQuery({
    queryKey: ['mobilityProfiles'],
    queryFn: getMobilityProfiles,
  });

  // Same options as useActiveProfile (useActiveProfileId.ts): the app-wide
  // defaults, retry included. Observers of one key must agree, or whichever
  // mounts first decides the retries.
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const statsQuery = useQuery({
    queryKey: ['profileStats'],
    queryFn: getStats,
    staleTime: 2 * 60 * 1000, // 2 min — invalidated explicitly when favorites/profile change
  });

  // Sync local state when profile data loads
  useEffect(() => {
    if (profileQuery.data) {
      setSelectedProfileIds(
        profileQuery.data.mobilityProfiles.map(mp => mp.id),
      );
      setSelectedAgeGroup(profileQuery.data.ageGroup ?? '');
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
    },
  });

  function toggleProfile(id: number) {
    setSelectedProfileIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id],
    );
  }

  async function saveProfile() {
    await saveMutation.mutateAsync({
      ageGroup: selectedAgeGroup || undefined,
      mobilityProfileIds:
        selectedProfileIds.length > 0 ? selectedProfileIds : undefined,
    });
  }

  return {
    mobilityProfiles: mobilityProfilesQuery.data ?? [],
    profile: profileQuery.data ?? null,
    stats: statsQuery.data ?? null,
    statsError: statsQuery.error as Error | null,
    refetchStats: statsQuery.refetch,
    isStatsRefreshing: statsQuery.isFetching,
    isLoading:
      mobilityProfilesQuery.isLoading ||
      profileQuery.isLoading ||
      statsQuery.isLoading,
    selectedProfileIds,
    showsStepFreeNote: hasStepFreeSelection(
      mobilityProfilesQuery.data ?? [],
      selectedProfileIds,
    ),
    toggleProfile,
    selectedAgeGroup,
    setSelectedAgeGroup,
    saveProfile,
    isSaving: saveMutation.isPending,
  };
}
