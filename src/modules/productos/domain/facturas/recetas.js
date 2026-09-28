/**
 * RECETAS DE LECTURA — una por FORMATO de factura (28/9/2026, en el navegador)
 * ============================================================================
 * Una receta sabe leer el layout de un formato: dónde están los renglones,
 * cómo viene el pie, qué mugre trae el texto. El formato se le ASIGNA al
 * proveedor (`proveedores.formato_factura`): muchos proveedores facturan con
 * el mismo sistema (Tango, por ejemplo), y una receta armada una vez sirve
 * para todos ellos sin tocar nada más.
 *
 * El contrato: la receta NO adivina. Lo que no matchea un patrón queda afuera
 * y el control de suma lo delata (Σ renglones tiene que dar el subtotal del
 * papel); el total leído se compara además con el del QR de la factura.
 *
 * Portada tal cual de `crm-api/src/facturas/recetas.ts` (la de Bavosi), que es
 * donde vivía mientras la lectura corría en el servidor.
 */
import { clave, numeroDe, nums, pegarNumeros, r2 } from './texto.js';

/* ------------------------- Tango (Bavosi) ------------------------- */

/**
 * El renglón de Tango, después de pegar los números partidos:
 *   codigo  descripcion [serie]  cantidad  precio+unidad  dto%  importe
 *   `10206 AJO GRANULADO x25 KGS. 1.00 9005.320KG 14.00 193,614.38`
 * La cantidad tiene 2 decimales y el precio 3: eso evita que un "2.840 KG"
 * dentro de la descripción se confunda con la cantidad.
 */
const RE_RENGLON_TANGO = /^(\d{4,6}) (.+?) (\d+\.\d{2}) (\d+\.\d{3})([A-Z]{2,4}\.?) (\d+\.\d{2}) ([\d,]+\.\d{2})$/;
/** Serie/lote de Bavosi al final de la descripción ("01IC04059757E"), con los espacios que mete el PDF. */
const RE_SERIE = /\s+\d{0,2}\s?I\s?C\s?\d[\d\s]{5,}[A-Z]?$/;

function leerTango(lineas) {
  const avisos = [];
  const enc = { tipoArca: null, puntoVenta: null, numero: null, fecha: null, cae: null, vencimiento: null };
  const pie = {
    bruto: null, bonifPct: null, bonifImporte: null, neto: null,
    ivaAlicuota: null, ivaImporte: null, percepciones: [], total: null,
  };
  const renglones = [];
  const ultima = lineas.reduce((a, l) => Math.max(a, l.pagina), 1);

  for (const l of lineas) {
    const t = pegarNumeros(l.texto);
    const k = clave(t);

    /* Encabezado: está en todas las páginas, se toma la primera vez. */
    if (enc.numero == null && k.includes('CODIGO')) {
      const m = t.match(/(\d{1,3}) (\d{4,5})-(\d{7,8})(?: |$)/);
      if (m) {
        enc.tipoArca = Number(m[1]);
        enc.puntoVenta = m[2];
        enc.numero = Number(m[3]);
      }
    }
    if (!enc.fecha) {
      const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) enc.fecha = `${m[3]}-${m[2]}-${m[1]}`;
    }
    if (!enc.cae) {
      const m = t.match(/CAE:?\s*(\d{14})/);
      if (m) enc.cae = m[1];
    }
    if (!enc.vencimiento && k.includes('DIAS')) {
      const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) enc.vencimiento = `${m[3]}-${m[2]}-${m[1]}`;
    }

    /* Renglones: en cualquier página. */
    const r = t.match(RE_RENGLON_TANGO);
    if (r) {
      renglones.push({
        codigo: r[1],
        descripcion: r[2].replace(RE_SERIE, '').trim(),
        cantidad: numeroDe(r[3]) ?? 0,
        precioUnit: numeroDe(r[4]),
        unidad: r[5].replace(/\.$/, ''),
        dto: numeroDe(r[6]) ?? 0,
        importe: numeroDe(r[7]) ?? 0,
      });
      continue;
    }

    /* El pie: SOLO la última página (la primera trae un subtotal PARCIAL). */
    if (l.pagina !== ultima) continue;
    if (/^SUBTOTAL\s*:/i.test(t)) {
      pie.neto = nums(t).pop() ?? null;
    } else if (/^SUBTOTAL/i.test(t)) {
      pie.bruto = nums(t).pop() ?? null;
    } else if (k.startsWith('BONIF')) {
      const n = nums(t);
      pie.bonifPct = n[0] ?? null;
      pie.bonifImporte = n.length > 1 ? n[n.length - 1] : null;
    } else if (k.startsWith('PERC')) {
      const imp = nums(t).pop();
      const ali = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (imp != null) {
        pie.percepciones.push({
          nombre: t.replace(/\s*\d+(?:[.,]\d+)?\s*%.*$/, '').trim(),
          alicuota: ali ? numeroDe(ali[1]) : null,
          importe: imp,
        });
      }
    } else if (k.startsWith('IVA') && t.includes('%')) {
      const n = nums(t);
      pie.ivaAlicuota = n[0] ?? null;
      pie.ivaImporte = n.length > 1 ? n[n.length - 1] : null;
    } else if (/^TOTAL\s*:/i.test(t)) {
      pie.total = nums(t).pop() ?? null;
    }
  }

  /* Controles internos: el parse se delata solo. */
  if (!renglones.length) {
    avisos.push('No se reconoció ningún renglón con el patrón de este formato.');
  } else if (pie.bruto != null) {
    const suma = r2(renglones.reduce((a, x) => a + x.importe, 0));
    if (Math.abs(suma - pie.bruto) > 0.011 * renglones.length + 0.01) {
      avisos.push(`Los renglones leídos suman ${suma.toFixed(2)} y el subtotal del papel dice ${pie.bruto.toFixed(2)}: falta algún renglón o alguno se leyó mal.`);
    }
  }
  if (pie.bruto != null && pie.bonifImporte != null && pie.neto != null
    && Math.abs(pie.bruto - pie.bonifImporte - pie.neto) > 0.02) {
    avisos.push('El neto del papel no cierra con subtotal − bonificación: revisá el pie.');
  }
  if (pie.neto != null && pie.ivaImporte != null && pie.total != null) {
    const perc = pie.percepciones.reduce((a, p) => a + p.importe, 0);
    if (Math.abs(pie.neto + pie.ivaImporte + perc - pie.total) > 0.02) {
      avisos.push('El total del papel no cierra con neto + IVA + percepciones: revisá el pie.');
    }
  }
  return { encabezado: enc, renglones, pie, avisos };
}

/* ----------------------------- Registro ----------------------------- */

/**
 * Los formatos que el sistema sabe leer. `id` es lo que se guarda en el
 * proveedor; `nombre`, lo que se ve. Agregar un formato = una entrada acá
 * (se arma mirando una factura real del proveedor).
 */
export const FORMATOS = [
  { id: 'tango-bavosi', nombre: 'Tango (como Bavosi)', leer: leerTango },
];
const porId = new Map(FORMATOS.map((f) => [f.id, f]));

/** El formato de un proveedor, o null si todavía no tiene estructura. */
export const formatoDe = (proveedor) => porId.get(String(proveedor?.formatoFactura ?? '')) ?? null;
