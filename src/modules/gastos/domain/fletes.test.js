import test from 'node:test';
import assert from 'node:assert/strict';
import {
  conceptoDelFlete, conceptoDeFila, etiquetaPapel, faltaEnFleteDe, fleteDeFila, filaDeRenglon, lecturaFlete, textoEnCosto,
  unidadDe, coincideNumero, RENGLON_VACIO,
} from './fletes.js';

test('el renglón de un proveedor se escribe solo, sin la forma societaria', () => {
  assert.equal(conceptoDelFlete('DONINAS  S. A. S.', 5), 'DONINAS - 5 BULTOS');
  assert.equal(conceptoDelFlete('Hojas Verdes SRL', 10), 'HOJAS VERDES - 10 BULTOS');
  assert.equal(conceptoDelFlete('ANGIOLA S.A', 2, 'PALLETS'), 'ANGIOLA - 2 PALLETS');
  assert.equal(conceptoDelFlete('Sabor andino', ''), 'SABOR ANDINO');
  assert.equal(unidadDe('NATUZEN - 2 PALLETS'), 'PALLETS');
  assert.equal(unidadDe('COSTA 38 BULTOS'), 'BULTOS');
});

test('la etiqueta del papel del proveedor', () => {
  const tipos = { factura: { label: 'Factura' }, liquidacion: { label: 'Liquidación (sin factura)' } };
  assert.equal(etiquetaPapel({ tipo: 'factura', letra: 'A', puntoVenta: '0001', numero: 2119 }, tipos), 'Factura A 0001-00002119');
  assert.equal(etiquetaPapel({ tipo: 'liquidacion', letra: 'X', puntoVenta: '1', numero: 7 }, tipos), 'Liquidación 0001-00000007');
});

test('lo que viaja de cada renglón depende de su origen', () => {
  const nombre = () => 'DONINAS  S. A. S.';
  const fila = { ...RENGLON_VACIO, fleteOrigen: 'proveedor', fleteProveedorId: '80', cantidad: '5', monto: '1000', fleteReferencia: '0003-99' };
  assert.equal(conceptoDeFila(fila, nombre), 'DONINAS - 5 BULTOS');
  assert.deepEqual(fleteDeFila(fila), { fleteOrigen: 'proveedor', fleteProveedorId: 80, fleteComprobanteId: null, fleteReferencia: '0003-99' });
  /* Con el papel elegido, el número escrito no viaja. */
  assert.equal(fleteDeFila({ ...fila, fleteComprobanteId: '98' }).fleteReferencia, '');
  assert.deepEqual(fleteDeFila({ ...fila, fleteOrigen: 'otro' }), { fleteOrigen: 'otro' });
  assert.deepEqual(fleteDeFila(RENGLON_VACIO), { fleteOrigen: null });
  assert.equal(filaDeRenglon({ concepto: 'NATUZEN - 2 PALLETS', monto: 10, cantidad: 2, fleteOrigen: 'proveedor', fleteProveedorId: 9 }).unidad, 'PALLETS');
});

test('el transporte no deja un renglón sin decir de dónde vino', () => {
  assert.match(faltaEnFleteDe({ ...RENGLON_VACIO, monto: '10' }), /de qué proveedor/);
  assert.match(faltaEnFleteDe({ ...RENGLON_VACIO, monto: '10', fleteOrigen: 'proveedor' }), /Elegí/);
  assert.match(faltaEnFleteDe({ ...RENGLON_VACIO, monto: '10', fleteOrigen: 'otro' }), /qué fue/);
  assert.equal(faltaEnFleteDe({ ...RENGLON_VACIO, monto: '10', fleteOrigen: 'otro', concepto: 'Envío a Fontana' }), null);
  assert.equal(faltaEnFleteDe(RENGLON_VACIO), null);
});

test('la lectura del flete real contra el que está en el costo', () => {
  const ocho = { min: 8, max: 8, habitual: 8 };
  assert.equal(textoEnCosto(ocho), '8 %');
  assert.equal(textoEnCosto({ min: 0, max: 18, habitual: 10 }), '10 % (0–18)');
  assert.equal(lecturaFlete({ pctReal: 16, enCosto: ocho }).label, 'El real es 8 puntos más');
  assert.equal(lecturaFlete({ pctReal: 8.5, enCosto: ocho }).label, 'Coincide');
  assert.equal(lecturaFlete({ pctReal: 3, enCosto: ocho }).label, 'El real es 5 puntos menos');
  /* El rango ancho no tapa: se compara con el de la mayoría de sus productos. */
  assert.equal(lecturaFlete({ pctReal: 4.9, enCosto: { min: 0, max: 18, habitual: 18 } }).label, 'El real es 13,1 puntos menos');
  assert.equal(lecturaFlete({ pctReal: 4, enCosto: { min: 0, max: 10, habitual: 0 } }).label, 'No está en el costo');
  assert.equal(lecturaFlete({ pctReal: null, enCosto: ocho }).label, 'Sin compras en el período');
  assert.equal(lecturaFlete({ pctReal: 4, enCosto: null }).label, 'Sin formato de compra');
});

test('el número escrito en el flete contra el papel que se está cargando', () => {
  assert.equal(coincideNumero('0003-00001234', '0003', '1234'), true);
  assert.equal(coincideNumero('1234', '0001', 1234), true);
  assert.equal(coincideNumero('0004-1234', '0003', '1234'), false);
  assert.equal(coincideNumero('', '0003', '1234'), false);
  assert.equal(coincideNumero('1234', '0003', ''), false);
});
