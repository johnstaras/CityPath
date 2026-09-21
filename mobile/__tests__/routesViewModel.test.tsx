import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../src/services/routeService', () => ({ getRoutes: jest.fn() }));
jest.mock('../src/services/profileService', () => ({ getProfile: jest.fn() }));
jest.mock('../src/utils/permissions', () => ({ ensureLocationPermission: jest.fn() }));
jest.mock('react-native-geolocation-service', () => ({ getCurrentPosition: jest.fn() }));

import Geolocation from 'react-native-geolocation-service';
import { getRoutes } from '../src/services/routeService';
import { getProfile } from '../src/services/profileService';
import { ensureLocationPermission } from '../src/utils/permissions';
import { useRoutesViewModel, SEARCH_DEBOUNCE_MS } from '../src/viewmodels/useRoutesViewModel';

const mockedGetRoutes = getRoutes as jest.Mock;
const mockedGetProfile = getProfile as jest.Mock;
const mockedPermission = ensureLocationPermission as jest.Mock;
const mockedPosition = Geolocation.getCurrentPosition as jest.Mock;

type VM = ReturnType<typeof useRoutesViewModel>;

const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(async () => {
  // Unmount so pending timers (search debounce) and fetches do not update a
  // component after its test has finished.
  await ReactTestRenderer.act(async () => {
    renderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function renderViewModel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const result: { current: VM | null } = { current: null };
  function Probe() {
    result.current = useRoutesViewModel();
    return null;
  }
  ReactTestRenderer.act(() => {
    renderers.push(ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ));
  });
  return { result, client };
}

const flush = (ms = 10) =>
  ReactTestRenderer.act(async () => {
    await new Promise<void>(r => setTimeout(r, ms));
  });

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 60 && !check(); i++) {
    await flush();
  }
}

describe('useRoutesViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedPermission.mockResolvedValue(true);
    mockedGetProfile.mockResolvedValue({ ageGroup: 'adult', mobilityProfiles: [{ id: 4, speedFactor: 0.5 }] });
    mockedGetRoutes.mockResolvedValue([{ id: 1, title: 'A' }]);
  });

  it('waits for the location attempt and the profile before fetching', async () => {
    let deliverPosition: (() => void) | null = null;
    mockedPosition.mockImplementation(success => {
      deliverPosition = () => success({ coords: { latitude: 37.98, longitude: 23.73 } });
    });
    const { result } = renderViewModel();
    await waitFor(() => deliverPosition != null);
    await flush(30);

    expect(mockedGetRoutes).not.toHaveBeenCalled();
    expect(result.current!.isLoading).toBe(true);

    ReactTestRenderer.act(() => deliverPosition!());
    await waitFor(() => result.current!.routes.length > 0);

    expect(mockedGetRoutes).toHaveBeenCalledTimes(1);
    expect(mockedGetRoutes).toHaveBeenCalledWith(
      expect.objectContaining({ mobilityProfileId: 4, lat: 37.98, lng: 23.73 }),
    );
  });

  it('falls back to Athens when permission is denied, then fetches', async () => {
    mockedPermission.mockResolvedValue(false);
    const { result } = renderViewModel();
    await waitFor(() => result.current!.routes.length > 0);
    expect(mockedGetRoutes).toHaveBeenCalledWith(
      expect.objectContaining({ mobilityProfileId: 4, lat: 37.9755, lng: 23.7348 }),
    );
  });

  it('shows an error, not pedestrian scores, when the profile fails', async () => {
    mockedPermission.mockResolvedValue(false);
    mockedGetProfile.mockRejectedValue(new Error('profile down'));
    const { result } = renderViewModel();
    await waitFor(() => result.current!.error != null);

    expect(result.current!.error?.message).toBe('profile down');
    expect(result.current!.isLoading).toBe(false);
    expect(mockedGetRoutes).not.toHaveBeenCalled();

    // Retry reloads the profile, and the list follows.
    mockedGetProfile.mockResolvedValue({ ageGroup: 'adult', mobilityProfiles: [{ id: 5, speedFactor: 0.4 }] });
    ReactTestRenderer.act(() => result.current!.refetch());
    await waitFor(() => result.current!.routes.length > 0);
    expect(mockedGetRoutes).toHaveBeenCalledWith(expect.objectContaining({ mobilityProfileId: 5 }));
  });

  it('debounces search and keeps the current list while the new one loads', async () => {
    mockedPermission.mockResolvedValue(false);
    const { result } = renderViewModel();
    await waitFor(() => result.current!.routes.length > 0);
    expect(mockedGetRoutes).toHaveBeenCalledTimes(1);

    let resolveSearch: (routes: unknown[]) => void = () => {};
    mockedGetRoutes.mockImplementation(
      () => new Promise(resolve => { resolveSearch = resolve; }),
    );
    ReactTestRenderer.act(() => result.current!.setSearchQuery('p'));
    ReactTestRenderer.act(() => result.current!.setSearchQuery('pl'));
    ReactTestRenderer.act(() => result.current!.setSearchQuery('plaka'));
    await flush(SEARCH_DEBOUNCE_MS / 2);
    expect(mockedGetRoutes).toHaveBeenCalledTimes(1);

    await waitFor(() => mockedGetRoutes.mock.calls.length > 1);
    expect(mockedGetRoutes).toHaveBeenCalledTimes(2);
    expect(mockedGetRoutes).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'plaka' }));

    // Previous list stays; no skeletons and no pull-to-refresh spinner.
    expect(result.current!.routes.map(r => r.id)).toEqual([1]);
    expect(result.current!.isLoading).toBe(false);
    expect(result.current!.isRefreshing).toBe(false);

    await ReactTestRenderer.act(async () => { resolveSearch([{ id: 2, title: 'Plaka' }]); });
    await waitFor(() => result.current!.routes[0]?.id === 2);
    expect(result.current!.routes.map(r => r.id)).toEqual([2]);
  });

  it('shows the refresh spinner only for a pull-to-refresh', async () => {
    mockedPermission.mockResolvedValue(false);
    const { result } = renderViewModel();
    await waitFor(() => result.current!.routes.length > 0);

    let resolveRefresh: (routes: unknown[]) => void = () => {};
    mockedGetRoutes.mockImplementation(
      () => new Promise(resolve => { resolveRefresh = resolve; }),
    );
    ReactTestRenderer.act(() => { result.current!.refresh(); });
    await flush();
    expect(result.current!.isRefreshing).toBe(true);

    await ReactTestRenderer.act(async () => { resolveRefresh([{ id: 1, title: 'A' }]); });
    await waitFor(() => !result.current!.isRefreshing);
    expect(result.current!.isRefreshing).toBe(false);
  });
});
