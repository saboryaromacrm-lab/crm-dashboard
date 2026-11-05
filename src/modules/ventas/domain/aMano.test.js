import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparAMano, claveTexto } from './aMano.js';

const f = (concepto, cobrado, cajero = 'Ana', sucursal = 'Fontana', fecha = '2026-10-10T12:00:00Z') => ({ concepto, cobrado, cajero, sucursal, fecha });

test('junta sin mayúsculas, acentos ni espacios de más, y muestra el texto más usado', () => {
  assert.equal(claveTexto('  Café   CON leche '), 'cafe con leche');
  const g = agruparAMano([f('CARAMELOS', 2500), f('caramelos', 1900, 'Beto', 'Express 1'), f('CARAMELOS ', 3000), f('paprika', 4700)]);
  assert.equal(g.length, 2);
  const c = g.find((x) => x.clave === 'caramelos');
  assert.equal(c.texto, 'CARAMELOS');
  assert.equal(c.veces, 3);
  assert.equal(c.cobrado, 7400);
  assert.equal(c.min, 1900);
  assert.equal(c.max, 3000);
  assert.deepEqual(c.cajeros, ['Ana', 'Beto']);
  assert.deepEqual(c.locales, ['Express 1', 'Fontana']);
  assert.equal(g[0].clave, 'caramelos', 'el de más plata primero');
});

test('una devolución resta y no cuenta como precio', () => {
  const [g] = agruparAMano([f('pecan', 9999), f('pecan', -9999)]);
  assert.equal(g.cobrado, 0);
  assert.equal(g.min, 9999);
  assert.equal(g.max, 9999);
});
