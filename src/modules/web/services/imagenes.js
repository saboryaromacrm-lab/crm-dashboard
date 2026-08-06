/**
 * MOTOR DE IMÁGENES DEL SITIO — el estándar establecido
 * ============================================================================
 * TODA imagen que sube al sitio pasa por acá: se elige el archivo, se lo pasa
 * por el MOLDE de su tipo (medida, encaje o recorte, fondo) y se comprime a
 * WebP — todo en el navegador, con el canvas nativo, sin dependencias ni
 * servicios externos. Un componente futuro que lleve imagen declara su preset
 * y hereda todo: molde, compresión, quitado de fondo y previsualización.
 *
 * Dos familias de molde:
 *   - 'encajar': la imagen entra ENTERA (nunca se recorta); lo que sobra se
 *     rellena con el fondo del preset (o queda transparente).
 *   - 'cubrir': la imagen LLENA la caja y lo que sobra se RECORTA al centro —
 *     por eso esos presets piden previsualización antes de subir.
 *
 * QUITAR FONDO: flood-fill desde los bordes. Se estima el color de fondo
 * muestreando el contorno y se "come" todo píxel conectado al borde que se le
 * parezca (según la tolerancia). Al ser por conexión, un centro blanco DENTRO
 * del producto no se borra aunque sea idéntico al fondo. Funciona muy bien
 * con fondos lisos y claros (la foto típica de catálogo); con fondos
 * complejos no hace magia — para eso está la vista previa.
 */

/** El archivo original puede venir del celular: se acepta grande porque acá se comprime. */
export const MAX_ENTRADA_MB = 12;

export const PRESETS_IMAGEN = {
  producto: {
    ancho: 800, alto: 800, modo: 'encajar', fondo: '#ffffff',
    quitarFondo: true, calidad: 0.85,
    titulo: 'Foto de producto',
    hint: 'Ideal 800×800, fondo blanco. Cualquier otra medida se adapta sola (la foto nunca se recorta).',
  },
  banner: {
    ancho: 1920, alto: 600, modo: 'cubrir', fondo: null,
    quitarFondo: false, calidad: 0.82,
    titulo: 'Imagen del slide',
    hint: 'Ideal 1920×600 (apaisada). Otra medida se recorta al centro — revisá la vista previa.',
  },
  categoria: {
    ancho: 600, alto: 600, modo: 'cubrir', fondo: null,
    quitarFondo: false, calidad: 0.82,
    titulo: 'Imagen de categoría',
    hint: 'Ideal 600×600 (cuadrada). Otra medida se recorta al centro — revisá la vista previa.',
  },
  marca: {
    ancho: 400, alto: 200, modo: 'encajar', fondo: null,
    quitarFondo: true, calidad: 0.9,
    titulo: 'Logo de marca',
    hint: 'Ideal 400×200 con fondo transparente. Un logo con fondo blanco se puede limpiar con "Quitar fondo".',
  },
  logo: {
    ancho: 400, alto: 120, modo: 'encajar', fondo: null,
    quitarFondo: true, calidad: 0.9,
    titulo: 'Logo del sitio',
    hint: 'Ideal 400×120 (apaisado) con fondo transparente: es el logo del encabezado del sitio. Sin logo, se muestra el nombre en texto.',
  },
  favicon: {
    ancho: 128, alto: 128, modo: 'encajar', fondo: null,
    quitarFondo: true, calidad: 0.9,
    titulo: 'Favicon',
    hint: 'Cuadrado, ideal 128×128 o más grande: es el ícono de la pestaña del navegador. Conviene un símbolo simple, no el logo completo.',
  },
  /**
   * Foto del comprobante de un gasto. Va en 'encajar' con fondo blanco a
   * propósito: recortar un papel puede cortar justo el total o el CUIT, y una
   * foto de comprobante que no se lee no sirve para nada.
   */
  comprobante: {
    ancho: 1200, alto: 1600, modo: 'encajar', fondo: '#ffffff',
    quitarFondo: false, calidad: 0.78,
    titulo: 'Foto del comprobante',
    hint: 'Sacá la foto derecha y con buena luz. Entra entera, sin recortes: el papel tiene que poder leerse.',
  },
};

/** Lee el archivo elegido como HTMLImageElement listo para dibujar. */
export function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

/**
 * Pasa la imagen por el molde del preset y devuelve un canvas del tamaño
 * final CON TRANSPARENCIA en el relleno (el fondo del preset se aplica recién
 * al exportar, así "quitar fondo" trabaja sobre los píxeles reales).
 */
