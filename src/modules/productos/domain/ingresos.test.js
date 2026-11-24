import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenNota } from './ingresos.js';

test('plegada, la fila muestra el total de la orden de pedido', () => {
  const nota = 'Pedido - Lorenzo Lucas - 13/11/2026 - Palitos de Queso x200g — 10 bultos — 2 bultos Budin Total: 33 bultos · 675 unidades Por favor confirmar recibido.';
  assert.equal(resumenNota(nota), 'Total: 33 bultos · 675 unidades');
  assert.equal(resumenNota('Lista\nTotal: 4 bultos'), 'Total: 4 bultos');
  assert.equal(resumenNota('Avena Total: 2 bolsas · 50 kg Gracias.'), 'Total: 2 bolsas · 50 kg');
});

test('una orden sin la línea de total: se cuentan sus renglones', () => {
  const nota = 'Pedido - Lorenzo Lucas - 23356782429 - 16/10/2026\n\nAtun Lomitos CUMANA x170g — 1 u.\n'
    + 'Avena Instantanea CUMANA x400g bulto X10Un — 8 bultos\nCopos de Avena CUMANA x400g bulto X10Un — 1 bulto\nAlgas Nory — 40 u.';
  assert.equal(resumenNota(nota), '4 productos · 9 bultos · 41 u.');
  assert.equal(resumenNota('Pedido - X - 1/1/2026\n\nAvena — 2 bolsas'), '1 producto · 2 bolsas');
});

test('sin total, la primera línea recortada; sin nota, nada', () => {
  assert.equal(resumenNota('Pedido - Lorenzo Lucas - 1/1/2026\n\nTraer cajas'), 'Traer cajas');
  assert.equal(resumenNota('Faltó espacio en el flete\nsegunda línea'), 'Faltó espacio en el flete');
  assert.equal(resumenNota('x'.repeat(200)).length, 90);
  assert.equal(resumenNota(''), '');
  assert.equal(resumenNota(null), '');
});
