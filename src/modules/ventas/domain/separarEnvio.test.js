/**
 * 0130 — qué billetes quedan en la caja y cuáles van al sobre. Mismos casos que
 * el servidor (`separacion.test.ts`): las dos copias de la regla tienen que dar igual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separarEnvio, sumaBilletes } from './separarEnvio.js';

test('queda EXACTO el fondo con los billetes más chicos; el resto al sobre', () => {
  const contados = { 20000: 5, 10000: 3, 2000: 4, 1000: 6, 500: 4, 100: 10 }; // $147.000
  const r = separarEnvio(contados, 20000);
  assert.equal(sumaBilletes(r.queda), 20000);
  assert.equal(sumaBilletes(r.envio), 127000);
  assert.equal(r.queda[20000] ?? 0, 0);
  assert.equal(r.queda[10000] ?? 0, 1);
  assert.equal(r.queda[100], 10);
  for (const [d, n] of Object.entries(contados)) assert.equal((r.queda[d] ?? 0) + (r.envio[d] ?? 0), n);
});

test('sin forma exacta: lo más cerca por arriba; contó menos que el fondo: queda todo', () => {
  assert.equal(sumaBilletes(separarEnvio({ 20000: 1, 10000: 1 }, 25000).queda), 30000);
  assert.equal(sumaBilletes(separarEnvio({ 20000: 3, 2000: 2 }, 21000).queda), 22000);
  assert.deepEqual(separarEnvio({ 1000: 5 }, 20000), { queda: { 1000: 5 }, envio: {} });
  assert.deepEqual(separarEnvio({ 20000: 1 }, 20000), { queda: { 20000: 1 }, envio: {} });
});

test('las cantidades llegan como texto del formulario', () => {
  const r = separarEnvio({ 20000: '2', 1000: '20', 500: '' }, 20000);
  assert.deepEqual(r.queda, { 1000: 20 });
  assert.deepEqual(r.envio, { 20000: 2 });
});
