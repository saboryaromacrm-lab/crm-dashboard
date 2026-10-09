/**
 * EXPORTAR EL ESTADO DE RESULTADOS (0152): a Excel (CSV con coma decimal, el
 * mismo formato de todo el ERP) y a PDF (la ventana de impresión, A4: «Guardar
 * como PDF»). Lo exportado es lo que se ve, con el detalle por rubro abierto.
 */
import { csvNum, descargarCsv } from '@shared/utils/csv.js';
import { esc, imprimirDocumento } from '@core/services/imprimir.js';
import { pct, pesos, renglones, sobreVentas } from './resultados.js';

const TODO_ABIERTO = new Set(['otrosVariables', 'otrosFijos', 'financieros']);

export function exportarCsv(nombre, datos, columnas) {
  const filas = renglones(columnas.map((c) => c.col), datos?.rubros ?? [], TODO_ABIERTO);
  const cab = ['Concepto', ...columnas.flatMap((c) => [c.titulo, `${c.titulo} (% de ventas)`])];
  const cuerpo = filas.map((f) => [
    `${f.detalle ? '   ' : ''}${f.sub ? f.texto.toUpperCase() : f.texto}`,
    ...f.valores.flatMap((v, i) => {
      const p = sobreVentas(v, columnas[i].col);
      return [v == null ? '' : csvNum(v), p == null ? '' : csvNum(p, 1)];
    }),
  ]);
  if (columnas.some((c) => Math.abs(c.col.retiros) > 0.004)) {
    cuerpo.push(['Retiros de los socios (aparte, a costo)', ...columnas.flatMap((c) => [csvNum(c.col.retiros), ''])]);
  }
  descargarCsv(nombre, cab, cuerpo);
}

export function imprimirEstado({ titulo, subtitulo, datos, columnas, avisos = [] }) {
  const filas = renglones(columnas.map((c) => c.col), datos?.rubros ?? [], TODO_ABIERTO);
  const td = (t, extra = '') => `<td style="padding:3px 6px;border-bottom:1px solid #ddd;${extra}">${t}</td>`;
  const num = 'text-align:right;white-space:nowrap';
  const cab = `<tr><th style="text-align:left;padding:3px 6px;border-bottom:2px solid #333">Concepto</th>${columnas
    .map((c) => `<th style="${num};padding:3px 6px;border-bottom:2px solid #333">${esc(c.titulo)}${c.sub ? `<br><span style="font-weight:400;font-size:10px">${esc(c.sub)}</span>` : ''}</th>`).join('')}</tr>`;
  const cuerpo = filas.map((f) => {
    const estilo = f.sub ? 'font-weight:700;border-top:2px solid #333;' : f.detalle ? 'color:#555;' : '';
    const celdas = f.valores.map((v, i) => {
      const p = sobreVentas(v, columnas[i].col);
      return td(`${esc(pesos(v))}${p != null && Math.abs(v) >= 0.005 && f.id !== 'ventasNetas' && f.id !== 'ventasLista' ? `<br><span style="font-size:10px;color:#666">${esc(pct(p))}</span>` : ''}`, num);
    }).join('');
    return `<tr style="${estilo}">${td(`${f.detalle ? '&nbsp;&nbsp;&nbsp;&nbsp;' : ''}${esc(f.texto)}`)}${celdas}</tr>`;
  }).join('');
  const retiros = columnas.some((c) => Math.abs(c.col.retiros) > 0.004)
    ? `<tr style="color:#555">${td('Retiros de los socios (aparte, mercadería a costo)')}${columnas.map((c) => td(esc(pesos(c.col.retiros)), num)).join('')}</tr>`
    : '';
  const notas = avisos.length
    ? `<div style="margin-top:10px;font-size:11px;color:#444">${avisos.map((a) => `· ${esc(a.texto)}`).join('<br>')}</div>`
    : '';
  const html = `
    <h2 style="margin:0 0 2px">${esc(titulo)}</h2>
    ${subtitulo ? `<div style="font-size:12px;margin-bottom:8px">${esc(subtitulo)}</div>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:11px"><thead>${cab}</thead><tbody>${cuerpo}${retiros}</tbody></table>
    <div style="margin-top:8px;font-size:11px">Todo en neto (sin IVA). El IVA es un resultado aparte. Ganancias: estimado, por lo acumulado del año.</div>
    ${notas}`;
  return imprimirDocumento('resultados', { titulo, cuerpo: html });
}
