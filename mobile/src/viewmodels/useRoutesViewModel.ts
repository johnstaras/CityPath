import { useState, useEffect, useCallback } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getRoutes, RouteFilters } from '../services/routeService';
import { useActiveProfile } from './useActiveProfileId';
import { ensureLocationPermission } from '../utils/permissions';
import { Route } from '../models';

export type TimeFilter = null | '60' | '120' | '180+';
export type CategoryFilter = null | 'historical' | 'cultural' | 'nature';

// Athens centre: used when location is denied or unavailable.
const FALLBACK_LOCATION = { lat: 37.9755, lng: 23.7348 };

/** Typing pause before a search request is sent. */
export const SEARCH_DEBOUNCE_MS = 300;

export function useRoutesViewModel() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  // True once the location attempt has finished, with a fix or the fallback.
  // The list waits for it: a request sent before would be unsorted by distance
  // and immediately replaced by a second one.
  const [locationResolved, setLocationResolved] = useState(false);
  // Only a pull-to-refresh shows the refresh spinner, not background refetches
  // caused by a filter change or a cache invalidation.
  const [isUserRefreshing, setIsUserRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolve = (location: { lat: number; lng: number }) => {
      if (cancelled) return;
      setUserLocation(location);
      setLocationResolved(true);
    };

    (async () => {
      try {
        const granted = await ensureLocationPermission();
        if (!granted) {
          resolve(FALLBACK_LOCATION);
          return;
        }
        Geolocation.getCurrentPosition(
          position =>
            resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          geoError => {
            console.warn('Geolocation error:', geoError.message);
            // e.g. emulator without GPS
            resolve(FALLBACK_LOCATION);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
        );
      } catch (err) {
        console.warn('Location permission error:', err);
        resolve(FALLBACK_LOCATION);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const profile = useActiveProfile();
  const { isError: profileFailed, refetch: refetchProfile } = profile;

  const filters: RouteFilters = {};
  // Only send location filter if user is near Athens (not emulator default location)
  // Emulator defaults to Mountain View, CA which would return no results
  if (userLocation && userLocation.lat > 37.5 && userLocation.lng > 20) {
    filters.lat = userLocation.lat;
    filters.lng = userLocation.lng;
  }
  if (profile.profileId != null) {
    filters.mobilityProfileId = profile.profileId;
  }
  if (timeFilter) {
    filters.time = timeFilter;
  }
  if (categoryFilter) {
    filters.category = categoryFilter;
  }
  if (debouncedSearch) {
    filters.q = debouncedSearch;
  }

  const {
    data,
    error: routesError,
    refetch: refetchRoutes,
  } = useQuery({
    queryKey: ['routes', filters],
    retry: 1,
    queryFn: () => getRoutes(filters),
    // Without the profile the server scores as a pedestrian, which would show
    // every route as accessible to, say, a wheelchair user.
    enabled: locationResolved && profile.isReady,
    // A new filter or search keeps the current list on screen until the new
    // one arrives, instead of dropping back to skeletons.
    placeholderData: keepPreviousData,
  });

  // A failed profile is an error of this screen too: scores without it would
  // be silently wrong.
  const error = profile.isError ? profile.error : routesError;

  // TanStack Query v5 dropped the onError option on useQuery, so surface fetch
  // failures from the returned error instead. Network errors have no response,
  // which is what a wrong API_URL host looks like from here.
  useEffect(() => {
    if (!error) return;
    const err = error as any;
    console.error(
      'ROUTES FETCH ERROR:',
      err?.message,
      err?.config?.url,
      err?.response?.status ?? 'no response',
    );
  }, [error]);

  const refetch = useCallback(() => {
    if (profileFailed) {
      refetchProfile();
    } else {
      refetchRoutes();
    }
  }, [profileFailed, refetchProfile, refetchRoutes]);

  const refresh = useCallback(async () => {
    setIsUserRefreshing(true);
    try {
      await (profileFailed ? refetchProfile() : refetchRoutes());
    } finally {
      setIsUserRefreshing(false);
    }
  }, [profileFailed, refetchProfile, refetchRoutes]);

  return {
    routes: (data ?? []) as Route[],
    // Also true while waiting for location and profile, so the list shows
    // skeletons rather than "no routes".
    isLoading: data === undefined && error == null,
    isRefreshing: isUserRefreshing,
    error,
    timeFilter,
    setTimeFilter,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    userLocation,
    refetch,
    refresh,
  };
}
