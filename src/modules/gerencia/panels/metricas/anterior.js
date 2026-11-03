/**
 * EL ARCHIVO DEL SISTEMA ANTERIOR (0213, 3/11/2026): su «Estadística de ventas
 * por período», un renglón por mes. Se leen solo las columnas que se pueden
 * comparar con el ERP (ver crm-api src/metricas/anterior.ts); las unidades y
 * la participación quedan afuera.
 */
import { parseCsv } from '@modules/productos/domain/importarCatalogo.js';

const COLUMNAS = ['Periodo', 'DiasVenta', 'CantidadCPR', 'MontoFacturado', 'Costo'];

/** Los meses del archivo, o los errores que impiden subirlo. */
export function leerEstadistica(texto) {
  const { cols, filas } = parseCsv(texto);
  const faltan = COLUMNAS.filter((c) => !cols.includes(c));
  if (faltan.length) {
    return { meses: [], errores: [`No es la «Estadística de ventas por período» del sistema anterior: le falta ${faltan.join(', ')}.`] };
  }
  const errores = [];
  const meses = filas.map((f, i) => {
    const renglon = i + 2;
    const m = /^(\d{4})[/-](\d{1,2})$/.exec(f.Periodo);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) errores.push(`Renglón ${renglon}: el período «${f.Periodo}» no es un mes (va como 2026/07).`);
    const n = (col) => {
      const v = Number(f[col]);
      if (f[col] === '' || !Number.isFinite(v) || v < 0) errores.push(`Renglón ${renglon}: «${col}» no es un número.`);
      return v;
    };
    return {
      mes: m ? `${m[1]}-${m[2].padStart(2, '0')}` : '',
      diasVenta: Math.round(n('DiasVenta')),
      comprobantes: Math.round(n('CantidadCPR')),
      monto: n('MontoFacturado'),
      costo: n('Costo'),
    };
  });
  if (!meses.length) errores.push('El archivo no trae ningún mes.');
  return { meses, errores };
}

const normal = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** El local que nombra el archivo («… EXPRESS 1.csv»): el nombre más largo que aparece entero. */
export function localDelArchivo(nombreArchivo, sucursales) {
  const archivo = ` ${normal(nombreArchivo.replace(/\.csv$/i, ''))} `;
  return [...(sucursales ?? [])]
    .filter((x) => normal(x.nombre) && archivo.includes(` ${normal(x.nombre)} `))
    .sort((a, b) => normal(b.nombre).length - normal(a.nombre).length)[0] ?? null;
}
