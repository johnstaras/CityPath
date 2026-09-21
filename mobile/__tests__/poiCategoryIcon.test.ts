import { getPoiCategoryIcon } from '../src/utils/poiCategoryIcon';

const glyphs: Record<string, number> = require('react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');

describe('getPoiCategoryIcon', () => {
  it('has a specific icon for the common photo-less categories', () => {
    expect(getPoiCategoryIcon('cafe')).toBe('coffee');
    expect(getPoiCategoryIcon('restaurant')).toBe('silverware-fork-knife');
    expect(getPoiCategoryIcon('pharmacy')).toBe('medical-bag');
    expect(getPoiCategoryIcon('viewpoint')).toBe('binoculars');
    expect(getPoiCategoryIcon('historical')).toBe('bank');
  });

  it('uses the first of several OSM values', () => {
    expect(getPoiCategoryIcon('cafe;bar')).toBe('coffee');
  });

  it('falls back to a generic place marker', () => {
    expect(getPoiCategoryIcon('other')).toBe('map-marker-outline');
    expect(getPoiCategoryIcon(undefined)).toBe('map-marker-outline');
  });

  it('only uses icon names that exist in MaterialCommunityIcons', () => {
    const categories = ['historical', 'cultural', 'nature', 'cafe', 'restaurant', 'pharmacy',
      'fast_food', 'hotel', 'artwork', 'bar', 'information', 'bank', 'attraction', 'gallery',
      'museum', 'theatre', 'hostel', 'ice_cream', 'cinema', 'doctors', 'nightclub',
      'post_office', 'atm', 'fuel', 'tourism', 'library', 'pub', 'veterinary', 'viewpoint',
      'parking', 'place_of_worship', 'school', 'bus_station', 'police', 'townhall',
      'courthouse', 'recycling', 'public_bath', 'aquarium', 'gambling', 'driving_school',
      'community_centre', 'other'];
    for (const category of categories) {
      expect(glyphs[getPoiCategoryIcon(category)]).toBeDefined();
    }
  });
});
