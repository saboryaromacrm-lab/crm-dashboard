import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rendirDesdeHasta } from './plazoCaja.js';

test('rendir desde y hasta: solo si el turno viene de otro día', () => {
  const abrio = new Date(2026, 10, 19, 7, 55).toISOString(); // jueves 19/11 a la mañana
  assert.deepEqual(rendirDesdeHasta(abrio, '2026-11-25'), { desde: 'jueves 19/11', hasta: 'miércoles 25/11' });
  assert.equal(rendirDesdeHasta(abrio, '2026-11-19'), null);
  assert.equal(rendirDesdeHasta(null, '2026-11-25'), null);
  assert.equal(rendirDesdeHasta(abrio, null), null);
});
