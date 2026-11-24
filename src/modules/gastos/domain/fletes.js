/**
 * LOS FLETES DE MERCADERÍA (0244) — lo puro de la pantalla.
 * ============================================================================
 * En la factura de un transporte (proveedor con «trae mercadería») cada renglón
 * dice de dónde vino: de un proveedor (y de qué factura o remito suyo, o el número
 * si todavía no está cargado) u «otra cosa». El renglón de un proveedor se escribe
 * solo, como se venía escribiendo a mano: «DONINAS - 5 BULTOS».
 */

export const UNIDADES_FLETE = { BULTOS: 'Bultos', PALLETS: 'Pallets' };

/** Lo que el selector «¿De quién trajo?» guarda cuando no es un proveedor. */
export const OTRA_COSA = 'otro';

/** El nombre sin la forma societaria: «DONINAS  S. A. S.» → «DONINAS». */
const sinSociedad = (nombre) => String(nombre ?? '')
  .replace(/\b(s\.?\s?a\.?\s?s\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?)(?=\s|$)/gi, '')
  .replace(/\s+/g, ' ').trim();

/** El renglón de un proveedor: «DONINAS - 5 BULTOS» (sin cantidad, solo el nombre). */
export function conceptoDelFlete(nombre, cantidad, unidad = 'BULTOS') {
  const n = sinSociedad(nombre).toUpperCase();
  return Number(cantidad) > 0 ? `${n} - ${Number(cantidad)} ${unidad}` : n;
}

/** Al editar, la unidad sale de lo escrito. */
export const unidadDe = (concepto) => (/pallet/i.test(String(concepto ?? '')) ? 'PALLETS' : 'BULTOS');

/** «Factura A 0001-00002119», «Remito 0003-00099999». */
export function etiquetaPapel(p, tipos = {}) {
  if (!p) return '';
  const tipo = tipos[p.tipo]?.label?.replace(/ \(.*\)$/, '') ?? p.tipo;
  const letra = p.tipo === 'factura' && p.letra ? ` ${p.letra}` : '';
  const numero = p.numero ? ` ${String(p.puntoVenta ?? '').padStart(4, '0')}-${String(p.numero).padStart(8, '0')}` : '';
  return `${tipo}${letra}${numero}`;
}

/** Un renglón vacío del formulario de gasto (los campos del flete van siempre, vacíos si no es un transporte). */
export const RENGLON_VACIO = {
  concepto: '', monto: '', cantidad: '', fleteOrigen: '', fleteProveedorId: '', fleteComprobanteId: '', fleteReferencia: '', unidad: 'BULTOS',
};

/** El renglón guardado, como fila del formulario. */
export function filaDeRenglon(i) {
  return {
    concepto: i.concepto, monto: String(i.monto), cantidad: i.cantidad ? String(i.cantidad) : '',
    fleteOrigen: i.fleteOrigen ?? '', fleteProveedorId: i.fleteProveedorId ? String(i.fleteProveedorId) : '',
    fleteComprobanteId: i.fleteComprobanteId ? String(i.fleteComprobanteId) : '', fleteReferencia: i.fleteReferencia ?? '',
    unidad: unidadDe(i.concepto),
  };
}

/** El concepto que va a quedar: el de un proveedor se escribe solo; el resto, como se tipeó. */
export function conceptoDeFila(fila, nombreProveedor) {
  if (fila.fleteOrigen === 'proveedor' && fila.fleteProveedorId) {
    return conceptoDelFlete(nombreProveedor(Number(fila.fleteProveedorId)), fila.cantidad, fila.unidad);
  }
  return String(fila.concepto ?? '').trim();
}

/** Lo que viaja de cada renglón: solo lo que corresponde a su origen. */
export function fleteDeFila(fila) {
  if (fila.fleteOrigen === 'proveedor') {
    return {
      fleteOrigen: 'proveedor',
      fleteProveedorId: Number(fila.fleteProveedorId) || null,
      fleteComprobanteId: Number(fila.fleteComprobanteId) || null,
      fleteReferencia: fila.fleteComprobanteId ? '' : String(fila.fleteReferencia ?? '').trim(),
    };
  }
  return { fleteOrigen: fila.fleteOrigen === OTRA_COSA ? OTRA_COSA : null };
}

/**
 * QUÉ LE FALTA A UN RENGLÓN DE TRANSPORTE para poder guardarse, o null. Con importe
 * y sin decir de dónde vino no se guarda: es la regla del transporte.
 */
export function faltaEnFleteDe(fila) {
  if (!(Number(fila.monto) > 0)) return null;
  if (!fila.fleteOrigen) return 'Decí de qué proveedor trajo cada renglón, o marcalo como otra cosa.';
  if (fila.fleteOrigen === 'proveedor' && !fila.fleteProveedorId) return 'Elegí de qué proveedor trajo.';
  if (fila.fleteOrigen === OTRA_COSA && !String(fila.concepto ?? '').trim()) return 'Escribí qué fue lo que no es de un proveedor.';
  return null;
}

/** El flete % que cargan los formatos del proveedor: el de la mayoría, y el rango si no son todos iguales («10 % (0–18)»). */
export function textoEnCosto(enCosto) {
  if (!enCosto) return '';
  const f = (n) => `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 })}`;
  return enCosto.min === enCosto.max ? `${f(enCosto.habitual)} %` : `${f(enCosto.habitual)} % (${f(enCosto.min)}–${f(enCosto.max)})`;
}

/**
 * LA LECTURA DE UN PROVEEDOR: lo que realmente costó traerlo contra el flete % que
 * tienen en el costo la mayoría de sus productos. Un punto de tolerancia para cada
 * lado: el real depende de cuánto vino en cada viaje.
 */
export function lecturaFlete({ pctReal, enCosto }) {
  if (!enCosto) return { pill: null, label: 'Sin formato de compra' };
  if (pctReal == null) return { pill: 'est-borrador', label: 'Sin compras en el período' };
  if (enCosto.habitual <= 0) return { pill: 'est-vencida', label: 'No está en el costo' };
  const dif = pctReal - enCosto.habitual;
  const puntos = Math.abs(dif).toLocaleString('es-AR', { maximumFractionDigits: 1 });
  if (dif > 1) return { pill: 'est-pendiente', label: `El real es ${puntos} puntos más` };
  if (dif < -1) return { pill: 'est-transito', label: `El real es ${puntos} puntos menos` };
  return { pill: 'est-recibida', label: 'Coincide' };
}

/**
 * ¿El número escrito en el flete es el de este papel? Igual que en el servidor:
 * "0003-00001234", "3-1234" o solo "1234" (sin punto de venta compara el número).
 */
export function coincideNumero(ref, puntoVenta, numero) {
  if (!Number(numero)) return false;
  const t = String(ref ?? '').trim();
  const conPv = /^\D*0*(\d+)\s*[-/]\s*0*(\d+)\D*$/.exec(t);
  if (conPv) return Number(conPv[1]) === Number(puntoVenta) && Number(conPv[2]) === Number(numero);
  const digitos = t.replace(/\D/g, '');
  return digitos !== '' && Number(digitos) === Number(numero);
}
