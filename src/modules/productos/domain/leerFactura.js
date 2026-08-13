/**
 * LEER UNA FACTURA DE PAPEL — lo que se puede hacer en el navegador.
 * ============================================================================
 * Una factura son dos mitades y se resuelven distinto:
 *
 *  - **El encabezado NO se interpreta.** Toda factura electrónica argentina
 *    lleva el QR de la RG 4892, que es un JSON con CUIT del emisor, tipo, punto
 *    de venta, número, fecha, total y CAE. Leer un QR es determinístico: o lo
 *    lee o no lo lee, no hay "lo leí mal".
 *
 *  - **El detalle de renglones sí hay que interpretarlo**, y eso es otra etapa.
 *
 * Todo pasa ACÁ, en la máquina: el papel no sale a ningún servicio externo.
 *
 * POR QUÉ HAY DOS LECTORES
 * ------------------------
 * El primer intento fue usar solo `BarcodeDetector`, la API nativa del
 * navegador: cero dependencias. **No existe en Chrome para Windows** — se probó
 * y no está—, así que en la máquina donde corre esto no habría leído ni un QR.
 * Queda como camino rápido porque en Android sí está (y el celular es justo
 * desde donde se van a sacar las fotos), con `jsQR` —JavaScript puro, sin
 * binarios— atrás para todo lo demás.
 *
 * El texto crudo del QR se manda tal cual a la API, que es la que lo traduce:
 * el mapeo de códigos de ARCA vive en un solo lugar (`facturas.module.ts`) y no
 * duplicado acá.
 */
import jsQR from 'jsqr';

/** Lo que acepta el input de archivos. El PDF entra pero sin lectura de QR. */
export const TIPOS_ACEPTADOS = 'image/jpeg,image/png,image/webp,application/pdf';
export const MAX_ENTRADA_MB = 15;

/**
 * Al guardar: 2200 px del lado largo. Es más de lo que necesita una miniatura a
 * propósito — el papel se guarda para poder LEERLO seis meses después, y con
 * 1200 px la letra chica del pie de una factura A4 se vuelve ilegible.
 */
const LADO_MAX = 2200;
const CALIDAD = 0.82;

export const esImagen = (file) => !!file && String(file.type || '').startsWith('image/');
export const esPdf = (file) => !!file && String(file.type || '') === 'application/pdf';

/** El camino rápido, cuando el navegador lo tiene (Android sí, Windows no). */
let _detector;
async function detectorNativo() {
  if (_detector !== undefined) return _detector;
  _detector = null;
  if (typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function') {
    try {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      if (formatos.includes('qr_code')) {
        _detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch { _detector = null; }
  }
  return _detector;
}

/**
 * Dibuja una región del bitmap en un canvas, con un techo de resolución.
 *
 * El techo importa por dos razones opuestas: una foto de 12 Mpx serían 48 MB de
 * píxeles y buscar el QR ahí se hace lento; pero recortar y volver a subir a ese
 * techo le da al mismo QR mucha más resolución que en la foto entera. Por eso el
 * recorte no es un adorno: en una foto de celular de una A4 el QR ocupa una
 * porción chica y el lector lo pierde.
 */
const TECHO_QR = 1600;
function aCanvas(bitmap, region) {
  const r = region || { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const escala = Math.min(TECHO_QR / Math.max(r.w, r.h), 3);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w * escala));
  c.height = Math.max(1, Math.round(r.h * escala));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return { canvas: c, ctx };
}

/** El QR de la factura es el que apunta al verificador de ARCA (`?p=…`). En la
 *  hoja puede haber otros códigos: el del banco al pie, uno del proveedor. */
const esDeFactura = (t) => /[?&]p=/.test(t || '') || /afip|arca/i.test(t || '');

/**
 * Busca el QR de la factura en una foto y devuelve su texto crudo (o '').
 *
 * El orden de las partes no es casual: en el diseño estándar de ARCA el QR va
 * **abajo a la izquierda**, al lado de la leyenda del CAE.
 */
export async function leerQr(file) {
  if (!esImagen(file)) return '';

  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return ''; }

  const { width: W, height: H } = bitmap;
  const mw = Math.round(W / 2);
  const mh = Math.round(H / 2);
  const intentos = [
    null,                                        // la foto entera
    { x: 0, y: H - mh, w: mw, h: mh },           // abajo izquierda (lo habitual)
    { x: mw, y: H - mh, w: mw, h: mh },          // abajo derecha
    { x: 0, y: 0, w: mw, h: mh },                // arriba izquierda
    { x: mw, y: 0, w: mw, h: mh },               // arriba derecha
  ];

  const nativo = await detectorNativo();
  let suplente = '';

  try {
    for (const region of intentos) {
      const { canvas, ctx } = aCanvas(bitmap, region);

      if (nativo) {
        try {
          const codigos = await nativo.detect(canvas);
          const hit = codigos.find((c) => esDeFactura(c.rawValue));
          if (hit) return hit.rawValue;
          if (codigos[0]?.rawValue && !suplente) suplente = codigos[0].rawValue;
        } catch { /* sigue con jsQR */ }
      }

      const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // `attemptBoth`: la foto de un papel arrugado o con flash puede quedar con
      // el contraste dado vuelta en la zona del código.
      const r = jsQR(px.data, px.width, px.height, { inversionAttempts: 'attemptBoth' });
      if (r?.data) {
        if (esDeFactura(r.data)) return r.data;
        if (!suplente) suplente = r.data;
      }
    }
  } finally {
    bitmap.close?.();
  }
  /* Si lo único que se encontró NO parece de una factura, igual se manda: la API
   * lo descarta sola (`interpretarQr` devuelve null) y el encabezado queda para
   * cargar a mano. Guardarse el dato no ayudaría a nadie. */
  return suplente;
}

