import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDENES_GRUPO, agruparStock, conVariacion, filtrarStock, marcarAbc, opcionesStock, ordenarStock, resumirStock, siguienteOrden,
} from './stockValorizado.js';

const fila = (o) => ({
  productoId: 1, nombre: 'X', tipo: 'entero', stock: 1, valor: 100, costoUnitario: 10, vendido: 1, diasDeStock: 30,
  estado: 'ok', deCoffit: false, proveedorId: 1, proveedor: 'Arcor SA', marcaId: 1, marca: 'Arcor', categoriaId: 1, categoria: 'Golosinas',
  valorVenta: 150, margenAnio: 0, costoVendidoAnio: 0, locales: { 1: 100 }, ...o,
});
const filas = [
  fila({ productoId: 1, nombre: 'Bon o Bon', valor: 500, valorVenta: 800, stock: 40, margenAnio: 1000, costoVendidoAnio: 2000, locales: { 1: 300, 2: 200 } }),
  fila({ productoId: 2, nombre: 'Almendras', tipo: 'granel', valor: 900, stock: 3.5, proveedorId: 2, proveedor: 'Frutos SRL', marcaId: null, marca: '', categoriaId: 2, categoria: 'Frutos secos', estado: 'parado', diasDeStock: null, valorVenta: 1200, margenAnio: 450, costoVendidoAnio: 900, locales: { 1: 900 } }),
  fila({ productoId: 3, nombre: 'Café Coffit', valor: 300, deCoffit: true, proveedorId: null, proveedor: '', locales: {} }),
  fila({ productoId: 4, nombre: 'Maní', tipo: 'granel', valor: 50, stock: 12, costoUnitario: 0, proveedorId: 2, proveedor: 'Frutos SRL', categoriaId: 2, categoria: 'Frutos secos', estado: 'sobrestock', diasDeStock: 400, valorVenta: null, locales: { 2: 50 } }),
];

test('filtra por proveedor, marca, categoría, tipo y «sin …»', () => {
  assert.deepEqual(filtrarStock(filas, { proveedor: '2' }).map((x) => x.productoId), [2, 4]);
  assert.deepEqual(filtrarStock(filas, { marca: '0' }).map((x) => x.productoId), [2]);
  assert.deepEqual(filtrarStock(filas, { proveedor: '0' }).map((x) => x.productoId), [3]);
  assert.deepEqual(filtrarStock(filas, { categoria: '2', tipo: 'granel' }).map((x) => x.productoId), [2, 4]);
  assert.deepEqual(filtrarStock(filas, { tipo: 'entero' }).map((x) => x.productoId), [1, 3]);
  assert.deepEqual(filtrarStock(filas, { q: 'mani' }).map((x) => x.productoId), [4]);
  assert.deepEqual(filtrarStock(filas, { q: 'frutos srl', estado: 'parado' }).map((x) => x.productoId), [2]);
});

test('ordena por plata y por cantidad, en los dos sentidos; lo sin dato al final', () => {
  assert.deepEqual(ordenarStock(filas, { col: 'valor', dir: 'desc' }).map((x) => x.productoId), [2, 1, 3, 4]);
  assert.deepEqual(ordenarStock(filas, { col: 'valor', dir: 'asc' }).map((x) => x.productoId), [4, 3, 1, 2]);
  assert.deepEqual(ordenarStock(filas, { col: 'stock', dir: 'desc' }).map((x) => x.productoId), [1, 4, 2, 3]);
  assert.deepEqual(ordenarStock(filas, { col: 'dias', dir: 'asc' }).map((x) => x.productoId).at(-1), 2);
  assert.deepEqual(ordenarStock(filas, { col: 'nombre', dir: 'asc' }).map((x) => x.nombre), ['Almendras', 'Bon o Bon', 'Café Coffit', 'Maní']);
});

test('clic en la columna: primero de mayor a menor, después al revés', () => {
  assert.deepEqual(siguienteOrden({ col: 'valor', dir: 'desc' }, 'stock'), { col: 'stock', dir: 'desc' });
  assert.deepEqual(siguienteOrden({ col: 'stock', dir: 'desc' }, 'stock'), { col: 'stock', dir: 'asc' });
  assert.deepEqual(siguienteOrden({ col: 'valor', dir: 'desc' }, 'nombre'), { col: 'nombre', dir: 'asc' });
});

