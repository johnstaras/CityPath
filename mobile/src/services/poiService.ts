import api from './api';
import { POI, POIRating } from '../models';

// Mirrors server poiRepository.getAverageRating. With no ratings the averages
// come back as 0 (COALESCE), so `count` is what tells "unrated" apart.
export interface POIRatingStats {
  avgRating: number;
  avgAccessibilityRating: number;
  count: number;
}

export interface POIDetail extends POI {
  ratingStats: POIRatingStats;
  reviews: POIRating[];
}

export interface RatePOIData {
  rating: number;
  accessibilityRating: number;
  comment?: string;
}

export async function getPOI(id: number): Promise<POIDetail> {
  const { data } = await api.get<POIDetail>(`/pois/${id}`);
  return data;
}

export async function ratePOI(poiId: number, ratingData: RatePOIData): Promise<void> {
  await api.post(`/pois/${poiId}/rate`, ratingData);
}
