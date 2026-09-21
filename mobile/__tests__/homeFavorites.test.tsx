import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../src/services/favoriteService', () => ({
  getFavorites: jest.fn(),
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
}));
const mockProfile = { profileId: 4 as number | undefined, isReady: true };
jest.mock('../src/viewmodels/useActiveProfileId', () => ({
  useActiveProfile: () => ({
    profileId: mockProfile.profileId,
    isReady: mockProfile.isReady,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

import { getFavorites, addFavorite, removeFavorite } from '../src/services/favoriteService';
import { useHomeFavoritesViewModel } from '../src/viewmodels/useHomeFavoritesViewModel';

const mockedGetFavorites = getFavorites as jest.Mock;
const mockedAddFavorite = addFavorite as jest.Mock;
const mockedRemoveFavorite = removeFavorite as jest.Mock;

function renderViewModel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  const result: { current: ReturnType<typeof useHomeFavoritesViewModel> | null } = { current: null };
  function Probe() {
    result.current = useHomeFavoritesViewModel();
    return null;
  }
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return { vm: result, client };
}

const flush = () => ReactTestRenderer.act(async () => { await new Promise<void>(r => setTimeout(r, 10)); });

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) {
    await flush();
  }
}

describe('useHomeFavoritesViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.profileId = 4;
    mockProfile.isReady = true;
    mockedGetFavorites.mockResolvedValue([{ id: 7 }]);
    mockedAddFavorite.mockResolvedValue(undefined);
    mockedRemoveFavorite.mockResolvedValue(undefined);
  });

  it('reads favorites for the active profile under the shared cache key', async () => {
    const { vm, client } = renderViewModel();
    await waitFor(() => vm.current!.favoriteIds.size > 0);
    expect(mockedGetFavorites).toHaveBeenCalledWith(4);
    expect(vm.current!.favoriteIds.has(7)).toBe(true);
    expect(client.getQueryData(['favorites', 4])).toEqual([{ id: 7 }]);
  });

  it('removes a favorited route and adds one that is not', async () => {
    const { vm } = renderViewModel();
    await waitFor(() => vm.current!.favoriteIds.size > 0);

    ReactTestRenderer.act(() => vm.current!.toggleFavorite(7));
    await waitFor(() => mockedRemoveFavorite.mock.calls.length > 0);
    expect(mockedRemoveFavorite).toHaveBeenCalledWith(7);

    ReactTestRenderer.act(() => vm.current!.toggleFavorite(9));
    await waitFor(() => mockedAddFavorite.mock.calls.length > 0);
    expect(mockedAddFavorite).toHaveBeenCalledWith(9);
  });

  it('does not fetch favorites before the profile is known', async () => {
    mockProfile.profileId = undefined;
    mockProfile.isReady = false;
    renderViewModel();
    await flush();
    expect(mockedGetFavorites).not.toHaveBeenCalled();
  });

  it('shows the tapped state at once and ignores a second tap while pending', async () => {
    let resolveAdd: () => void = () => {};
    mockedAddFavorite.mockImplementation(
      () => new Promise<void>(resolve => { resolveAdd = resolve; }),
    );
    const { vm } = renderViewModel();
    await waitFor(() => vm.current!.favoriteIds.size > 0);

    ReactTestRenderer.act(() => {
      vm.current!.toggleFavorite(9);
      vm.current!.toggleFavorite(9);
    });
    await waitFor(() => vm.current!.pendingIds.has(9));
    // A tap after the re-render is ignored too.
    ReactTestRenderer.act(() => vm.current!.toggleFavorite(9));
    await flush();

    expect(mockedAddFavorite).toHaveBeenCalledTimes(1);
    expect(vm.current!.favoriteIds.has(9)).toBe(true);
    expect(vm.current!.pendingIds.has(9)).toBe(true);

    mockedGetFavorites.mockResolvedValue([{ id: 7 }, { id: 9 }]);
    await ReactTestRenderer.act(async () => { resolveAdd(); });
    await waitFor(() => !vm.current!.pendingIds.has(9));
    expect(vm.current!.favoriteIds.has(9)).toBe(true);
  });

  it('falls back to the server state when the toggle fails', async () => {
    mockedAddFavorite.mockRejectedValue(new Error('network'));
    const { vm } = renderViewModel();
    await waitFor(() => vm.current!.favoriteIds.size > 0);

    ReactTestRenderer.act(() => vm.current!.toggleFavorite(9));
    await waitFor(() => mockedAddFavorite.mock.calls.length > 0 && !vm.current!.pendingIds.has(9));
    expect(vm.current!.favoriteIds.has(9)).toBe(false);
  });
});
