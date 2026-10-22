/**
 * EL TEXTO DE LA IA, CON FORMATO (0193). La IA contesta en markdown simple:
 * párrafos, **negrita**, *cursiva*, listas, títulos y tablas. Se arma con
 * elementos de React (nunca HTML crudo): lo que escribió la IA no puede meter
 * nada en la página.
 */
import { Fragment } from 'react';
import { s } from '@modules/productos/components/ui.jsx';

/** Negrita y cursiva dentro de una línea. */
function enLinea(texto, clave) {
  const partes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let ult = 0; let m; let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ult) partes.push(texto.slice(ult, m.index));
    const t = m[0];
    if (t.startsWith('**')) partes.push(<strong key={`${clave}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) partes.push(<code key={`${clave}-${i++}`}>{t.slice(1, -1)}</code>);
    else partes.push(<em key={`${clave}-${i++}`}>{t.slice(1, -1)}</em>);
    ult = m.index + t.length;
  }
  if (ult < texto.length) partes.push(texto.slice(ult));
  return partes;
}

const celdas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const esSeparador = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

export function Markdown({ texto }) {
  const lineas = String(texto ?? '').replace(/\r/g, '').split('\n');
  const bloques = [];
  for (let i = 0; i < lineas.length;) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    /* Tabla: una fila de encabezado, la de guiones y las filas. */
    if (l.includes('|') && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      const cab = celdas(l); const filas = [];
      i += 2;
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) { filas.push(celdas(lineas[i])); i++; }
      const num = cab.map((_, k) => filas.length > 0 && filas.every((f) => /^[\s*~−+$-]*[\d.,]+\s*(%|kg|u\.?|días?)?[\s*]*$/.test(f[k] ?? '') || !(f[k] ?? '').trim()));
      bloques.push(
        <div key={`t${i}`} style={{ overflowX: 'auto' }}>
          <table className={s.table} style={{ fontSize: 13 }}>
            <thead><tr>{cab.map((c, k) => <th key={k} style={num[k] ? { textAlign: 'right' } : undefined}>{enLinea(c, `h${i}${k}`)}</th>)}</tr></thead>
            <tbody>{filas.map((f, r) => <tr key={r}>{cab.map((_, k) => <td key={k} style={num[k] ? { textAlign: 'right', whiteSpace: 'nowrap' } : undefined}>{enLinea(f[k] ?? '', `c${i}${r}${k}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    /* Lista (con guión, asterisco o número). */
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordenada = /^\s*\d+[.)]/.test(l); const items = [];
      while (i < lineas.length && /^\s*([-*•]|\d+[.)])\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        i++;
        /* Una línea que sigue al ítem sin marcador es parte del mismo. */
        while (i < lineas.length && lineas[i].trim() && /^\s{2,}\S/.test(lineas[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lineas[i])) { items[items.length - 1] += ` ${lineas[i].trim()}`; i++; }
      }
      const Lista = ordenada ? 'ol' : 'ul';
      bloques.push(<Lista key={`l${i}`} style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 4 }}>{items.map((x, k) => <li key={k}>{enLinea(x, `li${i}${k}`)}</li>)}</Lista>);
      continue;
    }
    const titulo = l.match(/^\s*#{1,6}\s+(.*)$/);
    if (titulo) { bloques.push(<div key={`h${i}`} style={{ fontWeight: 700, marginTop: 4 }}>{enLinea(titulo[1], `t${i}`)}</div>); i++; continue; }
    /* Párrafo: las líneas seguidas hasta un corte. */
    const par = [];
    while (i < lineas.length && lineas[i].trim() && !(lineas[i].includes('|') && i + 1 < lineas.length && esSeparador(lineas[i + 1]))
      && !/^\s*([-*•]|\d+[.)])\s+/.test(lineas[i]) && !/^\s*#{1,6}\s+/.test(lineas[i])) { par.push(lineas[i].trim()); i++; }
    bloques.push(<p key={`p${i}`} style={{ margin: 0 }}>{par.map((x, k) => <Fragment key={k}>{k > 0 && <br />}{enLinea(x, `p${i}${k}`)}</Fragment>)}</p>);
  }
  return <div style={{ display: 'grid', gap: 10, lineHeight: 1.5 }}>{bloques}</div>;
}
