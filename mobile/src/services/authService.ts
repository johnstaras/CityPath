import {
  GoogleSignin,
  isCancelledResponse,
} from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Configure Google Sign-In (call once on app start)
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: Config.GOOGLE_WEB_CLIENT_ID || '',
    offlineAccess: true,
  });
}

// Resolves to null when the user cancels the Google account picker: the
// library reports that as a { type: 'cancelled' } response, not a rejection.
export async function googleSignIn(): Promise<string | null> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) return null;
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('No ID token received from Google');
  return idToken;
}

export async function sendTokenToBackend(idToken: string) {
  const { data } = await api.post('/auth/google', { idToken });
  return data; // { token, refreshToken, user, hasProfile }
}

export async function logoutFromGoogle() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore if not signed in
  }
}

// Sends the refresh token so the server can revoke the session even when the
// access token has already expired (the endpoint does not require it).
export async function logoutFromBackend() {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
  } catch {
    // Offline or server error: logout still completes locally (UC-12, 4a)
  }
}
