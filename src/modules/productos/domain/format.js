/**
 * DOMAIN FORMATTERS & DATE UTILITIES (Producto / Inventario)
 * ============================================================================
 * Pure helpers shared across the module's services and views. No React, no I/O.
 * Ported from the original vanilla `app.data.js`; `esc()` is intentionally gone
 * because React escapes text by default.
 */

/* ---- Fechas (el JS corre en el navegador) ---- */
/**
 * yyyy-mm-dd LOCAL (para inputs type="date").
 *
 * Con `toISOString()` esto daba MAÑANA a partir de las 21:00 de Argentina
 * (UTC−3): la factura que se cargaba a la noche nacía con la fecha del día
 * siguiente, la cobranza igual, y "este mes" arrancaba el 31 del mes anterior
 * porque el 1° a medianoche local es el último día del mes anterior en UTC.
 * Un input date habla de días del calendario de acá, no de instantes UTC.
 */
export function isoDate(d) {
  const f = new Date(d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
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

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sin pasar por Date (esquiva el corrimiento UTC). */
export function fmtFechaVenc(iso) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
}
