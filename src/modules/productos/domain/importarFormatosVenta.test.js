/* Actualizar formatos de venta de un proveedor (28/9/2026). Lo que se prueba es
 * lo que decide qué precio de góndola cambia: a qué lista va cada renglón, qué
 * artículo es, y qué queda afuera. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  armarPlanFormatosVenta, buscarArticulo, cuerpoImportacion, filaDelArchivo, listasDelArchivo, resumenPorProveedor,
} from './importarFormatosVenta.js';

const CATALOGO = {
  modalidades: [{ id: 1, nombre: 'Minorista' }, { id: 2, nombre: 'Mayorista' }],
  listas: [
    { id: 49, modalidadId: 1, numero: 1, activa: true, etiqueta: 'Minorista 1' },
    { id: 50, modalidadId: 2, numero: 1, activa: true, etiqueta: 'Mayorista 1' },
  ],
};
const fila = (codigo, producto, canal, nro, extra = {}) => ({
  Codigo: codigo, Producto: producto, Canal: canal, NroLista: String(nro),
  Actualizacion__: 'MarkUp Definido', MarkUp__: '40.00 %', Cantidad: '1.00', PrecioTotal__: '1000.00', CodBar: '', ...extra,
});
const PRODUCTOS = [
  { id: 1, codigoPropio: '100', nombre: 'Aceite de Chia', estado: 'activo', listas: [{ listaId: 49, modoPrecio: 'markup', markup: 40, unidades: 1 }], formatosCompra: [{ proveedorId: 7 }] },
  { id: 2, codigoPropio: '200', nombre: 'Barra Merlin', estado: 'activo', listas: [], formatosCompra: [{ proveedorId: 7 }] },
  { id: 3, codigoPropio: 'ZZZ2133', nombre: 'Mix Coco Nuts', estado: 'activo', listas: [], formatosCompra: [{ proveedorId: 7 }],
    presentaciones: [{ id: 31, tamKg: 1, codigoBarras: '', listas: [] }, { id: 32, tamKg: 0.25, codigoBarras: '779000', listas: [] }] },
  { id: 4, codigoPropio: '400', nombre: 'De otro proveedor', estado: 'activo', listas: [], formatosCompra: [{ proveedorId: 9 }] },
];
const esDel7 = (p) => (p.formatosCompra || []).some((f) => f.proveedorId === 7);

test('listas: misma modalidad y número; la 2 mayorista es la Mayorista 1; lo que falta se crea', () => {
  const ls = listasDelArchivo([
    fila('1', 'x', 'Minorista', 1), fila('1', 'x', 'Distribucion/mayorista', 2),
    fila('1', 'x', 'Minorista', 10), fila('1', 'x', 'Distribucion/mayorista', 3), fila('1', 'x', 'Minorista', 10),
  ], CATALOGO);
  const d = Object.fromEntries(ls.map((l) => [l.clave, l.destino]));
  assert.deepEqual(d['Minorista|1'], { tipo: 'existente', listaId: 49 });
  assert.deepEqual(d['Distribucion/mayorista|2'], { tipo: 'existente', listaId: 50 });
  assert.equal(d['Minorista|10'].tipo, 'nueva');
  assert.equal(d['Minorista|10'].modalidadId, 1);
  assert.equal(d['Minorista|10'].numero, 10);
  assert.equal(d['Distribucion/mayorista|3'].modalidadId, 2);
  assert.equal(ls.find((l) => l.clave === 'Minorista|10').filas, 2);
});

test('fila del archivo: markup, precio definido (el total del formato) y la caja', () => {
  assert.deepEqual(filaDelArchivo(fila('1', 'x', 'Minorista', 1)), { modoPrecio: 'markup', markup: 40, precioFijo: 0, unidades: 1 });
  assert.deepEqual(
    filaDelArchivo(fila('1', 'x', 'Minorista', 6, { Actualizacion__: 'Precio Definido', PrecioTotal__: '1100.00' })),
    { modoPrecio: 'precio', markup: 0, precioFijo: 1100, unidades: 1 },
  );
  assert.equal(filaDelArchivo(fila('1', 'x', 'Distribucion/mayorista', 2, { Cantidad: '14.00' })).unidades, 14);
});

test('artículo: por código, y el paquete por su etiqueta o por nombre + tamaño', () => {
  assert.equal(buscarArticulo(fila('100', 'ACEITE DE CHIA', 'Minorista', 1), PRODUCTOS).prod.id, 1);
  const porBarras = buscarArticulo(fila('ZZZ2136', 'MIX COCO NUTS X250G', 'Minorista', 1, { CodBar: '779000' }), PRODUCTOS);
  assert.deepEqual([porBarras.prod.id, porBarras.pres.id], [3, 32]);
  const porNombre = buscarArticulo(fila('ZZZ2135', 'MIX COCO NUTS X1KG', 'Minorista', 1), PRODUCTOS);
  assert.deepEqual([porNombre.prod.id, porNombre.pres.id], [3, 31]);
  assert.equal(buscarArticulo(fila('ZZZ9', 'NADA X90G', 'Minorista', 1), PRODUCTOS), null);
});

test('plan: afuera lo de otro proveedor, la madre a $0 y lo que no existe; igual no viaja', () => {
  const archivo = [
    fila('100', 'ACEITE DE CHIA', 'Minorista', 1),                         // igual (40%)
    fila('100', 'ACEITE DE CHIA', 'Minorista', 10, { MarkUp__: '55.00 %' }), // lista nueva
    fila('200', 'BARRA MERLIN', 'Distribucion/mayorista', 2, { Cantidad: '14.00', MarkUp__: '25.00 %' }),
    fila('ZZZ2133', 'MIX COCO NUTS MADRE -SOLO STOCK-', 'Minorista', 1, { Actualizacion__: 'Precio Definido', PrecioTotal__: '0.00' }),
    fila('ZZZ2135', 'MIX COCO NUTS X1KG', 'Minorista', 1, { MarkUp__: '50.00 %' }),
    fila('400', 'DE OTRO', 'Minorista', 1),
    fila('999', 'NO EXISTE', 'Minorista', 1),
  ];
  const listas = listasDelArchivo(archivo, CATALOGO);
  const destinos = Object.fromEntries(listas.map((l) => [l.clave, l.destino]));
  const plan = armarPlanFormatosVenta(archivo, { productos: PRODUCTOS, destinos, esDelProveedor: esDel7 });
  assert.deepEqual(plan.resumen, { cambia: 0, agrega: 3, igual: 1, afuera: 3 });
  const motivos = plan.afuera.map((a) => `${a.codigo}: ${a.motivo}`).join('\n');
  assert.match(motivos, /ZZZ2133: producto madre con precio \$0/);
  assert.match(motivos, /400: en el CRM no tiene a este proveedor/);
  assert.match(motivos, /999: no hay en el CRM/);

  const cuerpo = cuerpoImportacion(plan, listas, 7);
  assert.equal(cuerpo.items.length, 3, 'el que queda igual no viaja');
  assert.deepEqual(cuerpo.listasNuevas.map((l) => [l.clave, l.modalidadId, l.numero]), [['Minorista|10', 1, 10]]);
  const merlin = cuerpo.items.find((i) => i.productoId === 2);
  assert.deepEqual([merlin.listaId, merlin.unidades, merlin.markup], [50, 14, 25]);
  const paquete = cuerpo.items.find((i) => i.presentacionId === 31);
  assert.equal(paquete.listaId, 49);
  assert.equal(cuerpo.items.find((i) => i.listaNueva).listaNueva, 'Minorista|10');
});

test('dos listas del archivo al mismo destino del CRM: la segunda queda afuera, no pisa', () => {
  const archivo = [
    fila('100', 'ACEITE DE CHIA', 'Minorista', 1, { MarkUp__: '45.00 %' }),
    fila('100', 'ACEITE DE CHIA', 'Minorista', 10, { MarkUp__: '55.00 %' }),
  ];
  const destinos = { 'Minorista|1': { tipo: 'existente', listaId: 49 }, 'Minorista|10': { tipo: 'existente', listaId: 49 } };
  const plan = armarPlanFormatosVenta(archivo, { productos: PRODUCTOS, destinos, esDelProveedor: esDel7 });
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].despues.markup, 45);
  assert.match(plan.afuera[0].motivo, /ya carga esta lista/);
});

/* ---------------- Archivo completo, todos los proveedores (29/9/2026) ---------------- */

