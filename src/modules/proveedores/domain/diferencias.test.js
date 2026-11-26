import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accionDe, cantTxt, queTxt, totalesPendientes } from './diferencias.js';

test('las acciones a mano de cada tipo', () => {
  assert.equal(accionDe('faltante', 'llego').boton, 'Llegó');
  assert.equal(accionDe('sobrante', 'devuelto').boton, 'Devolver');
  assert.equal(accionDe('faltante', 'devuelto'), null);
});

test('cómo se dice', () => {
  assert.equal(cantTxt(4, 'entero'), '4 u.');
  assert.equal(cantTxt(1.5, 'granel'), '1,5 kg');
  assert.equal(queTxt({ tipo: 'faltante', cantidad: 4, tipoProducto: 'entero' }), 'Faltaron 4 u.');
  assert.equal(queTxt({ tipo: 'sobrante', cantidad: 2, tipoProducto: 'entero' }), 'Vinieron 2 u. de más');
});

test('lo pendiente: te deben los faltantes, le debés lo que vino de más', () => {
  assert.deepEqual(totalesPendientes([
    { estado: 'pendiente', tipo: 'faltante', valorPendiente: 100.5 },
    { estado: 'pendiente', tipo: 'sobrante', valorPendiente: 40 },
    { estado: 'resuelta', tipo: 'faltante', valorPendiente: 0 },
  ]), { teDeben: 100.5, leDebes: 40 });
});
