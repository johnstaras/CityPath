import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { planBackToStackRoot } from '../src/navigation/stackRoot';

jest.mock('../src/services/favoriteService', () => ({
  getFavorites: jest.fn(),
  addFavorite: jest.fn(),
}));
jest.mock('../src/services/poiService', () => ({
  ratePOI: jest.fn(),
}));

import { getFavorites, addFavorite } from '../src/services/favoriteService';
import { ratePOI } from '../src/services/poiService';
import { useRouteSummaryViewModel } from '../src/viewmodels/useRouteSummaryViewModel';

const mockedGetFavorites = getFavorites as jest.Mock;
const mockedAddFavorite = addFavorite as jest.Mock;
const mockedRatePOI = ratePOI as jest.Mock;

const route = { id: 7, title: 'Historic Center Walk' } as any;

function renderViewModel() {
  return renderViewModelWithClient().result;
}

function renderViewModelWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  const result: { current: ReturnType<typeof useRouteSummaryViewModel> | null } = { current: null };
  function Probe() {
    result.current = useRouteSummaryViewModel(route);
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

const flush = () => ReactTestRenderer.act(async () => { await new Promise<void>(r => setTimeout(r, 10)); });

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) {
    await flush();
  }
}

describe('useRouteSummaryViewModel favorite state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('reports a route that is already a favorite as saved without calling add', async () => {
    mockedGetFavorites.mockResolvedValue([{ id: 7 }, { id: 3 }]);
    const vm = renderViewModel();
    expect(vm.current!.isFavoriteLoading).toBe(true);
    await waitFor(() => !vm.current!.isFavoriteLoading);
    expect(vm.current!.isFavoriteLoading).toBe(false);
    expect(vm.current!.isFavorite).toBe(true);

    let ok: boolean | undefined;
    await ReactTestRenderer.act(async () => { ok = await vm.current!.saveFavorite(); });
    expect(ok).toBe(true);
    expect(mockedAddFavorite).not.toHaveBeenCalled();
  });

  it('offers saving a non-favorite and flips to saved after success', async () => {
    mockedGetFavorites.mockResolvedValueOnce([{ id: 3 }]).mockResolvedValue([{ id: 3 }, { id: 7 }]);
    mockedAddFavorite.mockResolvedValue(undefined);
    const vm = renderViewModel();
    await waitFor(() => !vm.current!.isFavoriteLoading);
    expect(vm.current!.isFavorite).toBe(false);

    let ok: boolean | undefined;
    await ReactTestRenderer.act(async () => { ok = await vm.current!.saveFavorite(); });
    await flush();
    expect(ok).toBe(true);
    await waitFor(() => vm.current!.isFavorite);
    expect(mockedAddFavorite).toHaveBeenCalledWith(7);
    expect(vm.current!.isFavorite).toBe(true);
  });

  it('refreshes the profile stats after saving a favorite and rating a stop', async () => {
    mockedGetFavorites.mockResolvedValue([]);
    mockedAddFavorite.mockResolvedValue(undefined);
    mockedRatePOI.mockResolvedValue(undefined);
    const { result: vm, client } = renderViewModelWithClient();
    await waitFor(() => !vm.current!.isFavoriteLoading);
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    await ReactTestRenderer.act(async () => { await vm.current!.saveFavorite(); });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profileStats'] });

    invalidateSpy.mockClear();
    await ReactTestRenderer.act(async () => { await vm.current!.rate(11, 4); });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profileStats'] });
  });

  it('returns false on a failed save and stays unsaved', async () => {
    mockedGetFavorites.mockResolvedValue([]);
    mockedAddFavorite.mockRejectedValue(new Error('network'));
    const vm = renderViewModel();
    await waitFor(() => !vm.current!.isFavoriteLoading);

    let ok: boolean | undefined;
    await ReactTestRenderer.act(async () => { ok = await vm.current!.saveFavorite(); });
    await flush();
    expect(ok).toBe(false);
    expect(vm.current!.isFavorite).toBe(false);
  });
});

describe('planBackToStackRoot', () => {
  it('pops to the top when the stack starts at its first screen (Favorites flow)', () => {
    expect(
      planBackToStackRoot({
        routeNames: ['FavoritesList', 'RouteDetails', 'ActiveRoute', 'RouteSummary'],
        routes: [{ name: 'FavoritesList' }, { name: 'RouteDetails' }, { name: 'RouteSummary' }],
      }),
    ).toEqual({ type: 'popToTop' });
  });

  it('resets to the first screen when the stack bottom is a nested screen', () => {
    expect(
      planBackToStackRoot({
        routeNames: ['HomeMain', 'RouteDetails', 'ActiveRoute', 'RouteSummary'],
        routes: [{ name: 'RouteDetails' }, { name: 'RouteSummary' }],
      }),
    ).toEqual({ type: 'reset', rootName: 'HomeMain' });
  });
});
