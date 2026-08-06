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
    shape: { borderRadius: 12 },
    typography: {
      fontFamily:
        "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' },
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
      /**
       * El detalle naranja de la identidad: el indicador de pestañas. La
       * pestaña activa queda en verde (texto) con la barrita naranja abajo —
       * los dos colores de la marca en un solo componente.
       */
      MuiTabs: {
        defaultProps: { indicatorColor: 'secondary' },
        styleOverrides: {
          indicator: { height: 3, borderRadius: 3 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            '&.Mui-selected': { color: palette.primary.main },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16, boxShadow: '0 24px 64px rgba(6, 27, 15, 0.28)' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { paddingBottom: 12 } },
      },
    },
  };

  return createTheme({ ...base, palette, ...brandOverrides });
}
