/**
 * El mapa de márgenes: que agrupe lo que de verdad comparte markup, y que el
 * alcance de "cambiar este grupo" sea EXACTO.
 *
 * Lo segundo es lo que toca plata: el grupo entrega los ids de las filas de
 * `producto_listas` que lo componen, y la actualización masiva cambia esas y
 * solo esas. Si se colara la fila de un paquete del mismo producto —que tiene
 * su propio markup—, el dueño vería "cambio 312 al 42%" y en la góndola se
 * habrían movido precios que nadie tocó.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filasDeMargenes, agruparMargenes, resumenPorLista, columnasDeMargenes, grillaDeMargenes,
} from './margenes.js';

/** Un formato de venta como lo manda el snapshot del inventario. */
const fmt = (id, listaId, etiqueta, markup, orden, extra = {}) => ({
  id, listaId, etiqueta, markup, orden, modoPrecio: 'markup', precioFinalUnitario: 1000, ...extra,
});

/* Dos productos que comparten el 35% en Minorista, uno con un paquete que va
 * al 50% en la misma lista: el caso que el dueño describió. */
const CATALOGO = [
  {
    id: 1,
    nombre: 'Aceite de Girasol',
    marca: 'Natura',
    categoria: 'Almacén',
    tipo: 'entero',
    estado: 'activo',
    costoNeto: 2730,
    listas: [fmt(101, 7, 'Minorista', 35, 1), fmt(102, 8, 'Mayorista', 28, 2)],
    presentaciones: [],
  },
  {
    id: 2,
    nombre: 'Yerba Suave',
    marca: 'Rosamonte',
    categoria: 'Almacén',
    tipo: 'granel',
    estado: 'activo',
    costoNeto: 1890,
    listas: [fmt(103, 7, 'Minorista', 35, 1)],
    presentaciones: [
      { id: 55, tamKg: 0.5, costoNeto: 945, listas: [fmt(104, 7, 'Minorista', 50, 1)] },
    ],
  },
  {
    id: 3,
    nombre: 'Café en cápsulas',
    marca: 'Illy',
    categoria: 'Cafetería',
    tipo: 'entero',
    estado: 'activo',
    costoNeto: 5000,
    // Precio a mano: no tiene markup que gobierne nada.
    listas: [fmt(105, 7, 'Minorista', 0, 1, { modoPrecio: 'precio', precioFijo: 9900 })],
    presentaciones: [],
  },
];

test('aplana el suelto y CADA paquete, una fila por lista', () => {
  const filas = filasDeMargenes(CATALOGO);
  assert.equal(filas.length, 5, 'son 2 + 1 + 1 (paquete) + 1');
  const paquete = filas.find((f) => f.filaId === 104);
  assert.equal(paquete.forma, '500 g', 'el paquete se identifica por su tamaño');
  assert.equal(paquete.presentacionId, 55);
  assert.equal(paquete.costo, 945, 'el paquete lleva SU costo, no el del kilo');
  const granel = filas.find((f) => f.filaId === 103);
  assert.equal(granel.forma, 'Granel (kg)', 'el granel suelto se vende por kilo');
});

test('junta a los que comparten markup en la misma lista', () => {
  const grupos = agruparMargenes(filasDeMargenes(CATALOGO));
  const g35 = grupos.find((g) => g.listaId === 7 && g.markup === 35);
  assert.equal(g35.cantidad, 2, 'el aceite y la yerba van juntos al 35%');
  assert.deepEqual(g35.filaIds.sort(), [101, 103], 'y el grupo sabe qué filas son');
  assert.equal(g35.productos.size, 2);
});

test('el paquete NO se mezcla con el kilo del que salió', () => {
  // La trampa: la yerba está al 35% y su paquete de 500 g al 50%, los dos en
  // Minorista. Son dos grupos distintos, y por eso cambiar uno no toca al otro.
  const grupos = agruparMargenes(filasDeMargenes(CATALOGO));
  const g50 = grupos.find((g) => g.listaId === 7 && g.markup === 50);
  assert.deepEqual(g50.filaIds, [104], 'el 50% es solo la fila del paquete');
  const g35 = grupos.find((g) => g.listaId === 7 && g.markup === 35);
  assert.ok(!g35.filaIds.includes(104), 'la fila del paquete no puede caer en el grupo del kilo');
});

test('el precio definido a mano tiene su propio grupo y no es un markup 0', () => {
  const grupos = agruparMargenes(filasDeMargenes(CATALOGO));
  const fijo = grupos.find((g) => g.modoPrecio === 'precio');
  assert.ok(fijo, 'tiene que existir el grupo de precio definido');
  assert.equal(fijo.markup, null, 'no tiene porcentaje');
  assert.deepEqual(fijo.filaIds, [105]);
  const cero = grupos.find((g) => g.modoPrecio === 'markup' && g.markup === 0);
  assert.equal(cero, undefined, 'y no aparece como un grupo al 0%');
});

test('ordena por lista y, adentro, de mayor a menor con el precio fijo al final', () => {
  const grupos = agruparMargenes(filasDeMargenes(CATALOGO));
  const minorista = grupos.filter((g) => g.listaId === 7);
  assert.deepEqual(
    minorista.map((g) => (g.modoPrecio === 'precio' ? 'fijo' : g.markup)),
    [50, 35, 'fijo'],
  );
  assert.equal(grupos[grupos.length - 1].listaId, 8, 'Mayorista va después: su orden es 2');
});

test('el resumen por lista trae el total y el grupo más grande (la barra)', () => {
  const resumen = resumenPorLista(agruparMargenes(filasDeMargenes(CATALOGO)));
  const minorista = resumen.find((l) => l.listaId === 7);
  assert.equal(minorista.total, 4, 'cuatro filas en Minorista');
  assert.equal(minorista.mayor, 2, 'el grupo más grande son los dos al 35%');
  assert.equal(resumen[0].listaId, 7, 'la lista de menor orden va primero');
});

test('la grilla pone una fila por forma y una celda por lista', () => {
  const filas = filasDeMargenes(CATALOGO);
  const columnas = columnasDeMargenes(filas);
  assert.deepEqual(columnas.map((c) => c.lista), ['Minorista', 'Mayorista']);

  const grilla = grillaDeMargenes(filas);
  assert.equal(grilla.length, 4, 'tres productos, y la yerba además con su paquete');
  const aceite = grilla.find((f) => f.productoId === 1);
  assert.equal(aceite.celdas.get(7).markup, 35);
  assert.equal(aceite.celdas.get(8).markup, 28);
  const yerbaKilo = grilla.find((f) => f.productoId === 2 && f.presentacionId === null);
  assert.equal(yerbaKilo.celdas.get(8), undefined, 'sin precio en Mayorista la celda queda vacía');
});

test('un catálogo vacío no rompe nada', () => {
  assert.deepEqual(filasDeMargenes(), []);
  assert.deepEqual(agruparMargenes(), []);
  assert.deepEqual(resumenPorLista(), []);
  assert.deepEqual(columnasDeMargenes(), []);
  assert.deepEqual(grillaDeMargenes(), []);
  // Un producto sin formato de venta cargado no aporta filas (y no explota).
  assert.deepEqual(filasDeMargenes([{ id: 9, nombre: 'Sin precio', listas: [], presentaciones: [] }]), []);
});
