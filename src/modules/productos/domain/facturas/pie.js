/**
 * EL PIE DE CUALQUIER FACTURA, por sus etiquetas (28/9/2026)
 * ============================================================================
 * Para lo que no tiene receta propia (lector automático y estructuras del
 * asistente). Se busca por PALABRA, no por posición: "Subtotal", "Bonif.",
 * "IVA 21%", "Percep. IIBB", "Total". El número que va es el primero que sigue
 * a la etiqueta en la misma línea — así funciona también cuando el proveedor
 * imprime todo el pie en un solo renglón ("Subtotal: 722.859,28 … Total: 874.659,73").
 *
 * Y el CONTROL: la suma de los renglones tiene que dar el subtotal del papel
 * (o, sin subtotal, reconstruir el total). Si no cierra, la lectura no se da
 * por buena: la persona lo ve y decide.
 */
import { clave, r2 } from './texto.js';
import { tokensDeLinea } from './tokens.js';

const ETIQUETAS = [
  ['subtotal', /^SUBTOTAL/],
  ['bonif', /^(BONIF|DESCUENTO|DTO)/],
  ['iva', /^IVA/],
  ['perc', /^(PERC|IIBB|INGRESOSBRUTOS|RET)/],
  ['total', /^(TOTAL|IMPORTETOTAL)$/],
];

/** El pie, leído de la ÚLTIMA página (en las anteriores suele haber subtotales parciales). */
export function leerPieGenerico(lineas) {
  const pie = {
    bruto: null, bonifPct: null, bonifImporte: null, neto: null,
    ivaAlicuota: null, ivaImporte: null, percepciones: [], total: null,
  };
  const ultima = lineas.reduce((a, l) => Math.max(a, l.pagina), 1);
  const subtotales = [];
  const ivas = [];
  for (const l of lineas) {
    if (l.pagina !== ultima) continue;
    const toks = tokensDeLinea(l);
    for (let i = 0; i < toks.length; i += 1) {
      if (toks[i].num != null) continue;
      const k = clave(toks[i].s);
      const tipo = ETIQUETAS.find(([, re]) => re.test(k))?.[0];
      if (!tipo) continue;
      // El valor: el primer número que sigue (los % son alícuotas, no importes).
      let pct = null;
      let valor = null;
      let j = i + 1;
      for (; j < toks.length; j += 1) {
        const t = toks[j];
        if (t.num == null) {
          if (ETIQUETAS.some(([, re]) => re.test(clave(t.s)))) break; // empieza otra etiqueta
          continue;
        }
        if (t.pct) { pct = t.num; continue; }
        valor = t.num;
        break;
      }
      if (tipo === 'iva' && pct == null) {
        const m = /(\d+(?:[.,]\d+)?)/.exec(k.replace(/^IVA/, ''));
        if (m) pct = Number(m[1].replace(',', '.'));
      }
      if (valor == null) continue;
      if (tipo === 'subtotal') subtotales.push(valor);
      else if (tipo === 'bonif') { pie.bonifImporte = valor; pie.bonifPct = pct; }
      else if (tipo === 'iva') ivas.push({ alicuota: pct, importe: valor });
      else if (tipo === 'perc' && valor > 0) pie.percepciones.push({ nombre: toks.slice(i, j).map((t) => t.s).join(' ').replace(/:$/, ''), alicuota: pct, importe: valor });
      else if (tipo === 'total') pie.total = valor;
      i = j;
    }
  }
  if (subtotales.length) {
    pie.bruto = subtotales[0];
    pie.neto = subtotales.length > 1 ? subtotales[subtotales.length - 1] : (pie.bonifImporte ? r2(subtotales[0] - pie.bonifImporte) : subtotales[0]);
  }
  if (ivas.length) {
    pie.ivaImporte = r2(ivas.reduce((a, x) => a + x.importe, 0));
    pie.ivaAlicuota = [...ivas].sort((a, b) => b.importe - a.importe)[0].alicuota;
  }
  return pie;
}

/**
 * ¿Los renglones leídos cierran con el papel? Contra el subtotal si está; si
 * no, reconstruyendo el total (neto − bonificación + IVA + percepciones).
 * Tolerancia de un centavo por renglón: el proveedor redondea línea por línea.
 */
export function controlDeSuma(renglones, pie) {
  const suma = r2(renglones.reduce((a, x) => a + (Number(x.importe) || 0), 0));
  const tol = 0.011 * renglones.length + 0.02;
  if (!renglones.length) return { cierra: false, suma, contra: null, papel: null };
  if (pie?.bruto != null) {
    return { cierra: Math.abs(suma - pie.bruto) <= tol, suma, contra: 'subtotal', papel: pie.bruto };
  }
  if (pie?.total != null) {
    const perc = (pie.percepciones || []).reduce((a, p) => a + p.importe, 0);
    const recon = r2(suma - (pie.bonifImporte || 0) + (pie.ivaImporte || 0) + perc);
    return { cierra: Math.abs(recon - pie.total) <= tol + 0.05, suma: recon, contra: 'total', papel: pie.total };
  }
  return { cierra: false, suma, contra: null, papel: null };
}
