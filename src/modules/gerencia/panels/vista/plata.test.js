import { test } from 'node:test';
import assert from 'node:assert/strict';
import { antiguedad, conSigno, estadoCuadre, lecturaDiferencia, saldoViejo } from './plata.js';

test('el cuadre del efectivo: cierra, sobra o falta', () => {
  assert.equal(estadoCuadre(0).tono, 'ok');
  assert.equal(estadoCuadre(0.6).tono, 'ok');
  assert.equal(estadoCuadre(1500).tono, 'warn');
  assert.equal(estadoCuadre(-625311.01).tono, 'danger');
});

test('la diferencia de un saldo cargado: negativa = salió plata por fuera del ERP', () => {
  assert.equal(lecturaDiferencia(null), null);
  assert.equal(lecturaDiferencia(0.3).tono, 'ok');
  assert.equal(lecturaDiferencia(-50000).tono, 'danger');
  assert.equal(lecturaDiferencia(20000).tono, 'warn');
});

test('qué tan viejo es un saldo', () => {
  const ahora = new Date(2026, 10, 26, 15, 0);
  assert.equal(antiguedad(new Date(2026, 10, 26, 9, 0), ahora), 'hoy');
  assert.equal(antiguedad(new Date(2026, 10, 25, 23, 0), ahora), 'ayer');
  assert.equal(antiguedad(new Date(2026, 10, 20, 9, 0), ahora), 'hace 6 días');
  assert.equal(saldoViejo(new Date(2026, 10, 18, 9, 0), ahora), true);
  assert.equal(saldoViejo(new Date(2026, 10, 24, 9, 0), ahora), false);
});

test('signo explícito', () => {
  const f = (v) => `$${v}`;
  assert.equal(conSigno(10, f), '+$10');
  assert.equal(conSigno(-10, f), '−$10');
  assert.equal(conSigno(0, f), '$0');
});
