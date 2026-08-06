/**
 * Palette definitions kept in sync with src/styles/tokens.css.
 *
 * The CSS custom properties drive pure-CSS modules; these JS objects drive the
 * MUI theme. Keeping both in one mental model (same names/values) is what makes
 * MUI components and custom CSS look like one product.
 *
 * Identidad: VERDE OSCURO como primario (siempre con blanco encima) y NARANJA
 * como secundario de detalle — es el color del indicador de tabs, badges y
 * resaltados, nunca de superficies grandes.
 */

export const lightPalette = {
  mode: 'light',
  primary: { main: '#166534', dark: '#14532d', light: '#2f9e5f', contrastText: '#ffffff' },
  secondary: { main: '#ea580c', dark: '#c2410c', contrastText: '#ffffff' },
  success: { main: '#16a34a' },
  warning: { main: '#b45309' },
  error: { main: '#dc2626' },
  info: { main: '#0f766e' },
  background: { default: '#f3f6f3', paper: '#ffffff' },
  text: { primary: '#16211a', secondary: '#56655c' },
  divider: '#dde6de',
};

export const darkPalette = {
  mode: 'dark',
  primary: { main: '#2f9e5f', dark: '#3cb571', light: '#4ade80', contrastText: '#06170d' },
  secondary: { main: '#fb923c', dark: '#f97316', contrastText: '#1a1108' },
  success: { main: '#22c55e' },
  warning: { main: '#d97706' },
  error: { main: '#ef4444' },
  info: { main: '#2dd4bf' },
  background: { default: '#0c1310', paper: '#131c16' },
  text: { primary: '#e9f0ea', secondary: '#a4b5aa' },
  divider: '#233129',
};
