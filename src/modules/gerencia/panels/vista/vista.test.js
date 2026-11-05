import test from 'node:test';
import assert from 'node:assert/strict';
import { armarVista, equilibrio, variacion } from './vista.js';

const per = (clave, enCurso, total, porLocal = {}) => ({
  clave, etiqueta: clave.slice(5, 7), titulo: `mes ${clave.slice(5, 7)}`, enCurso, dias: 30, transcurridos: enCurso ? 6 : 30, total, porLocal,
});
const celda = (ventas, costo, tickets, extra = {}) => ({ ventas, costo, tickets, sinCosto: 0, medios: { efectivo: ventas / 2, tarjeta: ventas / 2 }, ...extra });

const DATOS = {
  unidad: 'mes',
  periodos: [
    per('2026-08-01', false, celda(0, 0, 0)),
    per('2026-09-01', false, celda(1000, 600, 10, { resultado: { neto: 100, antesGanancias: 120, totalFijos: 200, contribucion: 300 } }), { 1: celda(400, 240, 4, { resultado: { neto: null, antesGanancias: 50, totalFijos: 80, contribucion: 120 } }) }),
    per('2026-10-01', false, celda(1200, 780, 10, { resultado: { neto: 150, antesGanancias: 180, totalFijos: 200, contribucion: 360 } })),
    per('2026-11-01', true, celda(300, 180, 3)),
  ],
  foto: { cicloCaja: 21, diasStock: 53, diasCobro: 0, diasPago: 32 },
};

test('compara el último mes COMPLETO contra el anterior, y deja afuera los meses sin datos', () => {
  const v = armarVista(DATOS);
  assert.equal(v.actual.clave, '2026-10-01');
  assert.equal(v.anterior.clave, '2026-09-01');
  assert.equal(v.serie.length, 3, 'agosto (antes de arrancar) no se dibuja');
  assert.equal(v.kpis.ventasVar, 20);
  assert.equal(v.kpis.margenPct, 35);
  assert.equal(v.kpis.margenPts, -5);
  assert.equal(v.kpis.ticketPromVar, 20);
  assert.equal(v.kpis.resultado, 150);
  assert.equal(v.proyeccion.ventas, 1500);
});

test('las lecturas explican la suba, avisan del margen y proyectan', () => {
  const t = armarVista(DATOS).lecturas.map((x) => x.texto).join(' | ');
  assert.match(t, /20 % más que en mes 09/);
  assert.match(t, /cuánto gastó cada cliente/);
  assert.match(t, /bajó 5 puntos/);
  assert.match(t, /cerrás en \$1\.500/);
  assert.match(t, /Tu plata da una vuelta en 21 días/);
});

test('con un local: su serie y el resultado antes de Ganancias', () => {
  const v = armarVista(DATOS, { sucursalId: 1 });
  const sep = v.serie.find((x) => x.clave === '2026-09-01');
  assert.equal(sep.ventas, 400);
  assert.equal(sep.resultado, 50);
});

test('punto de equilibrio y variación sin base', () => {
  assert.deepEqual(equilibrio({ ventas: 1200, totalFijos: 200, contribucion: 360 }), { ventas: 667, seguridadPct: 44.4, sinEquilibrio: false });
  assert.equal(equilibrio({ ventas: 1000, totalFijos: 200, contribucion: -10 }).sinEquilibrio, true);
  assert.equal(variacion(100, 0), null);
});

test('sin gastos fijos no hay punto de equilibrio; diferencias de inventario grandes se avisan', () => {
  assert.equal(equilibrio({ ventas: 1000, totalFijos: 0, contribucion: 300 }), null);
  const d = { unidad: 'mes', periodos: [per('2026-10-01', false, celda(1000, 600, 10, { resultado: { neto: 900, antesGanancias: 950, totalFijos: 0, contribucion: 300, ajustesStock: 800 } })), per('2026-11-01', true, celda(0, 0, 0))] };
  const t = armarVista(d).lecturas.map((x) => x.texto).join(' | ');
  assert.match(t, /Sobrantes de inventario por \$800/);
  assert.equal(armarVista(d).kpis.equilibrio, null);
});
