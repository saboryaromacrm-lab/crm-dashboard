/**
 * MOTOR DE IMPRESIÓN — el único lugar que arma un documento imprimible
 * ============================================================================
 * Cada documento del sistema (ticket del POS, presupuesto, hoja de armado,
 * listas de preparación) llama a `imprimirDocumento(tipoDoc, {...})` y el
 * motor resuelve TODO desde la configuración de Sistema:
 *
 *   - el FORMATO asignado al documento (rollo 80/58 mm · A4 · Carta), con su
 *     `@page`, tipografías y anchos;
 *   - el ENCABEZADO de la empresa (logo + nombre + CUIT/dirección/teléfono);
 *   - el color de marca (solo en A4/Carta: las térmicas son blanco y negro);
 *   - la leyenda "Documento no fiscal" y el pie configurable.
 *
 * La impresión sale por el diálogo del navegador (decisión del usuario). En la
 * PC de la caja, Chrome con `--kiosk-printing` imprime directo sin diálogo.
 */
import QRCode from 'qrcode';
import { httpClient } from './httpClient.js';
import { barcodeSvg } from './barcode.js';

/**
 * ESCAPA UN DATO PARA METERLO EN EL HTML DEL DOCUMENTO.
 *
 * Se exporta porque el `cuerpo` de cada documento lo arman los paneles, y ahí
 * es donde entran los datos de verdad: el nombre del producto, el del cliente y
 * —la que importa— las observaciones de un pedido del sitio, que las escribe
 * cualquiera desde internet. Un `<` en cualquiera de esos campos no puede
 * empezar una etiqueta.
 */
export const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FORMATOS = {
  rollo80: { page: '80mm auto', margen: '3mm', font: '11px', chica: '9.5px', rollo: true },
  rollo58: { page: '58mm auto', margen: '2mm', font: '10px', chica: '9px', rollo: true },
  a4: { page: 'A4', margen: '14mm', font: '13px', chica: '12px', rollo: false },
  carta: { page: 'letter', margen: '14mm', font: '13px', chica: '12px', rollo: false },

  /*
   * ETIQUETAS AUTOADHESIVAS — impresora térmica de etiquetas.
   *
   * Una etiqueta ES una página: la térmica avanza el rollo por página, así que
   * el `@page` tiene que medir lo que mide la etiqueta y el margen es el borde
   * blanco que la impresora no puede pisar. No llevan membrete ni pie: en 30 mm
   * de alto, el logo se come el precio. `bcMm` es cuánto alto se le da al
   * código de barras; `anchoMm`/`margen` los usa la pantalla para avisar si el
   * código quedó demasiado fino para el lector.
   */
  etiqueta50x30: { page: '50mm 30mm', anchoMm: 50, altoMm: 30, margen: '1.5mm', bcMm: 8, font: '8.5px', chica: '7px', etiqueta: true },
  etiqueta50x25: { page: '50mm 25mm', anchoMm: 50, altoMm: 25, margen: '1.5mm', bcMm: 7, font: '8px', chica: '6.5px', etiqueta: true },
  etiqueta40x25: { page: '40mm 25mm', anchoMm: 40, altoMm: 25, margen: '1mm', bcMm: 6.5, font: '7.5px', chica: '6px', etiqueta: true },
  etiqueta60x40: { page: '60mm 40mm', anchoMm: 60, altoMm: 40, margen: '2mm', bcMm: 12, font: '10px', chica: '8px', etiqueta: true },
};

export const FORMATOS_LABEL = {
  rollo80: 'Rollo 80 mm (recomendado)',
  rollo58: 'Rollo 58 mm (posnet / portátil)',
  a4: 'Hoja A4',
  carta: 'Hoja Carta',
  etiqueta50x30: 'Etiqueta 50 × 30 mm (recomendada)',
  etiqueta50x25: 'Etiqueta 50 × 25 mm',
  etiqueta40x25: 'Etiqueta 40 × 25 mm (chica)',
  etiqueta60x40: 'Etiqueta 60 × 40 mm (grande)',
};

/** Formato de etiqueta o de papel: decide qué opciones ofrece cada documento. */
export function esFormatoEtiqueta(formato) {
  return !!FORMATOS[formato]?.etiqueta;
}

/**
 * Medidas de una etiqueta en milímetros, para quien necesite calcular sobre el
 * papel (hoy: cuán fino queda el código de barras). `null` si no es etiqueta.
 */
export function medidaEtiqueta(formato) {
  const f = FORMATOS[formato];
  if (!f?.etiqueta) return null;
  const margen = parseFloat(f.margen) || 0;
  return { anchoMm: f.anchoMm, altoMm: f.altoMm, anchoUtilMm: f.anchoMm - margen * 2 };
}

/**
 * Con qué formato sale un documento si la configuración todavía no lo tiene
 * (config vieja, o un documento nuevo). Para el papel es A4; para las etiquetas
 * NO puede ser A4 —saldría una etiqueta gigante con membrete— así que cada
 * documento de etiqueta declara acá su tamaño de arranque.
 */
const DEFECTO_DOC = { etiquetaFraccionado: 'etiqueta50x30' };
export function formatoPorDefecto(tipoDoc) {
  return DEFECTO_DOC[tipoDoc] || 'a4';
}

/* La config se pide una vez por minuto: cambiarla en Sistema impacta al toque. */
let _cache = null;
let _cacheAt = 0;
export async function configImpresion() {
  if (_cache && Date.now() - _cacheAt < 60000) return _cache;
  const [empresa, impresion] = await Promise.all([
    httpClient.get('/configuracion/empresa'),
    httpClient.get('/configuracion/impresion'),
  ]);
  _cache = { empresa, impresion };
  _cacheAt = Date.now();
  return _cache;
}
export function invalidarConfigImpresion() { _cache = null; }

