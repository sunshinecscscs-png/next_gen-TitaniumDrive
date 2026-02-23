import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextValue.js';
import { registerUser, loginUser, fetchMe } from '../api/auth';

const TOKEN_KEY = 'autosite_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── восстановление сессии при загрузке ── */
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      // use timeout to avoid synchronous setState in effect body
      queueMicrotask(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    fetchMe(token)
      .then(({ user }) => { if (!cancelled) setUser(user); })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* ── регистрация ── */
  const register = useCallback(async (form) => {
    const { user, token } = await registerUser(form);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
    return user;
  }, []);

  /* ── логин ── */
  const login = useCallback(async (form) => {
    const { user, token } = await loginUser(form);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
    return user;
  }, []);

  /* ── логаут ── */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = { user, loading, register, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
