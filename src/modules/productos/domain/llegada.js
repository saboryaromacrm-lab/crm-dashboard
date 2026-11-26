/**
 * LO QUE LLEGÓ (0248, 26/11/2026): la vista previa en la factura de lo que la
 * API va a hacer (crm-api/src/proveedores/diferencias.ts, `repartirEntrega`).
 *
 *   esperado = lo de este papel + lo de la otra mitad − lo que ya había entrado de más
 *   faltante = esperado − llegó   (no entra al stock; la deuda sigue al papel)
 *   sobrante = llegó − esperado   (entra al stock sin deuda)
 *
 * Todo en unidades del stock (u. o kg). Lo que no se contó, llegó como dice el papel.
 */

const EPS = 1e-6;
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

/** Los renglones del papel juntados por producto: lo que se compara con lo que llegó. */
export function porProducto(renglones) {
  const m = new Map();
  for (const r of renglones) {
    const x = m.get(r.productoId) ?? { productoId: r.productoId, nombre: r.nombre, unidad: r.unidad, facturado: 0 };
    x.facturado = r6(x.facturado + (Number(r.cantidad) || 0));
    m.set(r.productoId, x);
  }
  return [...m.values()];
}

/**
 * La llegada que se manda y las diferencias que va a dejar.
 * @param filas      `porProducto(...)` del papel.
 * @param conteo     { [productoId]: texto } lo que se contó de cada uno ('' = como dice el papel).
 * @param extras     [{ productoId, nombre, unidad, cantidad }] lo que vino y no está en el papel.
 * @param otraMitad  Map productoId → lo que ingresó la otra mitad (o null).
 * @param cubiertos  Map productoId → lo que ya había entrado de más y este papel cobra.
 */
export function armarLlegada({ filas, conteo = {}, extras = [], otraMitad = null, cubiertos = new Map() }) {
  const llegaron = [];
  const diferencias = [];
  const errores = [];
  for (const f of filas) {
    const texto = conteo[f.productoId];
    if (texto == null || String(texto).trim() === '') continue;
    const llego = num(texto);
    if (!(llego >= 0)) { errores.push(`${f.nombre}: poné cuánto llegó (0 o más).`); continue; }
    const deEste = f.facturado - (cubiertos.get(f.productoId) ?? 0);
    const esperado = r6(deEste + (otraMitad?.get(f.productoId) ?? 0));
    llegaron.push({ productoId: f.productoId, cantidad: llego });
    const dif = r6(llego - esperado);
    if (dif < -EPS) {
      if (-dif > deEste + EPS) errores.push(`${f.nombre}: faltaría más de lo que trae este papel (${r6(deEste)}). Marcalo en el papel de la otra mitad.`);
      else diferencias.push({ productoId: f.productoId, nombre: f.nombre, unidad: f.unidad, tipo: 'faltante', cantidad: -dif, esperado });
    } else if (dif > EPS) {
      diferencias.push({ productoId: f.productoId, nombre: f.nombre, unidad: f.unidad, tipo: 'sobrante', cantidad: dif, esperado });
    }
  }
  for (const x of extras) {
    const c = num(x.cantidad);
    if (!x.productoId) continue;
    if (!(c > 0)) { errores.push(`${x.nombre || 'Lo que vino sin facturar'}: poné cuánto llegó.`); continue; }
    if (filas.some((f) => f.productoId === x.productoId)) { errores.push(`${x.nombre} ya está en el papel: contalo en su renglón.`); continue; }
    const otra = otraMitad?.get(x.productoId) ?? 0;
    llegaron.push({ productoId: x.productoId, cantidad: c });
    if (c - otra > EPS) diferencias.push({ productoId: x.productoId, nombre: x.nombre, unidad: x.unidad, tipo: 'sobrante', cantidad: r6(c - otra), esperado: otra });
    else if (otra - c > EPS) errores.push(`${x.nombre}: la otra mitad ya trajo ${otra}; si faltó, marcalo en ese papel.`);
  }
  return { llegaron, diferencias, errores };
}

/** «4 u.» / «1,5 kg». */
export const cantTxt = (n, unidad) => `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${unidad === 'kg' ? 'kg' : 'u.'}`;
