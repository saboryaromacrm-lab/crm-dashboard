/**
 * El motor del formato de venta: con qué lista se cotiza cada renglón.
 * Desde el 1/10/2026 la caja cobra MINORISTA por defecto: las cinco puertas
 * (cliente, producto, marca, bulto, monto) solo CALIFICAN, se avisa, y se
 * aplican cuando el cajero acepta el aviso.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agregadosTicket, calificacion, catalogoDeSucursal, contextoResolucion, faltantesMayorista, reglasDeMarcaCumplidas,
  resolverRenglon, restriccionMayorista, sugerenciaMayorista, totalPiso,
} from './listas.js';

const catalogo = {
  listas: [
    { listaId: 1, modalidadId: 10, esBase: true, nombre: 'Minorista', etiqueta: 'Minorista 1', modalidad: 'Minorista' },
    { listaId: 2, modalidadId: 20, esBase: false, nombre: 'Mayorista', etiqueta: 'Mayorista 1', modalidad: 'Mayorista' },
    { listaId: 3, modalidadId: 30, esBase: false, nombre: 'Distribuidor', etiqueta: 'Distribuidor 1', modalidad: 'Distribuidor' },
    { listaId: 4, modalidadId: 20, esBase: false, nombre: 'Mayorista 2', etiqueta: 'Mayorista 2', modalidad: 'Mayorista' },
  ],
  reglasMarca: [{ marcaId: 7, modalidadId: 20, unidadesMinimas: 20, marca: 'Coca-Cola' }],
  mayorista: { modalidadId: 20, modalidad: 'Mayorista', mediosPago: ['efectivo', 'transferencia'], porBulto: true },
  montoMayorista: { monto: 100000, modalidadId: 20, modalidad: 'Mayorista' },
};
// Precios del artículo, ya ordenados por preferencia (la mejor primero).
const precios = [
  { listaId: 3, precio: 80, unidadesMinimas: 50 },
  { listaId: 2, precio: 90, unidadesMinimas: 6 },
  { listaId: 1, precio: 100, unidadesMinimas: 0 },
];
const sinMinimo = [{ listaId: 2, precio: 90, unidadesMinimas: 0 }, { listaId: 1, precio: 100, unidadesMinimas: 0 }];

const ctxDe = (renglones, { cliente = null, aplicado = true, idx = null } = {}) =>
  contextoResolucion({ catalogo, cliente, renglones, aplicado, precios: idx });

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
  const cumplidas = reglasDeMarcaCumplidas(catalogo.reglasMarca, agregadosTicket([{ productoId: 1, marcaId: 7, cantidad: 20 }]));
  assert.equal(cumplidas.get(7)?.get(20)?.llevadas, 20);
  const noCumplidas = reglasDeMarcaCumplidas(catalogo.reglasMarca, agregadosTicket([{ productoId: 1, marcaId: 7, cantidad: 19 }]));
  assert.equal(noCumplidas.has(7), false);
});

test('POR DEFECTO MINORISTA: con una puerta abierta, sin aceptar el aviso queda el mostrador', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 6 };
  const res = resolverRenglon(r, precios, ctxDe([r], { aplicado: false }));
  assert.equal(res.lista.listaId, 1);
  assert.equal(res.origen, 'base');
  assert.equal(calificacion(r, precios, ctxDe([r], { aplicado: false })).lista.listaId, 2, 'pero califica: el aviso lo ofrece');
});

test('resolverRenglon: sin puertas abiertas queda el piso (mostrador)', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 1 };
  const res = resolverRenglon(r, precios, ctxDe([r]));
  assert.equal(res.lista.listaId, 1);
  assert.equal(res.precio, 100);
  assert.equal(res.origen, 'base');
});

test('puerta 1 — el cliente tiene la lista asignada (también por aviso)', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 1 };
  assert.equal(resolverRenglon(r, precios, ctxDe([r], { cliente: { listas: [2] }, aplicado: false })).origen, 'base');
  const res = resolverRenglon(r, precios, ctxDe([r], { cliente: { listas: [2] } }));
  assert.equal(res.lista.listaId, 2);
  assert.equal(res.origen, 'cliente');
});

test('puerta 2 — el mínimo de unidades del producto', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 6 };
  const res = resolverRenglon(r, precios, ctxDe([r]));
  assert.equal(res.lista.listaId, 2, '6 unidades abren Mayorista');
  assert.equal(res.origen, 'auto');
  const r50 = { productoId: 1, marcaId: 7, cantidad: 50 };
  assert.equal(resolverRenglon(r50, precios, ctxDe([r50])).lista.listaId, 3, '50 abren Distribuidor, que va primero');
});

test('puerta 3 — la regla de marca: surtido, y alcanza SOLO a esa marca', () => {
  const a = { productoId: 1, marcaId: 7, cantidad: 8 };
  const b = { productoId: 2, marcaId: 7, cantidad: 12 };
  const otro = { productoId: 3, marcaId: 9, cantidad: 1 };
  const ctx = ctxDe([a, b, otro]);
  assert.equal(resolverRenglon(a, sinMinimo, ctx).origen, 'marca', '8 + 12 surtidas de la marca = 20');
  assert.equal(resolverRenglon(otro, sinMinimo, ctx).origen, 'base', 'la otra marca no se beneficia');
});

test('puerta 4 — bulto cerrado del producto: abre la PRIMERA lista mayorista', () => {
  const conDos = [{ listaId: 4, precio: 85, unidadesMinimas: 0 }, { listaId: 2, precio: 90, unidadesMinimas: 0 }, { listaId: 1, precio: 100, unidadesMinimas: 0 }];
  const r = { productoId: 5, marcaId: 9, cantidad: 12, unidadesPorBulto: 12 };
  const res = resolverRenglon(r, conDos, ctxDe([r]));
  assert.equal(res.origen, 'bulto');
  assert.equal(res.lista.listaId, 4, 'la primera mayorista del artículo');
  const r15 = { ...r, cantidad: 15 };
  assert.equal(resolverRenglon(r15, conDos, ctxDe([r15])).origen, 'bulto', '15 de un bulto de 12: las 15 a mayorista');
  const r11 = { ...r, cantidad: 11 };
  assert.equal(resolverRenglon(r11, conDos, ctxDe([r11])).origen, 'base', 'bulto incompleto no');
});

test('puerta 4 — bulto: la lista que vende de a N, el interruptor y el granel', () => {
  const deA12 = [{ listaId: 3, precio: 80, unidadesMinimas: 0, unidades: 12 }, { listaId: 1, precio: 100, unidadesMinimas: 0 }];
  const r = { productoId: 6, marcaId: 9, cantidad: 12 };
  assert.equal(resolverRenglon(r, deA12, ctxDe([r])).origen, 'bulto', 'la caja x12 de la lista, sin bulto en la ficha');

  const apagado = contextoResolucion({ catalogo: { ...catalogo, mayorista: { ...catalogo.mayorista, porBulto: false } }, renglones: [], aplicado: true });
  const rb = { productoId: 5, marcaId: 9, cantidad: 12, unidadesPorBulto: 12 };
  assert.equal(calificacion(rb, sinMinimo, { ...apagado, agregados: agregadosTicket([rb]) }), null, 'con el interruptor apagado no');

  const granel = { productoId: 8, marcaId: 9, cantidad: 25, unidadesPorBulto: 25, fraccionable: true };
  assert.equal(calificacion(granel, sinMinimo, ctxDe([granel])), null, 'el granel se vende por kg');
});

test('puerta 5 — el monto se mide a precio de MOSTRADOR con IVA', () => {
  const r = { key: 'p1', productoId: 1, marcaId: 9, cantidad: 900, iva: 21 };
  const idx = new Map([['p1', sinMinimo]]);
  assert.equal(totalPiso([r], idx, new Map(catalogo.listas.map((l) => [l.listaId, l]))), 108900, '900 × $100 × 1,21');
  const res = resolverRenglon(r, sinMinimo, ctxDe([r], { idx }));
  assert.equal(res.origen, 'monto');
  assert.equal(res.precio, 90);
  const chico = { ...r, cantidad: 800 };   // $96.800
  assert.equal(calificacion(chico, sinMinimo, ctxDe([chico], { idx })), null, 'no llega');
});

test('una lista más cara que el mostrador nunca califica', () => {
  const cara = [{ listaId: 2, precio: 120, unidadesMinimas: 1 }, { listaId: 1, precio: 100, unidadesMinimas: 0 }];
  const r = { productoId: 1, marcaId: 7, cantidad: 5 };
  assert.equal(calificacion(r, cara, ctxDe([r])), null);
});

test('resolverRenglon: sin precios no hay lista; sin piso cargado, la última que tenga', () => {
  const r = { productoId: 1, marcaId: 7, cantidad: 1 };
  assert.equal(resolverRenglon(r, [], ctxDe([r])), null);
  const soloMayorista = [{ listaId: 2, precio: 90, unidadesMinimas: 6 }];
  const res = resolverRenglon(r, soloMayorista, ctxDe([r]));
  assert.equal(res.lista.listaId, 2, 'vendible igual');
  assert.equal(res.origen, 'base');
});

test('sugerenciaMayorista: los renglones que cumplen, con el motivo y el ahorro con IVA', () => {
  const renglones = [
    { uid: 1, key: 'a', productoId: 5, marcaId: 9, cantidad: 12, unidadesPorBulto: 12, iva: 21, precioLista: 100, listaId: 1, nombre: 'Coca 2L' },
    { uid: 2, key: 'b', productoId: 6, marcaId: 9, cantidad: 2, unidadesPorBulto: 12, iva: 21, precioLista: 100, listaId: 1, nombre: 'Fanta' },
    { uid: 3, key: 'c', productoId: 7, marcaId: 9, cantidad: 12, unidadesPorBulto: 12, iva: 21, precioLista: 100, listaId: 1, nombre: 'Sprite', listaManual: true },
  ];
  const preciosDe = () => sinMinimo;
  const s = sugerenciaMayorista(renglones, preciosDe, ctxDe(renglones, { aplicado: false }));
  assert.equal(s.renglones.length, 1, 'solo el bulto completo; el fijado a mano no se ofrece');
  assert.equal(s.renglones[0].origen, 'bulto');
  assert.equal(s.ahorro, 145.2, '12 × $10 × 1,21');
  assert.equal(s.modalidad, 'Mayorista');
  assert.equal(sugerenciaMayorista(renglones, preciosDe, ctxDe(renglones, { aplicado: true })), null, 'aceptado: ya no se ofrece');
});

test('faltantesMayorista: bultos y marcas pasada la mitad, los más cercanos primero', () => {
  const renglones = [
    { key: 'a', productoId: 5, marcaId: 7, cantidad: 9, unidadesPorBulto: 12, nombre: 'Coca 2L' },
    { key: 'b', productoId: 6, marcaId: 9, cantidad: 3, unidadesPorBulto: 12, nombre: 'Agua' },
  ];
  const f = faltantesMayorista(renglones, () => sinMinimo, ctxDe(renglones, { aplicado: false }));
  assert.deepEqual(f, ['Coca 2L: faltan 3 para el bulto de 12']);
  const surtido = [{ key: 'a', productoId: 5, marcaId: 7, cantidad: 15, nombre: 'Coca 2L' }];
  assert.deepEqual(faltantesMayorista(surtido, () => sinMinimo, ctxDe(surtido, { aplicado: false })), ['Coca-Cola: faltan 5 unidades de la marca']);
});

test('restriccionMayorista: por la MODALIDAD de la lista puesta, llegue como llegue', () => {
  assert.equal(restriccionMayorista([{ listaId: 1 }], catalogo), null, 'todo minorista: cualquier medio');
  assert.deepEqual(restriccionMayorista([
    { listaId: 1, cantidad: 2, precioUnitario: 100, iva: 21 },
    { listaId: 4, cantidad: 3, precioUnitario: 100, descuento: 10, iva: 21 },
    { listaId: 3, cantidad: 1, precioUnitario: 50, iva: 21 },
  ], catalogo), { medios: ['efectivo', 'transferencia'], articulos: 1, monto: 326.7, modalidad: 'Mayorista' }, 'monto = la parte mayorista con IVA: 3 × 100 − 10% = 270 + IVA');
  assert.equal(restriccionMayorista([{ listaId: 2 }], { ...catalogo, mayorista: { ...catalogo.mayorista, mediosPago: [] } }), null, 'sin medios configurados no restringe');
});

test('catalogoDeSucursal: sin mayorista, la caja no ve la modalidad, sus listas ni sus precios', () => {
  const cat = {
    vendeMayorista: false,
    listas: [
      { listaId: 1, modalidadId: 10, esBase: true }, { listaId: 2, modalidadId: 20, esBase: false }, { listaId: 3, modalidadId: 20, esBase: false },
    ],
    mayorista: { modalidadId: 20, mediosPago: ['efectivo'], porBulto: true },
    montoMayorista: { monto: 50000, modalidadId: 20 },
    reglasMarca: [{ marcaId: 7, modalidadId: 20, unidadesMinimas: 6 }, { marcaId: 8, modalidadId: 10, unidadesMinimas: 2 }],
    items: [{ key: 'p1', precios: [{ listaId: 1, precio: 100 }, { listaId: 2, precio: 80 }, { listaId: 3, precio: 70 }] }],
    ofertas: [{ id: 1 }],
  };
  const c = catalogoDeSucursal(cat);
  assert.equal(c.mayorista, null);
  assert.equal(c.montoMayorista, null);
  assert.deepEqual(c.listas.map((l) => l.listaId), [1]);
  assert.deepEqual(c.reglasMarca.map((r) => r.marcaId), [8]);
  assert.deepEqual(c.items[0].precios.map((p) => p.listaId), [1]);
  assert.deepEqual(c.ofertas, [{ id: 1 }], 'lo demás viaja igual');
  // El aviso y el empujón se apagan solos: no hay modalidad mayorista.
  const ctx = contextoResolucion({ catalogo: c, cliente: { listas: [2] }, renglones: [] });
  assert.equal(ctx.modalidadMayorista, null);
  assert.equal(ctx.montoCumplido, null);
  // La que vende mayorista (o un catálogo viejo sin el dato): tal cual.
  assert.equal(catalogoDeSucursal({ ...cat, vendeMayorista: true }).listas.length, 3);
  const viejo = { ...cat }; delete viejo.vendeMayorista;
  assert.equal(catalogoDeSucursal(viejo), viejo);
});
