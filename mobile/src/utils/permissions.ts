import { Platform, PermissionsAndroid } from 'react-native';
import i18n from 'i18next';

// Before i18n is initialised (plain unit tests) the English text is used.
function translate(key: string, fallback: string): string {
  if (!i18n.isInitialized) return fallback;
  const value = i18n.t(key);
  return typeof value === 'string' && value !== key ? value : fallback;
}

/**
 * Resolves true when fine-location access is available.
 *
 * The rationale dialog is worded from the `permissions.*` i18n keys in the
 * active UI language. The optional argument is accepted and ignored so older
 * call sites that still pass an (English) message keep compiling.
 *
 * Always check() before request(): check() works without an attached
 * Activity, while request() throws "Tried to use permissions API while not
 * attached to an Activity" under the New Architecture right after a reload —
 * which would abort route tracking even though permission is already granted.
 */
export async function ensureLocationPermission(..._ignored: unknown[]): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // iOS permissions are handled via Info.plist
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

  if (await PermissionsAndroid.check(permission)) {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(permission, {
      title: translate('permissions.locationTitle', 'Location permission'),
      message: translate(
        'permissions.locationMessage',
        'CityPaths uses your location to find routes near you and show where you are on a route.',
      ),
      buttonPositive: translate('permissions.allow', 'Allow'),
      buttonNegative: translate('permissions.deny', 'Not now'),
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return PermissionsAndroid.check(permission);
  }
}