test('choque: dos listas del archivo que caen en la misma del CRM — gana la de más renglones', () => {
  const archivo = [
    ...Array(5).fill(0).map(() => fila('1', 'x', 'Distribucion/mayorista', 2)),
    fila('1', 'x', 'Distribucion/mayorista', 1),
  ];
  const ls = listasDelArchivo(archivo, CATALOGO);
  const d = Object.fromEntries(ls.map((l) => [l.clave, l]));
  assert.deepEqual(d['Distribucion/mayorista|2'].destino, { tipo: 'existente', listaId: 50 });
  assert.equal(d['Distribucion/mayorista|1'].choque, true);
  assert.equal(d['Distribucion/mayorista|1'].destino.tipo, 'afuera');
  assert.match(d['Distribucion/mayorista|1'].destino.motivo, /misma lista/);
});

test('archivo completo: sin filtro de proveedor, agrupado por el proveedor del CRM y con exclusión', () => {
  const archivo = [
    fila('100', 'ACEITE DE CHIA', 'Minorista', 1, { MarkUp__: '45.00 %' }),
    fila('400', 'DE OTRO', 'Minorista', 1),
    fila('999', 'NO EXISTE', 'Minorista', 1),
  ];
  const destinos = Object.fromEntries(listasDelArchivo(archivo, CATALOGO).map((l) => [l.clave, l.destino]));
  const nombres = { 7: 'Biosalud', 9: 'Otro SA' };
  const plan = armarPlanFormatosVenta(archivo, {
    productos: PRODUCTOS, destinos, esDelProveedor: null,
    proveedorDe: (p) => ({ id: p.formatosCompra[0].proveedorId, nombre: nombres[p.formatosCompra[0].proveedorId] }),
  });
  assert.equal(plan.items.length, 2, 'entran los de cualquier proveedor');
  assert.deepEqual(resumenPorProveedor(plan).map((r) => [r.nombre, r.cambia + r.agrega]), [['Biosalud', 1], ['Otro SA', 1]]);
  const cuerpo = cuerpoImportacion(plan, listasDelArchivo(archivo, CATALOGO), null, { excluidos: new Set([9]) });
  assert.equal(cuerpo.todos, true);
  assert.equal(cuerpo.proveedorId, undefined);
  assert.deepEqual(cuerpo.items.map((i) => i.productoId), [1], 'el proveedor excluido no viaja');
});

test('índice: miles de renglones contra el catálogo en un instante', () => {
  const productos = Array.from({ length: 3000 }, (_, i) => ({
    id: i + 1, codigoPropio: `C${i}`, nombre: `Producto ${i}`, estado: 'activo', listas: [], formatosCompra: [{ proveedorId: 7 }],
  }));
  const archivo = Array.from({ length: 7000 }, (_, i) => fila(`C${i % 3500}`, 'x', 'Minorista', 1));
  const destinos = Object.fromEntries(listasDelArchivo(archivo, CATALOGO).map((l) => [l.clave, l.destino]));
  const t0 = Date.now();
  const plan = armarPlanFormatosVenta(archivo, { productos, destinos });
  assert.ok(Date.now() - t0 < 1500, `tardó ${Date.now() - t0} ms`);
  assert.equal(plan.items.length, 3000);
  assert.equal(buscarArticulo(fila('C10', 'x', 'Minorista', 1), productos).prod.id, 11, 'también acepta el catálogo directo');
});

