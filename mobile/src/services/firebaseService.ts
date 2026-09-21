import { Platform, PermissionsAndroid } from 'react-native';

// Lazy-load Firebase modules to prevent crashes if not configured
let analyticsModule: any = null;
let messagingModule: any = null;
let crashlyticsModule: any = null;

function getAnalytics() {
  if (!analyticsModule) {
    try {
      analyticsModule = require('@react-native-firebase/analytics').default;
    } catch (e) {
      console.warn('Firebase Analytics not available');
    }
  }
  return analyticsModule;
}

function getMessaging() {
  if (!messagingModule) {
    try {
      messagingModule = require('@react-native-firebase/messaging').default;
    } catch (e) {
      console.warn('Firebase Messaging not available');
    }
  }
  return messagingModule;
}

function getCrashlytics() {
  if (!crashlyticsModule) {
    try {
      crashlyticsModule = require('@react-native-firebase/crashlytics').default;
    } catch (e) {
      console.warn('Firebase Crashlytics not available');
    }
  }
  return crashlyticsModule;
}

// --- Crashlytics ---

export function initCrashlytics() {
  try {
    const crashlytics = getCrashlytics();
    if (crashlytics) {
      crashlytics().setCrashlyticsCollectionEnabled(true);
    }
  } catch (e) {
    // Silently fail
  }
}

export function logCrashlyticsError(error: Error, context?: string) {
  try {
    const crashlytics = getCrashlytics();
    if (crashlytics) {
      if (context) {
        crashlytics().log(context);
      }
      crashlytics().recordError(error);
    }
  } catch (e) {
    // Silently fail
  }
}

export function setCrashlyticsUser(userId: string) {
  try {
    const crashlytics = getCrashlytics();
    if (crashlytics) {
      crashlytics().setUserId(userId);
    }
  } catch (e) {
    // Silently fail
  }
}

// --- Analytics ---

export async function logScreenView(screenName: string) {
  try {
    const analytics = getAnalytics();
    if (analytics) {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenName,
      });
    }
  } catch (e) {
    // Silently fail — analytics should never crash the app
  }
}

export async function logEvent(eventName: string, params?: Record<string, any>) {
  try {
    const analytics = getAnalytics();
    if (analytics) {
      await analytics().logEvent(eventName, params);
    }
  } catch (e) {
    // Silently fail
  }
}

export async function logRouteStarted(routeId: number, routeName: string) {
  await logEvent('route_started', { route_id: routeId, route_name: routeName });
}

export async function logRouteCompleted(routeId: number, durationMinutes: number) {
  await logEvent('route_completed', { route_id: routeId, duration_minutes: durationMinutes });
}

export async function logCheckpointReached(routeId: number, checkpoint: number) {
  await logEvent('checkpoint_reached', { route_id: routeId, checkpoint_percent: checkpoint });
}

export async function logPOIRated(poiId: number, rating: number) {
  await logEvent('poi_rated', { poi_id: poiId, rating });
}

// --- Push Notifications ---

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    const messaging = getMessaging();
    if (!messaging) return false;

    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (e) {
    console.warn('Notification permission error:', e);
    return false;
  }
}

export async function getFCMToken(): Promise<string | null> {
  try {
    const messaging = getMessaging();
    if (!messaging) return null;
    const token = await messaging().getToken();
    return token;
  } catch (error) {
    console.warn('Failed to get FCM token:', error);
    return null;
  }
}

export function onNotificationReceived(callback: (message: any) => void) {
  try {
    const messaging = getMessaging();
    if (messaging) {
      return messaging().onMessage(callback);
    }
  } catch (e) {
    // Silently fail
  }
  return () => {};
}

export function onNotificationOpened(callback: (message: any) => void) {
  try {
    const messaging = getMessaging();
    if (messaging) {
      return messaging().onNotificationOpenedApp(callback);
    }
  } catch (e) {
    // Silently fail
  }
  return () => {};
}
