/**
 * ESTRUCTURA PROPIA DE UN PROVEEDOR — la que arma el asistente (28/9/2026)
 * ============================================================================
 * Para las facturas que la lectura automática no resuelve. La persona toca UN
 * renglón de ejemplo y marca qué es cada palabra (código, descripción,
 * cantidad, precio, descuento, importe). De eso se guardan las POSICIONES de
 * las columnas — en un PDF digital del mismo proveedor no se mueven — y el
 * resto de la factura (y las próximas) se leen solas con eso.
 *
 * La plantilla es un dato chico (unos números), se guarda en el proveedor y
 * no hay que tocar el sistema para sumar un proveedor nuevo.
 */
import { clave } from './texto.js';
import { tokensDeLinea } from './tokens.js';
import { controlDeSuma, leerPieGenerico } from './pie.js';

export const ROLES = [
  { id: 'codigo', nombre: 'Código', numero: false },
  { id: 'descripcion', nombre: 'Descripción', numero: false },
  { id: 'cantidad', nombre: 'Cantidad', numero: true },
  { id: 'unidad', nombre: 'Unidad', numero: false },
  { id: 'precio', nombre: 'Precio unitario', numero: true },
  { id: 'dto', nombre: 'Descuento %', numero: true },
  { id: 'importe', nombre: 'Importe', numero: true },
];
export const ROLES_OBLIGATORIOS = ['descripcion', 'cantidad', 'importe'];

/** Margen alrededor de cada columna: los números alineados a la derecha corren su inicio. */
const MARGEN = 8;
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * La plantilla a partir de lo marcado en el renglón de ejemplo.
 * `marcas`: Map índiceDeToken → rol. `codigoAbajo`: el código está en la línea siguiente.
 */
export function crearPlantilla(tokens, marcas, { codigoAbajo = false } = {}) {
  const columnas = {};
  for (const [i, rol] of marcas) {
    const t = tokens[i];
    if (!t || !rol) continue;
    const c = columnas[rol];
    columnas[rol] = c ? [Math.min(c[0], t.x0), Math.max(c[1], t.x1)] : [t.x0, t.x1];
  }
  for (const k of Object.keys(columnas)) columnas[k] = [r1(columnas[k][0] - MARGEN), r1(columnas[k][1] + MARGEN)];
  const faltan = ROLES_OBLIGATORIOS.filter((r) => !columnas[r]);
  return { plantilla: { v: 1, columnas, codigoAbajo: !!codigoAbajo }, faltan };
}

/**
 * Las columnas para LEER: la descripción ocupa todo el hueco entre la columna
 * anterior y la siguiente. El ejemplo tenía una descripción de cierto largo;
 * otras son más largas o más cortas, y sin esto se perderían palabras.
 */
function zonas(columnas) {
  const orden = Object.entries(columnas).sort((a, b) => a[1][0] - b[1][0]);
  const out = {};
  orden.forEach(([rol, [a, b]], i) => {
    if (rol === 'descripcion') {
      const antes = orden[i - 1]?.[1][1];
      const despues = orden[i + 1]?.[1][0];
      out[rol] = [antes != null ? antes : -Infinity, despues != null ? despues : Infinity];
    } else {
      out[rol] = [a, b];
    }
  });
  return out;
}

/** ¿En qué columna cae la palabra? La de mayor solapamiento. */
function columnaDe(t, columnas) {
  let mejor = null;
  let solape = 0;
  for (const [rol, [a, b]] of Object.entries(columnas)) {
    const s = Math.min(b, t.x1) - Math.max(a, t.x0);
    if (s > solape) { mejor = rol; solape = s; }
  }
  return mejor;
}

export function leerConPlantilla(lineas, plantilla) {
  const columnas = zonas(plantilla?.columnas || {});
  const renglones = [];
  const toksPorLinea = lineas.map((l) => tokensDeLinea(l));
  const renglonDe = (toks) => {
    const campos = {};
    for (const t of toks) {
      const rol = columnaDe(t, columnas);
      if (!rol) continue;
      (campos[rol] ??= []).push(t);
    }
    const num = (rol) => {
      const ts = (campos[rol] || []).filter((t) => t.num != null);
      return ts.length ? ts[ts.length - 1].num : null;
    };
    const cantidad = num('cantidad');
    const importe = num('importe');
    const descripcion = (campos.descripcion || []).map((t) => t.s).join(' ').replace(/[-\s]+$/, '');
    // Un renglón tiene cantidad e importe numéricos y alguna descripción; lo
    // demás (encabezados de columna, pie, leyendas) no pasa.
    if (!(cantidad > 0) || importe == null || !descripcion) return null;
    if (/^(SUBTOTAL|TOTAL|IVA|PERC|BONIF)/.test(clave(descripcion))) return null;
    const unidad = (campos.unidad || []).map((t) => t.s).join(' ')
      || (campos.cantidad || []).find((t) => t.unidad)?.unidad || (campos.precio || []).find((t) => t.unidad)?.unidad || '';
    return {
      codigo: (campos.codigo || []).map((t) => t.s).join('').slice(0, 40),
      descripcion: descripcion.slice(0, 300),
      cantidad,
      precioUnit: num('precio'),
      unidad: unidad.replace(/\.$/, '').slice(0, 12),
      dto: num('dto') ?? 0,
      importe,
    };
  };
  for (let i = 0; i < lineas.length; i += 1) {
    const r = renglonDe(toksPorLinea[i]);
    if (!r) continue;
    if (!r.codigo && plantilla?.codigoAbajo) {
      const sig = toksPorLinea[i + 1];
      if (sig && lineas[i + 1].pagina === lineas[i].pagina && !renglonDe(sig)) {
        r.codigo = sig.map((t) => t.s).join('').replace(/-+$/, '').slice(0, 40);
      }
    }
    if (!r.codigo) r.codigo = `D:${clave(r.descripcion).slice(0, 38)}`;
    renglones.push(r);
  }
  const pie = leerPieGenerico(lineas);
  const control = controlDeSuma(renglones, pie);
  const avisos = [];
  if (!renglones.length) avisos.push('La estructura guardada no encontró renglones en esta factura: puede que el proveedor haya cambiado el formato.');
  else if (!control.cierra && control.papel != null) {
    avisos.push(`Los renglones leídos suman ${control.suma.toFixed(2)} y el papel dice ${control.papel.toFixed(2)}: revisá los renglones.`);
  }
  return {
    encabezado: { tipoArca: null, puntoVenta: null, numero: null, fecha: null, cae: null, vencimiento: null },
    renglones, pie, avisos, control,
  };
}
