import type { ImageURISource } from 'react-native';

// Wikimedia Commons (upload.wikimedia.org) answers 403 to requests without a
// descriptive User-Agent, and React Native's Android image loader sends only
// okhttp's default one. Every remote photo goes through this helper so the
// header is set in one place.
export const IMAGE_USER_AGENT =
  'CityPaths/1.0 (University of Piraeus diploma thesis app; https://github.com/johnstaras/CityPath)';

export function remoteImageSource(uri: string): ImageURISource {
  return { uri, headers: { 'User-Agent': IMAGE_USER_AGENT } };
}
