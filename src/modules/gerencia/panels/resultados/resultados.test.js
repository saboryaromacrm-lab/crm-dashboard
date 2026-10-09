import test from 'node:test';
import assert from 'node:assert/strict';
import {
  armarColumnas, baldesDe, columna, cumplimiento, indicadores, mesesEntre, nombreMes, objetivoDe, origenDe, renglones, sobreVentas,
  sumarMeses, textoOrigen, variacion,
} from './resultados.js';

const balde = (balde, h) => {
  const ventasNetas = h.ventasLista - (h.descuentos ?? 0);
  const margenBruto = ventasNetas - h.cmv;
  const contribucion = margenBruto - (h.iibb ?? 0);
  const totalFijos = h.sueldos ?? 0;
  const operativo = contribucion - totalFijos;
  return {
    balde,
    hechos: { variables: {}, fijos: h.fijos ?? {}, financieros: {}, ...h },
    cascada: { ventasNetas, margenBruto, contribucion, totalFijos, operativo, antesGanancias: operativo, otrosFijos: 0, otrosVariables: 0 },
  };
};
const mes = (m, baldes, impuesto) => {
  const t = baldes.reduce((a, b) => ({
    hechos: { ...a.hechos, ...Object.fromEntries(Object.entries(b.hechos).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, (a.hechos[k] ?? 0) + v])) },
    cascada: Object.fromEntries(Object.keys(b.cascada).map((k) => [k, (a.cascada[k] ?? 0) + b.cascada[k]])),
  }), { hechos: { variables: {}, fijos: {}, financieros: {} }, cascada: {} });
  return { mes: m, baldes, total: t, ganancias: { impuesto }, origen: { iibb: m === '2026-09' ? 'real' : 'estimado' } };
};
const DATOS = {
  sucursales: [{ id: 2, nombre: 'Express 1' }, { id: 6, nombre: 'Fontana' }],
  meses: [
    mes('2026-09', [balde(2, { ventasLista: 1000, cmv: 600, iibb: 30, sueldos: 200 }), balde(6, { ventasLista: 500, cmv: 300, iibb: 15, sueldos: 100 })], 20),
    mes('2026-10', [balde(2, { ventasLista: 1200, cmv: 700, iibb: 36, sueldos: 200 }), balde(-1, { ventasLista: 0, cmv: 0, sueldos: 50 })], 30),
  ],
};

test('meses', () => {
  assert.equal(sumarMeses('2026-01', -1), '2025-12');
  assert.deepEqual(mesesEntre('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01']);
  assert.equal(nombreMes('2026-10'), 'Octubre 2026');
  assert.equal(nombreMes('2026-10', true), 'oct 26');
});

test('una columna suma meses y baldes; Ganancias solo para la empresa', () => {
  const emp = columna(DATOS, ['2026-09', '2026-10']);
  assert.equal(emp.ventasNetas, 2700);
  assert.equal(emp.antesGanancias, 2700 - 1600 - 81 - 550);
  assert.equal(emp.ganancias, 50);
  assert.equal(emp.neto, emp.antesGanancias - 50);
  const ex1 = columna(DATOS, ['2026-09', '2026-10'], 2);
  assert.equal(ex1.ventasNetas, 2200);
  assert.equal(ex1.ganancias, null);
  assert.equal(ex1.neto, null);
  assert.equal(columna(DATOS, ['2026-10'], 6).ventasNetas, 0, 'un local sin nada en el mes da cero');
});

test('los renglones: costos en negativo, sin ceros de más, sin Ganancias por local', () => {
  const emp = columna(DATOS, ['2026-09']);
  const r = renglones([emp]);
  const de = (id) => r.find((x) => x.id === id);
  assert.equal(de('cmv').valores[0], -900);
  assert.equal(de('neto').valores[0], emp.neto);
  assert.equal(de('descuentos'), undefined, 'en cero en todas: no se muestra');
  assert.ok(de('sueldos'), 'sueldos se muestra siempre');
  const local = renglones([columna(DATOS, ['2026-09'], 2)]);
  assert.equal(local.find((x) => x.id === 'ganancias'), undefined);
  assert.equal(local.find((x) => x.id === 'neto'), undefined);
});

