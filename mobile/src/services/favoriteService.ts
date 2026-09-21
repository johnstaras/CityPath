import api from './api';
import { Route } from '../models';

interface FavoriteResponse {
  createdAt: string;
  route: Route;
}

export async function getFavorites(mobilityProfileId?: number): Promise<Route[]> {
  const params: Record<string, number> = {};
  if (mobilityProfileId != null) params.mobilityProfileId = mobilityProfileId;
  const { data } = await api.get<FavoriteResponse[] | Route[]>('/favorites', { params });
  // API may return { createdAt, route } wrapper or flat Route[]
  if (data.length > 0 && 'route' in data[0]) {
    return (data as FavoriteResponse[]).map(f => f.route);
  }
  return data as Route[];
}

export async function addFavorite(routeId: number): Promise<void> {
  await api.post(`/favorites/${routeId}`);
}

export async function removeFavorite(routeId: number): Promise<void> {
  await api.delete(`/favorites/${routeId}`);
}
