import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService } from './auth.service.js';

const AuthContext = createContext(null);

/**
 * Holds the authenticated user and exposes login/logout.
 *
 * La sesión es REAL desde que existe el login con token: `auth.service.js`
 * resuelve contra `/auth/yo` en cada arranque, así que los permisos y la
 * sucursal salen del servidor y no de lo que quedó guardado. Este contexto solo
 * guarda el resultado y expone entrar/salir.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  useEffect(() => {
    let active = true;
    authService
      .getCurrentUser()
      .then((u) => {
        if (!active) return;
        setUser(u);
        setStatus(u ? 'authenticated' : 'anonymous');
      })
      .catch(() => active && setStatus('anonymous'));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const u = await authService.login(credentials);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      logout,
    }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
