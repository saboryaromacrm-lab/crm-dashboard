/** Formatos chicos de Métricas (sin componentes: así el archivo de gráficos solo exporta componentes). */

/** $ compacto para el eje: 850 · 12,5 k · 1,2 M. */
export function compacto(v) {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} k`;
  return `${s}${a.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}
