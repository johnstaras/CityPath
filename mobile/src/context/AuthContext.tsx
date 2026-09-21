import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthFailureHandler } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  hasProfile: boolean;
  isLoading: boolean;
  setAuth: (token: string, refreshToken: string, user: User, hasProfile: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setHasProfile: (value: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasProfile, setHasProfileState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Persist alongside state so onboarding completion survives an app restart.
  const setHasProfile = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem('hasProfile', String(value));
    setHasProfileState(value);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'hasProfile']);
    setToken(null);
    setUser(null);
    setHasProfileState(false);
    // Drop all cached server data so the next account never sees this one's
    // profile/favorites/stats while its own queries refetch.
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    loadStoredAuth();
    // Register auth failure handler so api.ts can force logout
    setAuthFailureHandler(() => {
      logout();
    });
  }, [logout]);

  async function loadStoredAuth() {
    try {
      const stored = await AsyncStorage.multiGet(['token', 'user', 'hasProfile']);
      const storedToken = stored[0][1];
      const storedUser = stored[1][1];
      const storedHasProfile = stored[2][1];
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setHasProfileState(storedHasProfile === 'true');
      }
    } catch (error) {
      // Failed to load auth from storage
    } finally {
      setIsLoading(false);
    }
  }

  async function setAuth(newToken: string, refreshToken: string, newUser: User, profileSet: boolean) {
    await AsyncStorage.multiSet([
      ['token', newToken],
      ['refreshToken', refreshToken],
      ['user', JSON.stringify(newUser)],
      ['hasProfile', String(profileSet)],
    ]);
    setToken(newToken);
    setUser(newUser);
    setHasProfileState(profileSet);
  }

  return (
    <AuthContext.Provider value={{ user, token, hasProfile, isLoading, setAuth, logout, setHasProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
