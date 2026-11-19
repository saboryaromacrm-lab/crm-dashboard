import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuerpoEdicion, formDesdePago, huboCambios } from './editarPago.js';

const pago = {
  fecha: '2026-11-19T03:00:00.000Z', importe: 566338, medio: 'transferencia', cambioPor: null,
  cuentaPropiaId: 3, cuentaAMano: null, referencia: '', concepto: 'Pago a cuenta', observaciones: '',
};

test('el formulario arranca con el pago y sin tocar no hay cambios', () => {
  const f = formDesdePago(pago, []);
  assert.equal(f.importe, '566338');
  assert.equal(f.modo, 'simple');
  assert.equal(f.cuentaId, '3');
  assert.equal(huboCambios(f, f), false);
  assert.equal(huboCambios(f, { ...f, motivo: 'nada' }), false);
  assert.equal(huboCambios(f, { ...f, importe: '500000' }), true);
  assert.deepEqual(cuerpoEdicion(f), {
    fecha: f.fecha, importe: 566338, referencia: '', concepto: 'Pago a cuenta', observaciones: '', motivo: undefined,
    medio: 'transferencia', formas: [], cuentaPropiaId: 3,
  });
});

test('efectivo por transferencia y pago mixto', () => {
  const cambio = formDesdePago({ ...pago, cambioPor: 'Juan', cuentaPropiaId: null }, []);
  assert.equal(cambio.medio, 'cambio');
  assert.equal(cuerpoEdicion(cambio).cambioPor, 'Juan');
  assert.equal(cuerpoEdicion(cambio).medio, 'transferencia');
  const mixto = formDesdePago({ ...pago, medio: 'efectivo' }, [
    { medio: 'efectivo', importe: 66338, fecha: null, cuentaPropiaId: null, cuentaAMano: null },
    { medio: 'transferencia', importe: 500000, fecha: null, cuentaPropiaId: null, cuentaAMano: 'mi hermano' },
  ]);
  assert.equal(mixto.modo, 'mixto');
  const b = cuerpoEdicion(mixto);
  assert.equal(b.medio, 'efectivo');
  assert.deepEqual(b.formas[1], { medio: 'transferencia', importe: 500000, fecha: undefined, cuentaAMano: 'mi hermano' });
});
