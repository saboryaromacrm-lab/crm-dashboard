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
 * PESO MÍNIMO (5/10/2026, pedido del dueño): `exportar` no usa una calidad
 * fija — baja de a poco hasta entrar en el peso objetivo del preset sin pasar
 * de su calidad mínima. Así cada foto pesa lo menos posible y se sigue viendo bien.
 *
 * ENCUADRE (5/10/2026): `encuadre` = { zoom, x, y } mueve y acerca la foto
 * dentro del molde (x, y de −1 a 1: de un borde al otro), y `recorte` es la
 * parte de la foto que se usa — `detectarContenido` lo calcula solo para que
 * el producto quede centrado y grande, sin el fondo que sobra alrededor.
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
    objetivoKb: 60, calidadMin: 0.6,
    titulo: 'Foto de producto',
    hint: 'Ideal 800×800, fondo blanco. Cualquier otra medida se adapta sola (la foto nunca se recorta).',
  },
  banner: {
    ancho: 1920, alto: 600, modo: 'cubrir', fondo: null,
    quitarFondo: false, calidad: 0.82,
    objetivoKb: 180, calidadMin: 0.6,
    titulo: 'Imagen del slide',
    hint: 'Ideal 1920×600 (apaisada). Otra medida se recorta al centro — revisá la vista previa.',
  },
  categoria: {
    ancho: 600, alto: 600, modo: 'cubrir', fondo: null,
    quitarFondo: false, calidad: 0.82,
    objetivoKb: 40, calidadMin: 0.6,
    titulo: 'Imagen de categoría',
    hint: 'Ideal 600×600 (cuadrada). Otra medida se recorta al centro — revisá la vista previa.',
  },
  marca: {
    ancho: 400, alto: 200, modo: 'encajar', fondo: null,
    quitarFondo: true, calidad: 0.9,
    objetivoKb: 25, calidadMin: 0.7,
    titulo: 'Logo de marca',
    hint: 'Ideal 400×200 con fondo transparente. Un logo con fondo blanco se puede limpiar con "Quitar fondo".',
  },
  logo: {
    ancho: 400, alto: 120, modo: 'encajar', fondo: null,
    quitarFondo: true, calidad: 0.9,
    objetivoKb: 25, calidadMin: 0.7,
    titulo: 'Logo del sitio',
    hint: 'Ideal 400×120 (apaisado) con fondo transparente: es el logo del encabezado del sitio. Sin logo, se muestra el nombre en texto.',
  },
  favicon: {
    ancho: 128, alto: 128, modo: 'encajar', fondo: null,
    quitarFondo: true, calidad: 0.9,
    objetivoKb: 12, calidadMin: 0.7,
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
    objetivoKb: 300, calidadMin: 0.65,
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

export const ENCUADRE_INICIAL = { zoom: 1, x: 0, y: 0 };

/**
 * Dónde y de qué tamaño se dibuja la foto en el molde. `rangoX/rangoY` es
 * cuánto se puede correr (en píxeles del molde) de su posición centrada: la
 * pantalla lo usa para traducir el arrastre del mouse a `encuadre.x/y`.
 */
export function geometria(img, preset, encuadre = ENCUADRE_INICIAL, recorte = null) {
  const r = recorte ?? { sx: 0, sy: 0, sw: img.width, sh: img.height };
  const base = preset.modo === 'cubrir'
    ? Math.max(preset.ancho / r.sw, preset.alto / r.sh)
    : Math.min(preset.ancho / r.sw, preset.alto / r.sh, recorte ? Infinity : 1);
  const escala = base * Math.max(1, Number(encuadre.zoom) || 1);
  const w = r.sw * escala;
  const h = r.sh * escala;
  const rangoX = Math.abs(w - preset.ancho) / 2;
  const rangoY = Math.abs(h - preset.alto) / 2;
  const lim = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
  return {
    ...r, w, h, rangoX, rangoY,
    dx: (preset.ancho - w) / 2 + lim(encuadre.x) * rangoX,
    dy: (preset.alto - h) / 2 + lim(encuadre.y) * rangoY,
  };
}

/**
 * Pasa la imagen por el molde del preset y devuelve un canvas del tamaño
 * final CON TRANSPARENCIA en el relleno (el fondo del preset se aplica recién
 * al exportar, así "quitar fondo" trabaja sobre los píxeles reales).
 */
export function moldear(img, preset, encuadre = ENCUADRE_INICIAL, recorte = null) {
  const canvas = document.createElement('canvas');
  canvas.width = preset.ancho;
  canvas.height = preset.alto;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const g = geometria(img, preset, encuadre, recorte);
  ctx.drawImage(img, g.sx, g.sy, g.sw, g.sh, g.dx, g.dy, g.w, g.h);
  return canvas;
}

/**
 * CENTRAR EL PRODUCTO SOLO: busca dónde está el producto dentro de la foto
 * (lo que se distingue del color del borde) y devuelve ese rectángulo con un
 * margen, para que el molde lo agrande y lo centre. Trabaja sobre una copia
 * chica (rápido aun con fotos del celular). Devuelve null si no hay nada que
 * recortar (fondo no liso, o el producto ya llena la foto).
 */
export function detectarContenido(img, tolerancia = 14) {
  const lado = 220;
  const k = Math.min(1, lado / Math.max(img.width, img.height));
  const W = Math.max(1, Math.round(img.width * k));
  const H = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  let r = 0; let g = 0; let b = 0; let n = 0;
  const sumar = (i) => { r += px[i]; g += px[i + 1]; b += px[i + 2]; n += 1; };
  for (let x = 0; x < W; x++) { sumar(x * 4); sumar(((H - 1) * W + x) * 4); }
  for (let y = 0; y < H; y++) { sumar(y * W * 4); sumar((y * W + W - 1) * 4); }
  r /= n; g /= n; b /= n;
  // El borde tiene que ser parejo: si varía mucho, no es un fondo liso.
  let disp = 0;
  const dist = (i) => Math.hypot(px[i] - r, px[i + 1] - g, px[i + 2] - b);
  for (let x = 0; x < W; x++) disp = Math.max(disp, dist(x * 4), dist(((H - 1) * W + x) * 4));
  for (let y = 0; y < H; y++) disp = Math.max(disp, dist(y * W * 4), dist((y * W + W - 1) * 4));
  if (disp > 90) return null;
  const umbral = (tolerancia / 100) * 255 * Math.sqrt(3) * 0.6;
  let x0 = W; let y0 = H; let x1 = -1; let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i + 3] < 30 || dist(i) <= umbral) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1; const bh = y1 - y0 + 1;
  if (bw < W * 0.08 || bh < H * 0.08) return null; // una mancha: no es el producto
  if (bw > W * 0.94 && bh > H * 0.94) return null; // ya lo llena: nada que recortar
  const margen = Math.max(bw, bh) * 0.06;
  const sx = Math.max(0, (x0 - margen) / k);
  const sy = Math.max(0, (y0 - margen) / k);
  const ex = Math.min(img.width, (x1 + 1 + margen) / k);
  const ey = Math.min(img.height, (y1 + 1 + margen) / k);
  return { sx, sy, sw: ex - sx, sh: ey - sy };
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
  if (!n) {
    /* La foto entró MÁS CHICA que el molde ('encajar' no agranda): quedó
     * centrada con margen transparente y el contorno del canvas no dice nada.
     * Se muestrea entonces el contorno del RECTÁNGULO OPACO — el borde de la
     * foto real — que es donde vive su fondo. Sin esto, una foto de 600×600
     * volvía intacta y el "Quitar fondo" parecía no hacer nada. */
    let x0 = W; let y0 = H; let x1 = -1; let y1 = -1;
    for (let p = 0; p < W * H; p++) {
      if (px[p * 4 + 3] < 200) continue;
      const xx = p % W; const yy = (p / W) | 0;
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
      if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
    }
    if (x1 < 0) return canvas; // no hay ni un píxel opaco: nada que hacer
    for (let xx = x0; xx <= x1; xx++) { sumar((y0 * W + xx) * 4); sumar((y1 * W + xx) * 4); }
    for (let yy = y0; yy <= y1; yy++) { sumar((yy * W + x0) * 4); sumar((yy * W + x1) * 4); }
    if (!n) return canvas;
  }
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
 * a WebP con el MENOR PESO que entra en el objetivo del preset sin bajar de
 * su calidad mínima. Si el navegador no sabe exportar WebP (Safari), cae a PNG.
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
  const pesoKb = (u) => Math.round(((u.length - u.indexOf(',') - 1) * 3) / 4 / 1024);
  let calidad = preset.calidad;
  let dataUrl = final.toDataURL('image/webp', calidad);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = final.toDataURL('image/png');
    return { dataUrl, kb: pesoKb(dataUrl), calidad: 1, formato: 'PNG' };
  }
  const objetivo = preset.objetivoKb ?? Infinity;
  const piso = preset.calidadMin ?? preset.calidad;
  while (pesoKb(dataUrl) > objetivo && calidad - 0.05 >= piso - 1e-9) {
    calidad = Math.round((calidad - 0.05) * 100) / 100;
    dataUrl = final.toDataURL('image/webp', calidad);
  }
  return { dataUrl, kb: pesoKb(dataUrl), calidad, formato: 'WebP' };
}

/** «2,4 MB» / «830 KB» para mostrar lo que pesaba el original. */
export function pesoLegible(bytes) {
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB` : `${Math.round(kb)} KB`;
}
