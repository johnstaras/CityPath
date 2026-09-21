import { useQuery } from '@tanstack/react-query';
import { getProfile, ProfileData } from '../services/profileService';

export interface ActiveProfile {
  /** Most restrictive selected profile, or undefined when none is selected. */
  profileId: number | undefined;
  /**
   * True once the user's profile has loaded. Scored queries must wait for it:
   * without a profile id the server scores as a pedestrian, so firing early
   * (or after a failure) shows every route as "accessible · 100%".
   */
  isReady: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

function mostRestrictiveProfileId(data: ProfileData | undefined): number | undefined {
  return data?.mobilityProfiles?.length
    ? [...data.mobilityProfiles].sort((a, b) => a.speedFactor - b.speedFactor)[0].id
    : undefined;
}

/**
 * The user's mobility profile drives accessibility scoring. Score against the
 * most restrictive selected profile (lowest speedFactor = worst case).
 *
 * Uses the same ['profile'] query as useProfileViewModel, with the same
 * options (the app-wide defaults: retry 2), so every observer of the cache key
 * behaves identically.
 */
export function useActiveProfile(): ActiveProfile {
  const { data, error, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  // A failed background refetch keeps the profile we already have: that is
  // still the right one to score with, so only a profile never loaded counts.
  const hasProfile = data !== undefined;
  return {
    profileId: mostRestrictiveProfileId(data),
    isReady: hasProfile,
    isError: !hasProfile && error != null,
    error: hasProfile ? null : (error as Error | null),
    refetch,
  };
}

/** The active profile id alone, for callers that do not gate on readiness. */
export function useActiveProfileId(): number | undefined {
  return useActiveProfile().profileId;
}
