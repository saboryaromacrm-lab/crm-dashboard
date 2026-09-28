/**
 * LECTOR AUTOMÁTICO — renglones de cualquier factura, sin estructura (28/9/2026)
 * ============================================================================
 * Pedido del dueño: que la app lea sola, sin que alguien arme la estructura de
 * cada proveedor. La regla que lo hace posible vale para cualquier formato:
 *
 *   un renglón es una línea que termina en números donde
 *   CANTIDAD × PRECIO × (1 − DESCUENTO) = IMPORTE (el último número).
 *
 * No importa el orden de las columnas ni si hay unidad en el medio ("2.00
 * Cajas 29.639,37 59.278,74"): se prueban las combinaciones y se queda la que
 * cierra la cuenta. Lo que no cierra NO es un renglón — no se adivina. Y al
 * final el control de suma (Σ importes = subtotal del papel) dice si la
 * lectura entera sirve.
 *
 * El código del artículo: la primera palabra si tiene pinta de código, o la
 * línea siguiente si trae solo eso (hay proveedores que lo imprimen debajo).
 * Sin código, se usa la descripción normalizada ("D:…") para que el mapeo con
 * el producto igual se aprenda la primera vez.
 */
import { clave } from './texto.js';
import { tokensDeLinea } from './tokens.js';
import { controlDeSuma, leerPieGenerico } from './pie.js';

/** Máximo de palabras "de unidad" entre los números del final (Cajas, KG, UN). */
const MAX_PALABRAS_COLA = 1;
const ETIQUETA_PIE = /^(SUBTOTAL|TOTAL|IVA|PERC|IIBB|BONIF|DESCUENTO|NETO|IMPORTE|SALDO)/;
/** Pinta de código: letras y dígitos, con al menos un dígito, sin espacios. */
const esCodigo = (s) => /\d/.test(s) && /^[A-Za-z0-9][A-Za-z0-9./_-]{1,24}$/.test(s) && !/^\d{1,2}[.,]\d{2}$/.test(s);

const cerca = (a, b) => Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.0005);

/**
 * De los números de la cola, cuál es cantidad, cuál precio y cuál descuento.
 * `nums` en orden visual, SIN el importe (que es el último).
 */
function resolver(nums, importe) {
  for (let i = 0; i < nums.length; i += 1) {
    for (let j = 0; j < nums.length; j += 1) {
      if (i === j) continue;
      const c = nums[i].num;
      const p = nums[j].num;
      if (!(c > 0) || !(p > 0)) continue;
      if (cerca(c * p, importe)) return { cantidad: c, precio: p, dto: 0, orden: i < j };
      for (let k = 0; k < nums.length; k += 1) {
        if (k === i || k === j) continue;
        const d = nums[k].num;
        if (d > 0 && d < 100 && cerca(c * p * (1 - d / 100), importe)) return { cantidad: c, precio: p, dto: d, orden: i < j };
      }
    }
  }
  return null;
}

/** Si la línea es un renglón, sus partes; si no, null. */
function renglonDe(toks) {
  // La cola: desde el primer número tras el cual solo hay números (y a lo sumo una palabra de unidad).
  let inicio = toks.length;
  let palabras = 0;
  for (let i = toks.length - 1; i >= 0; i -= 1) {
    if (toks[i].num != null) { inicio = i; continue; }
    if (palabras < MAX_PALABRAS_COLA && /^[A-Za-z.]{1,8}$/.test(toks[i].s) && i < toks.length - 1) { palabras += 1; continue; }
    break;
  }
  // La cola arranca en un número; lo que queda antes es la descripción.
  while (inicio < toks.length && toks[inicio].num == null) inicio += 1;
  const cola = toks.slice(inicio);
  const nums = cola.filter((t) => t.num != null);
  if (nums.length < 3) return null;
  const importe = nums[nums.length - 1].num;
  if (!(importe > 0)) return null;
  // Se prueban las ventanas del final: la cantidad y el precio suelen ser los
  // 2-4 números antes del importe (antes puede haber un código numérico).
  const previos = nums.slice(0, -1).slice(-4);
  const r = resolver(previos, importe);
  if (!r) return null;
  const desc = toks.slice(0, inicio);
  if (!desc.length) return null;
  if (ETIQUETA_PIE.test(clave(desc[0].s))) return null;
  let codigo = '';
  let palabrasDesc = desc;
  if (desc.length > 1 && esCodigo(desc[0].s)) {
    codigo = desc[0].s;
    palabrasDesc = desc.slice(1);
  }
  const unidad = cola.find((t) => t.num == null)?.s || nums.find((t) => t.unidad)?.unidad || '';
  return {
    codigo,
    descripcion: palabrasDesc.map((t) => t.s).join(' ').replace(/[-\s]+$/, '').slice(0, 300),
    cantidad: r.cantidad,
    precioUnit: r.precio,
    unidad: unidad.replace(/\.$/, '').slice(0, 12),
    dto: r.dto,
    importe,
  };
}

/** Una línea que trae SOLO un código (el proveedor lo imprime debajo del renglón). */
function codigoSuelto(toks) {
  if (!toks.length || toks.length > 2) return null;
  const s = toks.map((t) => t.s).join('');
  return esCodigo(s) || /^\d{8,14}$/.test(s) ? s.replace(/-+$/, '') : null;
}

export function leerAutomatico(lineas) {
  const renglones = [];
  const toksPorLinea = lineas.map((l) => tokensDeLinea(l));
  for (let i = 0; i < lineas.length; i += 1) {
    const r = renglonDe(toksPorLinea[i]);
    if (!r) continue;
    if (!r.codigo) {
      // ¿El código viene en la línea de abajo, antes del próximo renglón?
      const sig = toksPorLinea[i + 1];
      const suelto = sig && lineas[i + 1]?.pagina === lineas[i].pagina && !renglonDe(sig) ? codigoSuelto(sig) : null;
      if (suelto) r.codigo = suelto.slice(0, 40);
    }
    if (!r.codigo) r.codigo = `D:${clave(r.descripcion).slice(0, 38)}`;
    renglones.push(r);
  }
  const pie = leerPieGenerico(lineas);
  const control = controlDeSuma(renglones, pie);
  const avisos = [];
  if (!renglones.length) avisos.push('La lectura automática no encontró renglones en esta factura.');
  else if (!control.cierra) {
    avisos.push(control.papel != null
      ? `Los renglones leídos suman ${control.suma.toFixed(2)} y el papel dice ${control.papel.toFixed(2)}: la lectura automática no alcanza para esta factura.`
      : 'No se encontró el subtotal ni el total en el papel: no se puede comprobar la lectura.');
  }
  return {
    encabezado: { tipoArca: null, puntoVenta: null, numero: null, fecha: null, cae: null, vencimiento: null },
    renglones, pie, avisos, control,
  };
}
