import test from 'node:test';
import assert from 'node:assert/strict';
import { contraLaOtraMitad, porcDistintoDeLaFicha } from './otraMitad.js';

test('mismo neto en las dos mitades (centavos de diferencia): no avisa', () => {
  assert.equal(contraLaOtraMitad(1764.7217, 1764.6667, true), null);
  assert.equal(contraLaOtraMitad(3060, 3060, false), null);
});

test('liquidación con el IVA adentro: avisa y lo dice', () => {
  const r = contraLaOtraMitad(1210, 1000, true);
  assert.equal(Math.round(r.variacion * 10) / 10, 21);
  assert.equal(r.ivaAdentro, true);
});

test('al revés: cargando la factura A después de una liquidación con IVA adentro', () => {
  const r = contraLaOtraMitad(1000, 1105, false);
  assert.ok(r.variacion < 0);
  assert.equal(r.ivaAdentro, true);
});

test('otra lista (no es el IVA): avisa sin hablar de IVA', () => {
  const r = contraLaOtraMitad(1080, 1000, true);
  assert.equal(r.ivaAdentro, false);
  assert.equal(Math.round(r.variacion), 8);
});

test('sin precio de un lado: nada que comparar', () => {
  assert.equal(contraLaOtraMitad(1000, undefined, true), null);
  assert.equal(contraLaOtraMitad(0, 1000, true), null);
});

test('el % sin factura del producto contra el del proveedor', () => {
  assert.deepEqual(porcDistintoDeLaFicha(0, 50), { formato: 0, ficha: 50 });
  assert.deepEqual(porcDistintoDeLaFicha('100', '50'), { formato: 100, ficha: 50 });
  assert.equal(porcDistintoDeLaFicha(50, 50), null);
  assert.equal(porcDistintoDeLaFicha(50.04, 50), null);
  assert.equal(porcDistintoDeLaFicha(null, 0), null);
});
