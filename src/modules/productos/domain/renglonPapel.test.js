import test from 'node:test';
import assert from 'node:assert/strict';
import { bultoDelRenglon, cargaDelRenglon, nombreDelRenglon } from './renglonPapel.js';

test('Bracema: 1 bulto de 45 con precio por unidad entra como 1 bulto de 45 (no 45 de 45)', () => {
  const r = cargaDelRenglon({ cantidad: 45, costoPapel: 1426.14, bultosPapel: 1 }, { porBulto: 45, costoFormato: 0 });
  assert.deepEqual(r, { bultos: 1, porBulto: 45, costoBulto: 64176.3, modo: 'bulto', porUnidad: true });
});

test('sin columna de bultos, el precio parecido al costo por unidad del formato también convierte', () => {
  const r = cargaDelRenglon({ cantidad: 24, costoPapel: 1961.57 }, { porBulto: 24, costoFormato: 24 * 1800 });
  assert.equal(r.bultos, 1);
  assert.equal(r.costoBulto, +(1961.57 * 24).toFixed(4));
});

test('precio por bulto (parecido al costo del bulto) queda como siempre', () => {
  const r = cargaDelRenglon({ cantidad: 2, costoPapel: 12000 }, { porBulto: 12, costoFormato: 11500 });
  assert.deepEqual(r, { bultos: 2, porBulto: 12, costoBulto: 12000, modo: 'bulto', porUnidad: false });
});

test('unidades que no completan bultos: modo unidad, a precio por unidad', () => {
  const r = cargaDelRenglon({ cantidad: 30, costoPapel: 1426.14, bultosPapel: 1 }, { porBulto: 45 });
  assert.deepEqual(r, { bultos: 30, porBulto: 45, costoBulto: 1426.14, modo: 'unidad', porUnidad: true });
});

test('formato de 1, sin precio o sin cantidad: como siempre', () => {
  assert.equal(cargaDelRenglon({ cantidad: 10, costoPapel: 1448.8, bultosPapel: 0 }, { porBulto: 1 }).porUnidad, false);
  assert.equal(cargaDelRenglon({ cantidad: 10, costoPapel: 0, bultosPapel: 1 }, { porBulto: 45 }).porUnidad, false);
  assert.equal(cargaDelRenglon({ cantidad: 0, costoPapel: 100, bultosPapel: 1 }, { porBulto: 45 }).porUnidad, false);
});

test('bulto chico (2): sin columna de bultos no se adivina por el precio', () => {
  assert.equal(cargaDelRenglon({ cantidad: 4, costoPapel: 500 }, { porBulto: 2, costoFormato: 1000 }).porUnidad, false);
});

/* ---- bultoDelRenglon / nombreDelRenglon: el alta de un producto nuevo desde la factura (21/11/2026). Renglones reales de la bandeja. ---- */

test('Villares: 2 PACK a $13.632,30 que solo cierran con 12 por pack → bulto de 12 a $163.587,60', () => {
  const r = bultoDelRenglon({ cantidad: 2, costoBulto: 163587.6, precioUnitario: 13632.3, descripcion: 'AC. LA MASIA OLIVA EXTRA VIRGEN X 500 CC. (VIDRIO)' });
  assert.deepEqual(r, { bulto: 12, costo: 163587.6, por: 'importe' });
});

test('Villares granel: caja de castañas a $7.160,40 el kg que cierra con 22,68 kg → bulto de 22,68', () => {
  const r = bultoDelRenglon({ cantidad: 2, costoBulto: 162397.87, precioUnitario: 7160.4, descripcion: 'CAST.CAJU MOLIDA F-3 X 22,680 KG.' });
  assert.equal(r.bulto, 22.68);
  assert.equal(r.costo, 162397.87);
});

test('Bracema: 45 unidades en 1 bulto a $1.426,14 c/u → bulto de 45 a $64.176,30 (y la carga lo toma como 1 bulto)', () => {
  const r = bultoDelRenglon({ cantidad: 45, costoBulto: 1426.14, precioUnitario: 1426.14, bultosPapel: 1 });
  assert.deepEqual(r, { bulto: 45, costo: 64176.3, por: 'bultos' });
  const carga = cargaDelRenglon({ cantidad: 45, costoPapel: 1426.14, bultosPapel: 1 }, { porBulto: r.bulto, costoFormato: r.costo });
  assert.equal(carga.bultos, 1);
  assert.equal(carga.costoBulto, 64176.3);
});

test('el nombre dice el bulto: «560G X14U» y «Bulto x 72u.»; los tamaños (500 CC, 55g) no', () => {
  assert.deepEqual(bultoDelRenglon({ cantidad: 4, costoBulto: 40270.25, precioUnitario: 40270.25, descripcion: 'PAN RUSTICO TRADICIONAL 560G X14U - LA FRANCIA' }), { bulto: 14, costo: 40270.25, por: 'nombre' });
  assert.equal(bultoDelRenglon({ cantidad: 0.5, costoBulto: 55686.45, precioUnitario: 55686.45, descripcion: 'Alfajores Bañados En Chocolate X 55g - Bulto x 72u.' }).bulto, 72);
  assert.equal(bultoDelRenglon({ cantidad: 3, costoBulto: 900, precioUnitario: 900, descripcion: 'ACEITE X 500 CC' }).bulto, 1);
});

test('con el bulto propuesto, la carga del renglón queda igual que el papel (stock y plata)', () => {
  const r = bultoDelRenglon({ cantidad: 2, costoBulto: 163587.6, precioUnitario: 13632.3 });
  const carga = cargaDelRenglon({ cantidad: 2, costoPapel: 163587.6 }, { porBulto: r.bulto, costoFormato: r.costo });
  assert.deepEqual(carga, { bultos: 2, porBulto: 12, costoBulto: 163587.6, modo: 'bulto', porUnidad: false });
});

test('nombreDelRenglon saca lote y vencimiento, y deja lo demás', () => {
  assert.equal(nombreDelRenglon('AC. LA MASIA OLIVA EXTRA VIRGEN X 500 CC. (VIDRIO) - +IC04 113163 K BS.AS 11/06/2026'), 'AC. LA MASIA OLIVA EXTRA VIRGEN X 500 CC. (VIDRIO)');
  assert.equal(nombreDelRenglon('Alfajores de Pistacho Bañados x 50 grs - Bulto x 72u.'), 'Alfajores de Pistacho Bañados x 50 grs - Bulto x 72u.');
});
