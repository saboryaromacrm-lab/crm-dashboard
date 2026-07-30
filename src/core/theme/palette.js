/**
 * Palette definitions kept in sync with src/styles/tokens.css.
 *
 * The CSS custom properties drive pure-CSS modules; these JS objects drive the
 * MUI theme. Keeping both in one mental model (same names/values) is what makes
 * MUI components and custom CSS look like one product.
 */

export const lightPalette = {
  mode: 'light',
  primary: { main: '#2563eb', dark: '#1d4ed8', contrastText: '#ffffff' },
  secondary: { main: '#7c3aed', contrastText: '#ffffff' },
  success: { main: '#16a34a' },
  warning: { main: '#d97706' },
  error: { main: '#dc2626' },
  info: { main: '#0284c7' },
  background: { default: '#f4f6fb', paper: '#ffffff' },
  text: { primary: '#111827', secondary: '#6b7280' },
  divider: '#e5e7eb',
};

export const darkPalette = {
  mode: 'dark',
  primary: { main: '#3b82f6', dark: '#60a5fa', contrastText: '#0b1120' },
  secondary: { main: '#a78bfa', contrastText: '#0b1120' },
  success: { main: '#22c55e' },
  warning: { main: '#f59e0b' },
  error: { main: '#ef4444' },
  info: { main: '#38bdf8' },
  background: { default: '#0b1120', paper: '#111827' },
  text: { primary: '#f3f4f6', secondary: '#9ca3af' },
  divider: '#1f2937',
};