/**
 * NADA DE LO QUE ES DATO SE INTERPOLA CRUDO.
 *
 * El documento se arma concatenando texto, así que cada valor que viene de la
 * base o de la configuración es una oportunidad de inyectar HTML. Y no es
 * teórico ni interno: el campo "observaciones" de un pedido del sitio lo
 * escribe **cualquiera desde internet, sin cuenta**, y termina en este
 * documento cuando el vendedor lo imprime. La ventana de impresión se abre con
 * `about:blank`, que HEREDA EL ORIGEN del dashboard — o sea que un script ahí
 * adentro lee el token de sesión de quien imprimió.
 *
 * Tres candados, y ninguno reemplaza a los otros:
 *   1. `esc()` en todo lo que es dato (acá y en los cuerpos que arman los paneles);
 *   2. formato validado para lo que NO se arregla escapando —el color entra
 *      adentro de `<style>`, donde las entidades HTML no protegen, y el logo
 *      entra en un `src`—;
 *   3. una CSP en el propio documento que prohíbe ejecutar script, para que un
 *      olvido futuro en (1) no vuelva a abrir esto.
 */

/** Un color de marca y nada más: `#abc` o `#aabbcc`. Cualquier otra cosa, el default. */
const colorSeguro = (v, porDefecto) => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(v ?? '').trim())
  ? String(v).trim() : porDefecto);

/** El logo solo puede ser una imagen embebida. Un `data:text/html` no es un logo. */
const logoSeguro = (v) => (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(v ?? '').trim())
  ? String(v).trim() : '');

/**
 * La CSP del documento impreso. Va como `<meta>` porque el HTML no se sirve por
 * HTTP (se escribe en la ventana), y arriba de todo para que aplique desde el
 * primer byte. `script-src` no está en la lista: con `default-src 'none'`, no
 * corre ningún script — ni inline, ni de un `onerror`, ni de ningún lado.
 * Imágenes y estilos sí, que es todo lo que un impreso necesita.
 */
const CSP_IMPRESION = "default-src 'none'; img-src data: blob: https: http:; "
  + "style-src 'unsafe-inline'; font-src data:";

/**
 * Documento COMPLETO como HTML (lo usa la impresión y la vista previa de
 * Sistema). `cuerpo` es el contenido propio del documento (título, tablas…);
 * el motor pone página, empresa, estilos y pie.
 *
 * `cuerpo` es HTML A PROPÓSITO —trae tablas y filas— así que NO se escapa acá:
 * lo escapa quien lo arma, dato por dato. Es la única entrada que queda cruda,
 * y por eso existe el candado 3.
 */
export function htmlDocumento({ empresa, formato, titulo, cuerpo, pie = '', esTicket = false }) {
  const f = FORMATOS[formato] || FORMATOS.a4;
  // La etiqueta no es un documento chico: no lleva membrete, ni pie, ni bordes,
  // y cada una es una página del rollo. Sale por su propio camino.
  if (f.etiqueta) return htmlEtiquetas({ f, titulo, cuerpo });
  const color = f.rollo ? '#111' : colorSeguro(empresa.colorMarca, '#166534');
  /* El nombre GRANDE es el de fantasía, que es con el que el cliente conoce al
   * negocio. La razón social va abajo, en la línea de datos, y SOLO si es otra:
   * repetirla cuando coinciden es ruido en un rollo de 58 mm. En la factura la
   * razón social además figura como "Emisor", que es donde la exige la RG 1415;
   * acá está para que el papel diga quién cobra aunque no sea fiscal. */
  const razon = String(empresa.razonSocial || '').trim();
  const datos = [
    razon && razon !== String(empresa.nombre || '').trim() && esc(razon),
    empresa.cuit && `CUIT ${esc(empresa.cuit)}`,
    esc(empresa.direccion),
    esc(empresa.telefono),
  ].filter(Boolean).join(' · ');
  // Una sola vez: la vista previa de Sistema rearma el documento en CADA tecla,
  // y el logo son ~533 KB de base64 — validarlo dos veces era regex y copia por
  // duplicado en cada pulsación.
  const src = logoSeguro(empresa.logo);
  const logo = src ? `<img class="logo" src="${src}" alt="" />` : '';
  return `<!doctype html><html><head><meta charset="utf-8" />`
    + `<meta http-equiv="Content-Security-Policy" content="${CSP_IMPRESION}" />`
    + `<title>${esc(titulo)}</title><style>
    @page { size: ${f.page}; margin: ${f.margen}; }
    * { box-sizing: border-box; }
    body { font: ${f.font}/1.45 ${f.rollo ? "'Courier New', monospace" : 'system-ui, sans-serif'}; margin: 0; color: #111; }
    .emp { display: flex; align-items: center; gap: ${f.rollo ? '6px' : '14px'}; border-bottom: 2px solid ${color}; padding-bottom: ${f.rollo ? '4px' : '10px'}; margin-bottom: ${f.rollo ? '6px' : '14px'}; ${f.rollo ? 'flex-direction: column; text-align: center;' : ''} }
    .logo { max-height: ${f.rollo ? '34px' : '58px'}; max-width: ${f.rollo ? '46mm' : '70mm'}; ${f.rollo ? 'filter: grayscale(1);' : ''} }
    .empNombre { font-size: ${f.rollo ? '13px' : '19px'}; font-weight: 800; color: ${color}; }
    .empDatos { font-size: ${f.chica}; color: #555; }
    h1 { font-size: ${f.rollo ? '12px' : '17px'}; margin: 0; color: ${color}; }
    .sub { color: #555; margin: 2px 0 ${f.rollo ? '6px' : '12px'}; font-size: ${f.chica}; }
    table { width: 100%; border-collapse: collapse; font-size: ${f.rollo ? f.chica : f.font}; margin-top: 6px; }
    th, td { text-align: left; vertical-align: top; padding: ${f.rollo ? '2px 3px' : '7px 8px'}; ${f.rollo ? 'border-bottom: 1px dashed #999;' : 'border: 1px solid #999;'} }
    th { ${f.rollo ? '' : 'background: #eee;'} white-space: nowrap; ${f.rollo ? 'border-bottom: 1px solid #111;' : ''} }
    .n { text-align: right; white-space: nowrap; }
    .chica { white-space: nowrap; width: 1%; }
    .prep { width: 88px; }
    .obs { width: 34%; }
    .c { text-align: center; width: 32px; font-size: 16px; }
    .tot { margin-top: ${f.rollo ? '6px' : '12px'}; text-align: right; font-size: ${f.rollo ? '12px' : '15px'}; }
    .nota { margin-top: ${f.rollo ? '8px' : '14px'}; color: #555; font-size: ${f.chica}; ${esTicket ? 'text-align: center;' : ''} }
    .fiscal { margin-top: 6px; text-align: center; font-size: ${f.chica}; color: #555; letter-spacing: 0.06em; }

    /* ---- Comprobante fiscal (RG 1415 y RG 4892) ---- */
    /* El recuadro de la letra: es lo primero que se mira para saber qué
       comprobante es, así que va grande y centrado. */
    .letraBox {
      border: 2px solid #111; text-align: center; margin: ${f.rollo ? '4px auto 6px' : '0 auto 12px'};
      width: ${f.rollo ? '18mm' : '24mm'}; padding: ${f.rollo ? '1px 0' : '3px 0'};
    }
    .letraBox .letra { font-size: ${f.rollo ? '20px' : '30px'}; font-weight: 800; line-height: 1; }
    .letraBox .cod { font-size: ${f.chica}; }
    .fiscalDatos { font-size: ${f.chica}; ${f.rollo ? '' : 'display: flex; gap: 18px;'} }
    .fiscalDatos > div { flex: 1; }
    .fiscalDatos strong { display: inline-block; min-width: ${f.rollo ? '0' : '78px'}; }
    .cajaCae {
      margin-top: ${f.rollo ? '8px' : '14px'}; border-top: 1px solid #111; padding-top: 6px;
      ${f.rollo ? 'text-align: center;' : 'display: flex; align-items: center; gap: 14px;'}
    }
    .cajaCae .qr { width: ${f.rollo ? '26mm' : '32mm'}; height: ${f.rollo ? '26mm' : '32mm'}; flex: 0 0 auto; }
    .cajaCae .qr svg { width: 100%; height: 100%; display: block; }
    .caeNro { font-family: 'Courier New', monospace; font-size: ${f.rollo ? '12px' : '15px'}; font-weight: 700; letter-spacing: 0.04em; }
  </style></head><body>
    <div class="emp">${logo}<div><div class="empNombre">${esc(empresa.nombre || '')}</div>${datos ? `<div class="empDatos">${datos}</div>` : ''}</div></div>
    ${cuerpo}
    ${pie ? `<div class="nota">${esc(pie)}</div>` : ''}
  </body></html>`;
}

