import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alrededor, cambioDeMedio, comprobanteDe, conQuePago, dondeSeCobro, estadoDia, moverMes, rangoMes, segunMercadoPago, semanasDelMes,
} from './conciliacionMp.js';

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
  assert.deepEqual(alrededor('2026-11-02', true), { desde: '2026-11-01', hasta: '2026-11-05' }, 'desde un pago: las ventas de después');
});

test('el comprobante', () => {
  assert.equal(comprobanteDe({ origen: 'venta', tipoDoc: 'factura_b', puntoVenta: '00030', numero: 431 }), 'Factura B 00030-00000431');
  assert.equal(comprobanteDe({ origen: 'recibo', tipoDoc: 'recibo', puntoVenta: '0001', numero: 12 }), 'Recibo 0001-00000012');
});

test('el cambio de medio que anuncia la pantalla (la misma regla que la API)', () => {
  assert.equal(cambioDeMedio({ medio: 'qr', importe: 100 }, { medioErp: 'tarjeta_credito', bruto: 100 }), 'QR → Crédito');
  assert.equal(cambioDeMedio({ medio: 'tarjeta_debito', importe: 100 }, { medioErp: 'tarjeta_debito', bruto: 100 }), null);
  assert.equal(cambioDeMedio({ medio: 'qr', importe: 100 }, { medioErp: null, bruto: 100 }), null, 'Mercado Pago no lo dice claro');
  assert.equal(cambioDeMedio({ medio: 'qr', importe: 100 }, { medioErp: 'tarjeta_credito', bruto: 1000 }), null, 'otro importe: no se toca');
  assert.equal(cambioDeMedio({ medio: 'qr', importe: 100, referencia: 'MP 123' }, { medioErp: 'tarjeta_credito', bruto: 100 }), null, 'el QR del ERP');
});

const pMp = (x) => ({ id: '189143095373', estado: 'approved', familia: 'qr', tipo: 'account_money', metodo: 'account_money', cuotas: 1, bruto: 100, devuelto: 0, caja: 'Caja 1', ...x });

test('según Mercado Pago: QR del mostrador, posnet con tarjeta y QR del posnet', () => {
  assert.equal(dondeSeCobro(pMp()), 'QR del mostrador · Caja 1');
  assert.equal(dondeSeCobro(pMp({ familia: 'tarjeta', tipo: 'debit_card', metodo: 'debmaster', caja: null })), 'Posnet (Point) con tarjeta');
  assert.equal(dondeSeCobro(pMp({ familia: 'tarjeta', tipo: 'account_money', caja: null })), 'QR del posnet (Point)');
  assert.equal(dondeSeCobro(pMp({ familia: 'transferencia' })), 'Fuera del local (transferencia o link de pago)');
  assert.equal(conQuePago(pMp({ tipo: 'credit_card', metodo: 'visa', cuotas: 3 })), 'crédito Visa en 3 cuotas');
  assert.equal(conQuePago(pMp({ tipo: 'bank_transfer', metodo: 'interop_transfer' })), 'transferencia desde otro banco o billetera');

  const ok = segunMercadoPago({ medio: 'qr', mp: { atado: 'auto', motivo: '', medioAnterior: null, pagos: [pMp()] } });
  assert.equal(ok.pagos[0].donde, 'QR del mostrador · Caja 1');
  assert.equal(ok.pagos[0].operacion, '189143095373');
  assert.deepEqual(ok.avisos, []);
  assert.equal(ok.fuente, 'Confirmado por la Conciliación MP.');

  // Marcado QR en el ERP, pero fue débito en el posnet.
  const nombres = { qr: 'QR / billetera', tarjeta_debito: 'Tarjeta de débito' };
  const mal = segunMercadoPago(
    { medio: 'qr', mp: { atado: 'auto', motivo: '', medioAnterior: null, pagos: [pMp({ familia: 'tarjeta', tipo: 'debit_card', metodo: 'debmaster' })] } },
    { nombreDelMedio: (m) => nombres[m] },
  );
  assert.equal(mal.avisos[0], 'En el ERP figura «QR / billetera», pero Mercado Pago dice «Tarjeta de débito».');
  // El QR del posnet pagado con billetera es QR: no avisa.
  assert.deepEqual(segunMercadoPago({ medio: 'qr', mp: { atado: 'auto', pagos: [pMp({ familia: 'tarjeta' })] } }).avisos, []);
});

test('según Mercado Pago: sin atar, «No entró», devuelto y QR del ERP sin conciliar', () => {
  assert.equal(segunMercadoPago({ medio: 'efectivo', mp: null }, { fechaVenta: '2026-11-18' }), null);
  assert.equal(segunMercadoPago({ medio: 'qr', mp: null }, { fechaVenta: '2026-10-30T12:00:00Z' }), null);
  assert.equal(segunMercadoPago({ medio: 'qr', mp: null }, { fechaVenta: '2026-11-18T12:00:00Z' }).sinDato, true);
  const no = segunMercadoPago({ medio: 'qr', mp: { atado: 'sin_mp', motivo: 'Se cobró en efectivo', pagos: [] } });
  assert.match(no.avisos[0], /NO entró.*Se cobró en efectivo/);
  const dev = segunMercadoPago({ medio: 'qr', mp: { atado: 'auto', pagos: [pMp({ estado: 'refunded', devuelto: 100 })] } });
  assert.equal(dev.pagos[0].estado, 'Devuelto');
  const erp = segunMercadoPago({ medio: 'qr', mp: { atado: null, pagos: [pMp({ id: 'PAY01ABC', tipo: '', caja: 'Caja 2' })] } });
  assert.equal(erp.fuente, 'Cobrado con el botón QR del ERP (todavía sin conciliar).');
  assert.equal(erp.pagos[0].como, '');
  assert.equal(erp.pagos[0].operacion, '');
});
