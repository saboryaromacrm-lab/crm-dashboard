/**
 * LOS ATAJOS DE FECHA de Fraccionamiento (Historial y pedidos de la caja):
 * Hoy, Ayer, Últimos 7 días, Este mes, Mes pasado; fechas locales AAAA-MM-DD.
 */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** [desde, hasta] de un atajo. */
export function rango(id) {
  const hoy = new Date();
  const d = (y, m, dia) => new Date(y, m, dia);
  switch (id) {
    case 'ayer': { const a = d(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1); return [iso(a), iso(a)]; }
    case '7d': return [iso(d(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6)), iso(hoy)];
    case 'mes': return [iso(d(hoy.getFullYear(), hoy.getMonth(), 1)), iso(hoy)];
    case 'mesAnt': return [iso(d(hoy.getFullYear(), hoy.getMonth() - 1, 1)), iso(d(hoy.getFullYear(), hoy.getMonth(), 0))];
    default: return [iso(hoy), iso(hoy)];
  }
}
export const RANGOS = [
  { id: 'hoy', label: 'Hoy' }, { id: 'ayer', label: 'Ayer' }, { id: '7d', label: 'Últimos 7 días' },
  { id: 'mes', label: 'Este mes' }, { id: 'mesAnt', label: 'Mes pasado' },
];

/** El botón de un atajo: lleno cuando es el elegido. */
export const chip = (activo) => ({
  cursor: 'pointer', padding: '6px 12px', fontSize: 12.5, borderWidth: 1, borderStyle: 'solid',
  borderColor: activo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)',
  ...(activo ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)' } : {}),
});
