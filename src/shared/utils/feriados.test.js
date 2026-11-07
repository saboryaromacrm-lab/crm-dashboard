import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuantoFalta, diaYFecha, diasHasta, opcionDe, queHace, turnosDelDia } from './feriados.js';

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
  assert.equal(queHace({ abre: true, horario: '' }), 'abre todo el día');
  assert.equal(queHace({ abre: false, horario: '' }), 'cerrada');
});

const SEMANA = { lun: '08:00-12:30, 17:00-21:00', sab: '08:00-12:30', dom: '' };

test('turnosDelDia: el horario de ese día partido a las 14; solo si abre en los dos', () => {
  assert.deepEqual(turnosDelDia(SEMANA, '2026-11-09'), { manana: '08:00-12:30', tarde: '17:00-21:00' });
  assert.equal(turnosDelDia(SEMANA, '2026-11-14'), null, 'sábado solo a la mañana: no hay dos turnos');
  assert.equal(turnosDelDia(SEMANA, '2026-11-15'), null, 'domingo cerrado');
  assert.equal(turnosDelDia(null, '2026-11-09'), null, 'sin horario cargado');
  assert.deepEqual(turnosDelDia({ mar: '07:00-09:00, 10:00-13:30, 14:00-18:00' }, '2026-11-10'), { manana: '07:00-09:00, 10:00-13:30', tarde: '14:00-18:00' });
});

test('opcionDe: lo guardado vuelve a su opción', () => {
  const t = turnosDelDia(SEMANA, '2026-11-09');
  assert.equal(opcionDe(undefined, t), '');
  assert.equal(opcionDe({ abre: false, horario: '' }, t), 'no');
  assert.equal(opcionDe({ abre: true, horario: '' }, t), 'todo');
  assert.equal(opcionDe({ abre: true, horario: '08:00-12:30' }, t), 'manana');
  assert.equal(opcionDe({ abre: true, horario: '17:00-21:00' }, t), 'tarde');
  assert.equal(opcionDe({ abre: true, horario: '9 a 13' }, t), 'otro');
  assert.equal(opcionDe({ abre: true, horario: '08:00-12:30' }, null), 'otro', 'sin turnos ese día, queda como horario a mano');
});
