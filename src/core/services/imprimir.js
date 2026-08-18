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
  const datos = [empresa.cuit && `CUIT ${esc(empresa.cuit)}`, esc(empresa.direccion), esc(empresa.telefono)]
    .filter(Boolean).join(' · ');
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
  return `
    <h1>Ticket ${nro}</h1>
    <div class="sub">${esc(fechaHora(venta.fecha))}${venta.clienteNombre ? ` · ${esc(venta.clienteNombre)}` : ''}</div>
    <table><tbody>${filas}</tbody></table>
    <div class="tot"><strong>TOTAL ${moneda(venta.total)}</strong></div>
    ${pagos ? `<table><tbody>${pagos}</tbody></table>` : ''}
    ${leyendaNoFiscal ? '<div class="fiscal">DOCUMENTO NO FISCAL</div>' : ''}
  `;
}
