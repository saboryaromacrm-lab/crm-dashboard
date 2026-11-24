import test from 'node:test';
import assert from 'node:assert/strict';
import { preciosConIvaAdentro, sinIva } from './ivaAdentro.js';

/* La factura de Origen del 20/11/2026: renglones con IVA que suman el total. */
const origen = { neto: 445643, iva: 93585.03, totalPapel: 445643, tolerancia: 1 };

test('los renglones suman el total del papel: traen el IVA adentro', () => {
  assert.equal(preciosConIvaAdentro(origen), true);
});

test('una factura A normal (neto + IVA = total) no avisa', () => {
  assert.equal(preciosConIvaAdentro({ neto: 368300, iva: 77343, totalPapel: 445643, tolerancia: 1 }), false);
});

test('con percepciones en el papel también se reconoce', () => {
  assert.equal(preciosConIvaAdentro({ ...origen, totalPapel: 452643, percepciones: 7000 }), true);
});

test('sin IVA calculado (exento) o sin total del papel no avisa', () => {
  assert.equal(preciosConIvaAdentro({ ...origen, iva: 0 }), false);
  assert.equal(preciosConIvaAdentro({ ...origen, totalPapel: 0 }), false);
});

test('pasar a neto: los precios de Origen dan los netos redondos del proveedor', () => {
  assert.equal(sinIva(2403.06, 21), 1986);
  assert.equal(sinIva(16236.99, 21), 13419);
  assert.equal(sinIva(9102.83, '21'), 7523);
  assert.equal(sinIva(1105, 10.5), 1000);
  assert.equal(sinIva(500, 0), 500);
});
