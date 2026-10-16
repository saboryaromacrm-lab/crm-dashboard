import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenCambios } from './cambios.js';

test('agrupa por persona sin importar mayúsculas, tildes ni espacios', () => {
  const r = resumenCambios([
    { cambioPor: 'Juan Pérez', importe: 100000 },
    { cambioPor: ' juan  perez ', importe: 50000.5 },
    { cambioPor: 'Ana', importe: 200000 },
  ]);
  assert.equal(r.total, 350000.5);
  assert.equal(r.cantidad, 3);
  assert.deepEqual(r.porPersona, [
    { persona: 'Ana', cantidad: 1, total: 200000 },
    { persona: 'Juan Pérez', cantidad: 2, total: 150000.5 },
  ]);
});

test('sin pagos', () => {
  assert.deepEqual(resumenCambios([]), { total: 0, cantidad: 0, porPersona: [] });
});
