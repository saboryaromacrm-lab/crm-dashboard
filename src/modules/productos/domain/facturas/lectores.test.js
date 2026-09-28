/* Lector automático, estructura del asistente y pie genérico (28/9/2026),
 * contra una factura REAL de Solfrut (solo la tabla de artículos y el pie, sin
 * datos del comprador). Otro formato que el de Tango: la descripción va
 * primero, la unidad entre los números y el código en la línea de abajo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokensDeLinea } from './tokens.js';
import { leerPieGenerico, controlDeSuma } from './pie.js';
import { leerAutomatico } from './automatico.js';
import { crearPlantilla, leerConPlantilla } from './plantilla.js';
import { fuenteDe } from './leerRenglones.js';

const SOLFRUT = [{"p":1,"y":544,"f":[[28,66.4,"Producto / Servicio"],[154,40.3,"Descripción"],[371,31,"Cantidad"],[407,24.5,"Unidad"],[451.7,51.3,"Precio Unitario"],[526.4,28.2,"Importe"]]},{"p":1,"y":524,"f":[[28,115.8,"Oliovita Aceto Tradicional BT 12x250-"],[388.4,13.6,"2.00"],[407,16.6,"Cajas"],[465.4,38.6,"29,639.3700"],[536.1,30.9,"59,278.74"]]},{"p":1,"y":515.6,"f":[[28,76.6,"OLAC02-7798061191500"]]},{"p":1,"y":491,"f":[[28,113.8,"Oliovita Aceto Reducción BT 12x250-"],[388.4,13.6,"2.00"],[407,16.6,"Cajas"],[465.4,38.6,"32,109.3100"],[536.1,30.9,"64,218.62"]]},{"p":1,"y":482.6,"f":[[28,84.9,"OLACER02-7798061191517"]]},{"p":1,"y":458,"f":[[28,107.2,"Oliovita Mediterraneo PET 12x500-"],[388.4,13.6,"1.00"],[407,16.6,"Cajas"],[465.4,38.6,"93,056.8400"],[536.1,30.9,"93,056.84"]]},{"p":1,"y":449.6,"f":[[28,74.6,"OLMED-7798061190596"]]},{"p":1,"y":425,"f":[[28,103.5,"Oliovita Mediterraneo BT 12x500-"],[388.4,13.6,"1.00"],[407,16.6,"Cajas"],[461.6,42.4,"107,247.8100"],[532.3,34.7,"107,247.81"]]},{"p":1,"y":416.6,"f":[[28,82.8,"OLMEDBT-7798061190756"]]},{"p":1,"y":392,"f":[[28,107.2,"Oliovita Mediterraneo PET 12x250-"],[388.4,13.6,"2.00"],[407,16.6,"Cajas"],[465.4,38.6,"61,520.5500"],[532.3,34.7,"123,041.10"]]},{"p":1,"y":383.6,"f":[[28,97.9,"OLMED250PET-7798061190671"]]},{"p":1,"y":359,"f":[[28,106.9,"Oliovita Clasico BT 12x500-OLC01-"],[388.4,13.6,"2.00"],[407,16.6,"Cajas"],[461.6,42.4,"107,247.8100"],[532.3,34.7,"214,495.62"]]},{"p":1,"y":350.6,"f":[[28,49.6,"7798061190183"]]},{"p":1,"y":326,"f":[[28,110.5,"Oliovita Clasico PET 12x250-OLC07-"],[388.4,13.6,"1.00"],[407,16.6,"Cajas"],[465.4,38.6,"61,520.5500"],[536.1,30.9,"61,520.55"]]},{"p":1,"y":317.6,"f":[[28,49.6,"7798061190664"]]},{"p":1,"y":288,"f":[[451.7,53.3,"IVA 21% VENTA:"],[532.3,34.7,"151,800.45"]]},{"p":1,"y":274,"f":[[421.9,83.1,"Percep. IIBB Buenos Aires:"],[553.4,13.6,"0.00"]]},{"p":1,"y":119,"f":[[28,31.8,"Subtotal:"],[77,39.7,"722,859.28"],[159,36.9,"Impuestos"],[223,39.7,"151,800.45"],[324,21.9,"Otros:"],[354,15.5,"0.00"],[453,20.5,"Total:"],[523.3,39.7,"874,659.73"]]}].map((l) => ({
  pagina: l.p, y: l.y, frags: l.f.map(([x, w, s]) => ({ x, w, s })), texto: l.f.map((f) => f[2]).join(' '),
}));

test('tokens: parte los fragmentos en palabras y NO pega números de columnas distintas', () => {
  const t = tokensDeLinea(SOLFRUT[1]);
  assert.deepEqual(t.map((x) => x.s), ['Oliovita', 'Aceto', 'Tradicional', 'BT', '12x250-', '2.00', 'Cajas', '29,639.3700', '59,278.74']);
  assert.deepEqual(t.filter((x) => x.num != null).map((x) => x.num), [2, 29639.37, 59278.74]);
  // Un número que el PDF partió en fragmentos pegados sí se une.
  const partido = tokensDeLinea({ frags: [{ x: 100, w: 20, s: '193,' }, { x: 121, w: 16, s: '614.' }, { x: 138, w: 10, s: '38' }] });
  assert.equal(partido.length, 1);
  assert.equal(partido[0].num, 193614.38);
});

test('pie genérico: subtotal, IVA y total aunque vengan en un solo renglón', () => {
  const pie = leerPieGenerico(SOLFRUT);
  assert.equal(pie.bruto, 722859.28);
  assert.equal(pie.ivaAlicuota, 21);
  assert.equal(pie.ivaImporte, 151800.45);
  assert.equal(pie.total, 874659.73);
  assert.deepEqual(pie.percepciones, [], 'una percepción en $0 no se toma');
});

test('lectura automática: los 7 renglones de Solfrut, con código de la línea de abajo, y cierra', () => {
  const r = leerAutomatico(SOLFRUT);
  assert.equal(r.renglones.length, 7);
  assert.deepEqual(r.renglones[0], {
    codigo: 'OLAC02-7798061191500', descripcion: 'Oliovita Aceto Tradicional BT 12x250',
    cantidad: 2, precioUnit: 29639.37, unidad: 'Cajas', dto: 0, importe: 59278.74,
  });
  assert.equal(r.control.cierra, true);
  assert.equal(r.control.suma, 722859.28);
  assert.deepEqual(r.avisos, []);
});

test('lectura automática: una línea donde la cuenta no cierra NO es un renglón', () => {
  const trucha = [{ pagina: 1, y: 1, frags: [{ x: 10, w: 60, s: 'ALGO RARO' }, { x: 300, w: 20, s: '3.00' }, { x: 400, w: 30, s: '100.00' }, { x: 500, w: 30, s: '999.99' }] }];
  assert.equal(leerAutomatico(trucha).renglones.length, 0);
  // Con descuento: 2 × 100 × (1 − 10%) = 180.
  const conDto = [{ pagina: 1, y: 1, frags: [{ x: 10, w: 60, s: 'A123 PRODUCTO' }, { x: 300, w: 20, s: '2.00' }, { x: 400, w: 30, s: '100.00' }, { x: 450, w: 20, s: '10.00' }, { x: 500, w: 30, s: '180.00' }] }];
  const r = leerAutomatico(conDto).renglones[0];
  assert.deepEqual([r.codigo, r.cantidad, r.precioUnit, r.dto, r.importe], ['A123', 2, 100, 10, 180]);
});

test('asistente: con UN renglón marcado se lee la factura entera igual que la automática', () => {
  const toks = tokensDeLinea(SOLFRUT[1]);
  const marcas = new Map([[0, 'descripcion'], [1, 'descripcion'], [2, 'descripcion'], [3, 'descripcion'], [4, 'descripcion'],
    [5, 'cantidad'], [6, 'unidad'], [7, 'precio'], [8, 'importe']]);
  const { plantilla, faltan } = crearPlantilla(toks, marcas, { codigoAbajo: true });
  assert.deepEqual(faltan, []);
  const p = leerConPlantilla(SOLFRUT, plantilla);
  const a = leerAutomatico(SOLFRUT);
  assert.equal(p.control.cierra, true);
  assert.deepEqual(p.renglones.map((x) => [x.codigo, x.cantidad, x.importe]), a.renglones.map((x) => [x.codigo, x.cantidad, x.importe]));
  // Sin lo obligatorio, avisa qué falta.
  assert.deepEqual(crearPlantilla(toks, new Map([[8, 'importe']])).faltan, ['descripcion', 'cantidad']);
});

test('control de suma: contra el subtotal, o reconstruyendo el total', () => {
  const r = [{ importe: 100 }, { importe: 50 }];
  assert.equal(controlDeSuma(r, { bruto: 150 }).cierra, true);
  assert.equal(controlDeSuma(r, { bruto: 160 }).cierra, false);
  assert.equal(controlDeSuma(r, { total: 181.5, ivaImporte: 31.5, percepciones: [] }).cierra, true);
  assert.equal(controlDeSuma([], { bruto: 0 }).cierra, false);
});

test('qué lectura usa cada proveedor', () => {
  assert.equal(fuenteDe({ formatoFactura: 'tango-bavosi' }), 'receta');
  assert.equal(fuenteDe({ formatoFactura: 'plantilla', plantillaFactura: { columnas: {} } }), 'plantilla');
  assert.equal(fuenteDe({ formatoFactura: 'plantilla', plantillaFactura: null }), 'automatico');
  assert.equal(fuenteDe({ formatoFactura: 'auto' }), 'automatico');
  assert.equal(fuenteDe({ formatoFactura: '' }), 'automatico');
});
