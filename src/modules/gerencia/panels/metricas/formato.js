/** Formatos chicos de Métricas (sin componentes: así los archivos .jsx solo exportan componentes). */
import { num } from '@modules/productos/domain/format.js';

/** $ compacto para el eje: 850 · 12,5 k · 1,2 M. */
export function compacto(v) {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} k`;
  return `${s}${a.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

/*
 * Colores de las series (validados para daltonismo, en modo claro y oscuro,
 * contra la superficie de las tarjetas). El verde es el del ERP.
 */
export const COLOR_GRANEL = 'var(--crm-color-primary)';
export const COLOR_ENTERO = '#ea580c';
export const COLOR_A = 'var(--crm-color-primary)';
export const COLOR_B = '#2563eb';

export const pctTxt =(v) => (v == null ? '—' : `${num(v, 1)}%`);
/** Puntos porcentuales con signo: 42 % contra 38 % son «+4 pts». */
export const puntosTxt = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${num(v, 1)} pts`);

/* ------------------------------ fechas ------------------------------ */
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const DIAS_SEMANA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fechaCorta = (p) => `${Number(p.slice(8, 10))}/${Number(p.slice(5, 7))}`;
export const fechaLarga = (p) => `${p.slice(8, 10)}/${p.slice(5, 7)}/${p.slice(0, 4)}`;

/** Suma días a una fecha 'AAAA-MM-DD' (al mediodía: sin saltos por horario de verano). */
export const sumarDias = (p, n) => { const d = new Date(`${p}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
/** Días entre dos fechas, contando las dos puntas. */
export const diasDe = (desde, hasta) => Math.round((Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86_400_000) + 1;

/** Los períodos que se usan todos los días. */
export function rangoDe(preset) {
  const h = new Date();
  const hoy = iso(h);
  const d = (y, m, dd) => iso(new Date(y, m, dd));
  switch (preset) {
    case 'hoy': return [hoy, hoy];
    case '7d': return [d(h.getFullYear(), h.getMonth(), h.getDate() - 6), hoy];
    case '30d': return [d(h.getFullYear(), h.getMonth(), h.getDate() - 29), hoy];
    case 'mes-pasado': return [d(h.getFullYear(), h.getMonth() - 1, 1), d(h.getFullYear(), h.getMonth(), 0)];
    case 'anio': return [d(h.getFullYear(), 0, 1), hoy];
    case '12m': return [d(h.getFullYear(), h.getMonth() - 11, 1), hoy];
    case 'mes':
    default: return [d(h.getFullYear(), h.getMonth(), 1), hoy];
  }
}
export const PRESETS = [
  ['hoy', 'Hoy'], ['7d', 'Últimos 7 días'], ['mes', 'Este mes'], ['mes-pasado', 'Mes pasado'],
  ['30d', 'Últimos 30 días'], ['anio', 'Este año'], ['12m', 'Últimos 12 meses'], ['otro', 'Elegir fechas…'],
];

/**
 * Contra qué se compara el período A (pestaña «Comparar fechas»).
 *   · anterior — los días justo antes, del mismo largo.
 *   · semanas  — hace 52 semanas (364 días): cae en los mismos días de la semana,
 *                así un sábado se compara con un sábado. Lo que se usa en comercio.
 *   · anio     — las mismas fechas del año pasado (el 15/9 contra el 15/9).
 *   · otro     — fechas elegidas a mano.
 */
export const CONTRA = [
  ['anterior', 'El período anterior'], ['semanas', 'Hace un año (mismos días de la semana)'],
  ['anio', 'Mismas fechas del año pasado'], ['otro', 'Elegir fechas…'],
];
export function rangoContra(modo, desde, hasta) {
  if (modo === 'semanas') return [sumarDias(desde, -364), sumarDias(hasta, -364)];
  if (modo === 'anio') {
    // Un año atrás en el calendario; el 29/2 cae en el 28/2.
    const atras = (p) => { const [y, m, dd] = p.split('-').map(Number); return iso(new Date(y - 1, m - 1, Math.min(dd, new Date(y - 1, m, 0).getDate()))); };
    return [atras(desde), atras(hasta)];
  }
  const n = diasDe(desde, hasta);
  return [sumarDias(desde, -n), sumarDias(desde, -1)];
}

/** El agrupamiento que se lee bien según el largo del período. */
export const pasoPara = (desde, hasta) => {
  const dias = diasDe(desde, hasta);
  return dias <= 45 ? 'dia' : dias <= 180 ? 'semana' : 'mes';
};
export const etiquetaPeriodo = (p, paso) => (paso === 'mes' ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(2, 4)}` : fechaCorta(p));
export const tituloPeriodo = (p, paso) => (paso === 'mes' ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}` : paso === 'semana' ? `Semana del ${fechaLarga(p)}` : fechaLarga(p));
export const nombrePaso = (paso) => (paso === 'dia' ? 'día' : paso);

/** Hace cuánto, en palabras. */
export function haceCuanto(isoFecha) {
  if (!isoFecha) return 'nunca';
  const min = Math.round((Date.now() - new Date(isoFecha).getTime()) / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

export const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta_debito: 'Débito', tarjeta_credito: 'Crédito', qr: 'QR', cheque: 'Cheque', otro: 'Otro' };