test('los totales siguen al filtro y Coffit no suma', () => {
  const r = resumirStock(filas, (id) => ({ 1: 'Distribuidora', 2: 'Fontana' }[id]));
  assert.equal(r.valor, 1450);
  assert.equal(r.articulos, 3);
  assert.equal(r.coffit, 300);
  assert.equal(r.parado, 900);
  assert.equal(r.sobrestock, 50);
  assert.equal(r.sinCosto, 1);
  assert.deepEqual(r.porSucursal.map((x) => [x.nombre, x.valor]), [['Distribuidora', 1200], ['Fontana', 250]]);
  const soloFrutos = resumirStock(filtrarStock(filas, { proveedor: '2' }));
  assert.equal(soloFrutos.valor, 950);
});

test('opciones: solo lo que tiene stock y si hay «sin …»', () => {
  const o = opcionesStock(filas);
  assert.deepEqual(o.proveedores.lista.map((x) => x.l), ['Arcor SA', 'Frutos SRL']);
  assert.equal(o.proveedores.sin, true);
  assert.equal(o.marcas.sin, true);
  assert.equal(o.categorias.sin, false);
});

test('a precio de venta: el margen solo cuenta lo que tiene costo y precio; rinde y rotación por año', () => {
  const r = resumirStock(filas);
  assert.equal(r.venta, 2000); // 800 + 1200; Maní no tiene precio, Coffit no suma
  assert.equal(r.sinPrecio, 1);
  assert.equal(r.margenPotencial, 600); // (800 − 500) + (1200 − 900)
  assert.equal(r.margenPotencialPct, 30);
  assert.equal(r.rinde, 1); // 1450 de margen en el año / 1450 de stock
  assert.equal(r.rotacion, 2); // 2900 de costo vendido / 1450
  assert.deepEqual(filtrarStock(filas, { falta: 'precio' }).map((x) => x.productoId), [4]);
  assert.deepEqual(filtrarStock(filas, { falta: 'costo' }).map((x) => x.productoId), [4]);
});

test('ABC: el primer 80 % de la plata es A, el 15 % que sigue B y la cola C; Coffit sin clase', () => {
  const con = marcarAbc([
    fila({ productoId: 1, valor: 700 }), fila({ productoId: 2, valor: 200 }), fila({ productoId: 3, valor: 60 }),
    fila({ productoId: 4, valor: 40 }), fila({ productoId: 5, valor: 999, deCoffit: true }),
  ]);
  assert.deepEqual(con.map((x) => [x.productoId, x.abc]), [[1, 'A'], [2, 'A'], [3, 'B'], [4, 'C'], [5, null]]);
  assert.deepEqual(filtrarStock(con, { abc: 'A' }).map((x) => x.productoId), [1, 2]);
  assert.deepEqual(resumirStock(con).abc, [{ clase: 'A', articulos: 2, valor: 900 }, { clase: 'B', articulos: 1, valor: 60 }, { clase: 'C', articulos: 1, valor: 40 }]);
});

test('agrupado por proveedor: sumas por grupo, «sin proveedor» con clave 0 y Coffit afuera', () => {
  const g = ordenarStock(agruparStock(filas, 'proveedor'), { col: 'valor', dir: 'desc' }, ORDENES_GRUPO);
  assert.deepEqual(g.map((x) => [x.clave, x.nombre, x.valor, x.articulos]), [['2', 'Frutos SRL', 950, 2], ['1', 'Arcor SA', 500, 1]]);
  assert.equal(g[0].rinde, r2(450 / 950));
  const marcas = agruparStock(filas, 'marca');
  assert.equal(marcas.find((x) => x.clave === '0').nombre, 'Sin marca');
  assert.deepEqual(siguienteOrden({ col: 'valor', dir: 'desc' }, 'nombre', ORDENES_GRUPO), { col: 'nombre', dir: 'asc' });
});

test('fotos de fin de mes: variación contra el mes anterior', () => {
  const m = conVariacion([{ mes: '2026-11', valor: 110 }, { mes: '2026-10', valor: 100 }, { mes: '2026-09', valor: 0 }]);
  assert.deepEqual(m.map((x) => x.variacion), [10, null, null]);
});

function r2(n) { return Math.round(n * 100) / 100; }