/** file → data URL, sin tocar nada. Para el PDF, que no se puede recomprimir. */
function comoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(file);
  });
}

/**
 * Deja el archivo listo para subir: `{ nombre, data, kb }`.
 *
 * Las fotos se redimensionan y se comprimen a WebP; el PDF viaja tal cual. Una
 * foto de celular son 4 MB y queda en ~200 KB sin perder legibilidad, y eso
 * importa porque el papel se guarda en la base (igual que la foto del gasto):
 * lo que se sube hoy se lo lleva el backup de todos los días.
 *
 * IMPORTANTE: el QR se lee del archivo ORIGINAL, antes de pasar por acá. Al
 * comprimir se pierde justo el detalle fino que el lector necesita.
 */
export async function prepararArchivo(file) {
  const nombre = String(file?.name || 'factura').slice(0, 160);
  if (!file) throw new Error('Archivo vacío.');
  if (file.size > MAX_ENTRADA_MB * 1024 * 1024) {
    throw new Error(`"${nombre}" pesa ${Math.round(file.size / 1024 / 1024)} MB y el máximo es ${MAX_ENTRADA_MB} MB.`);
  }
  if (!esImagen(file) && !esPdf(file)) {
    throw new Error(`"${nombre}" no es una foto ni un PDF.`);
  }

  const original = await comoDataUrl(file);
  if (esPdf(file)) return { nombre, data: original, kb: Math.round(file.size / 1024) };

  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return { nombre, data: original, kb: Math.round(file.size / 1024) }; }

  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bitmap.width * escala));
  c.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = c.getContext('2d');
  // Fondo blanco: un PNG con transparencia sobre WebP quedaría con manchas.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close?.();

  let data = c.toDataURL('image/webp', CALIDAD);
  if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', CALIDAD);
  // Con fotos ya chicas comprimir puede AGRANDAR: ahí gana el original.
  if (data.length >= original.length) data = original;

  return { nombre, data, kb: Math.round(((data.length - data.indexOf(',') - 1) * 3) / 4 / 1024) };
}

/**
 * Prepara un archivo completo: lee el QR del original y comprime para guardar.
 * Es lo que usa el panel por cada archivo que alguien suelta.
 */
export async function prepararFactura(file) {
  const [qr, archivo] = await Promise.all([
    leerQr(file).catch(() => ''),
    prepararArchivo(file),
  ]);
  return { qr, archivo };
}
