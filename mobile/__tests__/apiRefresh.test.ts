jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import api, {
  REFRESH_TIMEOUT_MS,
  isAuthEndpoint,
  isSessionEndingRefreshError,
  setAuthFailureHandler,
  shouldAttemptRefresh,
} from '../src/services/api';

describe('shouldAttemptRefresh', () => {
  it('refreshes a first 401 on a regular endpoint when a refresh token exists', () => {
    expect(shouldAttemptRefresh({ url: '/routes' }, 401, true)).toBe(true);
  });

  it('never refreshes for the auth endpoints', () => {
    for (const url of ['/auth/google', '/auth/refresh', '/auth/logout', '/api/auth/google?x=1']) {
      expect(isAuthEndpoint(url)).toBe(true);
      expect(shouldAttemptRefresh({ url }, 401, true)).toBe(false);
    }
  });

  it('does not refresh without a refresh token, on a retry, or on other statuses', () => {
    expect(shouldAttemptRefresh({ url: '/routes' }, 401, false)).toBe(false);
    expect(shouldAttemptRefresh({ url: '/routes', _retry: true }, 401, true)).toBe(false);
    expect(shouldAttemptRefresh({ url: '/routes' }, 403, true)).toBe(false);
    expect(shouldAttemptRefresh(undefined, 401, true)).toBe(false);
  });
});

describe('api 401 interceptor', () => {
  const unauthorizedAdapter = (message: string) => async (config: any) => {
    const error: any = new Error('Request failed with status code 401');
    error.config = config;
    error.response = { status: 401, data: { error: message }, config, headers: {} };
    throw error;
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('rejects a failed Google login with its own error, not "No refresh token"', async () => {
    const postSpy = jest.spyOn(axios, 'post');
    const onFailure = jest.fn();
    setAuthFailureHandler(onFailure);

    await expect(
      api.post('/auth/google', { idToken: 'bad' }, { adapter: unauthorizedAdapter('Authentication failed') }),
    ).rejects.toMatchObject({ response: { status: 401, data: { error: 'Authentication failed' } } });

    expect(postSpy).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('does not try a refresh for auth endpoints even when a refresh token exists', async () => {
    await AsyncStorage.setItem('refreshToken', 'rt');
    const postSpy = jest.spyOn(axios, 'post');

    await expect(
      api.post('/auth/google', {}, { adapter: unauthorizedAdapter('Authentication failed') }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(postSpy).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('refreshToken')).toBe('rt');
  });

  it('rejects with the original error when no refresh token exists', async () => {
    await expect(
      api.get('/routes', { adapter: unauthorizedAdapter('Unauthorized') }),
    ).rejects.toMatchObject({ response: { status: 401, data: { error: 'Unauthorized' } } });
  });
});

describe('refresh failure handling', () => {
  const unauthorizedAdapter = async (config: any) => {
    const error: any = new Error('Request failed with status code 401');
    error.config = config;
    error.response = { status: 401, data: { error: 'Invalid or expired token' }, config, headers: {} };
    throw error;
  };

  const refreshFailure = (status?: number) => {
    const error: any = new Error(status ? `Request failed with status code ${status}` : 'Network Error');
    error.isAxiosError = true;
    if (status) error.response = { status, data: {}, headers: {} };
    return error;
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    await AsyncStorage.multiSet([['token', 'expired'], ['refreshToken', 'rt']]);
  });

  it('classifies only 400/401 (and a missing refresh token) as session-ending', () => {
    expect(isSessionEndingRefreshError(refreshFailure(401))).toBe(true);
    expect(isSessionEndingRefreshError(refreshFailure(400))).toBe(true);
    expect(isSessionEndingRefreshError(new Error('No refresh token'))).toBe(true);
    expect(isSessionEndingRefreshError(refreshFailure())).toBe(false);
    expect(isSessionEndingRefreshError(refreshFailure(500))).toBe(false);
    expect(isSessionEndingRefreshError(refreshFailure(503))).toBe(false);
  });

  it('keeps the session and rejects with the original error when the refresh is unreachable', async () => {
    const postSpy = jest.spyOn(axios, 'post').mockRejectedValue(refreshFailure());
    const onFailure = jest.fn();
    setAuthFailureHandler(onFailure);

    await expect(api.get('/routes', { adapter: unauthorizedAdapter })).rejects.toMatchObject({
      response: { status: 401, data: { error: 'Invalid or expired token' } },
    });

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      { refreshToken: 'rt' },
      { timeout: REFRESH_TIMEOUT_MS },
    );
    expect(onFailure).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('refreshToken')).toBe('rt');
    expect(await AsyncStorage.getItem('token')).toBe('expired');
  });

  it('keeps the session when the refresh endpoint answers 500', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(refreshFailure(500));
    const onFailure = jest.fn();
    setAuthFailureHandler(onFailure);

    await expect(api.get('/routes', { adapter: unauthorizedAdapter })).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(onFailure).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('refreshToken')).toBe('rt');
  });

  it('logs out when the server rejects the refresh token (401)', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(refreshFailure(401));
    const onFailure = jest.fn();
    setAuthFailureHandler(onFailure);

    await expect(api.get('/routes', { adapter: unauthorizedAdapter })).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('refreshToken')).toBeNull();
    expect(await AsyncStorage.getItem('token')).toBeNull();
  });
});
