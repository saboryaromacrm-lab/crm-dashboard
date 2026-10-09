import test from 'node:test';
import assert from 'node:assert/strict';
import { costoMensual, cuotaMensual } from './sueldos.js';

test('costo mensual: bruto + cargas + 1/12 de aguinaldo (igual que el servidor)', () => {
  assert.deepEqual(costoMensual(1000000, 25), { cargas: 250000, aguinaldo: 104166.67, total: 1354166.67 });
  assert.equal(costoMensual(0, 25).total, 0);
});

test('cuota de un bien de uso', () => {
  assert.equal(cuotaMensual(1200000, 24), 50000);
  assert.equal(cuotaMensual(100, 0), 100);
});
