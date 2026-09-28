/**
 * EL TEXTO DE UN PDF DIGITAL, EN LÍNEAS — en el NAVEGADOR (28/9/2026).
 * ============================================================================
 * Antes esto corría en el servidor, en el mismo proceso que atiende las cajas:
 * un PDF grande las frenaba mientras se leía. Ahora lo hace la computadora del
 * que procesa la factura; al servidor solo le llega el resultado (unos KB).
 *
 * La técnica no cambió: cada fragmento de texto trae su posición X/Y; misma Y
 * (± tolerancia) = misma línea, y dentro de la línea se ordena por X.
 *
 * `pdfjs` entra por parámetro: en la pantalla es la versión del navegador
 * (con su worker, así la lectura no traba la pantalla) y en las pruebas la de
 * Node. Este archivo no importa nada pesado.
 */

/** Misma línea = misma altura, con tolerancia: los renglones no vienen a Y exacta. */
const TOLERANCIA_Y = 2.5;
/** Techos generosos para una factura real (la más larga vista: 3 páginas, ~4.000 fragmentos). */
export const MAX_PAGINAS_PDF = 30;
export const MAX_FRAGMENTOS = 200_000;

export class PdfDemasiadoGrande extends Error {}

/** `datos`: ArrayBuffer o Uint8Array del PDF. Devuelve [{pagina, y, frags, texto}]. */
export async function extraerLineasPdf(pdfjs, datos) {
  const tarea = pdfjs.getDocument({
    // COPIA: pdf.js se queda con el buffer que recibe (lo manda a su worker y
    // lo deja inutilizable). Sin la copia, releer el mismo PDF fallaba.
    data: (datos instanceof Uint8Array ? datos : new Uint8Array(datos)).slice(),
    verbosity: 0,
    // No se renderiza nada: compilar las fuentes del archivo con eval no sirve y abre superficie.
    isEvalSupported: false,
  });
  const doc = await tarea.promise;
  const lineas = [];
  let fragmentos = 0;
  try {
    if (doc.numPages > MAX_PAGINAS_PDF) {
      throw new PdfDemasiadoGrande(`Ese PDF tiene ${doc.numPages} páginas: no parece una factura. El límite es ${MAX_PAGINAS_PDF}.`);
    }
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const frags = tc.items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str }));
      fragmentos += frags.length;
      if (fragmentos > MAX_FRAGMENTOS) {
        throw new PdfDemasiadoGrande('Ese PDF tiene demasiado texto para leerlo. Cargá los renglones a mano.');
      }
      // De arriba hacia abajo, y dentro de la línea de izquierda a derecha.
      frags.sort((a, b) => b.y - a.y || a.x - b.x);
      let actual = null;
      for (const f of frags) {
        if (!actual || Math.abs(actual.y - f.y) > TOLERANCIA_Y) {
          actual = { pagina: p, y: f.y, frags: [f], texto: '' };
          lineas.push(actual);
        } else {
          actual.frags.push(f);
        }
      }
      page.cleanup();
    }
  } finally {
    await tarea.destroy();
  }
  for (const l of lineas) {
    l.frags.sort((a, b) => a.x - b.x);
    l.texto = l.frags.map((f) => f.s.trim()).join(' ');
  }
  return lineas;
}

/*
 * pdf.js del NAVEGADOR, cargado recién la primera vez que se lee una factura:
 * quien nunca procesa facturas no lo descarga. El worker hace el trabajo en
 * otro hilo, así la pantalla sigue respondiendo mientras lee.
 */
/*
 * EL WORKER SE CREA CON `new Worker(new URL(...))` (28/9/2026): así Vite lo
 * empaqueta como un `.js` propio. Con `?url` salía como `.mjs`, y el servidor
 * de la pantalla sirve `.mjs` como `application/octet-stream`: el navegador
 * rechaza un módulo con ese tipo y la lectura no arrancaba en producción. Un
 * solo worker para todas las lecturas de la sesión.
 */
let pdfjsNavegador = null;
export function pdfjsDelNavegador() {
  pdfjsNavegador ??= import('pdfjs-dist/build/pdf.min.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
      { type: 'module' },
    );
    return pdfjs;
  });
  return pdfjsNavegador;
}
