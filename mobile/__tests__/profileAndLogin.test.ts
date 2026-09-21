jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/services/authService', () => ({}));

import { hasStepFreeSelection } from '../src/viewmodels/useProfileViewModel';
import { classifyLoginError } from '../src/viewmodels/useAuthViewModel';
import { MobilityProfile } from '../src/models';

const profile = (id: number, avoidStairs: boolean, requiresRamps: boolean): MobilityProfile => ({
  id,
  name: `p${id}`,
  icon: 'walk',
  maxIncline: null,
  avoidStairs,
  avoidCobblestone: avoidStairs,
  minSidewalkWidth: null,
  requiresRamps,
  requiresTactilePaving: false,
  maxRouteDistanceKm: null,
  restStopIntervalM: null,
  speedFactor: 1,
});

describe('hasStepFreeSelection (edit profile accessibility note)', () => {
  const profiles = [profile(1, false, false), profile(4, true, true), profile(6, false, true)];

  it('is false for the pedestrian profile alone or no selection', () => {
    expect(hasStepFreeSelection(profiles, [1])).toBe(false);
    expect(hasStepFreeSelection(profiles, [])).toBe(false);
  });

  it('is true when any selected profile avoids stairs or requires ramps', () => {
    expect(hasStepFreeSelection(profiles, [1, 4])).toBe(true);
    expect(hasStepFreeSelection(profiles, [6])).toBe(true);
  });
});

describe('classifyLoginError', () => {
  it('a 401 is a rejected Google sign-in', () => {
    expect(classifyLoginError({ isAxiosError: true, response: { status: 401 } })).toBe('rejected');
  });

  it('a 5xx or an unreachable server is "unavailable"', () => {
    expect(classifyLoginError({ isAxiosError: true, response: { status: 500 } })).toBe('unavailable');
    expect(classifyLoginError({ isAxiosError: true, message: 'Network Error' })).toBe('unavailable');
  });

  it('other errors (e.g. Google Sign-In) keep their own message', () => {
    expect(classifyLoginError(new Error('DEVELOPER_ERROR'))).toBeNull();
    expect(classifyLoginError({ isAxiosError: true, response: { status: 400 } })).toBeNull();
  });
});
