/**
 * LEER LOS RENGLONES DE UNA FACTURA PDF, en el navegador (28/9/2026).
 * ============================================================================
 * PDF → líneas (pdf.js) → la lectura que corresponda al proveedor → renglones,
 * pie y encabezado tal como los imprime el papel. Todo en la computadora de
 * quien procesa; al servidor después solo viaja esto (unos KB) para reconocer
 * los productos.
 *
 * Qué lectura se usa, en este orden:
 *   1. RECETA del formato del proveedor (hecha a mano para un sistema, p. ej. Tango).
 *   2. ESTRUCTURA PROPIA que armó el asistente (columnas marcadas una vez).
 *   3. LECTURA AUTOMÁTICA: cantidad × precio = importe, sin nada preparado.
 * Las tres terminan en el mismo control: la suma tiene que cerrar con el papel.
 */
import { extraerLineasPdf } from './lineasPdf.js';
import { pegarNumeros } from './texto.js';
import { formatoDe } from './recetas.js';
import { leerAutomatico } from './automatico.js';
import { leerConPlantilla } from './plantilla.js';

/** Menos fragmentos que esto = no hay capa de texto (escaneo o foto hecha PDF). */
const MIN_FRAGMENTOS = 15;
const MAX_TEXTO = 200_000;

/** Qué lectura usa el proveedor: 'receta' | 'plantilla' | 'automatico'. */
export function fuenteDe(proveedor) {
  if (formatoDe(proveedor)) return 'receta';
  if (proveedor?.formatoFactura === 'plantilla' && proveedor?.plantillaFactura?.columnas) return 'plantilla';
  return 'automatico';
}

/** Las líneas del PDF (para el asistente) o null si no tiene texto. */
export async function lineasDelPdf(pdfjs, datos) {
  const lineas = await extraerLineasPdf(pdfjs, datos);
  const fragmentos = lineas.reduce((a, l) => a + l.frags.length, 0);
  return fragmentos < MIN_FRAGMENTOS ? null : lineas;
}

export async function leerRenglonesPdf({ pdfjs, datos, proveedor }) {
  const lineas = await extraerLineasPdf(pdfjs, datos);
  const fragmentos = lineas.reduce((a, l) => a + l.frags.length, 0);
  const crudo = lineas.map((l) => `[p${l.pagina}] ${pegarNumeros(l.texto)}`).join('\n');
  const texto = crudo.length > MAX_TEXTO ? `${crudo.slice(0, MAX_TEXTO)}\n… (recortado)` : crudo;

  if (fragmentos < MIN_FRAGMENTOS) {
    return {
      formato: null, fuente: null, texto, sinTexto: true,
      avisos: ['El PDF no tiene texto adentro: es un escaneo o una foto convertida. Por ahora se carga a mano.'],
    };
  }

  const fuente = fuenteDe(proveedor);
  if (fuente === 'receta') {
    const formato = formatoDe(proveedor);
    return { formato: formato.nombre, fuente, texto, ...formato.leer(lineas) };
  }
  if (fuente === 'plantilla') {
    return { formato: 'Estructura propia', fuente, texto, ...leerConPlantilla(lineas, proveedor.plantillaFactura) };
  }
  const auto = leerAutomatico(lineas);
  /* Sin renglones o sin cierre, la automática no se ofrece como propuesta:
     se devuelve igual para que la pantalla ofrezca el asistente. */
  return {
    formato: auto.renglones.length ? 'Lectura automática' : null,
    fuente,
    confirmada: proveedor?.formatoFactura === 'auto',
    texto,
    ...auto,
  };
}
