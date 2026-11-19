import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alcanceNota, comprobante, mediosDe } from './notasCredito.js';

test('nombres de la lista de notas de crédito', () => {
  assert.equal(comprobante({ tipo: 'nota_credito_b', puntoVenta: '00034', numero: 3 }), 'N. crédito B 00034-00000003');
  assert.equal(comprobante({ tipo: 'nota_credito_ticket', puntoVenta: '0001', numero: 2 }), 'Devolución 0001-00000002');
  assert.equal(comprobante(null), '—');
  assert.equal(mediosDe(['tarjeta_debito', 'qr']), 'Tarjeta de débito y QR / billetera');
  assert.equal(mediosDe(undefined), '');
});

test('total o parcial contra la venta original', () => {
  assert.equal(alcanceNota({ total: 8503, original: { total: 8503 } }), 'Total');
  assert.equal(alcanceNota({ total: 3481, original: { total: 15683 } }), 'Parcial');
  assert.equal(alcanceNota({ total: 10, original: null }), '');
});