/**
 * La hoja de etiquetas: N bloques `.et`, uno por etiqueta, cada uno del tamaño
 * exacto del adhesivo.
 *
 * El salto va con `break-before` en la etiqueta SIGUIENTE y no con
 * `break-after` en cada una: con `break-after` la última deja una página vacía
 * detrás y en un rollo eso es un adhesivo desperdiciado por cada impresión.
 */
function htmlEtiquetas({ f, titulo, cuerpo }) {
  return `<!doctype html><html><head><meta charset="utf-8" />`
    + `<meta http-equiv="Content-Security-Policy" content="${CSP_IMPRESION}" />`
    + `<title>${esc(titulo)}</title><style>
    @page { size: ${f.page}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font: ${f.font}/1.15 system-ui, sans-serif; color: #000; }
    .et {
      width: ${f.anchoMm}mm; height: ${f.altoMm}mm; padding: ${f.margen};
      display: flex; flex-direction: column; justify-content: space-between;
      overflow: hidden; text-align: center;
    }
    .et + .et { break-before: page; page-break-before: always; }
    /* Dos líneas para el nombre, y si no entra se corta CON puntos suspensivos:
       un nombre cortado en seco parece el nombre completo del producto. */
    .nom {
      font-weight: 800; font-size: 1.15em; line-height: 1.05;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .fila { display: flex; align-items: baseline; justify-content: space-between; gap: 1mm; }
    .peso { font-weight: 700; }
    .precio { font-weight: 800; font-size: 1.35em; white-space: nowrap; }
    .bc { height: ${f.bcMm}mm; }
    .cod { font-family: 'Courier New', monospace; font-size: ${f.chica}; letter-spacing: 0.08em; }
    .sincod { font-size: ${f.chica}; color: #444; padding: 1mm 0; }
    .vto { font-size: ${f.chica}; font-weight: 700; }

    /* CARTEL DE GÓNDOLA. Centrado y repartido en alto: la etiqueta del paquete
       se apoya arriba porque abajo lleva el código de barras; el cartel no
       tiene código, así que si no se reparte queda todo pegado al techo. */
    .cartel { text-align: center; justify-content: space-evenly; }
    .cartel .marca { font-weight: 700; font-size: 1em; letter-spacing: 0.06em; text-transform: uppercase; }
    /* El nombre GRANDE, que es la razón de ser de este cartel. Dos renglones
       como máximo: al tercero ya no entra el precio, y un cartel sin precio no
       sirve para nada. */
    .cartel .nomGrande {
      font-weight: 800; font-size: 1.9em; line-height: 1.03;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .cartel .fila { justify-content: center; gap: 2mm; }
    .cartel .rot { font-size: ${f.chica}; text-transform: uppercase; letter-spacing: 0.05em; }
    .cartel .precio { font-size: 1.6em; }
  </style></head><body>${cuerpo}</body></html>`;
}

/** Tope de una tanda: un error de tipeo no puede vaciar el rollo entero. */
export const MAX_ETIQUETAS = 500;

/**
 * ETIQUETAS de un fraccionado, `cantidad` veces.
 *
 * Es la MISMA función que alimenta la vista previa y la impresora: una etiqueta
 * que se ve distinta de la que sale del rollo es peor que no tener vista previa.
 * Recibe todo ya formateado (precio con separadores, fecha DD/MM/AAAA): acá no
 * se decide ni precio ni redondeo, eso es del catálogo.
 */
