import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombreDia, paraCuando, recibidoEn, textoCuando, porEntrega } from './cuandoEnvio.js';

const HOY = '2026-10-23';
const ar = (s) => new Date(`${s}:00-03:00`).toISOString();
const pedido = (fecha, cuando) => ({ fecha: ar(fecha), webCliente: cuando ? { cuando } : {} });
const pronto = { tipo: 'pronto', desde: ar('2026-10-23T10:25'), hasta: ar('2026-10-23T10:45') };
const manana = { tipo: 'horario', desde: ar('2026-10-24T17:20'), hasta: ar('2026-10-24T17:40') };

test('nombreDia: hoy, mañana, ayer o el día con fecha', () => {
  assert.equal(nombreDia('2026-10-23', HOY), 'Hoy');
  assert.equal(nombreDia('2026-10-24', HOY), 'Mañana');
  assert.equal(nombreDia('2026-10-22', HOY), 'Ayer');
  assert.equal(nombreDia('2026-10-26', HOY), 'Lun 26/10');
});

test('textoCuando: lo que eligió, en hora argentina', () => {
  assert.equal(textoCuando(pronto, HOY), 'Lo antes posible · hoy 10:25 a 10:45');
  assert.equal(textoCuando(manana, HOY), 'Para mañana 17:20 a 17:40');
  assert.equal(textoCuando({ tipo: 'whatsapp' }, HOY), 'Lo coordina por WhatsApp');
  assert.equal(textoCuando(null, HOY), null);
});

test('filtros de tiempo: recibidos y para cuándo', () => {
  const a = pedido('2026-10-23T10:05', pronto);
  const b = pedido('2026-10-22T23:30', manana);
  const c = pedido('2026-10-15T09:00', { tipo: 'whatsapp' });
  const d = pedido('2026-10-23T11:00', null);
  assert.deepEqual([a, b, c, d].filter((p) => recibidoEn(p, 'hoy', HOY)), [a, d]);
  assert.deepEqual([a, b, c, d].filter((p) => recibidoEn(p, 'ayer', HOY)), [b]);
  assert.deepEqual([a, b, c, d].filter((p) => recibidoEn(p, 'semana', HOY)), [a, b, d]);
  assert.deepEqual([a, b, c, d].filter((p) => paraCuando(p, 'hoy', HOY)), [a]);
  assert.deepEqual([a, b, c, d].filter((p) => paraCuando(p, 'manana', HOY)), [b]);
  assert.deepEqual([a, b, c, d].filter((p) => paraCuando(p, 'whatsapp', HOY)), [c]);
  assert.deepEqual([a, b, c, d].filter((p) => paraCuando(p, 'pronto', HOY)), [a]);
  assert.deepEqual([b, a].sort(porEntrega), [a, b]);
});
