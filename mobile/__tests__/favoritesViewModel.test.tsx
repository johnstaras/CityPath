import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../src/services/favoriteService', () => ({
  getFavorites: jest.fn(),
  removeFavorite: jest.fn(),
}));
jest.mock('../src/services/profileService', () => ({
  getProfile: jest.fn(),
}));

import { getFavorites, removeFavorite } from '../src/services/favoriteService';
import { getProfile } from '../src/services/profileService';
import { useFavoritesViewModel } from '../src/viewmodels/useFavoritesViewModel';

const mockedGetFavorites = getFavorites as jest.Mock;
const mockedRemoveFavorite = removeFavorite as jest.Mock;
const mockedGetProfile = getProfile as jest.Mock;

function renderViewModel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const result: { current: ReturnType<typeof useFavoritesViewModel> | null } = { current: null };
  function Probe() {
    result.current = useFavoritesViewModel();
    return null;
  }
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return { result, client };
}

const flush = () =>
  ReactTestRenderer.act(async () => {
    await new Promise<void>(r => setTimeout(r, 10));
  });

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) {
    await flush();
  }
}

describe('useFavoritesViewModel removal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetProfile.mockResolvedValue({ mobilityProfiles: [{ id: 4, speedFactor: 0.7 }] });
  });

  it('removes the route from the rendered list before the server answers', async () => {
    mockedGetFavorites.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    let resolveRemove: () => void = () => {};
    mockedRemoveFavorite.mockImplementation(
      () => new Promise<void>(resolve => { resolveRemove = resolve; }),
    );
    const { result, client } = renderViewModel();
    await waitFor(() => result.current!.favorites.length === 2 && mockedGetFavorites.mock.calls.some(c => c[0] === 4));
    await waitFor(() => client.getQueryData(['favorites', 4]) !== undefined);
    expect(result.current!.favorites.map(r => r.id)).toEqual([1, 2]);

    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    ReactTestRenderer.act(() => result.current!.removeFavorite(1));
    await waitFor(() => result.current!.favorites.length === 1);

    // Still pending on the server, yet the list already updated.
    expect(result.current!.isRemoving).toBe(true);
    expect(result.current!.favorites.map(r => r.id)).toEqual([2]);

    await ReactTestRenderer.act(async () => { resolveRemove(); });
    await waitFor(() => !result.current!.isRemoving);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['favorites'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profileStats'] });
  });

  it('rolls the exact list entry back when removal fails', async () => {
    mockedGetFavorites.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockedRemoveFavorite.mockRejectedValue(new Error('network'));
    const { result, client } = renderViewModel();
    await waitFor(() => client.getQueryData(['favorites', 4]) !== undefined);
    // Make the refetch after settle hang so we observe the rollback itself.
    mockedGetFavorites.mockImplementation(() => new Promise(() => {}));

    ReactTestRenderer.act(() => result.current!.removeFavorite(1));
    await waitFor(() => !result.current!.isRemoving && mockedRemoveFavorite.mock.calls.length > 0);

    expect(client.getQueryData(['favorites', 4])).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current!.favorites.map(r => r.id)).toEqual([1, 2]);
    expect(client.getQueryData(['favorites'])).toBeUndefined();
  });
});