export function moldear(img, preset) {
  const canvas = document.createElement('canvas');
  canvas.width = preset.ancho;
  canvas.height = preset.alto;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  const escala = preset.modo === 'cubrir'
    ? Math.max(preset.ancho / img.width, preset.alto / img.height)
    : Math.min(preset.ancho / img.width, preset.alto / img.height, 1);
  const w = img.width * escala;
  const h = img.height * escala;
  ctx.drawImage(img, (preset.ancho - w) / 2, (preset.alto - h) / 2, w, h);
  return canvas;
}

/**
 * Vuelve transparente el fondo: estima su color desde el contorno y hace
 * flood-fill desde TODOS los píxeles del borde. `tolerancia` 0-100 (30 ≈
 * fondos lisos; más alto se come sombras y degradés).
 */
export function quitarFondo(canvas, tolerancia = 30) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const im = ctx.getImageData(0, 0, W, H);
  const px = im.data;

  // Color de fondo: promedio de los píxeles OPACOS del contorno (el relleno
  // transparente del molde no cuenta).
  let r = 0; let g = 0; let b = 0; let n = 0;
  const sumar = (i) => {
    if (px[i + 3] < 200) return;
    r += px[i]; g += px[i + 1]; b += px[i + 2]; n += 1;
  };
  for (let x = 0; x < W; x++) { sumar((x) * 4); sumar(((H - 1) * W + x) * 4); }
  for (let y = 0; y < H; y++) { sumar((y * W) * 4); sumar((y * W + W - 1) * 4); }
  if (!n) return canvas; // todo el contorno ya era transparente: nada que hacer
  r /= n; g /= n; b /= n;

  // Distancia máxima al color de fondo para considerarse "fondo".
  const maxDist = (tolerancia / 100) * 255 * Math.sqrt(3) * 0.6;
  const esFondo = (i) => {
    if (px[i + 3] === 0) return true; // relleno del molde: conecta el contorno
    const dr = px[i] - r; const dg = px[i + 1] - g; const db = px[i + 2] - b;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= maxDist;
  };

  // BFS desde el borde: solo se borra lo CONECTADO al contorno.
  const visitado = new Uint8Array(W * H);
  const cola = [];
  for (let x = 0; x < W; x++) { cola.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { cola.push(y * W, y * W + W - 1); }
  while (cola.length) {
    const p = cola.pop();
    if (visitado[p]) continue;
    visitado[p] = 1;
    if (!esFondo(p * 4)) continue;
    px[p * 4 + 3] = 0;
    const x = p % W; const y = (p / W) | 0;
    if (x > 0) cola.push(p - 1);
    if (x < W - 1) cola.push(p + 1);
    if (y > 0) cola.push(p - W);
    if (y < H - 1) cola.push(p + W);
  }

  // Suavizado de borde de 1 píxel: el contorno duro contra el recorte queda
  // serruchado; un alpha intermedio en la frontera lo disimula.
  const alphaOrig = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) alphaOrig[p] = px[p * 4 + 3];
  for (let p = 0; p < W * H; p++) {
    if (alphaOrig[p] === 0) continue;
    const x = p % W; const y = (p / W) | 0;
    const vecinoBorrado = (x > 0 && alphaOrig[p - 1] === 0) || (x < W - 1 && alphaOrig[p + 1] === 0)
      || (y > 0 && alphaOrig[p - W] === 0) || (y < H - 1 && alphaOrig[p + W] === 0);
    if (vecinoBorrado) px[p * 4 + 3] = Math.min(px[p * 4 + 3], 140);
  }

  ctx.putImageData(im, 0, 0);
  return canvas;
}

/**
 * Exporta el canvas listo para subir: aplica el fondo del preset (salvo que
 * se haya quitado el fondo — ahí la transparencia ES el resultado) y comprime
 * a WebP. Si el navegador no sabe exportar WebP (Safari), cae a PNG.
 */
export function exportar(canvas, preset, { fondoQuitado = false } = {}) {
  let final = canvas;
  const fondo = fondoQuitado ? null : preset.fondo;
  if (fondo) {
    final = document.createElement('canvas');
    final.width = canvas.width;
    final.height = canvas.height;
    const ctx = final.getContext('2d');
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, final.width, final.height);
    ctx.drawImage(canvas, 0, 0);
  }
  let dataUrl = final.toDataURL('image/webp', preset.calidad);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = final.toDataURL('image/png');
  const kb = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 / 1024);
  return { dataUrl, kb };
}
