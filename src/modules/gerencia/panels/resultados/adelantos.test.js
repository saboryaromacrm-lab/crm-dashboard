import test from 'node:test';
import assert from 'node:assert/strict';
import { SIN_EMPLEADO, detalleSinNombre, filtrar, opciones, porEmpleado, claveLugar, nombreEmpleado } from './adelantos.js';

const sofia = { id: 1, nombre: 'Sofía Pérez', usuarioId: null };
const juan = { id: 2, nombre: 'Juan', usuarioId: 7 };
const ad = (id, fecha, importe, extra = {}) => ({
  id, fecha, importe, detalle: '', concepto: 'Adelantos sueldos', lugar: 'Caja central (Cash Flow)', sucursalId: null,
  cargadoPor: 'Lucas', anulado: false, empleado: null, ...extra,
});
const lista = [
  ad('cashflow-1', '2026-11-01T13:00:00.000Z', 10000, { empleado: sofia, detalle: 'Sofía Pérez · semana 1' }),
  ad('caja-5', '2026-11-03T13:00:00.000Z', 5000, { empleado: juan, detalle: 'Juan', lugar: 'Fontana', sucursalId: 3 }),
  ad('caja-6', '2026-11-04T13:00:00.000Z', 2500.5, { empleado: sofia, detalle: 'Sofía Pérez', lugar: 'Fontana', sucursalId: 3 }),
  ad('cashflow-2', '2026-11-02T13:00:00.000Z', 8000, { empleado: juan, anulado: true }),
  ad('cashflow-3', '2026-10-30T13:00:00.000Z', 3000, { detalle: 'para Marta (viejo)' }),
];

test('el detalle sin el nombre que le antepone el servidor', () => {
  assert.equal(detalleSinNombre(lista[0]), 'semana 1');
  assert.equal(detalleSinNombre(lista[1]), '');
  assert.equal(detalleSinNombre(lista[4]), 'para Marta (viejo)');
  /* Otro nombre que empieza igual no se corta. */
  assert.equal(detalleSinNombre({ empleado: juan, detalle: 'Juana · algo' }), 'Juana · algo');
});

test('sin filtros: lo vigente, lo más nuevo primero', () => {
  assert.deepEqual(filtrar(lista, {}).map((a) => a.id), ['caja-6', 'caja-5', 'cashflow-1', 'cashflow-3']);
  assert.equal(filtrar(lista, { anulados: true }).length, 5);
});

test('filtra por empleado, lugar, concepto y texto (sin tildes)', () => {
  assert.deepEqual(filtrar(lista, { empleado: 'e:1' }).map((a) => a.id), ['caja-6', 'cashflow-1']);
  assert.deepEqual(filtrar(lista, { empleado: SIN_EMPLEADO }).map((a) => a.id), ['cashflow-3']);
  assert.deepEqual(filtrar(lista, { lugar: 's:3' }).map((a) => a.id), ['caja-6', 'caja-5']);
  assert.deepEqual(filtrar(lista, { lugar: 'central', anulados: true }).map((a) => a.id), ['cashflow-2', 'cashflow-1', 'cashflow-3']);
  assert.equal(filtrar(lista, { concepto: 'Otro' }).length, 0);
  assert.deepEqual(filtrar(lista, { texto: 'sofia' }).map((a) => a.id), ['caja-6', 'cashflow-1']);
  assert.deepEqual(filtrar(lista, { texto: 'MARTA' }).map((a) => a.id), ['cashflow-3']);
});

test('por empleado: solo lo vigente, de mayor a menor', () => {
  assert.deepEqual(porEmpleado(lista), [
    { clave: 'e:1', nombre: 'Sofía Pérez', cantidad: 2, total: 12500.5 },
    { clave: 'e:2', nombre: 'Juan', cantidad: 1, total: 5000 },
    { clave: SIN_EMPLEADO, nombre: 'Sin empleado elegido', cantidad: 1, total: 3000 },
  ]);
});

test('las opciones de un filtro, sin repetir y en orden', () => {
  assert.deepEqual(opciones(lista, claveLugar, (a) => a.lugar), [['central', 'Caja central (Cash Flow)'], ['s:3', 'Fontana']]);
  assert.deepEqual(opciones(lista, (a) => a.empleado?.id ?? 0, nombreEmpleado).map((o) => o[1]), ['Juan', 'Sin empleado elegido', 'Sofía Pérez']);
  /* El elegido sigue aunque el período no lo traiga. */
  assert.deepEqual(opciones([], claveLugar, (a) => a.lugar, ['s:9', 'Express 3']), [['s:9', 'Express 3']]);
  assert.equal(opciones(lista, claveLugar, (a) => a.lugar, ['s:3', 'Fontana']).length, 2);
});
