import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarLlegada, cantTxt, porProducto } from './llegada.js';

const filas = porProducto([
  { productoId: 1, nombre: 'Café', unidad: 'u', cantidad: 12 },
  { productoId: 1, nombre: 'Café', unidad: 'u', cantidad: 12 },
  { productoId: 2, nombre: 'Yerba', unidad: 'u', cantidad: 10 },
]);

test('los renglones del mismo producto se juntan', () => {
  assert.deepEqual(filas.map((f) => [f.productoId, f.facturado]), [[1, 24], [2, 10]]);
});

test('sin contar nada no hay diferencias ni se manda nada', () => {
  const r = armarLlegada({ filas });
  assert.deepEqual(r, { llegaron: [], diferencias: [], errores: [] });
});

test('faltante, sobrante y algo que no está en el papel', () => {
  const r = armarLlegada({ filas, conteo: { 1: '20', 2: '12' }, extras: [{ productoId: 3, nombre: 'Té', unidad: 'u', cantidad: '3' }] });
  assert.deepEqual(r.llegaron, [{ productoId: 1, cantidad: 20 }, { productoId: 2, cantidad: 12 }, { productoId: 3, cantidad: 3 }]);
  assert.deepEqual(r.diferencias.map((d) => [d.productoId, d.tipo, d.cantidad]), [[1, 'faltante', 4], [2, 'sobrante', 2], [3, 'sobrante', 3]]);
  assert.deepEqual(r.errores, []);
});

test('mitad y mitad: contra las dos juntas', () => {
  const otra = new Map([[2, 10]]);
  assert.deepEqual(armarLlegada({ filas, conteo: { 2: '20' }, otraMitad: otra }).diferencias, []);
  assert.equal(armarLlegada({ filas, conteo: { 2: '18' }, otraMitad: otra }).diferencias[0].cantidad, 2);
  assert.match(armarLlegada({ filas, conteo: { 2: '5' }, otraMitad: otra }).errores[0], /otra mitad/);
});

test('lo que ya había entrado de más y este papel cobra se descuenta de lo esperado', () => {
  const r = armarLlegada({ filas, conteo: { 2: '7' }, cubiertos: new Map([[2, 3]]) });
  assert.deepEqual(r.diferencias, []);
});

test('errores: vacío, negativo, repetido', () => {
  assert.equal(armarLlegada({ filas, conteo: { 1: '-1' } }).errores.length, 1);
  assert.equal(armarLlegada({ filas, conteo: { 1: 'abc' } }).errores.length, 1);
  assert.equal(armarLlegada({ filas, extras: [{ productoId: 1, nombre: 'Café', cantidad: '2' }] }).errores.length, 1);
  assert.equal(armarLlegada({ filas, extras: [{ productoId: 3, nombre: 'Té', cantidad: '' }] }).errores.length, 1);
});

test('texto de una cantidad', () => {
  assert.equal(cantTxt(4, 'u'), '4 u.');
  assert.equal(cantTxt(1.5, 'kg'), '1,5 kg');
});
