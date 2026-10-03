/**
 * EL GRANEL MADRE SE VENDE COMO SU FORMATO (3/10/2026): de a una bolsa de N kg.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bultoAbajo, bultoArriba, bultoDeFila, cantidadInicial, desgloseBulto, textoBulto, ticketReducer, ticketDesdeBorrador,
} from './pos.js';

const albahaca = {
  key: 'p1', productoId: 1, presentacionId: null, nombre: 'Albahaca', detalle: 'Bolsa de 10 kg',
  unidad: 'kg', fraccionable: true, bolsaKg: 10, precio: 8442.98, precioFinal: 10216, precioBolsa: 102160, iva: 21, stock: 200,
};

test('la cantidad que carga sola: bolsa del granel, N de la caja escaneada, 1 lo demás', () => {
  assert.equal(cantidadInicial(albahaca), 10);
  assert.equal(cantidadInicial({ ...albahaca, _escaneoUnidades: 20 }), 20, 'el código de un formato manda');
  assert.equal(cantidadInicial({ key: 'p2', unidad: 'u' }), 1);
  assert.equal(cantidadInicial({ key: 'p3', unidad: 'kg', fraccionable: true, bolsaKg: 0 }), 1);
});

test('el renglón del granel madre va de a bolsas, y es regla', () => {
  const b = bultoDeFila({ fraccionable: true, bolsaKg: 10 }, 1);
  assert.deepEqual(b, { unidades: 10, exigido: true, bolsa: true });
  assert.deepEqual(bultoDeFila({ fraccionable: true, bolsaKg: 0 }, 1), { unidades: 0, exigido: false }, 'sin bolsa: como siempre');
  assert.equal(bultoArriba(10, 10), 20);
  assert.equal(bultoAbajo(20, 10), 10);
  assert.equal(bultoArriba(2.5, 2.5), 5, 'bolsa de 2,5 kg');
  assert.ok(desgloseBulto(7.5, 2.5).exacto);
  assert.ok(!desgloseBulto(3, 10).exacto, '3 kg sueltos no es una bolsa');
});

test('cómo se lee en la caja', () => {
  assert.equal(textoBulto(10, 10, true), '1 × bolsa de 10 kg');
  assert.equal(textoBulto(30, 10, true), '3 × bolsa de 10 kg');
  assert.equal(textoBulto(3, 10, true), '3 kg sueltos · bolsa de 10 kg');
  assert.equal(textoBulto(12.5, 10, true), '1 bolsa + 2,5 kg sueltos');
  assert.equal(textoBulto(24, 12), '2 × bulto de 12', 'el bulto de siempre no cambia');
});

test('el ticket guarda la bolsa en el renglón y al retomarlo', () => {
  let t = ticketReducer({ renglones: [], uid: 1, ctx: { catalogo: [albahaca], listas: [] } }, { tipo: 'agregar', item: albahaca, cantidad: 10 });
  assert.equal(t.renglones[0].bolsaKg, 10);
  assert.equal(t.renglones[0].cantidad, 10);
  t = ticketReducer(t, { tipo: 'agregar', item: albahaca, cantidad: 10 });
  assert.equal(t.renglones[0].cantidad, 20, 'otra bolsa suma 10 kg');
  const r = ticketDesdeBorrador({ items: [{ id: 9, productoId: 1, presentacionId: null, cantidad: 20, precioUnitario: 8442.98, iva: 21 }] }, [albahaca]);
  assert.equal(r.renglones[0].bolsaKg, 10);
});
