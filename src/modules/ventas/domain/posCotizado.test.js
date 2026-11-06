/**
 * LO DE MÁS DE UN PRESUPUESTO VA AL PRECIO DE HOY (6/11/2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { partirCotizados, ticketDesdeBorrador } from './pos.js';

const cot = (extra = {}) => ({
  uid: 1, key: 'p1', productoId: 1, presentacionId: null, nombre: 'Aceite', unidad: 'u',
  listaId: 3, lista: 'Mayorista', listaOrigen: 'presupuesto', listaManual: true,
  precioLista: 8500, precioUnitario: 8500, descuentoBase: 5, descuento: 5, cotizado: 2, cantidad: 2, ...extra,
});
const est = (renglones) => ({ renglones, extras: [], uid: 10, ctx: {} });

test('dentro de lo cotizado no toca nada (misma referencia)', () => {
  const e = est([cot()]);
  assert.equal(partirCotizados(e), e);
});

test('si lleva más, lo cotizado queda y lo de más va a otro renglón sin precio fijo, y avisa', () => {
  const r = partirCotizados(est([cot({ cantidad: 5 })]));
  assert.equal(r.renglones.length, 2);
  assert.equal(r.renglones[0].cantidad, 2);
  assert.equal(r.renglones[0].precioUnitario, 8500);
  const extra = r.renglones[1];
  assert.equal(extra.cantidad, 3);
  assert.equal(extra.cotizado, undefined);
  assert.equal(extra.listaManual, false, 'el motor le pone el precio de hoy');
  assert.equal(extra.listaOrigen, 'base');
  assert.equal(extra.descuento, 0, 'no hereda el descuento del presupuesto');
  assert.equal(extra.uid, 10);
  assert.equal(r.uid, 11);
  assert.match(r.avisoCotizado.texto, /cotizó 2 u; lo de más va en otro renglón al precio de hoy/);
  assert.equal(r.avisoCotizado.n, 1);
});

test('si ya existe el renglón de lo de más, se le suma ahí', () => {
  const deMas = { ...cot(), uid: 2, cotizado: undefined, listaManual: false, listaOrigen: 'base', cantidad: 1 };
  const r = partirCotizados({ ...est([cot({ cantidad: 4 }), deMas]), avisoCotizado: { n: 3, texto: '' } });
  assert.equal(r.renglones.length, 2);
  assert.equal(r.renglones[0].cantidad, 2);
  assert.equal(r.renglones[1].cantidad, 3);
  assert.equal(r.avisoCotizado.n, 4);
});

test('granel con decimales', () => {
  const r = partirCotizados(est([cot({ unidad: 'kg', cotizado: 2.5, cantidad: 3.2 })]));
  assert.equal(r.renglones[0].cantidad, 2.5);
  assert.equal(r.renglones[1].cantidad, 0.7);
  assert.match(r.avisoCotizado.texto, /cotizó 2,5 kg/);
});

test('el borrador trae lo que cubre el precio y lo pone solo en el renglón del presupuesto', () => {
  const t = ticketDesdeBorrador({
    items: [
      { productoId: 1, presentacionId: null, listaOrigen: 'presupuesto', cantidad: 2, precioLista: 8500, precioUnitario: 8500, iva: 21 },
      { productoId: 1, presentacionId: null, listaOrigen: 'auto', cantidad: 1, precioLista: 9452, precioUnitario: 9452, iva: 21 },
    ],
    cotizados: [{ clave: '1:', cantidad: 2, precioLista: 8500 }],
  }, []);
  assert.equal(t.renglones[0].cotizado, 2);
  assert.equal(t.renglones[1].cotizado, undefined);
});
