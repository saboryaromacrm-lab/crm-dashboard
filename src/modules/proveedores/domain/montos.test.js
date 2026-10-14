/* Proveedores › Montos (14/10/2026): el agrupado y los filtros de la pantalla. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analizarMontos, SIN_PROVEEDOR } from './montos.js';

const prod = (id, proveedorId, o = {}) => ({
  id, nombre: `P${id}`, proveedorId, tipo: 'entero', categoriaId: 1, marcaId: 1,
  stock: 10, valor: 100, costoDia: 0, parado: false, sinCosto: false, ...o,
});
const datos = {
  proveedores: [{ id: 7, nombre: 'Bagley', esLocal: false }, { id: 8, nombre: 'Molino Formosa', esLocal: true }],
  productos: [
    prod(1, 7, { valor: 600, costoDia: 20 }),
    prod(2, 7, { valor: 200, tipo: 'granel', stock: 12.5, categoriaId: 2, parado: true }),
    prod(3, 8, { valor: 150, marcaId: 2, costoDia: 5 }),
    prod(4, null, { valor: 50, sinCosto: true }),
  ],
};

test('agrupa por proveedor, de más a menos plata, con enteros y granel separados', () => {
  const r = analizarMontos(datos);
  assert.deepEqual(r.proveedores.map((g) => g.nombre), ['Bagley', 'Molino Formosa', SIN_PROVEEDOR]);
  const b = r.proveedores[0];
  assert.equal(b.valor, 800);
  assert.deepEqual(b.enteros, { articulos: 1, unidades: 10, valor: 600 });
  assert.deepEqual(b.granel, { articulos: 1, kg: 12.5, valor: 200 });
  assert.equal(b.parado, 200);
  assert.equal(r.resumen.valor, 1000);
  assert.equal(r.resumen.articulos, 4);
  assert.equal(r.resumen.sinCosto, 1);
});

test('porcentajes, acumulado y cuántos juntan el 80 %', () => {
  const r = analizarMontos(datos);
  assert.equal(r.proveedores[0].pct, 80);
  assert.equal(r.proveedores[1].pctAcumulado, 95);
  assert.equal(r.resumen.pareto80, 1, 'Bagley solo llega al 80 %');
  assert.deepEqual(r.proveedores.map((g) => g.pareto), [true, false, false]);
});

test('días de stock: la plata ÷ lo que se vende por día a costo; sin ventas, null', () => {
  const r = analizarMontos(datos);
  assert.equal(r.proveedores[0].dias, 40);
  assert.equal(r.proveedores[1].dias, 30);
  assert.equal(r.proveedores[2].dias, null);
  assert.equal(r.resumen.dias, 1000 / 25);
});

test('los filtros recalculan todo: tipo, categoría, marca, locales y nombre', () => {
  assert.equal(analizarMontos(datos, { tipo: 'granel' }).resumen.valor, 200);
  assert.equal(analizarMontos(datos, { categoriaId: '2' }).proveedores.length, 1);
  assert.deepEqual(analizarMontos(datos, { marcaId: 2 }).proveedores.map((g) => g.id), [8]);
  const loc = analizarMontos(datos, { soloLocales: true });
  assert.deepEqual(loc.proveedores.map((g) => g.nombre), ['Molino Formosa']);
  assert.equal(loc.proveedores[0].pct, 100, 'el % es sobre lo filtrado');
  assert.deepEqual(analizarMontos(datos, { buscar: 'molíno' }).proveedores.map((g) => g.id), [8], 'sin importar tildes');
  assert.equal(analizarMontos(null), null);
});
