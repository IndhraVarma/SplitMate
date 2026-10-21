import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/auth.service.js';
import { setStoredToken, getStoredToken, setUnauthorizedHandler } from '../services/api.js';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user.
 *
 * On first load, if a token is in storage we ask the API who it belongs to -
 * the token is never trusted for its contents, only presented as a credential.
 * A 401 from anywhere clears the session so the UI cannot sit in a half-signed-in
 * state.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const [sessionMessage, setSessionMessage] = useState(null);

  const clearSession = useCallback((message) => {
    setStoredToken(null);
    setUser(null);
    setStatus('anonymous');
    if (message) setSessionMessage(message);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((code) => {
      if (!getStoredToken()) return;
      clearSession(
        code === 'TOKEN_EXPIRED'
          ? 'Your session expired. Please sign in again.'
          : 'Please sign in to continue.'
      );
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getStoredToken()) {
        setStatus('anonymous');
        return;
      }
      try {
        const { data } = await authService.fetchMe();
        if (!cancelled) {
          setUser(data.user);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) clearSession();
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const signIn = useCallback(async (credentials) => {
    const { data } = await authService.login(credentials);
    setStoredToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
    setSessionMessage(null);
    return data.user;
  }, []);

  const signUp = useCallback(async (payload) => {
    const { data } = await authService.register(payload);
    setStoredToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
    setSessionMessage(null);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    // Best effort: clearing the cookie is nice, but the local session must go
    // regardless of whether the network call succeeds.
    await authService.logout().catch(() => null);
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
      signIn,
      signUp,
      signOut,
      setUser,
    }),
    [user, status, sessionMessage, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider.');
  return ctx;
}

export default AuthContext;
