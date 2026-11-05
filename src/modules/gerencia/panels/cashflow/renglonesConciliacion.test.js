import test from 'node:test';
import assert from 'node:assert/strict';
import { cascada, nombreMes, otroMes, puenteMetricas, textoSinCaja, turnoParaMirar } from './renglonesConciliacion.js';

/* Los totales de octubre de la base local, como los manda el servidor. */
const T = {
  ventas: 37756969.59, cobranzas: 224.04, ingresos: 0, pagosProveedor: 2086754.25, devoluciones: 8176, otrosEgresos: 1661000,
  sinDetalle: 0, generado: 34001263.38, jefeGenerado: 0, jefeContado: 0, jefeDif: 0, jefeApertura: 0, difApertura: 0, fondoAbrieron: 6503400, fondoDejaron: 6504000,
  debiaSobres: 34000663.38, difCajeros: 87686.62, enviado: 34088350, sinRendir: 3898000, previo: 7520250, noCorresponde: 0,
  controlado: 22670100, difControl: 0, contado: 22670100, turnos: 81, porJefe: 0, sinRendirN: 11, diferencias: 87686.62,
};

/** Cada subtotal es la suma de los renglones desde el subtotal anterior (que arrastra). */
function cuadra(renglones) {
  let acum = 0;
  for (const r of renglones) {
    if (r.total) {
      assert.ok(Math.abs(acum - r.valor) < 0.005, `${r.texto}: ${acum} ≠ ${r.valor}`);
      acum = r.valor;
    } else acum += r.valor;
  }
}

test('cascada: cada subtotal es la suma de lo de arriba', () => {
  cuadra(cascada(T));
  const conTodo = { ...T, ingresos: 5000, sinDetalle: 10, generado: 34006273.38, porJefe: 2, jefeGenerado: 100000, jefeContado: 150000, jefeApertura: -2000, difApertura: -1500, difCajeros: -1000 };
  conTodo.debiaSobres = conTodo.generado - conTodo.jefeGenerado + conTodo.difApertura + conTodo.fondoAbrieron - conTodo.fondoDejaron;
  conTodo.enviado = conTodo.debiaSobres + conTodo.difCajeros;
  conTodo.noCorresponde = 1000;
  conTodo.controlado = conTodo.enviado - conTodo.sinRendir - conTodo.previo - conTodo.noCorresponde;
  conTodo.difControl = -500;
  conTodo.contado = conTodo.controlado + conTodo.difControl;
  cuadra(cascada(conTodo));
});

test('cascada: lo que está en cero y no explica nada no aparece; lo que importa, siempre', () => {
  const claves = cascada(T).map((r) => r.clave);
  assert.ok(!claves.includes('ingresos'));
  assert.ok(!claves.includes('jefe'));
  assert.ok(!claves.includes('noCorresponde'));
  assert.ok(!claves.includes('sinDetalle'));
  for (const k of ['ventas', 'difApertura', 'fondo', 'difCajeros', 'difControl', 'sinRendir', 'previo', 'contado']) assert.ok(claves.includes(k), k);
  const r = cascada({ ...T, sinRendir: 0, sinRendirN: 0, difControl: 0 });
  assert.ok(!r.some((x) => x.clave === 'sinRendir'));
  assert.ok(r.some((x) => x.clave === 'difControl'), 'la diferencia en cero se muestra: «sin diferencia» también dice algo');
});

test('cascada: el fondo explica para qué lado fue', () => {
  const f = cascada(T).find((r) => r.clave === 'fondo');
  assert.equal(f.valor, -600);
  assert.match(f.nota, /no viajó/);
  assert.match(cascada({ ...T, fondoDejaron: T.fondoAbrieron }).find((r) => r.clave === 'fondo').nota, /mismo fondo/);
  assert.match(cascada({ ...T, fondoDejaron: T.fondoAbrieron - 100 }).find((r) => r.clave === 'fondo').nota, /viajó en los sobres/);
});

test('cascada: la caja del jefe dice qué le faltó al abrir y al cerrar', () => {
  const j = cascada({ ...T, porJefe: 1, jefeGenerado: 1000, jefeContado: 51000, jefeApertura: -2000, jefeDif: 500 }).find((r) => r.clave === 'jefe');
  assert.match(j.nota, /al abrir faltaron \$\s?2\.000/);
  assert.match(j.nota, /al cerrar sobraron \$\s?500/);
});

test('puente con Métricas: suma al efectivo de ventas', () => {
  const d = { metricas: 37836198.92, otrosTurnos: 79229.33, sinCaja: 0, esperandoCae: 0, deOtroMes: 0, resultado: 37756969.59, cuadra: true };
  const r = puenteMetricas(d);
  cuadra(r);
  assert.deepEqual(r.map((x) => x.clave), ['metricas', 'otrosTurnos', 'resultado']);
  assert.deepEqual(puenteMetricas(null), []);
});

test('turnos para mirar: con diferencia, sin rendir o que no cuadran', () => {
  assert.equal(turnoParaMirar({ difCajero: 0, difControl: 0, estado: 'rendida', descuadre: [] }), false);
  assert.equal(turnoParaMirar({ difCajero: -100, difControl: null, estado: 'rendida', descuadre: [] }), true);
  assert.equal(turnoParaMirar({ difCajero: 0, difControl: 50, estado: 'rendida', descuadre: [] }), true);
  assert.equal(turnoParaMirar({ difCajero: 0, difControl: null, estado: 'sin_rendir', descuadre: [] }), true);
  assert.equal(turnoParaMirar({ difCajero: 0, difControl: null, estado: 'sin_sobre', descuadre: ['x'] }), true);
  assert.equal(turnoParaMirar({ difApertura: -1000, difCajero: 0, difControl: 0, estado: 'rendida', descuadre: [] }), true);
  assert.equal(turnoParaMirar({ difApertura: null, difCajero: 0, difControl: 0, estado: 'rendida', descuadre: [] }), false);
});

test('efectivo sin caja: se avisa lo que hay, nada si no hay', () => {
  assert.equal(textoSinCaja({ ventas: 0, cobranzas: 0 }), '');
  assert.equal(textoSinCaja(undefined), '');
  assert.match(textoSinCaja({ ventas: 0, cobranzas: 8000 }), /^En el mes se cobraron en efectivo, sin caja abierta, recibos de cuenta corriente por \$\s?8\.000/);
  assert.match(textoSinCaja({ ventas: 4000, cobranzas: 8000 }), /ventas por \$\s?4\.000(,00)? y recibos/);
});

test('meses', () => {
  assert.equal(nombreMes('2026-10'), 'octubre 2026');
  assert.equal(otroMes('2026-01', -1), '2025-12');
  assert.equal(otroMes('2026-12', 1), '2027-01');
});
