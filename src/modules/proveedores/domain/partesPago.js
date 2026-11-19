/**
 * LAS PARTES DE UN PAGO MIXTO (19/11/2026, pedido del dueño: «que pueda
 * seleccionar pagar el resto, porque sino tengo que estar calculando»). Un pago
 * que salió en varios medios se carga parte por parte; estas cuentas dicen
 * cuánto le falta a una parte para que todas sumen el total del pago.
 */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const EPS = 0.009;

export const PARTE_VACIA = { medio: 'transferencia', importe: '', fecha: '', cuentaId: '' };

export const sumaPartes = (formas) => r2(formas.reduce((a, x) => a + (Number(x.importe) || 0), 0));

/**
 * Lo que tiene que llevar la parte `i` para que el pago cierre, respetando lo
 * que ya llevan las otras. `null` si las otras ya cubren el total (o pasan).
 */
export function restoParaParte(formas, total, i) {
  const otras = r2(formas.reduce((a, x, j) => a + (j === i ? 0 : Number(x.importe) || 0), 0));
  const resto = r2(total - otras);
  return resto > EPS ? resto : null;
}

/** Una parte nueva, que ya trae lo que falta (si falta algo). */
export function agregarParte(formas, total) {
  const resto = r2(total - sumaPartes(formas));
  return [...formas, { ...PARTE_VACIA, importe: resto > EPS ? String(resto) : '' }];
}

/** Cómo está la suma: cierra, faltan o sobran (con cuánto). */
export function estadoPartes(formas, total) {
  const dif = r2(total - sumaPartes(formas));
  if (Math.abs(dif) <= EPS) return { id: 'cierra', monto: 0 };
  return dif > 0 ? { id: 'faltan', monto: dif } : { id: 'sobran', monto: -dif };
}
