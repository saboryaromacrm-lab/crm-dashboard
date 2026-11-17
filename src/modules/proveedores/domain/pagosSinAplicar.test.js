import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubiertoALaCuenta, repartirPago } from './pagosSinAplicar.js';

/* El caso real de BRACEMA (17/11/2026). */
const fc = (docId, fecha, saldo) => ({ tipo: 'comprobante', docId, fecha, saldo, etiqueta: `FC ${docId}` });
const f19 = fc(1288, '2026-10-19', 315009.94);
const f20 = fc(1341, '2026-10-20', 67208.2);
const f23 = fc(1588, '2026-10-23', 183844.31);
const clave = (d) => `${d.tipo}-${d.docId}`;

test('el pago de $382.218,17 salda las dos facturas enteras y sobran 3 centavos', () => {
  const r = repartirPago(382218.17, [f20, f19]);
  assert.deepEqual(r.lineas.map((x) => [x.doc.docId, x.importe]), [[1288, 315009.94], [1341, 67208.2]]);
  assert.equal(r.sobra, 0.03);
  assert.deepEqual(r.sinAlcanzar, []);
});

test('si no alcanza, la factura se lleva todo lo que le queda al pago; las siguientes quedan afuera', () => {
  const r = repartirPago(183844.29, [f23]);
  assert.deepEqual(r.lineas.map((x) => x.importe), [183844.29]);
  assert.equal(r.sobra, 0);
  const dos = repartirPago(100000, [f23, f20]);
  assert.deepEqual(dos.lineas.map((x) => [x.doc.docId, x.importe]), [[1341, 67208.2], [1588, 32791.8]]);
  const corto = repartirPago(50000, [f19, f20]);
  assert.deepEqual(corto.sinAlcanzar.map((d) => d.docId), [1341]);
});

test('con saldo 0 la plata a favor cubre todas las facturas; con deuda, de la más vieja a la más nueva', () => {
  const todo = cubiertoALaCuenta([f23, f20, f19], -0.01, clave);
  assert.equal(todo.total, 566062.45);
  assert.equal(todo.porDoc.get('comprobante-1588'), 183844.31);
  const parte = cubiertoALaCuenta([f23, f20, f19], 200000, clave);
  assert.equal(parte.total, 366062.45);
  assert.equal(parte.porDoc.get('comprobante-1288'), 315009.94);
  assert.equal(parte.porDoc.get('comprobante-1341'), 51052.51);
  assert.equal(parte.porDoc.has('comprobante-1588'), false);
  assert.equal(cubiertoALaCuenta([f19], null, clave).total, 0);
  assert.equal(cubiertoALaCuenta([f19], 315009.94, clave).total, 0);
});
