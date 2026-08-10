/**
 * LEER CÓDIGO DE BARRAS (1D) DESDE LA CÁMARA
 * ============================================================================
 * Hermano de `leerFactura.js`, que lee el QR de las facturas. Acá el código es
 * el de la GÓNDOLA: EAN-13 / EAN-8 / UPC / Code-128, el que trae impreso el
 * paquete. `jsQR` NO sirve para esto (lee solo QR, que es 2D), así que hay dos
 * caminos y se elige el que haya:
 *
 *   1. `BarcodeDetector`, la API nativa. En **Chrome para Android existe** — y
 *      Android es justo donde se va a escanear, caminando la góndola. Es la vía
 *      rápida: la decodificación la hace el sistema operativo, sin bajar nada.
 *   2. `@zxing/library` (JavaScript puro) para todo lo demás — iPhone/Safari y
 *      Chrome de Windows, donde la nativa no está. Entra por **import dinámico**:
 *      son ~250 KB que se descargan SOLO si alguien abre la cámara y el
 *      navegador no tiene la nativa. El bundle de la app no crece.
 *
 * La cámara exige **contexto seguro**: HTTPS o localhost. Entrando al CRM por
 * `http://<ip-de-la-red>:3000` desde el celular, `getUserMedia` no existe y el
 * navegador no da ningún error entendible — por eso `motivoSinCamara()` lo
 * detecta ANTES de pedir permiso y la pantalla explica qué hacer.
 */

/** Los formatos que puede traer un paquete de góndola. */
const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

/**
 * Por qué NO se puede usar la cámara, o '' si se puede.
 * Se consulta antes de mostrar el botón: mejor un cartel que explique que un
 * botón que falla en silencio.
 */
export function motivoSinCamara() {
  if (typeof navigator === 'undefined') return 'Sin navegador.';
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'La cámara necesita una conexión segura (HTTPS). Estás entrando por HTTP a una IP de la red, y los navegadores bloquean la cámara ahí. Se puede escanear con el lector USB, o abrir el CRM por HTTPS.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Este navegador no da acceso a la cámara.';
  }
  return '';
}

/* ---------------- Camino 1: la API nativa (Android) ---------------- */
let _nativo;
async function detectorNativo() {
  if (_nativo !== undefined) return _nativo;
  _nativo = null;
  if (typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function') {
    try {
      const soportados = await window.BarcodeDetector.getSupportedFormats();
      const usables = FORMATOS.filter((f) => soportados.includes(f));
      if (usables.length) _nativo = new window.BarcodeDetector({ formats: usables });
    } catch { _nativo = null; }
  }
  return _nativo;
}

/* ---------------- Camino 2: ZXing, solo si hace falta ----------------
 *
 * Se usa el núcleo (`MultiFormatReader` + luminancia del canvas), NO las clases
 * `Browser*` de la librería: ésas manejan ellas mismas la cámara y el bucle de
 * frames, que acá ya están resueltos (y su `decodeFromCanvas` no existe en la
 * 0.23 — se descubrió probando con un EAN-13 dibujado a mano).
 */
let _zxing;
async function lectorZxing() {
  if (_zxing !== undefined) return _zxing;
  try {
    const zx = await import('@zxing/library');
    const lector = new zx.MultiFormatReader();
    // Restringir los formatos acelera mucho: no prueba decodificadores que no
    // van a aparecer nunca en un paquete de almacén.
    lector.setHints(new Map([[
      zx.DecodeHintType.POSSIBLE_FORMATS,
      [
        zx.BarcodeFormat.EAN_13, zx.BarcodeFormat.EAN_8, zx.BarcodeFormat.UPC_A,
        zx.BarcodeFormat.UPC_E, zx.BarcodeFormat.CODE_128, zx.BarcodeFormat.CODE_39,
        zx.BarcodeFormat.ITF,
      ],
    ]]));
    _zxing = { lector, zx };
  } catch {
    _zxing = null;
  }
  return _zxing;
}

/**
 * Lee un código de un canvas ya dibujado. Devuelve el código o ''.
 *
 * Vive aparte de `leerFrame` por dos razones: se puede PROBAR sin cámara
 * (dibujando un código conocido) y sirve para leer de una FOTO, no solo del
 * video en vivo.
 */
export async function leerDeCanvas(canvas) {
  if (!canvas?.width) return '';

  const nativo = await detectorNativo();
  if (nativo) {
    try {
      const hits = await nativo.detect(canvas);
      const val = hits?.[0]?.rawValue || '';
      if (val) return String(val).trim();
    } catch { /* si la nativa falla, se sigue con ZXing */ }
  }

  const z = await lectorZxing();
  if (!z) return '';
  try {
    const fuente = new z.zx.HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new z.zx.BinaryBitmap(new z.zx.HybridBinarizer(fuente));
    const res = z.lector.decode(bitmap);
    return String(res?.getText() || '').trim();
  } catch {
    // NotFoundException en cada frame sin código: es lo normal, no es un error.
    return '';
  } finally {
    // El lector guarda estado entre lecturas; sin esto, un frame malo puede
    // arrastrar basura al siguiente.
    z.lector.reset();
  }
}

/**
 * Un intento de lectura sobre el frame actual del `<video>`.
 *
 * La API nativa lee el `<video>` DIRECTO (más rápido: no hay copia de píxeles);
 * ZXing necesita el frame en un canvas, así que se copia solo en ese caso.
 */
export async function leerFrame(video, canvas) {
  if (!video || video.readyState < 2 || !video.videoWidth) return '';

  const nativo = await detectorNativo();
  if (nativo) {
    try {
      const hits = await nativo.detect(video);
      const val = hits?.[0]?.rawValue || '';
      return val ? String(val).trim() : '';
    } catch { /* si la nativa falla, se sigue con ZXing */ }
  }

  if (!canvas) return '';
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  return leerDeCanvas(canvas);
}

/**
 * Abre la cámara TRASERA (la de atrás es la que apunta al paquete) y devuelve
 * el stream. Si `environment` no está disponible cae a cualquier cámara: en una
 * notebook hay una sola y negarse sería peor que usarla.
 */
export async function abrirCamara() {
  const base = { audio: false };
  try {
    return await navigator.mediaDevices.getUserMedia({
      ...base,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e;
    return navigator.mediaDevices.getUserMedia({ ...base, video: true });
  }
}

/** Corta el stream y libera la luz de la cámara (sin esto queda prendida). */
export function cerrarCamara(stream) {
  try { stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ya cerrado */ }
}
