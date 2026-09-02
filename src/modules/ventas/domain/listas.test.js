/**
 * El motor del formato de venta: con qué lista se cotiza cada renglón.
 * Las cuatro puertas (cliente, producto, marca, monto) y el piso.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregadosTicket, contextoResolucion, reglasDeMarcaCumplidas, resolverRenglon } from './listas.js';

const catalogo = {
  listas: [
    { listaId: 1, modalidadId: 10, esBase: true, nombre: 'Minorista' },
    { listaId: 2, modalidadId: 20, esBase: false, nombre: 'Mayorista' },
    { listaId: 3, modalidadId: 30, esBase: false, nombre: 'Distribuidor' },
  ],
  reglasMarca: [{ marcaId: 7, modalidadId: 20, unidadesMinimas: 12, marca: 'Coca-Cola' }],
};
// Precios del artículo, ya ordenados por preferencia (la mejor primero).
const precios = [
  { listaId: 3, precio: 80, unidadesMinimas: 50 },
  { listaId: 2, precio: 90, unidadesMinimas: 6 },
  { listaId: 1, precio: 100, unidadesMinimas: 0 },
];

const ctxDe = (renglones, cliente = null, modalidadesExtra = []) =>
  contextoResolucion({ catalogo, cliente, renglones, modalidadesExtra });

test('agregadosTicket: cuenta por producto y por marca, ignorando cantidades no positivas', () => {
  const a = agregadosTicket([
    { productoId: 1, marcaId: 7, cantidad: 3 },
    { productoId: 1, marcaId: 7, cantidad: 2 },
    { productoId: 2, marcaId: 7, cantidad: 0 },
    { productoId: 3, marcaId: null, cantidad: 4 },
  ]);
  assert.equal(a.porProducto.get(1), 5);
  assert.equal(a.porProducto.has(2), false);
  assert.equal(a.porMarca.get(7), 5);
  assert.equal(a.porMarca.has(null), false);
});

test('reglasDeMarcaCumplidas: solo las marcas que llegaron al mínimo', () => {
  const cumplidas = reglasDeMarcaCumplidas(catalogo.reglasMarca, agregadosTicket([{ productoId: 1, marcaId: 7, cantidad: 12 }]));
  assert.equal(cumplidas.get(7)?.get(20)?.llevadas, 12);
  const noCumplidas = reglasDeMarcaCumplidas(catalogo.reglasMarca, agregadosTicket([{ productoId: 1, marcaId: 7, cantidad: 11 }]));
  assert.equal(noCumplidas.has(7), false);
});

test('resolverRenglon: sin puertas abiertas queda el piso (mostrador)', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 1 };
  const res = resolverRenglon(r, precios, ctxDe([r]));
  assert.equal(res.lista.listaId, 1);
  assert.equal(res.precio, 100);
  assert.equal(res.origen, 'base');
});

test('resolverRenglon: puerta 1 — el cliente tiene la lista por contrato', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 1 };
  const res = resolverRenglon(r, precios, ctxDe([r], { listas: [2] }));
  assert.equal(res.lista.listaId, 2);
  assert.equal(res.origen, 'cliente');
});

test('resolverRenglon: puerta 2 — el mínimo de unidades del producto', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 6 };
  const res = resolverRenglon(r, precios, ctxDe([r]));
  assert.equal(res.lista.listaId, 2, '6 unidades abren Mayorista');
  assert.equal(res.origen, 'auto');
  const r50 = { productoId: 1, marcaId: 7, cantidad: 50 };
  assert.equal(resolverRenglon(r50, precios, ctxDe([r50])).lista.listaId, 3, '50 abren Distribuidor, que va primero');
});

test('resolverRenglon: puerta 3 — la regla de marca alcanza SOLO a esa marca', () => {
  // 12 unidades de la marca 7 repartidas en dos productos: cada uno por
  // separado no llega al mínimo del producto (6), pero la marca sí.
  const a = { productoId: 1, marcaId: 7, cantidad: 5 };
  const b = { productoId: 2, marcaId: 7, cantidad: 7 };
  const otro = { productoId: 3, marcaId: 9, cantidad: 1 };
  const ctx = ctxDe([a, b, otro]);
  const preciosSinMinimo = [{ listaId: 2, precio: 90, unidadesMinimas: 0 }, { listaId: 1, precio: 100, unidadesMinimas: 0 }];
  assert.equal(resolverRenglon(a, preciosSinMinimo, ctx).origen, 'marca');
  assert.equal(resolverRenglon(otro, preciosSinMinimo, ctx).origen, 'base', 'la otra marca no se beneficia');
});

test('resolverRenglon: puerta 4 — el monto alcanza a todo el ticket', () => {
  const r = { productoId: 3, marcaId: 9, cantidad: 1 };
  const preciosSinMinimo = [{ listaId: 2, precio: 90, unidadesMinimas: 0 }, { listaId: 1, precio: 100, unidadesMinimas: 0 }];
  const res = resolverRenglon(r, preciosSinMinimo, ctxDe([r], null, [20]));
  assert.equal(res.origen, 'monto');
  assert.equal(res.precio, 90);
});

test('resolverRenglon: sin precios no hay lista; sin piso cargado, la última que tenga', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 1 };
  assert.equal(resolverRenglon(r, [], ctxDe([r])), null);
  const soloMayorista = [{ listaId: 2, precio: 90, unidadesMinimas: 6 }];
  const res = resolverRenglon(r, soloMayorista, ctxDe([r]));
  assert.equal(res.lista.listaId, 2, 'vendible igual');
  assert.equal(res.origen, 'base');
});
