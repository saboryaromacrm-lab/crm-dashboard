import { useDeferredValue, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { csvNum, descargarCsv } from '@shared/utils/csv.js';
import { CONTRA, PRESETS, fechaLarga, haceCuanto, rangoContra, rangoDe } from '@modules/gerencia/panels/metricas/formato.js';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import {
  DIMENSIONES, FILTRABLES, MEDIDAS, ORDENES, analizarVariaciones, detalleGrupo, prepararVariaciones,
} from '../domain/variaciones.js';
import { Btn, PanelHead, Pill, Stat, Table, money, num, s, usePaginado } from '../components/ui.jsx';

/**
 * VENTAS › VARIACIONES (14/10/2026, pedido del dueño): cuánto subió o bajó lo
 * vendido entre dos períodos, en cantidad y en plata neta, por producto o
 * agrupado. Solo las fechas piden de nuevo; todo lo demás se recalcula en
 * pantalla (ver `domain/variaciones.js`). Sin costos ni margen.
 */
const FILTROS = Object.fromEntries(FILTRABLES.map((d) => [d, '']));
const ETIQUETA_FILTRO = {
  sucursal: 'Todas las sucursales', lista: 'Todas las listas', tipo: 'Enteros y granel', marca: 'Todas las marcas',
  categoria: 'Todas las categorías', subcategoria: 'Todas las subcategorías', etiqueta: 'Todas las etiquetas', proveedor: 'Todos los proveedores',
};
const PILL = { sube: 'est-recibida', nuevo: 'est-recibida', baja: 'st-defectuoso', dejo: 'st-defectuoso', igual: 'est-cancelada' };
const FLECHA = { sube: '▲ ', baja: '▼ ', dejo: '▼ ', igual: '' };
const MUESTRA = 50;

const conSigno = (n, txt) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${txt}`;
const pctTxt = (p) => conSigno(p, `${num(Math.abs(p), Math.abs(p) >= 10 ? 0 : 1)} %`);
const SUBE = new Set(['sube', 'nuevo']);
const BAJA = new Set(['baja', 'dejo']);
const acento = (v) => (SUBE.has(v?.estado) ? 'accent-green' : BAJA.has(v?.estado) ? 'accent-red' : undefined);
/** Cómo se escribe cada medida, y su diferencia con signo. */
const FMT = {
  plata: (n) => money(n),
  unidades: (n) => `${num(n, 0)} u.`,
  kilos: (n) => `${num(n, 2)} kg`,
};
const difTxt = (v, medida) => conSigno(v.dif, FMT[medida](Math.abs(v.dif)));
const COLUMNAS = { unidades: 'Unidades', kilos: 'Kilos', plata: 'Plata (sin IVA)' };

/** La variación de una medida, en % o en monto, con su color y su flecha. */
function Variacion({ v, medida, montos }) {
  if (!v) return null;
  if (v.estado === 'nuevo') return <Pill pill={PILL.nuevo} label={montos ? difTxt(v, medida) : 'nuevo'} />;
  const txt = montos ? difTxt(v, medida) : pctTxt(v.pct);
  return <Pill pill={PILL[v.estado]} label={`${FLECHA[v.estado]}${v.estado === 'dejo' && !montos ? 'dejó de venderse' : txt}`} />;
}

function Celda({ g, medida, montos }) {
  const m = MEDIDAS[medida];
  if (!g.v[medida]) return <td className={s.num}>—</td>;
  return (
    <td className={s.num}>
      <strong>{FMT[medida](g[m.a])}</strong>
      <div className={s.hint} style={{ margin: 0 }}>antes {FMT[medida](g[m.b])}</div>
      <Variacion v={g.v[medida]} medida={medida} montos={montos} />
    </td>
  );
}

export function VariacionesPanel() {
  const [preset, setPreset] = useState('7d');
  const [manual, setManual] = useState(() => rangoDe('7d'));
  const [contra, setContra] = useState('anterior');
  const [manualB, setManualB] = useState(() => rangoContra('anterior', ...rangoDe('7d')));
  const [verPor, setVerPor] = useState('producto');
  const [f, setF] = useState(FILTROS);
  const [buscar, setBuscar] = useState('');
  const [medida, setMedida] = useState('plata');
  const [orden, setOrden] = useState('sube');
  const [umbral, setUmbral] = useState(10);
  const [montos, setMontos] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const [verTodos, setVerTodos] = useState(false);

  const [desde, hasta] = preset === 'otro' ? manual : rangoDe(preset);
  const [bDesde, bHasta] = contra === 'otro' ? manualB : rangoContra(contra, desde, hasta);
  const { data, loading, error } = useResource(
    `variaciones:${desde}:${hasta}:${bDesde}:${bHasta}`,
    () => ventasApi.variaciones({ desde, hasta, bDesde, bHasta }),
  );
  const prep = useMemo(() => prepararVariaciones(data), [data]);
  const textoBuscado = useDeferredValue(buscar);
  const u = Number(umbral) || 0;
  const analisis = useMemo(
    () => analizarVariaciones(prep, { verPor, filtros: f, buscar: textoBuscado, medida, umbral: u, orden }),
    [prep, verPor, f, textoBuscado, medida, u, orden],
  );
  const grupos = analisis?.grupos ?? [];
  const r = analisis?.resumen;
  const pag = usePaginado(grupos, 'variaciones', `${verPor}|${JSON.stringify(f)}|${textoBuscado}|${medida}|${orden}|${desde}|${bDesde}`);

  const hayEnteros = !!r && Math.abs(r.ua) + Math.abs(r.ub) > 1e-6;
  const hayGranel = !!r && Math.abs(r.ka) + Math.abs(r.kb) > 1e-6;
  const columnas = [hayEnteros && 'unidades', hayGranel && 'kilos', 'plata'].filter(Boolean);
  const porProducto = verPor === 'producto';
  const hayFiltro = buscar || Object.values(f).some(Boolean);
  const abrir = (clave) => { setAbierto(abierto === clave ? null : clave); setVerTodos(false); };
  const setFiltro = (d) => (e) => { setF((x) => ({ ...x, [d]: e.target.value, ...(d === 'categoria' ? { subcategoria: '' } : {}) })); setAbierto(null); };
  const cambiarVerPor = (v) => { setVerPor(v); setAbierto(null); };

  const exportar = () => descargarCsv(
    `variaciones-${desde}-${hasta}.csv`,
    [DIMENSIONES[verPor].label, ...columnas.flatMap((c) => [`${COLUMNAS[c]} ahora`, `${COLUMNAS[c]} antes`, `${COLUMNAS[c]} diferencia`, `${COLUMNAS[c]} %`])],
    grupos.map((g) => [g.nombre, ...columnas.flatMap((c) => {
      const m = MEDIDAS[c]; const v = g.v[c]; const dec = c === 'plata' ? 2 : 3;
      return [csvNum(g[m.a], dec), csvNum(g[m.b], dec), csvNum(v?.dif ?? 0, dec), v?.pct == null ? (v?.estado === 'nuevo' ? 'nuevo' : '') : csvNum(v.pct, 1)];
    })]),
  );

  const filaDe = (g, clave, onClick) => (
    <tr key={clave} className={onClick ? s.clickable : undefined} onClick={onClick} title={onClick ? 'Ver sus productos' : undefined}>
      <td>
        {onClick && (abierto === g.clave ? '▾ ' : '▸ ')}<strong>{g.nombre}</strong>
        {g.producto && <div className={s.hint} style={{ margin: 0 }}>{[g.producto.granel ? 'granel' : null, prep.nombres.marcas?.[g.producto.marca], prep.nombres.categorias?.[g.producto.categoria]].filter(Boolean).join(' · ')}</div>}
        {g.items && <div className={s.hint} style={{ margin: 0 }}>{g.items.size} producto{g.items.size === 1 ? '' : 's'}</div>}
      </td>
      {columnas.map((c) => <Celda key={c} g={g} medida={c} montos={montos} />)}
    </tr>
  );

  return (
    <div>
      <PanelHead
        title="Variaciones"
        desc={`Lo vendido del ${fechaLarga(desde)} al ${fechaLarga(hasta)} contra el ${fechaLarga(bDesde)} al ${fechaLarga(bHasta)}: cuánto subió o bajó, en cantidad y en plata (neta, sin IVA). Mostrador y tienda; las devoluciones restan.`}
        actions={<Btn onClick={exportar} disabled={!grupos.length}>Exportar CSV</Btn>}
      />

      <div className={s.toolbar} style={{ marginBottom: 8 }}>
        <select id="var-periodo" className={s['select-inline']} value={preset} aria-label="Período"
          onChange={(e) => { if (e.target.value === 'otro') setManual([desde, hasta]); setPreset(e.target.value); }}>
          {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {preset === 'otro' && <>
          <input id="var-desde" type="date" value={manual[0]} max={manual[1]} onChange={(e) => setManual([e.target.value, manual[1]])} aria-label="Desde" />
          <input id="var-hasta" type="date" value={manual[1]} min={manual[0]} onChange={(e) => setManual([manual[0], e.target.value])} aria-label="Hasta" />
        </>}
        <select id="var-contra" className={s['select-inline']} value={contra} aria-label="Contra qué se compara"
          onChange={(e) => { if (e.target.value === 'otro') setManualB([bDesde, bHasta]); setContra(e.target.value); }}>
          {CONTRA.map(([k, l]) => <option key={k} value={k}>Contra: {l}</option>)}
        </select>
        {contra === 'otro' && <>
          <input id="var-b-desde" type="date" value={manualB[0]} max={manualB[1]} onChange={(e) => setManualB([e.target.value, manualB[1]])} aria-label="Antes: desde" />
          <input id="var-b-hasta" type="date" value={manualB[1]} min={manualB[0]} onChange={(e) => setManualB([manualB[0], e.target.value])} aria-label="Antes: hasta" />
        </>}
        <select id="var-ver-por" className={s['select-inline']} value={verPor} onChange={(e) => cambiarVerPor(e.target.value)} aria-label="Ver por">
          {Object.entries(DIMENSIONES).map(([k, d]) => <option key={k} value={k}>Ver por: {d.label}</option>)}
        </select>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <input id="var-montos" type="checkbox" checked={montos} onChange={(e) => setMontos(e.target.checked)} />
          Ver en montos
        </label>
      </div>

      <div className={s.toolbar} style={{ marginBottom: 12 }}>
        {FILTRABLES.map((d) => {
          const ops = analisis?.opciones[d] ?? [];
          if (d === 'subcategoria' && !f.categoria && !f.subcategoria) return null;
          return (
            <select key={d} id={`var-${d}`} className={s['select-inline']} value={f[d]} onChange={setFiltro(d)} aria-label={DIMENSIONES[d]?.label ?? 'Tipo'}>
              <option value="">{ETIQUETA_FILTRO[d]}</option>
              {ops.map((o) => <option key={o.valor} value={o.valor}>{o.nombre} ({o.n})</option>)}
            </select>
          );
        })}
        <input id="var-buscar" type="search" placeholder="Buscar producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        {hayFiltro && <Btn small onClick={() => { setF(FILTROS); setBuscar(''); }}>Limpiar filtros</Btn>}
      </div>

      <div className={s.toolbar} style={{ marginBottom: 12 }}>
        <select id="var-medida" className={s['select-inline']} value={medida} onChange={(e) => setMedida(e.target.value)} aria-label="Medir por">
          {Object.entries(MEDIDAS).map(([k, m]) => <option key={k} value={k}>Ordenar y contar por: {m.label}</option>)}
        </select>
        <select id="var-orden" className={s['select-inline']} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
          {Object.entries(ORDENES).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
        </select>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          Sin cambio entre ±
          <input id="var-umbral" type="number" min="0" max="100" step="1" value={umbral} onChange={(e) => setUmbral(e.target.value)} style={{ width: 56 }} aria-label="Umbral" />
          %
        </label>
        {data && (
          <span className={s.hint} style={{ margin: 0 }}>Datos {haceCuanto(data.actualizado)} · se actualizan cada 10 minutos</span>
        )}
      </div>

      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      {r && (
        <div className={s.stats} style={{ opacity: loading ? 0.6 : 1 }}>
          {columnas.map((c) => (
            <Stat
              key={c} label={c === 'plata' ? 'Plata vendida' : c === 'unidades' ? 'Unidades vendidas' : 'Kilos vendidos'}
              value={FMT[c](r[MEDIDAS[c].a])}
              accent={acento(r.v[c])}
              nota={r.v[c] ? `${r.v[c].pct == null ? 'antes no había' : pctTxt(r.v[c].pct)} · antes ${FMT[c](r[MEDIDAS[c].b])}` : ''}
            />
          ))}
          <Stat label="Subieron" value={num(r.sube + r.nuevo, 0)} accent={r.sube + r.nuevo ? 'accent-green' : undefined} nota={`más de +${u} %${r.nuevo ? ` · ${r.nuevo} nuevos` : ''}`} />
          <Stat label="Bajaron" value={num(r.baja + r.dejo, 0)} accent={r.baja + r.dejo ? 'accent-red' : undefined} nota={`más de −${u} %${r.dejo ? ` · ${r.dejo} dejaron de venderse` : ''}`} />
          <Stat label="Sin cambio" value={num(r.igual, 0)} nota={`entre −${u} % y +${u} %`} />
          {[['Lo que más subió', r.mayorSuba], ['Lo que más bajó', r.mayorBaja]].map(([label, g]) => (
            <Stat key={label} label={label} value={g ? g.nombre : '—'} nota={g ? `${difTxt(g.v[medida], medida)} en ${MEDIDAS[medida].label.toLowerCase()}` : ''} />
          ))}
        </div>
      )}

      <Table
        cols={[{ h: DIMENSIONES[verPor].label }, ...columnas.map((c) => ({ h: COLUMNAS[c], num: true }))]}
        empty={loading ? 'Calculando…' : 'No hay ventas con esos filtros en ninguno de los dos períodos.'}
        pag={pag}
      >
        {pag.visibles.flatMap((g) => {
          if (porProducto) return [filaDe(g, g.clave)];
          const fila = filaDe(g, g.clave, () => abrir(g.clave));
          if (abierto !== g.clave) return [fila];
          const items = detalleGrupo(g, { medida, umbral: u, orden });
          return [fila, (
            <tr key={`${g.clave}-items`}>
              <td colSpan={columnas.length + 1} style={{ background: 'var(--crm-color-surface-2)' }}>
                <table className={s.table} style={{ width: '100%' }}>
                  <thead><tr><th>Producto</th>{columnas.map((c) => <th key={c} className={s.num}>{COLUMNAS[c]}</th>)}</tr></thead>
                  <tbody>{(verTodos ? items : items.slice(0, MUESTRA)).map((x) => filaDe(x, x.clave))}</tbody>
                </table>
                {!verTodos && items.length > MUESTRA && <Btn small onClick={() => setVerTodos(true)}>Ver los {items.length - MUESTRA} restantes</Btn>}
              </td>
            </tr>
          )];
        })}
      </Table>
      <div className={s.hint}>
        <strong>Cómo leerlo:</strong> arriba lo de ahora, abajo «antes» y la variación: verde si subió más del umbral, rojo si bajó, gris si se mantuvo.
        <strong> Nuevo</strong>: antes no se vendía. La cantidad va en unidades (enteros) y en kilos (granel; un paquete de 500 g cuenta 0,5 kg), nunca mezcladas.
        Envíos a Coffit y retiros sin costo no son ventas y no cuentan.
      </div>
    </div>
  );
}
