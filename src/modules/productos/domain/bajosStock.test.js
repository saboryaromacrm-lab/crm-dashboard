/* Bajos en stock (12/10/2026): la cuenta que comparten la sección y el globito del menú. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analizarBajos } from './bajosStock.js';

const prod = (id, o = {}) => ({ id, nombre: `P${id}`, tipo: 'entero', estado: 'activo', stockMin: 0, ...o });
const base = (o = {}) => ({ sucursalId: 1, diasVenta: 30, diasCobertura: 7, umbralRojo: 50, ventas: [], controlados: [], ...o });
const correr = (productos, stock, datos, extra = {}) => analizarBajos({
  productos,
  disponible: (id) => stock[id] ?? 0,
  datos,
  proveedorDe: (p) => p.prov ?? null,
  controla: (p) => p.controla !== false,
  bultoDe: (p) => p.bulto ?? 0,
  ...extra,
});

test('la regla del dueño: 10 productos, 5 en cero → rojo (50 %)', () => {
  const ps = Array.from({ length: 10 }, (_, i) => prod(i + 1, { prov: 7 }));
  const stock = Object.fromEntries(ps.map((p, i) => [p.id, i < 5 ? 0 : 20]));
  const r = correr(ps, stock, base());
  assert.equal(r.proveedores[0].sin, 5);
  assert.equal(r.proveedores[0].pct, 50);
  assert.equal(r.proveedores[0].color, 'rojo');
  assert.equal(r.rojos, 1);
});

test('mínimo automático: venta diaria × 7 días, para arriba; el manual manda', () => {
  const ps = [prod(1, { prov: 7 }), prod(2, { prov: 7, stockMin: 50 }), prod(3, { prov: 7, tipo: 'granel' })];
  /* P1 vendió 30 en 30 días = 1/día → mínimo 7; tiene 6 → bajo. P2 manual 50, tiene 40 → bajo. P3 granel 4,5 kg en 30 días → 1,05 kg; tiene 2 kg → bien. */
  const r = correr(ps, { 1: 6, 2: 40, 3: 2 }, base({ ventas: [[1, 30], [2, 3], [3, 4.5]] }));
  const f = Object.fromEntries(r.proveedores[0].filas.map((x) => [x.p.id, x]));
  assert.equal(f[1].minimo, 7); assert.equal(f[1].estado, 'bajo'); assert.equal(f[1].pedir, 1);
  assert.equal(f[2].minimo, 50); assert.equal(f[2].manual, true); assert.equal(f[2].estado, 'bajo');
  assert.equal(f[3].minimo, 1.1); assert.equal(f[3].estado, 'ok');
  assert.equal(f[1].alcanza, 6);
});

test('lo que no se vende y no tiene mínimo: con stock está bien, en 0 está sin stock y no sugiere pedido', () => {
  const r = correr([prod(1, { prov: 7 }), prod(2, { prov: 7 })], { 1: 3, 2: 0 }, base());
  const f = Object.fromEntries(r.proveedores[0].filas.map((x) => [x.p.id, x]));
  assert.equal(f[1].estado, 'ok'); assert.equal(f[1].alcanza, null);
  assert.equal(f[2].estado, 'sin'); assert.equal(f[2].pedir, 0);
});

test('pedir en bultos del proveedor; el negativo cuenta como cero', () => {
  /* 2/día × 7 = 14; stock −3 → faltan 14 → bulto de 12 → 2 bultos. */
  const r = correr([prod(1, { prov: 7, bulto: 12 })], { 1: -3 }, base({ ventas: [[1, 60]] }));
  const f = r.proveedores[0].filas[0];
  assert.equal(f.estado, 'sin'); assert.equal(f.pedir, 2);
});

test('colores: amarillo desde la mitad del umbral; afuera discontinuados, sin control y no controlados (si se pide)', () => {
  const ps = [
    prod(1, { prov: 7 }), prod(2, { prov: 7 }), prod(3, { prov: 7 }), prod(4, { prov: 7 }),
    prod(5, { prov: 7, estado: 'discontinuado' }), prod(6, { prov: 7, controla: false }),
  ];
  const r = correr(ps, { 1: 0, 2: 9, 3: 9, 4: 9, 5: 0, 6: 0 }, base({ controlados: [1, 2] }));
  assert.equal(r.proveedores[0].total, 4);
  assert.equal(r.proveedores[0].pct, 25);
  assert.equal(r.proveedores[0].color, 'amarillo');
  const solo = correr(ps, { 1: 0, 2: 9, 3: 9, 4: 9 }, base({ controlados: [1, 2] }), { soloControlados: true });
  assert.equal(solo.proveedores[0].total, 2);
  assert.equal(solo.proveedores[0].color, 'rojo');
});

test('el filtro de tipo cambia el % del proveedor', () => {
  const ps = [prod(1, { prov: 7 }), prod(2, { prov: 7, tipo: 'granel' })];
  const r = correr(ps, { 1: 0, 2: 5 }, base(), { tipo: 'granel' });
  assert.equal(r.proveedores[0].total, 1);
  assert.equal(r.proveedores[0].color, 'verde');
  assert.equal(correr(ps, { 1: 0, 2: 5 }, base(), { tipo: 'entero' }).proveedores[0].color, 'rojo');
});

test('sin proveedor va aparte y no suma al globito; sin datos no hay nada', () => {
  const r = correr([prod(1), prod(2)], { 1: 0, 2: 0 }, base());
  assert.equal(r.proveedores[0].id, 0);
  assert.equal(r.proveedores[0].color, 'rojo');
  assert.equal(r.rojos, 0);
  assert.deepEqual(correr([prod(1)], {}, null), { proveedores: [], rojos: 0, yaPedidos: 0 });
});

test('lo ya pedido: afuera de la lista y del globito, salvo que se pida verlo', () => {
  const ps = [prod(1, { prov: 7 }), prod(2, { prov: 7 }), prod(3, { prov: 8 }), prod(4, { prov: 8 })];
  const datos = base({ pedidos: [[7, '2026-10-20T12:00:00.000Z']] });
  const r = correr(ps, { 1: 0, 2: 0, 3: 0, 4: 0 }, datos);
  assert.deepEqual(r.proveedores.map((g) => g.id), [8]);
  assert.equal(r.rojos, 1);
  assert.equal(r.yaPedidos, 1);
  const todos = correr(ps, { 1: 0, 2: 0, 3: 0, 4: 0 }, datos, { verPedidos: true });
  assert.deepEqual(todos.proveedores.map((g) => [g.id, g.pedido]).sort(), [[7, '2026-10-20T12:00:00.000Z'], [8, null]]);
  assert.equal(todos.rojos, 1, 'el globito sigue sin contar lo ya pedido');
});

test('de quién es la lista: Sabor y Aroma sin nada de Coffit; Coffit, solo su depósito', () => {
  const ps = [prod(1, { prov: 7 }), prod(2, { prov: 7, soloCafeteria: true }), prod(3, { prov: 8, origenCafeteria: true })];
  const stock = { 1: 0, 2: 0, 3: 0 };
  const ids = (r) => r.proveedores.flatMap((g) => g.filas.map((f) => f.p.id));
  assert.deepEqual(ids(correr(ps, stock, base())), [1], 'sin «alcance» es la de Sabor y Aroma');
  assert.deepEqual(ids(correr(ps, stock, base({ alcance: 'saborYAroma' }))), [1]);
  assert.deepEqual(ids(correr(ps, stock, base({ alcance: 'coffit', sucursalId: null }))), [2]);
});
