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

const FORMATOS = {
  rollo80: { page: '80mm auto', margen: '3mm', font: '11px', chica: '9.5px', rollo: true },
  rollo58: { page: '58mm auto', margen: '2mm', font: '10px', chica: '9px', rollo: true },
  a4: { page: 'A4', margen: '14mm', font: '13px', chica: '12px', rollo: false },
  carta: { page: 'letter', margen: '14mm', font: '13px', chica: '12px', rollo: false },
};

export const FORMATOS_LABEL = {
  rollo80: 'Rollo 80 mm (recomendado)',
  rollo58: 'Rollo 58 mm (posnet / portátil)',
  a4: 'Hoja A4',
  carta: 'Hoja Carta',
};

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
 * Documento COMPLETO como HTML (lo usa la impresión y la vista previa de
 * Sistema). `cuerpo` es el contenido propio del documento (título, tablas…);
 * el motor pone página, empresa, estilos y pie.
 */
export function htmlDocumento({ empresa, formato, titulo, cuerpo, pie = '', esTicket = false }) {
  const f = FORMATOS[formato] || FORMATOS.a4;
  const color = f.rollo ? '#111' : (empresa.colorMarca || '#166534');
  const datos = [empresa.cuit && `CUIT ${empresa.cuit}`, empresa.direccion, empresa.telefono]
    .filter(Boolean).join(' · ');
  const logo = empresa.logo
    ? `<img class="logo" src="${empresa.logo}" alt="" />`
    : '';
  return `<!doctype html><html><head><title>${titulo}</title><style>
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
    <div class="emp">${logo}<div><div class="empNombre">${empresa.nombre || ''}</div>${datos ? `<div class="empDatos">${datos}</div>` : ''}</div></div>
    ${cuerpo}
    ${pie ? `<div class="nota">${pie}</div>` : ''}
  </body></html>`;
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
  const formato = impresion[tipoDoc] || 'a4';
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
      <td>${it.nombre ?? `#${it.productoId}`}<br /><span style="color:#555">${Number(it.cantidad)} x ${moneda(it.precioUnitario * (1 + (it.iva ?? 21) / 100))}</span></td>
      <td class="n">${moneda(final)}</td>
    </tr>`;
  }).join('');
  const pagos = (venta.pagos ?? []).map((p) => `<tr><td>${p.medio}</td><td class="n">${moneda(p.importe)}</td></tr>`).join('');
  const nro = venta.numero != null ? `${venta.puntoVenta}-${String(venta.numero).padStart(8, '0')}` : '';
  return `
    <h1>Ticket ${nro}</h1>
    <div class="sub">${fechaHora(venta.fecha)}${venta.clienteNombre ? ` · ${venta.clienteNombre}` : ''}</div>
    <table><tbody>${filas}</tbody></table>
    <div class="tot"><strong>TOTAL ${moneda(venta.total)}</strong></div>
    ${pagos ? `<table><tbody>${pagos}</tbody></table>` : ''}
    ${leyendaNoFiscal ? '<div class="fiscal">DOCUMENTO NO FISCAL</div>' : ''}
  `;
}
