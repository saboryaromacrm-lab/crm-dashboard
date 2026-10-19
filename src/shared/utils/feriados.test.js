import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuantoFalta, diaYFecha, diasHasta, queHace } from './feriados.js';

test('cuantoFalta: hoy, mañana, en N días y pasó (días de calendario, cruzando de mes)', () => {
  assert.equal(cuantoFalta('2026-11-23', '2026-11-23'), 'hoy');
  assert.equal(cuantoFalta('2026-11-24', '2026-11-23'), 'mañana');
  assert.equal(cuantoFalta('2026-12-01', '2026-11-23'), 'en 8 días');
  assert.equal(cuantoFalta('2026-11-20', '2026-11-23'), 'pasó');
  assert.equal(diasHasta('2027-01-01', '2026-12-31'), 1);
});

test('diaYFecha: el día de la semana y la fecha corta', () => {
  assert.equal(diaYFecha('2026-11-23'), 'lunes 23/11');
  assert.equal(diaYFecha('2026-04-02'), 'jueves 02/04');
});

test('queHace: sin fila es «sin definir»; abre con o sin horario; cerrada', () => {
  assert.equal(queHace(undefined), 'sin definir');
  assert.equal(queHace({ abre: true, horario: '9 a 13' }), 'abre 9 a 13');
  assert.equal(queHace({ abre: true, horario: '' }), 'abre');
  assert.equal(queHace({ abre: false, horario: '' }), 'cerrada');
});
