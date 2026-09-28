/* El archivo de costos con TODOS los proveedores (28/9/2026): agrupar, cruzar con
 * el padrón, decidir y armar los destinos. Lo que se prueba es lo que decide
 * a qué proveedor va cada costo — un error acá cambia precios de góndola. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categoriaProveedor, decisionInicialProveedores, destinosDeProveedores, proveedoresDelArchivo,
} from './importarCatalogo.js';
import { mismoNombreProveedor, parecidoProveedor, proveedoresParecidos } from '../../proveedores/domain/importarProveedores.js';

const fila = (prov, codigo, precio = '100') => ({ Proveedor: prov, Codigo: codigo, PrecioLista: precio, Cantidad: '1', CostoFlete: '0' });
const ARCHIVO = [
  fila('NUEVO COSMOS S.A.', '1'), fila('Nuevo Cosmos SA', '2'), fila('NUEVO COSMOS S.A.', '3'),
  fila('Coca Cola FEMSA', '1'), fila('Distribuidora Zeta', '4'), fila('', '5'),
  fila('Nuevo Cosmo S.A. - Lucfel', '6'),
];
const PADRON = [
  { id: 10, nombre: 'Nuevo Cosmos S.A.' },
  { id: 20, nombre: 'COCA-COLA FEMSA' },
  { id: 30, nombre: 'Molinos Río' },
];
const CATALOGO = [
  { id: 1, codigoPropio: '1', nombre: 'Gaseosa', formatosCompra: [{ proveedorId: 20 }] },
  { id: 2, codigoPropio: '2', nombre: 'Yerba', formatosCompra: [] },
  { id: 3, codigoPropio: '3', nombre: 'Azúcar', formatosCompra: [{ proveedorId: 10 }] },
  { id: 4, codigoPropio: '4', nombre: 'Arroz', formatosCompra: [] },
  { id: 6, codigoPropio: '6', nombre: 'Harina', formatosCompra: [] },
];
const conPadron = (grupos) => grupos.map((g) => {
  if (g.sinNombre) return { ...g, exacto: null, candidatos: [] };
  const exacto = PADRON.find((p) => mismoNombreProveedor(p.nombre, g.nombre)) || null;
  return { ...g, exacto, candidatos: exacto ? [] : proveedoresParecidos(g.nombre, PADRON) };
});

test('agrupa por proveedor con el nombre normalizado y deja aparte los renglones sin proveedor', () => {
  const g = proveedoresDelArchivo(ARCHIVO);
  const cosmos = g.find((x) => x.clave === 'nuevo cosmos sa');
  assert.equal(cosmos.filas.length, 3, '"NUEVO COSMOS S.A." y "Nuevo Cosmos SA" son el mismo grupo');
  assert.equal(cosmos.nombre, 'NUEVO COSMOS S.A.', 'se muestra la grafía más repetida');
  assert.equal(g.at(-1).sinNombre, true, 'el grupo sin proveedor va al final');
  assert.equal(g.length, 5);
});

test('el idéntico entra solo; el parecido arranca con el MÁS parecido elegido y queda "para revisar"', () => {
  const g = conPadron(proveedoresDelArchivo(ARCHIVO));
  const d = decisionInicialProveedores(g, true);
  assert.equal(d['nuevo cosmos sa'], 'p:10', 'mismo nombre (mayúsculas y puntos aparte) → entra solo');
  assert.equal(d['coca cola femsa'], 'p:20', '"Coca Cola FEMSA" = "COCA-COLA FEMSA"');
  assert.equal(d['nuevo cosmo sa lucfel'], 'p:10', 'parecido → se sugiere el más parecido (Nuevo Cosmos S.A.)');
  const cat = Object.fromEntries(g.map((x) => [x.clave, categoriaProveedor(x, true)]));
  assert.equal(cat['nuevo cosmo sa lucfel'], 'revisar', 'pero queda en el grupo "para revisar" (amarillo)');
  assert.equal(cat['nuevo cosmos sa'], 'coincide');
  assert.equal(cat['distribuidora zeta'], 'afuera');
  assert.equal(d['distribuidora zeta'], 'afuera', 'no está en el padrón y solo se importan los cargados → afuera');
  assert.equal(d.__sin_nombre__, 'afuera', 'sin proveedor → afuera siempre');
});

test('con "solo cargados" destildado, el que no está en el padrón también lo decide la persona', () => {
  const g = conPadron(proveedoresDelArchivo(ARCHIVO));
  const d = decisionInicialProveedores(g, false);
  assert.equal(d['distribuidora zeta'], '', 'se puede crear, pero confirmándolo');
  assert.equal(d.__sin_nombre__, 'afuera');
});

test('los destinos juntan nombres que van al mismo proveedor y no crean nada que no se confirmó', () => {
  const g = conPadron(proveedoresDelArchivo(ARCHIVO));
  const d = { ...decisionInicialProveedores(g, false), 'distribuidora zeta': 'nuevo' };
  const dest = destinosDeProveedores(g, d, PADRON, CATALOGO);
  const cosmos = dest.find((t) => t.id === 10);
  assert.equal(cosmos.filas.length, 4, 'los dos nombres de Cosmos + el parecido confirmado → un solo destino');
  assert.deepEqual(cosmos.delArchivo.sort(), ['NUEVO COSMOS S.A.', 'Nuevo Cosmo S.A. - Lucfel'].sort());
  assert.equal(cosmos.plan.resumen.actualiza, 1, 'Azúcar ya tenía formato de Cosmos → actualiza');
  assert.equal(cosmos.plan.resumen.agrega, 3, 'Gaseosa (que es de Coca: Cosmos queda alternativo), Yerba y Harina → se le agregan');
  const zeta = dest.find((t) => t.nuevo);
  assert.equal(zeta.nombre, 'Distribuidora Zeta');
  assert.equal(zeta.plan.resumen.agrega, 1, 'proveedor nuevo: todo lo que matchea se agrega');
  const coca = dest.find((t) => t.id === 20);
  assert.equal(coca.plan.resumen.actualiza, 1, 'la gaseosa ya era de Coca → actualiza');
  assert.equal(dest[0].id, 10, 'primero el de más renglones');
  assert.ok(!dest.some((t) => t.delArchivo.includes('(sin proveedor en el archivo)')), 'lo que queda afuera no entra');
});

test('lo que queda afuera no genera destino, aunque tenga renglones', () => {
  const g = conPadron(proveedoresDelArchivo(ARCHIVO));
  const d = { ...decisionInicialProveedores(g, true), 'nuevo cosmo sa lucfel': 'afuera' };
  const dest = destinosDeProveedores(g, d, PADRON, CATALOGO);
  assert.deepEqual(dest.map((t) => t.id).sort(), [10, 20]);
  assert.equal(dest.find((t) => t.id === 10).filas.length, 3);
});

test('las siglas sueltas no separan nombres: S.A. = SA, S.R.L. = SRL', () => {
  assert.ok(mismoNombreProveedor('Nuevo Cosmos S.A.', 'NUEVO COSMOS SA'));
  assert.ok(mismoNombreProveedor('Lácteos del Sur S.R.L.', 'LACTEOS DEL SUR SRL'));
  assert.ok(!mismoNombreProveedor('Juan y Pedro', 'Juan Pedro'), 'una "y" suelta entre palabras no se come');
});

test('de varios parecidos, el sugerido es el MÁS parecido', () => {
  const padron = [{ id: 1, nombre: 'Bavosi Hermanos Distribuidora' }, { id: 2, nombre: 'Bavosi' }, { id: 3, nombre: 'Bavos' }];
  const orden = proveedoresParecidos('BAVOSI S.A.', padron).map((p) => p.id);
  assert.equal(orden[0], 2, '"BAVOSI S.A." se parece más a "Bavosi" que a "Bavosi Hermanos Distribuidora"');
  assert.ok(parecidoProveedor('Gomez Noelia Edith', 'GOMEZ NOELIA') > parecidoProveedor('Gomez Noelia Edith', 'Gomez Hnos'));
});

test('sin "solo cargados", el que no se parece a nadie queda "a decidir" (no se crea solo)', () => {
  const g = conPadron(proveedoresDelArchivo(ARCHIVO));
  const zeta = g.find((x) => x.clave === 'distribuidora zeta');
  assert.equal(categoriaProveedor(zeta, false), 'decidir');
  assert.equal(decisionInicialProveedores(g, false)['distribuidora zeta'], '');
});

test('NO se importan: sin producto, costo $0 ni saltos de más de ×3 (salvo que se incluyan a propósito)', async () => {
  const { armarPlanCostos } = await import('./importarCatalogo.js');
  const catalogo = [
    { id: 1, codigoPropio: 'A', nombre: 'Normal', formatosCompra: [{ proveedorId: 9 }] },
    { id: 2, codigoPropio: 'B', nombre: 'En cero', formatosCompra: [{ proveedorId: 9 }] },
    { id: 3, codigoPropio: 'C', nombre: 'Salto x10', formatosCompra: [{ proveedorId: 9 }] },
    { id: 4, codigoPropio: 'D', nombre: 'Baja a la décima', formatosCompra: [{ proveedorId: 9 }] },
  ];
  const f = (c, p) => ({ Codigo: c, PrecioLista: String(p), Cantidad: '1', CostoFlete: '0' });
  const filas = [f('A', 110), f('B', 0), f('C', 1000), f('D', 10), f('ZZZ1010', 0), f('ZZZ9', 500)];
  const costoAnterior = () => 100;
  const plan = armarPlanCostos(filas, catalogo, 9, costoAnterior);
  assert.deepEqual(plan.items.map((i) => i.codigoPropio), ['A'], 'solo entra el normal (100 → 110)');
  const est = Object.fromEntries(plan.filas.map((x) => [x.codigo, x.estado]));
  assert.equal(est.B, 'sin_costo', 'costo $0 no pisa el costo real');
  assert.equal(est.C, 'salto', '100 → 1000 es un salto');
  assert.equal(est.D, 'salto', '100 → 10 también');
  assert.equal(est.ZZZ1010, 'no_encontrado');
  assert.equal(plan.resumen.noSeImportan, 5);
  const conSaltos = armarPlanCostos(filas, catalogo, 9, costoAnterior, { incluirSaltos: true });
  assert.deepEqual(conSaltos.items.map((i) => i.codigoPropio).sort(), ['A', 'C', 'D'], 'tildando, los saltos entran; el $0 nunca');
});
