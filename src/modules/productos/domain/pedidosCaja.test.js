import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haceCuanto, minutos, textoRenglon } from './pedidosCaja.js';

const hace = (min) => new Date(Date.now() - min * 60000).toISOString();

test('minutos: del pedido a «Listo», redondeado y nunca negativo', () => {
  assert.equal(minutos('2026-10-16T12:00:00Z', '2026-10-16T12:07:40Z'), 8);
  assert.equal(minutos('2026-10-16T12:00:00Z', '2026-10-16T11:59:00Z'), 0);
  assert.equal(minutos(null, '2026-10-16T12:00:00Z'), null);
  assert.equal(minutos(hace(3)), 3);
});

test('haceCuanto: recién, minutos y horas', () => {
  assert.equal(haceCuanto(hace(0)), 'recién');
  assert.equal(haceCuanto(hace(4)), 'hace 4 min');
  assert.equal(haceCuanto(hace(60)), 'hace 1 h');
  assert.equal(haceCuanto(hace(70)), 'hace 1 h 10 min');
  assert.equal(haceCuanto(null), '');
});

test('textoRenglon: cantidad, producto y tamaño del paquete', () => {
  assert.equal(textoRenglon({ paquetes: 2, nombre: 'Avena Instantánea', tamKg: 0.4 }), '2 × Avena Instantánea 400 g');
  assert.equal(textoRenglon({ paquetes: 1, nombre: 'Almendras', tamKg: 1 }), '1 × Almendras 1 kg');
});
