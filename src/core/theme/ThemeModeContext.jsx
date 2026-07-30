import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from './createAppTheme.js';
import { appConfig } from '@core/config/app.config.js';

const ThemeModeContext = createContext(null);

/**
 * Owns the active color mode and exposes toggle/set helpers.
 *
 * Responsibilities:
 *   - build the MUI theme for the current mode,
 *   - mirror the mode onto <html data-theme> so pure-CSS modules react too,
 *   - keep a single, app-wide switch that per-tenant branding can hook into.
 */
export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(appConfig.theme.defaultMode);

  const applyDomTheme = useCallback((next) => {
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  const setThemeMode = useCallback(
    (next) => {
      setMode(next);
      applyDomTheme(next);
    },
    [applyDomTheme],
  );

  const toggleThemeMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      applyDomTheme(next);
      return next;
    });
  }, [applyDomTheme]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const value = useMemo(
    () => ({ mode, setThemeMode, toggleThemeMode }),
    [mode, setThemeMode, toggleThemeMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within <ThemeModeProvider>');
  }
  return ctx;
}
