import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarParte, estadoPartes, restoParaParte, sumaPartes } from './partesPago.js';

const parte = (importe) => ({ medio: 'transferencia', importe, fecha: '', cuentaId: '' });

test('el resto de una parte respeta lo que llevan las otras', () => {
  const formas = [parte('1209247'), parte('')];
  assert.equal(restoParaParte(formas, 2702073.09, 1), 1492826.09);
  // La primera, si se le pide el resto, toma lo que la segunda no cubre (todo).
  assert.equal(restoParaParte(formas, 2702073.09, 0), 2702073.09);
  // Si las otras ya cubren el total, no hay resto.
  assert.equal(restoParaParte([parte('100'), parte('')], 100, 1), null);
  assert.equal(restoParaParte([parte('150'), parte('')], 100, 1), null);
});

test('agregar una parte trae lo que falta', () => {
  const xs = agregarParte([parte('1209247')], 2702073.09);
  assert.equal(xs.length, 2);
  assert.equal(xs[1].importe, '1492826.09');
  assert.equal(sumaPartes(xs), 2702073.09);
  assert.equal(agregarParte([parte('100')], 100)[1].importe, '');
});

test('estado de la suma (centavos sin error de coma flotante)', () => {
  assert.deepEqual(estadoPartes([parte('0.1'), parte('0.2')], 0.3), { id: 'cierra', monto: 0 });
  assert.deepEqual(estadoPartes([parte('50')], 80), { id: 'faltan', monto: 30 });
  assert.deepEqual(estadoPartes([parte('90')], 80), { id: 'sobran', monto: 10 });
});
