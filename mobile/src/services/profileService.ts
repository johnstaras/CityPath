import api from './api';
import { MobilityProfile } from '../models';

export interface ProfileData {
  ageGroup: string;
  mobilityProfiles: MobilityProfile[];
}

export interface ProfileStats {
  completedRoutes: number;
  totalDistanceMeters: number;
  favoritesCount: number;
  ratingsCount: number;
}

export async function getMobilityProfiles(): Promise<MobilityProfile[]> {
  const { data } = await api.get('/mobility-profiles');
  return data;
}

export async function getProfile(): Promise<ProfileData> {
  const { data } = await api.get('/profile');
  return data;
}

export async function updateProfile(payload: {
  ageGroup?: string;
  mobilityProfileIds?: number[];
}): Promise<ProfileData> {
  const { data } = await api.put('/profile', payload);
  return data;
}

export async function getStats(): Promise<ProfileStats> {
  const { data } = await api.get('/profile/stats');
  return data;
}
