/**
 * EL HISTORIAL DE TRANSFERENCIAS COMO IMAGEN (7/10/2026).
 *
 * El resumen de una cuenta disponible se le pasa al proveedor por WhatsApp.
 * Sacarle captura a la vista de impresión cortaba la lista (no entra en la
 * pantalla) y la achicaba. Acá se dibuja la hoja —datos de la cuenta con
 * «Transferido» resaltado, y la lista con fecha y hora, monto, comprobante y
 * observación— en una imagen PNG del largo que haga falta.
 *
 * SIN MEMBRETE (7/10/2026, pedido del dueño): la imagen no lleva el logo ni
 * los datos de la empresa (razón social, CUIT, dirección, teléfono); arranca
 * en «Historial de transferencias». El papel de «Imprimir» sí los sigue
 * llevando. Se dibuja a mano en un canvas, sin librerías.
 */
import { configImpresion } from '@core/services/imprimir.js';
import { fmtFechaHora, money } from '@modules/productos/domain/format.js';

const ANCHO = 820;
const PAD = 28;
const ESCALA = 2; // nitidez en pantallas y al hacer zoom en el celular
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const AMARILLO = '#fff176';
const BORDE = '#9a9a9a';

const colorMarca = (c) => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || '').trim()) ? String(c).trim() : '#166534');

/** Parte un texto en renglones que entran en `ancho` (corta palabras larguísimas). */
function partir(ctx, texto, ancho) {
  const palabras = String(texto ?? '').split(/\s+/).filter(Boolean);
  if (!palabras.length) return [''];
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho) { actual = prueba; continue; }
    if (actual) lineas.push(actual);
    let resto = p;
    while (ctx.measureText(resto).width > ancho && resto.length > 1) {
      let i = resto.length - 1;
      while (i > 1 && ctx.measureText(resto.slice(0, i)).width > ancho) i--;
      lineas.push(resto.slice(0, i));
      resto = resto.slice(i);
    }
    actual = resto;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/**
 * Arma el PNG. Dos pasadas con el mismo código: la primera solo mide (para
 * saber el alto), la segunda dibuja.
 */
export async function imagenResumenCuenta(cuenta, pagos) {
  /* Solo el color de la marca, para el título (sin logo ni datos de la empresa). */
  const { empresa } = await configImpresion();
  const color = colorMarca(empresa.colorMarca);

  const COLS = [
    { h: 'Fecha y hora', w: 170, v: (p) => fmtFechaHora(p.fecha) },
    { h: 'Monto', w: 150, der: true, negrita: true, v: (p) => money(p.importe) },
    { h: 'Comprobante', w: 180, v: (p) => p.documento?.etiqueta || '—' },
    { h: 'Obs.', w: ANCHO - 2 * PAD - 500, v: (p) => p.observaciones || '' },
  ];
  const INFO = [
    ['Titular', cuenta.titular],
    ['Alias / CBU', cuenta.cbuAlias],
    ['A cubrir', money(cuenta.importe)],
    ['Transferido', `${money(cuenta.pagado)} en ${cuenta.cant} transferencia${cuenta.cant === 1 ? '' : 's'}`, true],
    ['Falta', money(cuenta.falta)],
  ];

  const dibujar = (ctx, pintar) => {
    const texto = (t, x, y, { size = 14, peso = 400, col = '#111', alinear = 'left' } = {}) => {
      ctx.font = `${peso} ${size}px ${FUENTE}`;
      ctx.textAlign = alinear;
      ctx.textBaseline = 'middle';
      if (pintar) { ctx.fillStyle = col; ctx.fillText(String(t ?? ''), x, y); }
    };
    const rect = (x, y, w, h, relleno) => {
      if (!pintar) return;
      if (relleno) { ctx.fillStyle = relleno; ctx.fillRect(x, y, w, h); }
      ctx.strokeStyle = BORDE; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };
    if (pintar) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ANCHO, ctx.canvas.height / ESCALA); }

    // Título (arriba de todo: sin membrete)
    let y = PAD + 12;
    texto('Historial de transferencias', PAD, y, { size: 20, peso: 800, col: color });
    y += 24;
    texto(cuenta.proveedorNombre, PAD, y, { size: 13, col: '#555' });
    y += 20;

    // Datos de la cuenta («Transferido» con marcador amarillo)
    const labW = 140;
    for (const [k, v, resaltar] of INFO) {
      const h = 34;
      rect(PAD, y, labW, h, resaltar ? AMARILLO : null);
      rect(PAD + labW - 1, y, ANCHO - 2 * PAD - labW + 1, h, resaltar ? AMARILLO : null);
      texto(k, PAD + 10, y + h / 2, { size: 14, peso: 700 });
      texto(v, PAD + labW + 10, y + h / 2, { size: 14, peso: resaltar ? 700 : 400 });
      y += h - 1;
    }
    y += 16;

    // Lista de transferencias
    const altoCab = 34;
    let cx = PAD;
    for (const c of COLS) {
      rect(cx, y, c.w, altoCab, '#eeeeee');
      texto(c.h, c.der ? cx + c.w - 10 : cx + 10, y + altoCab / 2, { size: 14, peso: 700, alinear: c.der ? 'right' : 'left' });
      cx += c.w - 1;
    }
    y += altoCab - 1;
    if (!pagos.length) {
      rect(PAD, y, ANCHO - 2 * PAD, 34);
      texto('Todavía no recibió transferencias.', PAD + 10, y + 17, { size: 14, col: '#555' });
      y += 33;
    }
    for (const p of pagos) {
      ctx.font = `400 14px ${FUENTE}`;
      const celdas = COLS.map((c) => partir(ctx, c.v(p), c.w - 20));
      const h = Math.max(...celdas.map((l) => l.length)) * 18 + 16;
      cx = PAD;
      COLS.forEach((c, i) => {
        rect(cx, y, c.w, h);
        celdas[i].forEach((l, j) => texto(l, c.der ? cx + c.w - 10 : cx + 10, y + 17 + j * 18,
          { size: 14, peso: c.negrita ? 700 : 400, alinear: c.der ? 'right' : 'left' }));
        cx += c.w - 1;
      });
      y += h - 1;
    }
    y += 18;
    texto(`Generado el ${fmtFechaHora(new Date().toISOString())}`, PAD, y, { size: 11, col: '#777' });
    return y + PAD;
  };

  const medir = document.createElement('canvas').getContext('2d');
  const alto = Math.ceil(dibujar(medir, false));
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO * ESCALA;
  canvas.height = alto * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  dibujar(ctx, true);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo armar la imagen.'))), 'image/png'));
}

/**
 * Copia la imagen al portapapeles (para pegarla con Ctrl+V en WhatsApp). La
 * promesa va DENTRO del ClipboardItem: así el navegador cuenta el clic aunque
 * la imagen tarde en armarse. Si el navegador no deja copiar imágenes, se
 * descarga el archivo. Devuelve 'copiada' o 'descargada'.
 */
export async function copiarImagenResumen(cuenta, pagos) {
  const blob = imagenResumenCuenta(cuenta, pagos);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copiada';
    } catch { /* sin permiso o sin soporte: se descarga */ }
  }
  const url = URL.createObjectURL(await blob);
  const a = document.createElement('a');
  const nombre = String(cuenta.proveedorNombre || 'proveedor').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  a.href = url;
  a.download = `transferencias-${nombre}-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'descargada';
}
