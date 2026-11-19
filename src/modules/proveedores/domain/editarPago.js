/**
 * MODIFICAR UN PAGO (19/11/2026, pedido del dueño desde el estado de cuenta).
 * El formulario arranca con el pago tal cual está guardado y manda su estado
 * completo: la API compara y solo toca (y audita) lo que cambió.
 */

/** Efectivo por transferencia: viaja como transferencia con `cambioPor`. */
export const CAMBIO = 'cambio';
const A_MANO = 'mano:';
/** Igual que `cuentaDelPago` de CuentaPropiaSelect (acá sin React, para poder probarlo). */
const cuentaDelPago = (value) => (String(value ?? '').startsWith(A_MANO)
  ? { cuentaAMano: String(value).slice(A_MANO.length) }
  : { cuentaPropiaId: Number(value) || undefined });

const dia = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const cuentaComoValor = (id, aMano) => (aMano ? `${A_MANO}${aMano}` : id ? String(id) : '');
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** El formulario con lo que el pago tiene hoy. */
export function formDesdePago(pago, formas = []) {
  const mixto = formas.length > 1;
  return {
    fecha: dia(pago.fecha),
    importe: String(r2(pago.importe)),
    modo: mixto ? 'mixto' : 'simple',
    medio: pago.cambioPor ? CAMBIO : pago.medio,
    cuentaId: cuentaComoValor(pago.cuentaPropiaId, pago.cuentaAMano),
    cambioPor: pago.cambioPor ?? '',
    formas: mixto
      ? formas.map((f) => ({ medio: f.medio, importe: String(r2(f.importe)), fecha: dia(f.fecha), cuentaId: cuentaComoValor(f.cuentaPropiaId, f.cuentaAMano) }))
      : [{ medio: 'efectivo', importe: '', fecha: '', cuentaId: '' }, { medio: 'transferencia', importe: '', fecha: '', cuentaId: '' }],
    referencia: pago.referencia ?? '',
    concepto: pago.concepto ?? '',
    observaciones: pago.observaciones ?? '',
    motivo: '',
  };
}

/** Lo que se manda a `PATCH /pagos-proveedor/:id`. */
export function cuerpoEdicion(f) {
  const base = {
    fecha: f.fecha,
    importe: r2(f.importe),
    referencia: f.referencia.trim(),
    concepto: f.concepto.trim(),
    observaciones: f.observaciones.trim(),
    motivo: f.motivo.trim() || undefined,
  };
  if (f.modo === 'mixto') {
    const partes = f.formas.filter((x) => Number(x.importe) > 0).map((x) => ({
      medio: x.medio, importe: r2(x.importe), fecha: x.fecha || undefined,
      ...(x.medio === 'transferencia' ? cuentaDelPago(x.cuentaId) : {}),
    }));
    return { ...base, medio: partes[0]?.medio ?? 'efectivo', formas: partes };
  }
  if (f.medio === CAMBIO) return { ...base, medio: 'transferencia', formas: [], cambioPor: f.cambioPor.trim() };
  return { ...base, medio: f.medio, formas: [], ...(f.medio === 'transferencia' ? cuentaDelPago(f.cuentaId) : {}) };
}

/** ¿Cambió algo? Guardar sin tocar nada no tiene sentido (el motivo solo no es un cambio). */
export const huboCambios = (inicial, actual) => {
  const sin = ({ motivo, ...x }) => x; // eslint-disable-line no-unused-vars
  return JSON.stringify(sin(cuerpoEdicion(inicial))) !== JSON.stringify(sin(cuerpoEdicion(actual)));
};
