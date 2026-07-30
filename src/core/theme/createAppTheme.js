import { createTheme } from '@mui/material/styles';
import { lightPalette, darkPalette } from './palette.js';

/**
 * Builds a MUI theme for the requested mode.
 *
 * Shared, mode-independent design decisions (shape, typography, component
 * defaults) live in `base`. Per-mode palettes are merged on top. Adding a
 * per-tenant brand later = pass overrides into this factory, no component edits.
 *
 * @param {'light' | 'dark'} mode
 * @param {object} [brandOverrides] optional per-tenant theme overrides
 */
export function createAppTheme(mode = 'light', brandOverrides = {}) {
  const palette = mode === 'dark' ? darkPalette : lightPalette;

  const base = {
    shape: { borderRadius: 10 },
    typography: {
      fontFamily:
        "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      h1: { fontSize: '2rem', fontWeight: 700 },
      h2: { fontSize: '1.5rem', fontWeight: 700 },
      h3: { fontSize: '1.25rem', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { border: `1px solid ${palette.divider}` },
        },
      },
    },
  };

  return createTheme({ ...base, palette, ...brandOverrides });
}