test('el detalle por rubro al abrir un grupo', () => {
  const datos = { meses: [mes('2026-09', [balde(2, { ventasLista: 100, cmv: 0, fijos: { 1: 30, 7: 10 } })], 0)] };
  datos.meses[0].total.hechos.fijos = { 1: 30, 7: 10 };
  const col = columna(datos, ['2026-09']);
  const r = renglones([col], [{ id: 1, nombre: 'Alquiler' }, { id: 7, nombre: 'Honorarios' }], new Set(['otrosFijos']));
  const det = r.filter((x) => x.detalle);
  assert.deepEqual(det.map((x) => [x.texto, x.valores[0]]), [['Alquiler', -30], ['Honorarios', -10]]);
});

test('indicadores: margen, contribución, equilibrio', () => {
  const i = indicadores({ ventasNetas: 1000, margenBruto: 400, contribucion: 250, totalFijos: 200 });
  assert.equal(i.margenBrutoPct, 40);
  assert.equal(i.contribucionPct, 25);
  assert.equal(i.equilibrio, 800);
  assert.equal(i.margenSeguridadPct, 20);
  assert.equal(indicadores({ ventasNetas: 1000, contribucion: -5, totalFijos: 200 }).sinEquilibrio, true);
  assert.equal(indicadores({ ventasNetas: 0 }).margenBrutoPct, null);
  assert.equal(sobreVentas(-250, { ventasNetas: 1000 }), -25);
});

test('variación y cumplimiento', () => {
  assert.equal(variacion(120, 100), 20);
  assert.equal(variacion(-50, -100), 50);
  assert.equal(variacion(10, 0), null);
  assert.equal(cumplimiento(850, 1000), 85);
  assert.equal(cumplimiento(850, 0), null);
});

test('objetivos de la empresa o de un local, solo los meses con objetivo', () => {
  const obj = [
    { mes: '2026-09', sucursalId: null, ventaNeta: 1000, resultado: 100 },
    { mes: '2026-10', sucursalId: null, ventaNeta: 1500, resultado: null },
    { mes: '2026-10', sucursalId: 6, ventaNeta: 400, resultado: 40 },
  ];
  assert.deepEqual(objetivoDe(obj, ['2026-09', '2026-10']), { ventaNeta: 2500, resultado: 100, mesesVenta: ['2026-09', '2026-10'], mesesResultado: ['2026-09'] });
  assert.equal(objetivoDe(obj, ['2026-10'], 6).resultado, 40);
  assert.equal(objetivoDe(obj, ['2026-11']).ventaNeta, null);
});

test('estimado o real, y los baldes con nombre', () => {
  assert.equal(textoOrigen(origenDe(DATOS, ['2026-09'], 'iibb')), 'pago real');
  assert.equal(textoOrigen(origenDe(DATOS, ['2026-09', '2026-10'], 'iibb')), 'pago real en 1 mes, estimado en 1 mes');
  assert.deepEqual(baldesDe(DATOS, ['2026-09', '2026-10']).map((b) => b.nombre), ['Express 1', 'Fontana', 'Administración']);
});

test('las columnas: un mes con sus comparaciones, varios meses con total, por local', () => {
  const un = armarColumnas(DATOS, { modo: 'mes', mes: '2026-10', vista: 'meses' });
  assert.deepEqual(un.columnas.map((c) => c.sub), ['este período', 'mes anterior']);
  assert.equal(un.contra.ventasNetas, 1500);
  const rango = armarColumnas(DATOS, { modo: 'rango', desde: '2026-09', hasta: '2026-10', vista: 'meses' });
  assert.deepEqual(rango.columnas.map((c) => c.key), ['2026-09', '2026-10', 'total']);
  assert.equal(rango.principal.ventasNetas, 2700);
  const locales = armarColumnas(DATOS, { modo: 'rango', desde: '2026-09', hasta: '2026-10', vista: 'locales' });
  assert.deepEqual(locales.columnas.map((c) => c.titulo), ['Express 1', 'Fontana', 'Administración', 'Total']);
  const fontana = armarColumnas(DATOS, { modo: 'mes', mes: '2026-10', vista: 'meses', balde: 6 });
  assert.equal(fontana.empresa, false);
  assert.equal(fontana.columnas.length, 2, 'Fontana vendió en septiembre: hay mes anterior');
});
