/**
 * Ajustar markups (0218): que entren EXACTAMENTE las filas elegidas — la
 * lista, la marca, el proveedor que fija el precio, la forma y el tamaño —, que
 * el precio definido quede afuera y que el markup nuevo salga bien.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertaPrecio, aplicarRegla, describirAjuste, filasDelAjuste, nuevoMarkup, opcionesAjuste, planAjuste } from './ajusteMarkups.js';

const fila = (id, listaId, markup, modoPrecio = 'markup') => ({ id, listaId, markup, modoPrecio });
const NUEZ = {
  id: 1, nombre: 'Nuez', marca: 'Alicante', categoria: 'Frutos secos', tipo: 'granel',
  listas: [fila(10, 1, 40), fila(11, 2, 30)],
  presentaciones: [
    { id: 100, tamKg: 0.5, listas: [fila(101, 1, 50), fila(102, 2, 35)] },
    { id: 200, tamKg: 0.25, listas: [fila(201, 1, 55, 'precio')] },
  ],
};
const ACEITE = { id: 2, nombre: 'Aceite', marca: 'Cocinero', categoria: 'Almacén', tipo: 'entero', listas: [fila(20, 1, 25)] };
const PRODUCTOS = [NUEZ, ACEITE];
/* El proveedor que fija el precio: la Nuez al 7, el Aceite al 8. */
const proveedorDe = (p) => (p.id === 1 ? 7 : 8);
const ids = (r) => r.filas.map((f) => f.id).sort((a, b) => a - b);

test('sin criterios entran todas las filas de markup; el precio definido se cuenta aparte', () => {
  const r = filasDelAjuste(PRODUCTOS, {}, proveedorDe);
  assert.deepEqual(ids(r), [10, 11, 20, 101, 102]);
  assert.equal(r.aMano, 1);
});

test('solo fraccionados de 500 g en la lista 1', () => {
  const r = filasDelAjuste(PRODUCTOS, { listaIds: [1], forma: 'fraccionado', tamanos: ['500 g'] }, proveedorDe);
  assert.deepEqual(ids(r), [101]);
  assert.equal(r.filas[0].forma, '500 g');
});

test('granel suelto y enteros van aparte de los paquetes', () => {
  assert.deepEqual(ids(filasDelAjuste(PRODUCTOS, { forma: 'suelto' }, proveedorDe)), [10, 11]);
  assert.deepEqual(ids(filasDelAjuste(PRODUCTOS, { forma: 'entero' }, proveedorDe)), [20]);
});

test('marcas y proveedor que fija el precio, varios a la vez', () => {
  assert.deepEqual(ids(filasDelAjuste(PRODUCTOS, { proveedorIds: [8] }, proveedorDe)), [20]);
  assert.deepEqual(ids(filasDelAjuste(PRODUCTOS, { marcas: ['Alicante', 'Cocinero'], listaIds: [2] }, proveedorDe)), [11, 102]);
  assert.deepEqual(ids(filasDelAjuste(PRODUCTOS, { marcas: ['Alicante'], proveedorIds: [8] }, proveedorDe)), []);
});

test('las reglas: %, puntos y fijar, nunca negativas, y el redondeo de 5 en 5', () => {
  assert.equal(aplicarRegla(40, 'porcentaje', 10), 44);
  assert.equal(aplicarRegla(40, 'monto', 5), 45);
  assert.equal(aplicarRegla(40, 'fijar', 50), 50);
  assert.equal(aplicarRegla(10, 'monto', -20), 0);
  assert.equal(nuevoMarkup(40, { modo: 'porcentaje', valor: 8, redondear: true }), 45); // 43,2 → 45
  assert.equal(nuevoMarkup(40, { modo: 'porcentaje', valor: 8, redondear: false }), 43.2);
});

test('el plan deja solo lo que cambia y sin valor no propone nada', () => {
  const { filas } = filasDelAjuste(PRODUCTOS, { listaIds: [1] }, proveedorDe);
  assert.deepEqual(planAjuste(filas, { modo: 'fijar', valor: '' }), []);
  const plan = planAjuste(filas, { modo: 'fijar', valor: 50 });
  assert.deepEqual(plan.map((f) => [f.id, f.actual, f.nuevo]), [[10, 40, 50], [20, 25, 50]]); // el de 50 no cambia
});

test('opciones: proveedores que fijan precio y tamaños de menor a mayor', () => {
  const o = opcionesAjuste(PRODUCTOS, proveedorDe);
  assert.deepEqual(o.marcas, ['Alicante', 'Cocinero']);
  assert.deepEqual(o.proveedorIds.sort(), [7, 8]);
  assert.deepEqual(o.tamanos, ['250 g', '500 g']);
});

test('alerta: precio que baja o que sube más de 30 %', () => {
  assert.equal(alertaPrecio(100, 95), 'baja');
  assert.equal(alertaPrecio(100, 131), 'fuerte');
  assert.equal(alertaPrecio(100, 120), null);
});

test('la descripción del ajuste se lee', () => {
  const d = describirAjuste(
    { listaIds: [1], marcas: ['Alicante'], forma: 'fraccionado', tamanos: ['500 g'], proveedorIds: [7] },
    { modo: 'monto', valor: 5, redondear: true },
    { lista: () => 'Minorista', proveedor: () => 'Dos Hermanos' },
  );
  assert.equal(d, 'Minorista · Marcas: Alicante · Proveedores: Dos Hermanos · Fraccionados (paquetes) 500 g · +5 puntos, de 5 en 5');
});
