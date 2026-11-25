/**
 * LA HORMA QUE SE FACTURA AL PESO (25/11/2026, pedido del dueño: «es para
 * Coffit, yo no lo vendo… que me quede bien el precio por kg»).
 *
 * El queso Danbo o el Pategras de La Serenísima están dados de alta por
 * unidad (la horma de 3,5 kg, la de 4 kg): el stock se cuenta en hormas. Pero
 * el papel los cobra en kilos («18,53 × $12.321,60») y la API frena una
 * cantidad con decimales en un producto por unidad. En octubre las hormas
 * entraban en una factura a $0 y la plata se cargaba aparte en «QUESOS A
 * COBRAR COFFIT», así que el costo por kg de Coffit nunca se enteraba.
 *
 * En el modo «al peso» el renglón habla como el papel: la cantidad son los kg
 * y el costo es el $ por kg. Lo que se graba sigue siendo en hormas:
 *   · si las hormas YA ENTRARON (la factura a $0 de antes), este papel no
 *     suma stock y se graba exacto: kg ÷ kg por horma (5,294 hormas), así el
 *     costo por kg que ve Coffit es el del papel al centavo;
 *   · si entran AHORA, se graban hormas enteras (las que llegaron; de entrada
 *     kg ÷ kg por horma redondeado) y el costo por horma es el importe dividido
 *     por ellas: el $/kg de Coffit puede variar un poco según el peso real.
 * El importe del renglón es siempre kg × $/kg, igual al del papel.
 */
import { pesoDe } from './parecidoPapel.js';

/** Los kg de UNA unidad, sacados del nombre («Horma 3.5k», «x4kg», «X2.560KG»); null si no lo dice. */
export function kgPorUnidadDe(nombre) {
  const p = pesoDe(nombre);
  return p?.unidad === 'g' && p.valor > 0 ? p.valor / 1000 : null;
}

/** ¿Este renglón del papel viene al peso? Un producto por unidad, con kg en el nombre, y cantidad con decimales. */
export function vieneAlPeso(prod, cantidadPapel) {
  const q = Number(cantidadPapel) || 0;
  return prod?.tipo === 'entero' && kgPorUnidadDe(prod.nombre) != null && q > 0 && Math.abs(q - Math.round(q)) > 1e-9;
}

/** Las unidades sugeridas para `kg`: redondeado, al menos una. */
export function unidadesSugeridas(kg, kgPorUnidad) {
  const k = Number(kg) || 0;
  const p = Number(kgPorUnidad) || 0;
  return k > 0 && p > 0 ? Math.max(1, Math.round(k / p)) : 0;
}

/** Las unidades que graba el renglón al peso (decimales solo si ya entraron: no mueve stock). */
export function unidadesAlPeso(it) {
  const kg = Number(it.bultos) || 0;
  const p = Number(it.kgPorUnidad) || 0;
  if (!(kg > 0) || !(p > 0)) return 0;
  if (it.yaEntraron) return Math.round((kg / p) * 1e6) / 1e6;
  const n = Number(it.unidadesPeso);
  return Number.isInteger(n) && n > 0 ? n : unidadesSugeridas(kg, p);
}

/**
 * ¿Las hormas de este producto ya entraron? Sí si el último papel de este
 * proveedor que lo trae lo cobró a menos de $1 (la horma a $0 o $0,10 «con
 * confirmación de peso»). `comprobantes`: los que tiene la pantalla.
 */
export function yaEntraronSegunHistorial(comprobantes, productoId, proveedorId) {
  const pid = Number(productoId);
  const ultimo = (comprobantes || [])
    .filter((c) => c.proveedorId === Number(proveedorId) && c.estado === 'confirmado'
      && ['factura', 'liquidacion', 'remito'].includes(c.tipo)
      && (c.items || []).some((x) => Number(x.productoId) === pid))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id)[0];
  if (!ultimo) return false;
  const renglon = ultimo.items.find((x) => Number(x.productoId) === pid);
  return (Number(renglon.costoUnitario) || 0) < 1;
}