export function cuerpoEtiquetas({ nombre, peso, precio, codigo, vencimiento, cantidad = 1 }) {
  const svg = barcodeSvg(codigo, { alto: 30 });
  const una = `<div class="et">`
    + `<div class="nom">${esc(nombre)}</div>`
    + `<div class="fila"><span class="peso">${esc(peso)}</span><span class="precio">${esc(precio)}</span></div>`
    + (svg
      ? `<div class="bc">${svg}</div><div class="cod">${esc(codigo)}</div>`
      : '<div class="sincod">sin código de barras</div>')
    + (vencimiento ? `<div class="vto">Vto ${esc(vencimiento)}</div>` : '')
    + '</div>';
  const n = Math.min(MAX_ETIQUETAS, Math.max(1, Math.round(Number(cantidad) || 1)));
  return una.repeat(n);
}

/**
 * CARTEL DE GÓNDOLA (0083) — el que lee el CLIENTE en el estante.
 *
 * Misma familia que la etiqueta del fraccionado y a propósito: es el mismo
 * rollo, la misma impresora y el mismo tamaño de siempre. Tres diferencias, y
 * las tres salen de para quién es:
 *
 *  · **El nombre va grande.** La etiqueta del paquete se lee en la mano; el
 *    cartel, a un metro. Es la diferencia que se pidió y la razón de que esto
 *    exista aparte.
 *  · **No lleva código de barras.** Nadie escanea un cartel: sirve para que el
 *    cliente vea el precio sin preguntarle al cajero.
 *  · **Hasta dos precios.** Algunos productos tienen mayorista y minorista;
 *    otros solo minorista. La segunda línea aparece si hay dato y no si no —
 *    no hay que configurar nada por producto.
 *
 * TODA LÍNEA VACÍA DESAPARECE, y eso no es cosmético: es lo que permite el
 * cartel de la marca sola para toda una góndola. Sin eso quedaría un hueco
 * donde debería ir el nombre y el cartel saldría torcido.
 *
 * Los precios llegan YA FORMATEADOS y con IVA. Acá no se decide ni precio ni
 * redondeo: eso es del catálogo, el mismo que cobra la caja.
 */
export function cuerpoCartelGondola({
  marca, nombre, precio, precioMayorista, etiquetaPrecio = 'minorista',
  etiquetaPrecioMayorista = 'mayorista', cantidad = 1,
}) {
  const linea = (clase, txt) => (txt ? `<div class="${clase}">${esc(txt)}</div>` : '');
  const fila = (rot, val) => (val
    ? `<div class="fila"><span class="rot">${esc(rot)}</span><span class="precio">${esc(val)}</span></div>`
    : '');
  const una = '<div class="et cartel">'
    + linea('marca', marca)
    + linea('nomGrande', nombre)
    + fila(etiquetaPrecio, precio)
    + fila(etiquetaPrecioMayorista, precioMayorista)
    + '</div>';
  const n = Math.min(MAX_ETIQUETAS, Math.max(1, Math.round(Number(cantidad) || 1)));
  return una.repeat(n);
}

/**
 * PLANILLA DEL CONTROL DE STOCK — la hoja que se lleva a la góndola.
 *
 * Es la MISMA función que alimenta la vista previa de Sistema y la impresora.
 *
 * Dos decisiones que no son cosméticas:
 *
 *  · **No lleva la cantidad del sistema. Nunca**, ni siquiera cuando el control
 *    no es ciego y la pantalla la muestra. El sentido de la hoja es escribir lo
 *    que hay en el estante; un número impreso al lado del casillero es el número
 *    que se termina copiando, y entonces el control no controla nada. La
 *    comparación la hace el sistema después, que para eso guarda el instante.
 *
 *  · **Los apartados SÍ van**, y en negrita. Es mercadería que está físicamente
 *    ahí pero ya separada para un envío: si el que cuenta la suma, la diferencia
 *    da un sobrante que no existe. La hoja tiene que decir "de estos, N no los
 *    cuentes" o repite en papel el error que la pantalla evita.
 *
 * `filas` = renglones del conteo tal como los devuelve la API, más el `codigo`
 * que resuelve la pantalla desde el catálogo.
 */
