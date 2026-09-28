/**
 * LEER LOS RENGLONES DE UNA FACTURA PDF, en el navegador (28/9/2026).
 * ============================================================================
 * PDF → líneas (pdf.js) → receta del formato del proveedor → renglones, pie y
 * encabezado tal como los imprime el papel. Todo en la computadora de quien
 * procesa; al servidor después solo viaja esto (unos KB) para reconocer los
 * productos. Si el PDF no tiene texto (escaneo) o el proveedor todavía no
 * tiene formato, se devuelve el texto crudo igual: con él se arma la receta.
 */
import { extraerLineasPdf } from './lineasPdf.js';
import { pegarNumeros } from './texto.js';

/** Menos fragmentos que esto = no hay capa de texto (escaneo o foto hecha PDF). */
const MIN_FRAGMENTOS = 15;
const MAX_TEXTO = 200_000;

export async function leerRenglonesPdf({ pdfjs, datos, formato }) {
  const lineas = await extraerLineasPdf(pdfjs, datos);
  const fragmentos = lineas.reduce((a, l) => a + l.frags.length, 0);
  const crudo = lineas.map((l) => `[p${l.pagina}] ${pegarNumeros(l.texto)}`).join('\n');
  const texto = crudo.length > MAX_TEXTO ? `${crudo.slice(0, MAX_TEXTO)}\n… (recortado)` : crudo;

  if (fragmentos < MIN_FRAGMENTOS) {
    return {
      formato: null, texto, sinTexto: true,
      avisos: ['El PDF no tiene texto adentro: es un escaneo o una foto convertida. Por ahora se carga a mano.'],
    };
  }
  if (!formato) {
    return {
      formato: null, texto,
      avisos: ['Este proveedor todavía no tiene estructura de lectura. Asignale un formato en la pestaña Proveedores, o mandá una factura de muestra para armarla.'],
    };
  }
  const leida = formato.leer(lineas);
  return { formato: formato.nombre, texto, ...leida };
}
