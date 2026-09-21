// MaterialCommunityIcons name for a POI's category, shown in place of a photo.
//
// Covers every category present in the `pois` table (`SELECT DISTINCT category
// FROM pois`). Only the curated historical/cultural/nature stops have photos;
// the thousands of OSM places (cafes, pharmacies, "other", ...) never do, so
// this icon is what users actually see for them.
const POI_CATEGORY_ICONS: Record<string, string> = {
  // Curated stops
  historical: 'bank',
  cultural: 'drama-masks',
  nature: 'tree',
  tourism: 'map-marker-star',
  attraction: 'star-circle-outline',
  viewpoint: 'binoculars',
  artwork: 'palette',
  museum: 'pillar',
  gallery: 'image-frame',
  arts_centre: 'palette',
  'food-drink-beauty_gallery': 'image-frame',
  information: 'information-outline',
  place_of_worship: 'hands-pray',
  aquarium: 'fish',
  marketplace: 'store',
  // Food and drink
  cafe: 'coffee',
  internet_cafe: 'laptop',
  restaurant: 'silverware-fork-knife',
  fast_food: 'hamburger',
  ice_cream: 'ice-cream',
  bar: 'glass-cocktail',
  pub: 'beer',
  biergarten: 'beer',
  hookah_lounge: 'glass-cocktail',
  nightclub: 'music',
  // Entertainment
  theatre: 'drama-masks',
  cinema: 'movie-open',
  music_venue: 'music',
  concert_hall: 'music',
  gambling: 'cards-playing-outline',
  // Accommodation
  hotel: 'bed',
  hostel: 'bed',
  guest_house: 'bed',
  apartment: 'bed',
  // Health
  pharmacy: 'medical-bag',
  doctors: 'hospital-box',
  clinic: 'hospital-box',
  hospital: 'hospital-box',
  dentist: 'tooth',
  veterinary: 'paw',
  public_bath: 'shower',
  // Money
  bank: 'cash-multiple',
  atm: 'cash',
  bureau_de_change: 'cash',
  money_transfer: 'cash',
  // Education
  school: 'school',
  college: 'school',
  prep_school: 'school',
  kindergarten: 'school',
  childcare: 'school',
  language_school: 'school',
  music_school: 'school',
  dancing_school: 'school',
  driving_school: 'steering',
  trade_school: 'school',
  training: 'school',
  dojo: 'school',
  library: 'library',
  // Transport
  parking: 'parking',
  fuel: 'gas-station',
  car_rental: 'car',
  car_wash: 'car',
  bicycle_rental: 'bicycle',
  bus_station: 'bus',
  // Public services
  post_office: 'email',
  police: 'police-badge',
  townhall: 'domain',
  courthouse: 'gavel',
  community_centre: 'account-group',
  social_centre: 'account-group',
  social_facility: 'account-group',
  recycling: 'recycle',
};

const DEFAULT_ICON = 'map-marker-outline';

export function getPoiCategoryIcon(category?: string | null): string {
  if (!category) return DEFAULT_ICON;
  // OSM allows several values ("cafe;bar"): the first one names the place.
  const primary = category.split(';')[0].trim();
  return POI_CATEGORY_ICONS[primary] ?? DEFAULT_ICON;
}