export function cuerpoPlanillaConteo({ titulo, alcance, sucursal, filas, impresa, hoja = '' }) {
  const rows = filas.map((f) => `
    <tr>
      <td>${esc(f.nombre)}${f.presLabel ? ` <strong>· ${esc(f.presLabel)}</strong>` : ''}${
        f.recontar ? ' <strong>⟳ RECONTAR</strong>' : ''}</td>
      <td class="chica">${esc(f.codigo || '')}</td>
      <td class="chica">${esc(f.unidad || '')}</td>
      <td class="chica n">${f.apartados > 1e-9 ? `<strong>${esc(f.apartados)} ⚠</strong>` : '—'}</td>
      <td class="prep"></td>
      <td class="c">&#9744;</td>
    </tr>`).join('');
  return `
    <h1>${esc(titulo)} — control de stock</h1>
    <div class="sub">${esc(alcance)} · ${esc(sucursal)} · ${filas.length} renglón(es)${
      hoja ? ` · ${esc(hoja)}` : ''} · impresa ${esc(impresa)}</div>
    <div class="sub">Contó: ______________________ &nbsp;&nbsp; Fecha y hora: ______________
      &nbsp;&nbsp; <strong>Anotá lo que HAY en el estante.</strong> La columna
      <strong>Apartados</strong> es mercadería ya separada para un envío: NO la cuentes.</div>
    <table><thead><tr>
      <th>Producto</th><th>Código</th><th>Unidad</th><th>Apartados</th><th>Contado</th><th>&#10003;</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

/* ==================================================================== *
 * LOS COMPROBANTES QUE SE REIMPRIMEN
 * ====================================================================
 * Cuatro documentos que hasta ahora no existían en papel: el remito de una
 * transferencia recibida, el vale de un movimiento de stock, la ficha de un
 * gasto y la orden de pago a un proveedor.
 *
 * TODOS SON REIMPRESIONES, y eso cambia una cosa: el papel tiene que decir
 * **cuándo se imprimió**, porque no sale en el momento del hecho. Un remito
 * sin fecha de impresión, encontrado dentro de tres meses, no se distingue de
 * uno emitido el día de la recepción — y si la transferencia cambió de estado
 * en el medio, el papel viejo miente. Por eso todos llevan el sello abajo.
 *
 * Ninguno inventa datos: se arman con lo que la pantalla ya tiene a la vista.
 * Un documento impreso que muestre algo que la pantalla no muestra es una
 * segunda fuente de verdad, y a la larga las dos divergen.
 */

/** El pie de toda reimpresión: quién la sacó y cuándo. */
function selloReimpresion(usuario, ahora) {
  return `<div class="fiscal">Reimpreso el ${esc(ahora)}${
    usuario ? ` por ${esc(usuario)}` : ''} · documento interno, sin valor fiscal</div>`;
}

/**
 * REMITO DE UNA TRANSFERENCIA.
 *
 * Las tres cantidades van juntas —pedido, enviado, recibido— y no es
 * redundancia: la diferencia entre ellas ES el documento. Pedido contra
 * enviado dice qué no había en el depósito; enviado contra recibido, qué se
 * perdió en el camino. Con una sola columna no se puede reclamar nada.
 */
export function cuerpoRemitoTransferencia({
  transferencia: t, origen, destino, filas, hist, monto, moneda, ahora, usuario,
}) {
  const rows = filas.map((f) => {
    const falto = f.recibido != null && f.enviado != null && f.recibido < f.enviado - 1e-9;
    return `
    <tr>
      <td>${esc(f.nombre)}${f.presLabel ? ` <strong>· ${esc(f.presLabel)}</strong>` : ''}</td>
      <td class="n">${esc(f.pedido ?? '—')}</td>
      <td class="n">${esc(f.enviado ?? '—')}</td>
      <td class="n">${f.recibido != null ? `${falto ? '<strong>' : ''}${esc(f.recibido)}${falto ? ' ⚠</strong>' : ''}` : '—'}</td>
    </tr>`;
  }).join('');
  const pasos = (hist ?? []).map((h) => `${esc(h.estado)} ${esc(h.fecha)}${h.usuario ? ` (${esc(h.usuario)})` : ''}`).join(' · ');
  return `
    <h1>Remito ${esc(t.codigo)}</h1>
    <div class="sub"><strong>${esc(origen)}</strong> → <strong>${esc(destino)}</strong> · ${esc(t.estado)}</div>
    ${monto != null ? `<div class="sub">Monto a costo: ${esc(moneda(monto))}</div>` : ''}
    ${t.observaciones ? `<div class="sub">Observaciones: ${esc(t.observaciones)}</div>` : ''}
    <table><thead><tr>
      <th>Producto</th><th class="n">Pedido</th><th class="n">Enviado</th><th class="n">Recibido</th>
    </tr></thead><tbody>${rows}</tbody></table>
    ${pasos ? `<div class="nota">${pasos}</div>` : ''}
    <div class="nota">Recibí conforme: ______________________ &nbsp;&nbsp; Aclaración: ______________________</div>
    ${selloReimpresion(usuario, ahora)}`;
}

/**
 * VALE DE UNA OPERACIÓN DE ALMACÉN — el papel que se firma y se archiva.
 *
 * `datos` es una lista de pares `[etiqueta, valor]` en vez de campos fijos, y
 * es a propósito: lo pide **Operaciones** (el libro del almacén, una fila por
 * documento: código, concepto, monto) y también el **Historial** de Compras
 * (una fila por movimiento: producto, presentación, cantidad). Son dos formas
 * distintas de la misma hoja, y con campos fijos habría que inventarle a cada
 * una los del otro — o duplicar el markup, que es peor.
 *
 * Los pares sin valor se caen solos: una etiqueta con la raya al lado no
 * informa nada y en un rollo de 80 mm ocupa un renglón que sí sirve.
 */
export function cuerpoValeOperacion({ titulo, subtitulo, datos, ahora, usuario }) {
  const filas = (datos ?? [])
    .filter(([, valor]) => valor != null && String(valor).trim() !== '')
    .map(([etiqueta, valor]) => `
      <tr><td class="chica"><strong>${esc(etiqueta)}</strong></td><td>${esc(valor)}</td></tr>`)
    .join('');
  return `
    <h1>${esc(titulo)}</h1>
    ${subtitulo ? `<div class="sub">${esc(subtitulo)}</div>` : ''}
    <table><tbody>${filas}</tbody></table>
    <div class="nota">Firma: ______________________ &nbsp;&nbsp; Aclaración: ______________________</div>
    ${selloReimpresion(usuario, ahora)}`;
}

/**
 * FICHA DE UN GASTO — para archivar junto al papel del proveedor.
 *
 * Lleva el desglose de IVA y percepciones porque es lo que se cruza contra el
 * comprobante original cuando algo no cierra. El total va al final y en grande:
 * es el número que se compara primero.
 */
export function cuerpoComprobanteGasto({ gasto: g, filas, moneda, ahora, usuario }) {
  const fila = (etiqueta, valor) => (valor
    ? `<tr><td class="chica"><strong>${esc(etiqueta)}</strong></td><td>${esc(valor)}</td></tr>`
    : '');
  const detalle = (filas ?? []).map((f) => `
    <tr><td>${esc(f.concepto)}</td><td class="n">${esc(moneda(f.importe))}</td></tr>`).join('');
  return `
    <h1>Gasto ${esc(g.numero || '')}</h1>
    <div class="sub">${esc(g.fecha)}${g.rubro ? ` · ${esc(g.rubro)}` : ''}</div>
    <table><tbody>
      ${fila('Proveedor', g.proveedor)}
      ${fila('Comprobante', g.comprobante)}
      ${fila('Sucursal', g.sucursal)}
      ${fila('Vencimiento', g.vencimiento)}
      ${fila('Estado', g.estado)}
    </tbody></table>
    ${detalle ? `<table><thead><tr><th>Concepto</th><th class="n">Importe</th></tr></thead><tbody>${detalle}</tbody></table>` : ''}
    <div class="tot"><strong>TOTAL ${esc(moneda(g.total))}</strong></div>
    ${g.observaciones ? `<div class="nota">${esc(g.observaciones)}</div>` : ''}
    ${selloReimpresion(usuario, ahora)}`;
}

/**
 * ORDEN DE PAGO — el recibo que se le entrega al proveedor.
 *
 * ES EL ÚNICO DE LOS CUATRO QUE SALE DE LA CASA, y por eso lleva dos cosas que
 * los otros no: el detalle de **qué se está cancelando** (si no, el proveedor
 * no puede imputarlo en su cuenta) y un lugar para firmar. El total pagado va
 * separado del detalle porque pueden no coincidir: un pago a cuenta no imputa
 * a ninguna factura y sigue siendo plata que se entregó.
 */
export function cuerpoOrdenDePago({ pago: p, imputaciones, moneda, ahora, usuario }) {
  const fila = (etiqueta, valor) => (valor
    ? `<tr><td class="chica"><strong>${esc(etiqueta)}</strong></td><td>${esc(valor)}</td></tr>`
    : '');
  const detalle = (imputaciones ?? []).map((i) => `
    <tr>
      <td>${esc(i.concepto)}</td>
      <td class="chica">${esc(i.fecha || '')}</td>
      <td class="n">${esc(moneda(i.importe))}</td>
    </tr>`).join('');
  const imputado = (imputaciones ?? []).reduce((a, i) => a + (Number(i.importe) || 0), 0);
  const aCuenta = (Number(p.total) || 0) - imputado;
  return `
    <h1>Orden de pago ${esc(p.numero || '')}</h1>
    <div class="sub">${esc(p.fecha)}${p.sucursal ? ` · ${esc(p.sucursal)}` : ''}</div>
    <table><tbody>
      ${fila('Proveedor', p.proveedor)}
      ${fila('Medio de pago', p.medio)}
      ${fila('Referencia', p.referencia)}
    </tbody></table>
    ${detalle ? `
      <h1 style="font-size:inherit;margin-top:10px">Se cancela</h1>
      <table><thead><tr><th>Comprobante</th><th>Fecha</th><th class="n">Importe</th></tr></thead>
      <tbody>${detalle}</tbody></table>` : ''}
    ${Math.abs(aCuenta) > 0.009 ? `<div class="nota">A cuenta (sin imputar): ${esc(moneda(aCuenta))}</div>` : ''}
    <div class="tot"><strong>TOTAL PAGADO ${esc(moneda(p.total))}</strong></div>
    ${p.observaciones ? `<div class="nota">${esc(p.observaciones)}</div>` : ''}
    <div class="nota">Recibí conforme: ______________________ &nbsp;&nbsp; Aclaración: ______________________</div>
    ${selloReimpresion(usuario, ahora)}`;
}

/**
 * Abre la ventana e imprime. `tipoDoc` = clave de la config de impresión.
 *
 * Devuelve `false` si el navegador BLOQUEÓ la ventana emergente: sin eso la
 * impresión fallaba en silencio y quedaba la duda de si el ticket salió. Quien
 * llama avisa (es lo único que se puede hacer: el permiso lo da el usuario).
 */
export async function imprimirDocumento(tipoDoc, { titulo, cuerpo, pie, esTicket = false }) {
  const { empresa, impresion } = await configImpresion();
  const formato = impresion[tipoDoc] || formatoPorDefecto(tipoDoc);
  const html = htmlDocumento({
    empresa, formato, titulo, cuerpo, esTicket,
    pie: pie ?? (esTicket ? impresion.pieTicket : ''),
  });
  const w = window.open('', '_blank', 'width=760,height=900');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
  return true;
}

/* ==================================================================== *
 * COMPROBANTE FISCAL (RG 1415 · QR de la RG 4892)
 * ==================================================================== */

const COND_IVA_TEXTO = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributo: 'Responsable Monotributo',
  exento: 'IVA Sujeto Exento',
  consumidor_final: 'Consumidor Final',
  no_categorizado: 'Sujeto No Categorizado',
};

const DOC_TEXTO = { cuit: 'CUIT', cuil: 'CUIL', dni: 'DNI', sin_identificar: '' };

/** Cómo se nombra un comprobante en el papel (para el "asociado" de una nota). */
const TIPO_TEXTO = {
  ticket: 'Ticket',
  factura_a: 'Factura A', factura_b: 'Factura B', factura_c: 'Factura C',
  nota_credito_a: 'Nota de crédito A',
  nota_credito_b: 'Nota de crédito B',
  nota_credito_c: 'Nota de crédito C',
};

/**
 * El QR como SVG **en línea**, no como imagen.
 *
 * La CSP del documento impreso prohíbe todo script, así que no se puede
 * generar en la página: se arma acá y se pega ya dibujado. Va inline y no como
 * `<img src="data:...">` porque un SVG en el marcado escala sin perder nitidez
 * — en una térmica de 203 dpi un QR rasterizado y reescalado se lee mal.
 */
async function qrSvg(url) {
  if (!url) return '';
  try {
    return await QRCode.toString(url, {
      type: 'svg',
      margin: 0,
      // 'M' tolera ~15% de daño: es el nivel que ARCA usa en sus ejemplos y
      // aguanta que la térmica imprima flojo o que el papel se manche.
      errorCorrectionLevel: 'M',
    });
  } catch {
    return '';
  }
}

/**
 * LA FACTURA COMO CUERPO DE DOCUMENTO.
 *
 * LA DIFERENCIA ENTRE A Y B NO ES COSMÉTICA, es lo que manda la ley:
 *
 *  · **Factura A** (a un responsable inscripto): el IVA se DISCRIMINA. Los
 *    renglones van en NETO y al pie aparecen el neto gravado, el IVA por
 *    alícuota y el total. El cliente necesita ese desglose porque se computa
 *    el IVA como crédito fiscal.
 *  · **Factura B** (a consumidor final, monotributo o exento): el IVA **no se
 *    discrimina**. Los renglones van con el impuesto adentro y solo se muestra
 *    el total — que es, además, la regla de la casa: al público, todo con IVA.
 *
 * Es `async` porque el QR se dibuja acá (ver `qrSvg`).
 */
export async function cuerpoFactura(venta, { moneda, fecha, empresa }) {
  const letra = String(venta.tipo || '').slice(-1).toUpperCase();
  const discrimina = letra === 'A';
  /* La misma plantilla imprime la NOTA DE CRÉDITO: mismo emisor, mismo
   * receptor, mismos renglones y el mismo desglose de IVA — cambia el título,
   * y que arriba tiene que decir QUÉ COMPROBANTE AJUSTA. Sin esa línea la nota
   * queda huérfana y el cliente no sabe de qué factura le devolvieron. */
  const esNota = String(venta.tipo || '').startsWith('nota_credito');
  const titulo = esNota ? 'NOTA DE CRÉDITO' : 'FACTURA';
  const cli = venta.cliente || {};
  const nro = venta.numero != null
    ? `${esc(venta.puntoVenta)}-${String(venta.numero).padStart(8, '0')}`
    : '';

  /* Los renglones. `subtotal` es el neto del renglón (ya con descuentos y
   * ofertas); el final se deriva con la alícuota del propio renglón, que puede
   * no ser la misma en todo el comprobante. */
  /* El importe con IVA se arma como `neto + round(neto × alícuota)`, que es
   * exactamente como el sistema construyó `ivaTotal` al cobrar. Calcularlo
   * como `neto × 1,21` puede diferir un centavo, y entonces los renglones del
   * papel no suman el total — en una factura, eso lo nota el cliente. */
  const conIva = (neto, alic) => neto + Math.round(neto * alic) / 100;

  const filas = (venta.items ?? []).map((it) => {
    const neto = Number(it.subtotal) || 0;
    const alic = it.iva ?? 21;
    const importe = discrimina ? neto : conIva(neto, alic);
    const unit = Number(it.cantidad) ? importe / Number(it.cantidad) : importe;
    return `<tr>
      <td>${esc(it.nombre ?? `#${it.productoId}`)}</td>
      <td class="chica n">${Number(it.cantidad)}</td>
      <td class="chica n">${moneda(unit)}</td>
      ${discrimina ? `<td class="chica n">${Number(alic)}%</td>` : ''}
      <td class="chica n">${moneda(importe)}</td>
    </tr>`;
  }).join('');

  const extras = (venta.extras ?? []).map((e) => {
    const neto = Number(e.importe) || 0;
    const alic = e.iva ?? 21;
    const importe = discrimina ? neto : conIva(neto, alic);
    return `<tr>
      <td>${esc(e.concepto || 'Extra')}</td>
      <td class="chica n">1</td>
      <td class="chica n">${moneda(importe)}</td>
      ${discrimina ? `<td class="chica n">${Number(alic)}%</td>` : ''}
      <td class="chica n">${moneda(importe)}</td>
    </tr>`;
  }).join('');

  /* El desglose por alícuota, solo en A. Se agrupa igual que lo que se le
   * mandó a ARCA: si el papel dijera otra cosa que el comprobante emitido,
   * el que mira no podría conciliarlos. */
  let pieIva = '';
  if (discrimina) {
    const porAlic = new Map();
    for (const x of [...(venta.items ?? []), ...(venta.extras ?? [])]) {
      const neto = Number(x.subtotal ?? x.importe) || 0;
      const alic = Number(x.iva ?? 21);
      porAlic.set(alic, (porAlic.get(alic) ?? 0) + neto * alic / 100);
    }
    pieIva = [...porAlic.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([alic, imp]) => `<div>IVA ${alic}%: <strong>${moneda(imp)}</strong></div>`)
      .join('');
  }

  const docCliente = DOC_TEXTO[cli.tipoDoc]
    ? `${DOC_TEXTO[cli.tipoDoc]} ${esc(cli.numeroDoc || '')}`
    : 'Sin identificar';

  /*
   * EL DOMICILIO DE LA FACTURA ES EL DEL LOCAL QUE LA EMITIÓ (0077).
   *
   * ARCA declara cada punto de venta contra un domicilio, y el comprobante
   * lleva ESE domicilio comercial: la factura del local de Belgrano 728 no
   * puede decir el domicilio fiscal de la empresa. Si la sucursal no tiene el
   * suyo cargado se usa el de la empresa, que es lo correcto mientras haya un
   * solo local (y es como venía funcionando).
   */
  const domicilioEmisor = venta.sucursalDireccion || empresa.direccion || '';

  const qr = await qrSvg(venta.qrArca);
  const caeVto = venta.caeVencimiento ? fecha(venta.caeVencimiento) : '';
  /* El motivo de la nota es la PRIMERA línea de las observaciones; la segunda
   * es el rastro interno ("[Nota de crédito de Factura B …]"), que no va al
   * papel porque ya está impreso arriba como comprobante asociado. */
  const motivo = esNota ? String(venta.observaciones || '').split('\n')[0].trim() : '';

  return `
    <div class="letraBox">
      <div class="letra">${esc(letra)}</div>
      <div class="cod">COD. ${String(venta.codigoComprobante ?? '').padStart(2, '0')}</div>
    </div>

    <h1>${titulo} ${esc(letra)} ${nro}</h1>
    <div class="sub">Fecha de emisión: ${esc(fecha(venta.fecha))}</div>
    ${esNota && venta.origen ? `<div class="sub"><strong>Comprobante asociado:</strong> ${esc(
    `${TIPO_TEXTO[venta.origen.tipo] || 'Comprobante'} ${venta.origen.puntoVenta}-${String(venta.origen.numero ?? 0).padStart(8, '0')}`,
  )} del ${esc(fecha(venta.origen.fecha))}</div>` : ''}

    <div class="fiscalDatos">
      <div>
        <div><strong>Emisor:</strong> ${esc(empresa.razonSocial || empresa.nombre || '')}</div>
        ${empresa.cuit ? `<div><strong>CUIT:</strong> ${esc(empresa.cuit)}</div>` : ''}
        ${domicilioEmisor ? `<div><strong>Domicilio:</strong> ${esc(domicilioEmisor)}</div>` : ''}
        <div><strong>Cond. IVA:</strong> IVA Responsable Inscripto</div>
      </div>
      <div>
        <div><strong>Cliente:</strong> ${esc(venta.clienteNombre || '')}</div>
        <div><strong>${esc(docCliente)}</strong></div>
        ${cli.direccion ? `<div><strong>Domicilio:</strong> ${esc(cli.direccion)}</div>` : ''}
        <div><strong>Cond. IVA:</strong> ${esc(COND_IVA_TEXTO[cli.condicionIva] || 'Consumidor Final')}</div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th>Descripción</th><th>Cant.</th><th>P. unit.</th>
        ${discrimina ? '<th>IVA</th>' : ''}
        <th>Importe</th>
      </tr></thead>
      <tbody>${filas}${extras}</tbody>
    </table>

    <div class="tot">
      ${discrimina ? `<div>Neto gravado: <strong>${moneda(venta.subtotalNeto)}</strong></div>${pieIva}` : ''}
      <div style="font-size:1.2em">TOTAL <strong>${moneda(venta.total)}</strong></div>
    </div>

    ${esNota && motivo ? `<div class="sub"><strong>Motivo:</strong> ${esc(motivo)}</div>` : ''}

    ${venta.cae ? `<div class="cajaCae">
      ${qr ? `<div class="qr">${qr}</div>` : ''}
      <div>
        <div>CAE N°</div>
        <div class="caeNro">${esc(venta.cae)}</div>
        ${caeVto ? `<div>Vencimiento del CAE: ${esc(caeVto)}</div>` : ''}
      </div>
    </div>` : `<div class="fiscal"><strong>SERVICIO DE ARCA NO DISPONIBLE</strong></div>
    <div class="fiscal">COMPROBANTE PROVISORIO — PENDIENTE DE FACTURACIÓN</div>`}
  `;
}

/**
 * IMPRIME UNA VENTA, y decide sola qué papel es.
 *
 * Existe para que la decisión viva en UN lugar. Hay tres pantallas que sacan
 * el papel de una venta —el cobro, el "Reimprimir" del punto de venta y el
 * detalle del listado— y las tres tienen que llegar al mismo resultado:
 *
 *   con CAE  →  la FACTURA, con su QR fiscal. **Reemplaza** al ticket: si
 *               salieran los dos papeles, el cliente no sabría cuál vale.
 *   sin CAE  →  el ticket interno de siempre (y si la venta quedó pendiente
 *               de facturar, con su leyenda de provisorio).
 *
 * UNA NOTA DE CRÉDITO SIEMPRE VA POR LA PLANTILLA FISCAL, tenga CAE o no: el
 * ticket del POS es el papel de una VENTA —lleva "cómo se pagó" y da un total
 * que entró— y usarlo para una devolución diría exactamente lo contrario de lo
 * que pasó. Sin CAE sale igual, con la leyenda de provisorio.
 *
 * Devuelve `false` si el navegador bloqueó la ventana emergente, igual que
 * `imprimirDocumento`.
 */
export async function imprimirVenta(venta, { moneda, fechaHora }) {
  const { empresa, impresion } = await configImpresion();
  const nro = `${venta.puntoVenta}-${String(venta.numero ?? '').padStart(8, '0')}`;
  const esNota = String(venta.tipo || '').startsWith('nota_credito');
  if (venta.cae || esNota) {
    return imprimirDocumento('facturaVenta', {
      titulo: `${esNota ? 'Nota de crédito' : 'Factura'} ${nro}`,
      cuerpo: await cuerpoFactura(venta, { moneda, fecha: fechaHora, empresa }),
      pie: '',
    });
  }
  return imprimirDocumento('ticketPos', {
    titulo: `Ticket ${nro}`,
    esTicket: true,
    cuerpo: cuerpoTicket(venta, { moneda, fechaHora, leyendaNoFiscal: impresion.leyendaNoFiscal }),
  });
}

/** El ticket del POS como cuerpo de documento (lo usan cobro y reimpresión). */
export function cuerpoTicket(venta, { moneda, fechaHora, leyendaNoFiscal = true }) {
  const filas = (venta.items ?? []).map((it) => {
    const neto = it.cantidad * it.precioUnitario * (1 - (it.descuento || 0) / 100);
    const final = neto * (1 + (it.iva ?? 21) / 100);
    return `<tr>
      <td>${esc(it.nombre ?? `#${it.productoId}`)}<br /><span style="color:#555">${Number(it.cantidad)} x ${moneda(it.precioUnitario * (1 + (it.iva ?? 21) / 100))}</span></td>
      <td class="n">${moneda(final)}</td>
    </tr>`;
  }).join('');
  const pagos = (venta.pagos ?? []).map((p) => `<tr><td>${esc(p.medio)}</td><td class="n">${moneda(p.importe)}</td></tr>`).join('');
  const nro = venta.numero != null ? `${esc(venta.puntoVenta)}-${String(venta.numero).padStart(8, '0')}` : '';
  /*
   * ARCA CAÍDO (0073): el ticket provisorio LO DICE, siempre — esta leyenda no
   * se apaga con la configuración, porque es la explicación que el cliente se
   * lleva de por qué no recibió su factura. Cuando la venta se facture desde
   * la pestaña Sin facturar, la reimpresión sale sin esto.
   */
  const provisorio = venta.facturarPendiente
    ? '<div class="fiscal"><strong>SERVICIO DE ARCA NO DISPONIBLE</strong></div>'
      + '<div class="fiscal">COMPROBANTE PROVISORIO — PENDIENTE DE FACTURACIÓN</div>'
    : '';
  return `
    <h1>Ticket ${nro}</h1>
    <div class="sub">${esc(fechaHora(venta.fecha))}${venta.clienteNombre ? ` · ${esc(venta.clienteNombre)}` : ''}</div>
    <table><tbody>${filas}</tbody></table>
    <div class="tot"><strong>TOTAL ${moneda(venta.total)}</strong></div>
    ${pagos ? `<table><tbody>${pagos}</tbody></table>` : ''}
    ${leyendaNoFiscal ? '<div class="fiscal">DOCUMENTO NO FISCAL</div>' : ''}
    ${provisorio}
  `;
}
