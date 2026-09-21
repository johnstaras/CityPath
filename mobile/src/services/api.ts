import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/constants';

// Event callback for auth failure — set by AuthContext
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// The refresh call goes through plain axios (not `api`, to stay out of these
// interceptors), so it needs its own bound: without one a hung request left
// every waiting 401 hanging with it.
export const REFRESH_TIMEOUT_MS = 10000;

// Request interceptor — attach JWT
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single in-flight refresh shared by all 401s. Without this, concurrent
// requests each POST /auth/refresh; the server rotates the token on the first
// call, the rest fail with the now-stale token, and a validly-refreshed user
// gets force-logged-out.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await axios.post(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { timeout: REFRESH_TIMEOUT_MS },
  );

  await AsyncStorage.multiSet([
    ['token', data.token],
    ['refreshToken', data.refreshToken],
  ]);

  return data.token;
}

/**
 * Whether a failed refresh means the session is over. Only the server saying
 * the refresh token itself is invalid or expired (400/401) — or there being no
 * refresh token at all — ends it. A network error, timeout or 5xx says nothing
 * about the token: logging out then threw away a valid 30-day session because
 * of a dropped connection.
 */
export function isSessionEndingRefreshError(refreshError: unknown): boolean {
  const status = (refreshError as AxiosError | undefined)?.response?.status;
  if (status === 400 || status === 401) return true;
  return refreshError instanceof Error && refreshError.message === 'No refresh token';
}

// Endpoints whose 401 is the answer itself, not an expired access token:
// a rejected Google login, a dead refresh token, a logout with a stale token.
const AUTH_ENDPOINTS = ['/auth/google', '/auth/refresh', '/auth/logout'];

interface RetryableRequestConfig {
  url?: string;
  _retry?: boolean;
}

export function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return AUTH_ENDPOINTS.some((endpoint) => path === endpoint || path.endsWith(endpoint));
}

/**
 * Whether a failed request should be retried after refreshing the access
 * token. Only a 401 on a regular endpoint, not yet retried, with a refresh
 * token to spend. Everything else must surface its ORIGINAL error — on the
 * login screen there is no refresh token, and trying anyway replaced the real
 * login failure with "No refresh token".
 */
export function shouldAttemptRefresh(
  config: RetryableRequestConfig | undefined,
  status: number | undefined,
  hasRefreshToken: boolean,
): boolean {
  return (
    status === 401 &&
    config != null &&
    !config._retry &&
    !isAuthEndpoint(config.url) &&
    hasRefreshToken
  );
}

// Response interceptor — auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || !originalRequest || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    const hasRefreshToken = !!(await AsyncStorage.getItem('refreshToken'));
    if (!hasRefreshToken) {
      // A signed-in session that cannot be renewed is over; clear it so the
      // app returns to login, but report the request's own error.
      if (originalRequest.headers?.Authorization) {
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'hasProfile']);
        onAuthFailure?.();
      }
      return Promise.reject(error);
    }

    if (shouldAttemptRefresh(originalRequest, error.response.status, hasRefreshToken)) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (!isSessionEndingRefreshError(refreshError)) {
          // Transient (offline, timeout, server error): keep the tokens so the
          // next request can try again, and report the request's own error.
          return Promise.reject(error);
        }
        // The refresh token was rejected — the session is over.
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'hasProfile']);
        if (onAuthFailure) {
          onAuthFailure();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
