import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILTROS_ESTADO, ORDENES_OFERTA, correEnSucursal, cuandoDias, situacionOferta, textoSituacion } from './ofertasLista.js';

/* Miércoles 19/11/2026 a las 12:00 (hora argentina). */
const ahora = new Date('2026-11-19T12:00:00-03:00');
const pasa = (clave, o) => FILTROS_ESTADO.find(([k]) => k === clave)[2](situacionOferta(o, ahora));

test('vigente que vence en 3 días y que hoy aplica', () => {
  const o = { activa: true, desde: '2026-11-01T00:00:00-03:00', hasta: '2026-11-22T12:00:00-03:00', dias: '' };
  const s = situacionOferta(o, ahora);
  assert.equal(s.estado.id, 'vigente');
  assert.equal(s.aplicaHoy, true);
  assert.equal(s.venceEn, 3);
  assert.equal(textoSituacion(o, s), 'vence en 3 días');
  assert.ok(pasa('vigentes', o) && pasa('hoy', o) && pasa('por_vencer', o) && !pasa('vencidas', o));
});

test('vigente de «solo los lunes»: hoy (miércoles) no aplica', () => {
  const o = { activa: true, dias: '1000000' };
  const s = situacionOferta(o, ahora);
  assert.equal(s.aplicaHoy, false);
  assert.equal(textoSituacion(o, s), 'hoy no aplica (solo los lunes)');
  assert.ok(pasa('vigentes', o) && !pasa('hoy', o) && !pasa('por_vencer', o));
});

test('días en corto', () => {
  assert.equal(cuandoDias(''), '');
  assert.equal(cuandoDias('1111111'), '');
  assert.equal(cuandoDias('1111110'), 'todos menos los domingos');
  assert.equal(cuandoDias('1111100'), 'todos menos los sábados y domingos');
  assert.equal(cuandoDias('1010100'), 'solo los lunes, miércoles y viernes');
});

test('programada, vencida e inactiva', () => {
  const prog = { activa: true, desde: '2026-11-24T00:00:00-03:00' };
  assert.equal(textoSituacion(prog, situacionOferta(prog, ahora)), 'empieza en 5 días');
  const venc = { activa: true, hasta: '2026-11-15T23:59:00-03:00' };
  assert.equal(textoSituacion(venc, situacionOferta(venc, ahora)), 'venció hace 3 días');
  const apagada = { activa: false };
  assert.equal(textoSituacion(apagada, situacionOferta(apagada, ahora)), 'apagada a mano');
  assert.ok(pasa('programadas', prog) && pasa('vencidas', venc) && pasa('inactivas', apagada) && pasa('todas', apagada));
});

test('sucursal y orden', () => {
  assert.equal(correEnSucursal({ sucursales: '' }, 4), true);
  assert.equal(correEnSucursal({ sucursales: '2,4' }, 4), true);
  assert.equal(correEnSucursal({ sucursales: '2' }, 4), false);
  const l = [{ id: 1, hasta: null, uso: { descuento: 10 } }, { id: 2, hasta: '2026-11-20', uso: { descuento: 50 } }, { id: 3, hasta: '2026-11-25' }];
  assert.deepEqual([...l].sort(ORDENES_OFERTA.vencen.fn).map((x) => x.id), [2, 3, 1]);
  assert.deepEqual([...l].sort(ORDENES_OFERTA.uso.fn).map((x) => x.id), [2, 1, 3]);
});
