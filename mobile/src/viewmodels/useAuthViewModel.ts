import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  googleSignIn,
  sendTokenToBackend,
  logoutFromGoogle,
  logoutFromBackend,
} from '../services/authService';

/**
 * Which login failure the user is shown. 'rejected': the server refused the
 * Google token (401). 'unavailable': the server could not complete the login
 * (5xx) or could not be reached. null: anything else (e.g. a Google Sign-In
 * error), whose own message is shown.
 */
export function classifyLoginError(err: any): 'rejected' | 'unavailable' | null {
  const status: number | undefined = err?.response?.status;
  if (status === 401) return 'rejected';
  if (status != null && status >= 500) return 'unavailable';
  if (err?.isAxiosError && !err?.response) return 'unavailable';
  return null;
}

export function useAuthViewModel() {
  const { t } = useTranslation();
  const { setAuth, logout: clearAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setIsLoading(true);
    setError(null);
    try {
      const idToken = await googleSignIn();
      // Cancelled: stay on the login screen without an error (finally clears loading).
      if (idToken === null) return;
      const data = await sendTokenToBackend(idToken);
      await setAuth(data.token, data.refreshToken, data.user, data.hasProfile);
    } catch (err: any) {
      const kind = classifyLoginError(err);
      if (kind === 'rejected') {
        setError(t('login.errorRejected'));
        return;
      }
      if (kind === 'unavailable') {
        setError(t('login.errorUnavailable'));
        return;
      }
      const message = err?.response?.data?.error || err?.message || 'Login failed';
      // Don't show error if user cancelled
      if (!message.includes('cancel') && !message.includes('SIGN_IN_CANCELLED')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    setIsLoading(true);
    try {
      await logoutFromBackend();
      await logoutFromGoogle();
      await clearAuth();
    } catch (err) {
      console.error('Logout error:', err);
      await clearAuth(); // Clear local state even if API fails
    } finally {
      setIsLoading(false);
    }
  }

  return { login, logout, isLoading, error };
}
