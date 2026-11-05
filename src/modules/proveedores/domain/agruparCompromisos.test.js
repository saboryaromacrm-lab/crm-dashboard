import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparCompromisos } from './agruparCompromisos.js';

const k = (id, proveedorId, extra = {}) => ({
  id, proveedorId, proveedorNombre: `P${proveedorId}`, pagado: false, importe: 100, falta: 100,
  diasPlazo: 15, comprobanteId: id * 10, ...extra,
});

test('un grupo por proveedor, en el orden de su compromiso más viejo', () => {
  const g = agruparCompromisos([k(1, 7), k(2, 3), k(3, 7), k(4, 9)]);
  assert.deepEqual(g.map((x) => x.proveedorId), [7, 3, 9]);
  assert.deepEqual(g[0].filas.map((x) => x.id), [1, 3]);
});

test('el total suma lo que falta de lo pendiente y el importe de lo pagado, al centavo', () => {
  const [g] = agruparCompromisos([
    k(1, 7, { importe: 175000, falta: 175000 }),
    k(2, 7, { importe: 125000, falta: 0.1 + 0.2 }),
    k(3, 7, { pagado: true, importe: 50, falta: 0 }),
  ]);
  assert.equal(g.total, 175050.3);
  assert.equal(g.aPagar, 175000.3);
  assert.equal(g.pagado, false);
});

test('la fila del grupo vence con la primera impaga; todo pagado queda pagado', () => {
  const [g] = agruparCompromisos([k(1, 7, { pagado: true, falta: 0 }), k(2, 7, { diasRest: -18 })]);
  assert.equal(g.primera.id, 2);
  const [p] = agruparCompromisos([k(1, 7, { pagado: true, falta: 0 }), k(2, 7, { pagado: true, falta: 0 })]);
  assert.equal(p.pagado, true);
  assert.equal(p.primera.id, 1);
  assert.deepEqual(p.comprobantesAPagar, []);
});

test('plazo: uno solo para todas, o null si son distintos', () => {
  assert.deepEqual(agruparCompromisos([k(1, 7), k(2, 7)])[0].plazo, { dias: 15 });
  assert.equal(agruparCompromisos([k(1, 7), k(2, 7, { diasPlazo: 30 })])[0].plazo, null);
});

test('para pagar juntas: facturas impagas con saldo, sin repetir cuotas ni manuales', () => {
  const [g] = agruparCompromisos([
    k(1, 7, { comprobanteId: 50 }),
    k(2, 7, { comprobanteId: 50, cuota: 2 }),
    k(3, 7, { comprobanteId: null }),
    k(4, 7, { falta: 0, cubiertoACuenta: 100 }),
    k(5, 7, { pagado: true, falta: 0 }),
    k(6, 7, { comprobanteId: 60 }),
  ]);
  assert.deepEqual(g.comprobantesAPagar, [50, 60]);
  assert.equal(g.todasConComprobante, false);
});
