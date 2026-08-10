/**
 * CÓDIGOS DE BARRAS — SVG puro, sin dependencias
 * ============================================================================
 * Dibuja el código de una presentación para la ETIQUETA autoadhesiva. Dos
 * simbologías, y la elección NO es un gusto: es lo que el código permite.
 *
 *   EAN-13  → cuando son 13 dígitos y el verificador cierra. Es lo que todo
 *             lector lee de fábrica, así que es el camino feliz.
 *   Code 39 → todo lo demás (códigos de 7, 9 u 11 dígitos, con letras, o de 13
 *             con el verificador mal). Escanea los mismos caracteres, así que
 *             el POS lo encuentra igual; el precio es una etiqueta más ancha y
 *             que algunos lectores baratos vienen con Code 39 APAGADO.
 *
 * El SVG sale en unidades de MÓDULO (la barra fina) con `viewBox`, no en
 * milímetros: la etiqueta lo estira al ancho que tenga y las proporciones se
 * mantienen. El que decide si el módulo quedó demasiado fino para la impresora
 * es quien lo muestra — `analizarCodigo` devuelve `modulos` justamente para eso.
 */

/* ------------------------------ EAN-13 ------------------------------ *
 * 95 módulos: guarda 101 · 6 dígitos (L o G según la paridad del primero) ·
 * guarda central 01010 · 6 dígitos (R) · guarda 101. El PRIMER dígito no se
 * dibuja: viaja escondido en qué tabla usa cada uno de los seis siguientes.
 */
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
/** R es el complemento de L (barra donde L tiene espacio). */
const EAN_R = EAN_L.map((p) => p.replace(/[01]/g, (b) => (b === '0' ? '1' : '0')));
const EAN_PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/**
 * Verificador de un EAN-13: posiciones impares ×1, pares ×3 (de izquierda a
 * derecha), y el dígito 13 completa la decena. Devuelve `null` si no son 13
 * dígitos — "no es un EAN" y "es un EAN mal calculado" son cosas distintas.
 */
export function verificadorEan13(codigo) {
  const c = String(codigo || '');
  if (!/^\d{13}$/.test(c)) return null;
  let suma = 0;
  for (let i = 0; i < 12; i += 1) suma += Number(c[i]) * (i % 2 ? 3 : 1);
  return ((10 - (suma % 10)) % 10) === Number(c[12]);
}

function modulosEan13(codigo) {
  const paridad = EAN_PARIDAD[Number(codigo[0])];
  let bits = '101';
  for (let i = 0; i < 6; i += 1) {
    const d = Number(codigo[i + 1]);
    bits += paridad[i] === 'L' ? EAN_L[d] : EAN_G[d];
  }
  bits += '01010';
  for (let i = 7; i < 13; i += 1) bits += EAN_R[Number(codigo[i])];
  return `${bits}101`;
}

/* ------------------------------ Code 39 ------------------------------ *
 * Cada carácter son 9 elementos que alternan barra/espacio empezando por
 * barra, de los cuales 3 son ANCHOS (n = fino, w = ancho = 3 finos), más un
 * espacio fino de separación entre caracteres. El código va entre asteriscos.
 *
 * La tabla no es arbitraria y por eso se puede auditar: los 40 caracteres de
 * datos son las 4 posiciones posibles del espacio ancho × los 10 pares
 * posibles de barras anchas, SIEMPRE en el mismo orden. Los cuatro símbolos
 * $ / + % son la excepción (tres espacios anchos y ninguna barra ancha).
 */
const C39 = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw',
  5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};
/** Ancho en módulos de un carácter (6 finos + 3 anchos) + el espacio de separación. */
const C39_ANCHO = 16;

function modulosCode39(texto) {
  let bits = '';
  for (const ch of `*${texto}*`) {
    const patron = C39[ch];
    for (let i = 0; i < 9; i += 1) {
      const ancho = patron[i] === 'w' ? 3 : 1;
      // Los índices pares son barra; los impares, espacio.
      bits += (i % 2 ? '0' : '1').repeat(ancho);
    }
    bits += '0'; // separación entre caracteres
  }
  return bits.slice(0, -1); // sin la separación final
}

const CODE39_OK = /^[0-9A-Z\-. $/+%]+$/;

/**
 * Qué se puede hacer con este código, antes de imprimir nada. `modulos` es el
 * ancho en barras finas: dividido por el ancho útil de la etiqueta da los
 * milímetros de cada módulo, que es lo que decide si el lector va a poder.
 */
export function analizarCodigo(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) return { codigo: '', tipo: 'vacio', modulos: 0, aviso: 'Esta presentación no tiene código de barras cargado: la etiqueta sale sin código y no se puede escanear en la caja.' };

  const ver = verificadorEan13(c);
  if (ver === true) return { codigo: c, tipo: 'ean13', modulos: 95 + 18, aviso: '' };

  if (!CODE39_OK.test(c)) {
    return { codigo: c, tipo: 'invalido', modulos: 0, aviso: 'El código tiene caracteres que no se pueden dibujar: corregilo en el producto madre.' };
  }
  const modulos = (c.length + 2) * C39_ANCHO - 1 + 20;
  const aviso = ver === false
    ? 'Son 13 dígitos pero el verificador no cierra, así que no es un EAN-13 válido: se imprime en Code 39. Conviene corregir el código en el producto madre.'
    : 'El código no es un EAN-13: se imprime en Code 39. Probá una etiqueta con el lector antes de tirar la tanda entera.';
  return { codigo: c, tipo: 'code39', modulos, aviso };
}

/**
 * El SVG del código, listo para meter en la etiqueta. Devuelve '' si no hay
 * nada que dibujar (sin código o con caracteres imposibles): la etiqueta se
 * imprime igual, con nombre, peso y precio.
 *
 * `alto` está en las mismas unidades del viewBox, así que el SVG se estira al
 * ancho del contenedor y la altura la fija el CSS de la etiqueta.
 */
export function barcodeSvg(codigo, { alto = 30 } = {}) {
  const info = analizarCodigo(codigo);
  if (info.tipo === 'vacio' || info.tipo === 'invalido') return '';

  // La zona muda (el blanco a los costados) es parte del código: sin ella el
  // lector no encuentra dónde arranca. Va DENTRO del viewBox para que no se la
  // coma el estirado.
  const muda = info.tipo === 'ean13' ? [11, 7] : [10, 10];
  const bits = info.tipo === 'ean13' ? modulosEan13(info.codigo) : modulosCode39(info.codigo);
  const ancho = bits.length + muda[0] + muda[1];

  let rects = '';
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === '0') { i += 1; continue; }
    let largo = 0;
    while (bits[i + largo] === '1') largo += 1;
    rects += `<rect x="${i + muda[0]}" y="0" width="${largo}" height="${alto}"/>`;
    i += largo;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" shape-rendering="crispEdges" style="display:block;width:100%;height:100%"><rect x="0" y="0" width="${ancho}" height="${alto}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
