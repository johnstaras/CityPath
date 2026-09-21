import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../src/services/routeService', () => ({ getRouteById: jest.fn() }));
jest.mock('../src/services/profileService', () => ({ getProfile: jest.fn() }));
jest.mock('../src/services/favoriteService', () => ({
  getFavorites: jest.fn(),
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
}));
jest.mock('../src/utils/permissions', () => ({ ensureLocationPermission: jest.fn() }));
jest.mock('react-native-geolocation-service', () => ({ getCurrentPosition: jest.fn() }));

import { getRouteById } from '../src/services/routeService';
import { getProfile } from '../src/services/profileService';
import { getFavorites } from '../src/services/favoriteService';
import { useRouteDetailsViewModel } from '../src/viewmodels/useRouteDetailsViewModel';

const mockedGetRoute = getRouteById as jest.Mock;
const mockedGetProfile = getProfile as jest.Mock;
const mockedGetFavorites = getFavorites as jest.Mock;

type VM = ReturnType<typeof useRouteDetailsViewModel>;

const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    renderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function renderViewModel(routeId = 129) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const result: { current: VM | null } = { current: null };
  function Probe() {
    result.current = useRouteDetailsViewModel(routeId);
    return null;
  }
  ReactTestRenderer.act(() => {
    renderers.push(ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ));
  });
  return result;
}

const flush = () =>
  ReactTestRenderer.act(async () => {
    await new Promise<void>(r => setTimeout(r, 10));
  });

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 80 && !check(); i++) {
    await flush();
  }
}

function httpError(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status },
  });
}

describe('useRouteDetailsViewModel load states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetProfile.mockResolvedValue({ ageGroup: 'adult', mobilityProfiles: [{ id: 2, speedFactor: 0.7 }] });
    mockedGetFavorites.mockResolvedValue([]);
  });

  it('scores the route with the loaded profile, never before it', async () => {
    let resolveProfile: (value: unknown) => void = () => {};
    mockedGetProfile.mockImplementation(() => new Promise(resolve => { resolveProfile = resolve; }));
    mockedGetRoute.mockResolvedValue({ id: 129, title: 'Route' });
    const result = renderViewModel();
    await flush();
    expect(mockedGetRoute).not.toHaveBeenCalled();
    expect(result.current!.isLoading).toBe(true);

    await ReactTestRenderer.act(async () => {
      resolveProfile({ ageGroup: 'adult', mobilityProfiles: [{ id: 2, speedFactor: 0.7 }] });
    });
    await waitFor(() => result.current!.route != null);
    expect(mockedGetRoute).toHaveBeenCalledWith(129, 2);
  });

  it('reports not-found only for a 404, without retrying', async () => {
    mockedGetRoute.mockRejectedValue(httpError(404));
    const result = renderViewModel();
    await waitFor(() => result.current!.error != null);
    expect(result.current!.isNotFound).toBe(true);
    expect(mockedGetRoute).toHaveBeenCalledTimes(1);
  });

  it('treats a network error as retryable, not as a missing route', async () => {
    mockedGetRoute.mockRejectedValue(new Error('Network Error'));
    const result = renderViewModel();
    // The query's own retries (2) run first.
    for (let i = 0; i < 6 && result.current!.error == null; i++) {
      await ReactTestRenderer.act(async () => {
        await new Promise<void>(r => setTimeout(r, 1000));
      });
    }
    expect(result.current!.error).not.toBeNull();
    expect(result.current!.isNotFound).toBe(false);

    mockedGetRoute.mockResolvedValue({ id: 129, title: 'Route' });
    ReactTestRenderer.act(() => result.current!.retry());
    await waitFor(() => result.current!.route != null);
    expect(result.current!.route?.id).toBe(129);
  }, 15000);
});
