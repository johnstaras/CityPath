import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en.json';
import el from './el.json';

const resources = {
  en: { translation: en },
  el: { translation: el },
};

// Detect device language using built-in React Native APIs (no extra library needed)
function getDeviceLanguage(): string {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;

    if (locale && locale.startsWith('el')) {
      return 'el';
    }
  } catch (e) {
    // Fallback to English
  }
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

const LANGUAGE_KEY = 'appLanguage';

// A user-chosen language wins over device detection; applied async at startup
// (react-i18next re-renders consumers when it lands).
AsyncStorage.getItem(LANGUAGE_KEY)
  .then(saved => {
    if ((saved === 'en' || saved === 'el') && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  })
  .catch(() => {});

export type AppLanguage = 'en' | 'el';

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang).catch(() => {});
  await i18n.changeLanguage(lang);
}

export default i18n;
