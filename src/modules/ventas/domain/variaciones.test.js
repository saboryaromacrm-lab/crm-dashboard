/* Ventas › Variaciones (14/10/2026): la cuenta, los filtros dinámicos y el orden. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analizarVariaciones, detalleGrupo, prepararVariaciones, variar } from './variaciones.js';

/* Coca (entero, marca 1, etiquetas 5 y 6), Yerba (granel, marca 2), Galletita (entero, marca 1, nueva), Alfajor (dejó de venderse). */
const prep = prepararVariaciones({
  filas: [
    [1, 1, 50, 100, 80, 10000, 8000], // Coca, Distribuidora: +25 % cantidad
    [1, 2, 50, 20, 20, 2000, 2000], // Coca, Express: igual
    [2, 1, 50, 12.5, 25, 5000, 10000], // Yerba: −50 %
    [3, 1, 50, 10, 0, 1000, 0], // Galletita: nueva
    [4, 2, 50, 0, 4, 0, 400], // Alfajor: dejó
  ],
  productos: [
    [1, 'Coca Cola 2,25 L', false, 1, 9, null, 7, [5, 6]],
    [2, 'Yerba Playadito', true, 2, 8, 30, 7, []],
    [3, 'Galletita Óreo', false, 1, 8, null, null, []],
    [4, 'Alfajor Jorgito', false, null, 8, null, 7, [5]],
  ],
  nombres: { marcas: { 1: 'Coca', 2: 'Playadito' }, categorias: { 8: 'Almacén', 9: 'Bebidas' }, subcategorias: { 30: 'Yerbas' }, etiquetas: { 5: 'Promo', 6: 'Frío' }, proveedores: { 7: 'Bagley' }, sucursales: { 1: 'Distribuidora', 2: 'Express 1' }, listas: { 50: 'Minorista' } },
});

test('variar: %, nuevo, dejó de venderse y el umbral', () => {
  assert.deepEqual(variar(125, 100), { dif: 25, pct: 25, estado: 'sube' });
  assert.equal(variar(105, 100).estado, 'igual', 'dentro de ±10 %');
  assert.equal(variar(105, 100, 5).estado, 'sube', 'con umbral 5 %');
  assert.deepEqual(variar(10, 0), { dif: 10, pct: null, estado: 'nuevo' });
  assert.equal(variar(0, 4).estado, 'dejo');
  assert.equal(variar(0, 4).pct, -100);
  assert.equal(variar(0, 0), null, 'nada que comparar');
});

test('por producto: cantidades separadas (u. y kg) y las dos sucursales sumadas', () => {
  const r = analizarVariaciones(prep, { medida: 'unidades', orden: 'sube' });
  const coca = r.grupos.find((g) => g.clave === 1);
  assert.equal(coca.ua, 120); assert.equal(coca.ub, 100);
  assert.equal(Math.round(coca.v.unidades.pct), 20);
  const yerba = r.grupos.find((g) => g.clave === 2);
  assert.equal(yerba.ka, 12.5); assert.equal(yerba.v.unidades, null, 'el granel no tiene unidades');
  assert.equal(yerba.v.kilos.pct, -50);
  assert.deepEqual(r.grupos.map((g) => g.nombre), ['Galletita Óreo', 'Coca Cola 2,25 L', 'Alfajor Jorgito', 'Yerba Playadito'], 'nuevo arriba, sin unidades al final');
  assert.equal(r.resumen.ua, 130); assert.equal(r.resumen.ub, 104);
  assert.equal(r.resumen.va, 18000); assert.equal(r.resumen.vb, 20400);
});

test('resumen: cuántos subieron, bajaron, nuevos, dejaron, y los extremos', () => {
  const r = analizarVariaciones(prep, { medida: 'plata' });
  assert.deepEqual([r.resumen.sube, r.resumen.baja, r.resumen.igual, r.resumen.nuevo, r.resumen.dejo], [1, 1, 0, 1, 1]);
  assert.equal(r.resumen.mayorSuba.nombre, 'Coca Cola 2,25 L', 'por monto: +$2.000');
  assert.equal(r.resumen.mayorBaja.nombre, 'Yerba Playadito', 'por monto: −$5.000');
});

test('ver por marca, etiqueta (suma en las dos) y sucursal; el detalle del grupo', () => {
  let r = analizarVariaciones(prep, { verPor: 'marca', orden: 'nombre' });
  assert.deepEqual(r.grupos.map((g) => g.nombre), ['Coca', 'Playadito', 'Sin marca']);
  assert.equal(r.grupos[0].va, 13000);
  assert.deepEqual(detalleGrupo(r.grupos[0], { orden: 'vendido' }).map((x) => x.nombre), ['Coca Cola 2,25 L', 'Galletita Óreo']);
  r = analizarVariaciones(prep, { verPor: 'etiqueta', orden: 'nombre' });
  assert.deepEqual(r.grupos.map((g) => [g.nombre, g.va]), [['Frío', 12000], ['Promo', 12000], ['Sin etiqueta', 6000]]);
  assert.equal(r.resumen.va, 18000, 'el total no se duplica');
  r = analizarVariaciones(prep, { verPor: 'sucursal', orden: 'nombre' });
  assert.deepEqual(r.grupos.map((g) => [g.nombre, g.va, g.vb]), [['Distribuidora', 16000, 18000], ['Express 1', 2000, 2400]]);
});

test('filtros dinámicos: cada desplegable cuenta con los OTROS filtros puestos', () => {
  const r = analizarVariaciones(prep, { filtros: { marca: '1', sucursal: '2' } });
  assert.deepEqual(r.grupos.map((g) => g.nombre), ['Coca Cola 2,25 L']);
  assert.deepEqual(r.opciones.marca.map((o) => [o.nombre, o.n]), [['Coca', 1], ['Sin marca', 1]], 'en Express 1 se vendieron Coca y Alfajor');
  assert.deepEqual(r.opciones.sucursal.map((o) => [o.nombre, o.n]), [['Distribuidora', 2], ['Express 1', 1]], 'de la marca Coca');
  assert.deepEqual(r.opciones.tipo.map((o) => o.nombre), ['Enteros']);
  const g = analizarVariaciones(prep, { filtros: { tipo: 'granel' } });
  assert.deepEqual(g.grupos.map((x) => x.nombre), ['Yerba Playadito']);
  const vacio = analizarVariaciones(prep, { filtros: { marca: '2', sucursal: '2' } });
  assert.equal(vacio.grupos.length, 0);
  assert.ok(vacio.opciones.marca.some((o) => o.valor === '2' && o.n === 0), 'lo elegido sigue en el desplegable');
});

test('buscar sin importar tildes; sin datos, null', () => {
  assert.deepEqual(analizarVariaciones(prep, { buscar: 'oreo' }).grupos.map((g) => g.clave), [3]);
  assert.equal(analizarVariaciones(null), null);
  assert.equal(prepararVariaciones(null), null);
});
