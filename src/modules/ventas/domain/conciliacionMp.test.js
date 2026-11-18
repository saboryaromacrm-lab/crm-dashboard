import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alrededor, cambioDeMedio, comprobanteDe, estadoDia, moverMes, rangoMes, semanasDelMes } from './conciliacionMp.js';

test('el color del día', () => {
  assert.equal(estadoDia(undefined), 'vacio');
  assert.equal(estadoDia({ vendido: 100, entro: 100, faltan: 0, sugeridos: 0, sinVenta: 0, avisos: 0 }), 'ok');
  assert.equal(estadoDia({ vendido: 100, entro: 90, faltan: 10, sugeridos: 1, sinVenta: 0, avisos: 0 }), 'falta');
  assert.equal(estadoDia({ vendido: 100, entro: 120, faltan: 0, sugeridos: 0, sinVenta: 20, avisos: 0 }), 'revisar');
});

test('el calendario de noviembre de 2026 arranca un domingo', () => {
  const s = semanasDelMes('2026-11');
  assert.equal(s[0].filter(Boolean).length, 1);
  assert.equal(s[0][6], '2026-11-01');
  assert.equal(s.flat().filter(Boolean).length, 30);
  assert.ok(s.every((sem) => sem.length === 7));
});

test('meses y alrededores', () => {
  assert.deepEqual(rangoMes('2026-02'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.equal(moverMes('2026-01', -1), '2025-12');
  assert.equal(moverMes('2026-12', 1), '2027-01');
  assert.deepEqual(alrededor('2026-11-02'), { desde: '2026-10-30', hasta: '2026-11-03' });
});

test('el comprobante', () => {
  assert.equal(comprobanteDe({ origen: 'venta', tipoDoc: 'factura_b', puntoVenta: '00030', numero: 431 }), 'Factura B 00030-00000431');
  assert.equal(comprobanteDe({ origen: 'recibo', tipoDoc: 'recibo', puntoVenta: '0001', numero: 12 }), 'Recibo 0001-00000012');
});

test('el cambio de medio que anuncia la pantalla', () => {
  assert.equal(cambioDeMedio({ medio: 'qr' }, { medioErp: 'tarjeta_credito' }), 'QR → Crédito');
  assert.equal(cambioDeMedio({ medio: 'tarjeta_debito' }, { medioErp: 'tarjeta_debito' }), null);
  assert.equal(cambioDeMedio({ medio: 'qr' }, {}), null);
});
