/* La lectura de facturas en el navegador (28/9/2026): la receta de Tango y la
 * limpieza del texto tienen que leer IGUAL que cuando corrían en el servidor.
 * Un error acá carga un costo mal. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATOS, formatoDe } from './recetas.js';
import { numeroDe, pegarNumeros, clave } from './texto.js';

const L = (pagina, texto) => ({ pagina, y: 0, frags: [], texto });
const TANGO = [
  L(1, 'CODIGO 1 00115- 00194842'), L(1, '04/ 08/ 2026'), L(1, 'CAE: 76123456789012'), L(1, '30 DIAS F.F. Vto: 03/09/2026'),
  L(1, '10206 AJO GRANULADO x25 KGS. 01I C04059757E 1. 00 9005. 320KG 14. 00 193, 614. 38'),
  L(1, '10310 OREGANO x10 KGS. 2.00 5100.000KG 0.00 102,000.00'),
  L(1, 'SUBTOTAL 1.000,00'), // subtotal PARCIAL de la página 1: no se toma
  L(2, '20001 PIMIENTA NEGRA x5 KGS. 3.00 4000.000KG 10.00 10,800.00'),
  L(2, 'SUBTOTAL 306,414.38'), L(2, 'BONIF. 5,00 % 15,320.72'), L(2, 'SUBTOTAL: 291,093.66'),
  L(2, 'IVA 21.00 % 61,129.67'), L(2, 'PERC. IIBB 3 % 8,732.81'), L(2, 'TOTAL: 360,956.14'),
];

test('texto: números partidos, formatos mezclados y claves', () => {
  assert.equal(numeroDe('87, 731. 41'), 87731.41);
  assert.equal(numeroDe('1.596.319,64'), 1596319.64);
  assert.equal(numeroDe('10,00'), 10);
  assert.equal(numeroDe('abc'), null);
  assert.equal(pegarNumeros('00115- 00194842'), '00115-00194842');
  assert.equal(pegarNumeros('1.00 9005.320'), '1.00 9005.320', 'no pega números distintos');
  assert.equal(clave('Ajó  granulado'), 'AJOGRANULADO');
});

test('Tango: encabezado, renglones (sin la serie) y el pie de la ÚLTIMA página', () => {
  const r = FORMATOS.find((f) => f.id === 'tango-bavosi').leer(TANGO);
  assert.deepEqual(r.encabezado, {
    tipoArca: 1, puntoVenta: '00115', numero: 194842, fecha: '2026-08-04', cae: '76123456789012', vencimiento: '2026-09-03',
  });
  assert.equal(r.renglones.length, 3);
  assert.deepEqual(r.renglones[0], {
    codigo: '10206', descripcion: 'AJO GRANULADO x25 KGS.', cantidad: 1, precioUnit: 9005.32, unidad: 'KG', dto: 14, importe: 193614.38,
  });
  assert.equal(r.pie.bruto, 306414.38, 'el subtotal parcial de la página 1 no se toma');
  assert.equal(r.pie.total, 360956.14);
  assert.deepEqual(r.pie.percepciones, [{ nombre: 'PERC. IIBB', alicuota: 3, importe: 8732.81 }]);
  assert.deepEqual(r.avisos, [], 'todo cierra: sin avisos');
});

test('Tango: si falta un renglón, el control de suma lo delata', () => {
  const r = FORMATOS[0].leer(TANGO.filter((l) => !l.texto.startsWith('10310')));
  assert.match(r.avisos.join(' '), /falta algún renglón/);
});

test('formato del proveedor: por el id guardado; sin id, sin estructura', () => {
  assert.equal(formatoDe({ formatoFactura: 'tango-bavosi' })?.id, 'tango-bavosi');
  assert.equal(formatoDe({ formatoFactura: '' }), null);
  assert.equal(formatoDe({ formatoFactura: 'no-existe' }), null);
  assert.equal(formatoDe(null), null);
});
