/**
 * DOMAIN FORMATTERS & DATE UTILITIES (Producto / Inventario)
 * ============================================================================
 * Pure helpers shared across the module's services and views. No React, no I/O.
 * Ported from the original vanilla `app.data.js`; `esc()` is intentionally gone
 * because React escapes text by default.
 */

/* ---- Fechas (el JS corre en el navegador) ---- */
export function hoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
export function iso(d) {
  return new Date(d).toISOString();
}
/** yyyy-mm-dd (para inputs type="date"). */
export function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}
export function fmtFecha(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('es-AR');
}
export function fmtFechaHora(v) {
  const d = new Date(v);
  return (
    d.toLocaleDateString('es-AR') +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  );
}
export function diasHasta(v) {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - hoy()) / 86400000);
}

/* ---- Formato numérico / moneda ---- */
export function money(n) {
  return (
    '$' +
    Number(n || 0).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
export function num(n, dec) {
  return Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: dec == null ? 3 : dec,
  });
}
/** Tamaño legible: < 1 kg se muestra en gramos. */
export function fmtTam(kg) {
  return kg < 1 ? num(kg * 1000, 0) + ' g' : num(kg, 3) + ' kg';
}
