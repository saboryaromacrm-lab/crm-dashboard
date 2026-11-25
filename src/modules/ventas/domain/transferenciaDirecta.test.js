import test from 'node:test';
import assert from 'node:assert/strict';
import { planTransferencia } from './transferenciaDirecta.js';

const fc = (docId, fecha, saldo) => ({ tipo: 'comprobante', docId, fecha, saldo });

test('sin documentos: todo a cuenta', () => {
  const p = planTransferencia(437559, []);
  assert.equal(p.aCuenta, 437559);
  assert.deepEqual(p.imputaciones, []);
});

test('alcanza para todas: cada una por su saldo y lo que sobra a cuenta', () => {
  const p = planTransferencia(1000, [fc(2, '2026-11-10', 300), fc(1, '2026-11-01', 500)]);
  assert.deepEqual(p.imputaciones, [{ comprobanteId: 1, importe: 500 }, { comprobanteId: 2, importe: 300 }]);
  assert.equal(p.aCuenta, 200);
  assert.equal(p.sinAlcanzar.length, 0);
});

test('no alcanza: la más nueva se lleva lo que queda y la que no recibe nada se avisa', () => {
  const p = planTransferencia(437559, [fc(1, '2026-10-13', 529246.74), fc(2, '2026-11-01', 1000)]);
  assert.deepEqual(p.imputaciones, [{ comprobanteId: 1, importe: 437559 }]);
  assert.equal(p.aCuenta, 0);
  assert.deepEqual(p.sinAlcanzar.map((d) => d.docId), [2]);
});

test('gastos y facturas a la vez: mezcla', () => {
  const p = planTransferencia(1000, [fc(1, '2026-11-01', 100), { tipo: 'gasto', docId: 9, fecha: '2026-11-02', saldo: 100 }]);
  assert.equal(p.mezcla, true);
  assert.deepEqual(p.imputaciones[1], { gastoId: 9, importe: 100 });
});
