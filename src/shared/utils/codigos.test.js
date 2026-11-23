import test from 'node:test';
import assert from 'node:assert/strict';
import { codigoContiene, codigoTerminaEn, codigosDeBarras, tieneCodigo } from './codigos.js';

const p = { codigoBarras: '7790000000002', codigosAnteriores: ['7791111111110', ''] };

test('el código actual y los anteriores, sin vacíos', () => {
  assert.deepEqual(codigosDeBarras(p), ['7790000000002', '7791111111110']);
  assert.deepEqual(codigosDeBarras({ codigoBarras: '' }), []);
  assert.deepEqual(codigosDeBarras(null), []);
});

test('el escáner encuentra por el código actual y por uno anterior', () => {
  assert.equal(tieneCodigo(p, '7790000000002'), true);
  assert.equal(tieneCodigo(p, '7791111111110'), true);
  assert.equal(tieneCodigo(p, '7792222222228'), false);
  assert.equal(tieneCodigo(p, ''), false);
});

test('los buscadores: un pedazo o los últimos dígitos, también del anterior', () => {
  assert.equal(codigoContiene(p, '11111'), true);
  assert.equal(codigoContiene(p, ''), false);
  assert.equal(codigoTerminaEn(p, '1110'), true);
  assert.equal(codigoTerminaEn(p, '0002'), true);
  assert.equal(codigoTerminaEn(p, '9999'), false);
});

test('un producto sin la lista (datos viejos) sigue andando con su código', () => {
  assert.equal(tieneCodigo({ codigoBarras: '123' }, '123'), true);
});
