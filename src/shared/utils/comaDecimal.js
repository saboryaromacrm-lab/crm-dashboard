/**
 * LA COMA DECIMAL EN LOS CASILLEROS DE NÚMEROS (25/11/2026, pedido del dueño:
 * «no me deja poner precios decimales» en el costo de una factura al peso).
 *
 * Los casilleros numéricos del navegador (`<input type="number">`) solo
 * entienden el punto. En Argentina se escribe con coma, y el teclado numérico
 * en castellano también pone coma: el navegador la tiraba sin avisar y
 * «12321,60» quedaba 1.232.160 (cien veces más). Esto vale para TODO el ERP,
 * sin tocar cada casillero: la coma tipeada entra como punto, y lo pegado con
 * formato argentino («$ 12.321,60») entra como número («12321.60»).
 */

/** Lo pegado con coma decimal → el número con punto; sin coma no se toca (null). */
export function numeroPegado(texto) {
  const t = String(texto ?? '').replace(/[$\s]/g, '');
  if (!/^-?[\d.]*,\d*$/.test(t)) return null;
  return t.replace(/\./g, '').replace(',', '.');
}

const esNumerico = (el) => el instanceof HTMLInputElement && el.type === 'number' && !el.readOnly && !el.disabled;
/* Escribe como si se tipeara: el navegador valida y React se entera por el evento de siempre. */
const escribir = (texto) => document.execCommand('insertText', false, texto);

/** Se llama una vez al arrancar la app. */
export function aceptarComaDecimal() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== ',' || e.ctrlKey || e.metaKey || e.altKey || !esNumerico(e.target)) return;
    e.preventDefault();
    escribir('.');
  }, true);
  document.addEventListener('paste', (e) => {
    if (!esNumerico(e.target)) return;
    const numero = numeroPegado(e.clipboardData?.getData('text'));
    if (numero == null) return;
    e.preventDefault();
    escribir(numero);
  }, true);
}
