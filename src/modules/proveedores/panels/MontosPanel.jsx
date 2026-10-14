import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { csvNum, descargarCsv } from '@shared/utils/csv.js';
import { useResource } from '../hooks/useResource.js';
import { provApi } from '../services/proveedores.api.js';
import { analizarMontos } from '../domain/montos.js';
import { Btn, PanelHead, Pill, Stat, Table, money, num, s } from '../components/ui.jsx';

/**
 * PROVEEDORES › MONTOS (14/10/2026, pedido del dueño): la plata en mercadería de
 * cada proveedor, a costo de hoy y sin IVA — la MISMA cuenta que Gerencia ›
 * Métricas › Stock. Cada producto cuenta en el proveedor que fija su precio.
 * La sucursal y el período de ventas piden de nuevo; el resto de los filtros
 * se recalcula en pantalla (ver `domain/montos.js`).
 */
const FILTROS = { tipo: '', categoriaId: '', marcaId: '', soloLocales: false, buscar: '' };
const ORDENES = {
  valor: { label: 'Más plata', cmp: (a, b) => b.valor - a.valor },
  articulos: { label: 'Más artículos', cmp: (a, b) => b.articulos - a.articulos || b.valor - a.valor },
  dias: { label: 'Más días de stock', cmp: (a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity) || b.valor - a.valor },
  parado: { label: 'Más plata parada', cmp: (a, b) => b.parado - a.parado || b.valor - a.valor },
  nombre: { label: 'Nombre', cmp: (a, b) => a.nombre.localeCompare(b.nombre, 'es') },
};
const MUESTRA = 50;
const pct = (n) => `${num(n, n >= 10 || n === 0 ? 0 : 1)} %`;
const diasTxt = (d) => (d == null ? 'sin ventas' : `${num(d, 0)} días`);

export function MontosPanel() {
  const [suc, setSuc] = useState('');
  const [ventana, setVentana] = useState(30);
  const [f, setF] = useState(FILTROS);
  const [orden, setOrden] = useState('valor');
  const [abierto, setAbierto] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const abrir = (clave) => { setAbierto(abierto === clave ? null : clave); setVerTodos(false); };
  const { data, loading, error } = useResource(
    `prov-montos:${suc}:${ventana}`,
    () => provApi.montos({ sucursalId: suc || undefined, ventana }),
  );
  const analisis = useMemo(() => analizarMontos(data, f), [data, f]);
  const filas = useMemo(() => (analisis ? [...analisis.proveedores].sort(ORDENES[orden].cmp) : []), [analisis, orden]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const hayFiltro = JSON.stringify(f) !== JSON.stringify(FILTROS);
  const r = analisis?.resumen;
  const nombreSuc = data?.sucursalId == null ? 'todas las sucursales' : (data?.sucursales ?? []).find((x) => x.id === data.sucursalId)?.nombre ?? '';

  const exportar = () => descargarCsv(
    `montos-proveedores-${data?.hoy ?? ''}.csv`,
    ['Proveedor', 'Local', 'Plata', '% del total', '% acumulado', 'Artículos', 'Enteros (art.)', 'Unidades', 'Plata enteros',
      'Granel (art.)', 'Kg', 'Plata granel', 'Días de stock', 'Plata parada', 'Sin costo'],
    filas.map((g) => [
      g.nombre, g.esLocal ? 'Sí' : '', csvNum(g.valor), csvNum(g.pct, 2), csvNum(g.pctAcumulado, 2), g.articulos,
      g.enteros.articulos, csvNum(g.enteros.unidades, 0), csvNum(g.enteros.valor), g.granel.articulos, csvNum(g.granel.kg, 3),
      csvNum(g.granel.valor), g.dias == null ? '' : Math.round(g.dias), csvNum(g.parado), g.sinCosto,
    ]),
  );

  return (
    <div>
      <PanelHead
        title="Montos"
        desc={`La plata en mercadería de cada proveedor, a costo de hoy y sin IVA (la misma cuenta que Gerencia › Métricas › Stock), en ${nombreSuc || '…'}. Cada producto cuenta en el proveedor que fija su precio.`}
        actions={<Btn onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>}
      />

      <div className={s.toolbar} style={{ marginBottom: 12 }}>
        <select id="montos-sucursal" className={s['select-inline']} value={suc || String(data?.sucursalId ?? '')} onChange={(e) => { setSuc(e.target.value); setAbierto(null); }} aria-label="Sucursal">
          {(data?.sucursales ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          <option value="todas">Todas las sucursales</option>
        </select>
        <select id="montos-ventana" className={s['select-inline']} value={ventana} onChange={(e) => setVentana(Number(e.target.value))} aria-label="Período de ventas" title="Para los días de stock y la plata parada">
          {[30, 60, 90].map((d) => <option key={d} value={d}>Ventas de los últimos {d} días</option>)}
        </select>
        <select id="montos-tipo" className={s['select-inline']} value={f.tipo} onChange={set('tipo')} aria-label="Tipo">
          <option value="">Enteros y granel</option>
          <option value="entero">Solo enteros</option>
          <option value="granel">Solo granel</option>
        </select>
        <select id="montos-categoria" className={s['select-inline']} value={f.categoriaId} onChange={set('categoriaId')} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {(data?.categorias ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select id="montos-marca" className={s['select-inline']} value={f.marcaId} onChange={set('marcaId')} aria-label="Marca">
          <option value="">Todas las marcas</option>
          {(data?.marcas ?? []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <input id="montos-buscar" type="search" placeholder="Buscar proveedor…" value={f.buscar} onChange={set('buscar')} />
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <input id="montos-locales" type="checkbox" checked={f.soloLocales} onChange={set('soloLocales')} />
          Solo proveedores locales
        </label>
        <select id="montos-orden" className={s['select-inline']} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
          {Object.entries(ORDENES).map(([k, o]) => <option key={k} value={k}>Ordenar: {o.label}</option>)}
        </select>
        {hayFiltro && <Btn small onClick={() => setF(FILTROS)}>Limpiar filtros</Btn>}
      </div>

      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      {r && (
        <div className={s.stats} style={{ opacity: loading ? 0.6 : 1 }}>
          <Stat label="Plata en mercadería" value={money(r.valor)} nota="a costo de hoy, sin IVA" />
          <Stat label="Artículos con stock" value={num(r.articulos, 0)} nota={`${num(r.enteros.articulos, 0)} enteros · ${num(r.granel.articulos, 0)} a granel`} />
          <Stat label="Enteros" value={`${num(r.enteros.unidades, 0)} u.`} nota={money(r.enteros.valor)} />
          <Stat label="A granel" value={`${num(r.granel.kg, 1)} kg`} nota={money(r.granel.valor)} />
          <Stat label="Proveedores" value={num(r.proveedores, 0)} nota={r.proveedores ? `${r.pareto80} juntan el 80 % de la plata` : ''} />
          <Stat
            label="Plata parada" value={money(r.parado)} accent={r.parado > 0 ? 'accent-amber' : undefined}
            nota={r.valor > 0 ? `${pct((r.parado / r.valor) * 100)} sin ventas en ${data.ventana} días` : ''}
          />
          <Stat label="Días de stock" value={r.dias == null ? '—' : num(r.dias, 0)} nota={`al ritmo de venta de los últimos ${data.ventana} días`} />
          {r.sinCosto > 0 && <Stat label="Sin costo cargado" value={num(r.sinCosto, 0)} accent="accent-red" nota="artículos con stock que no suman plata" />}
        </div>
      )}

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Plata', num: true }, { h: '% del total', num: true }, { h: 'Artículos', num: true },
          { h: 'Enteros', num: true }, { h: 'A granel', num: true }, { h: 'Días de stock', num: true }, { h: 'Parado', num: true },
        ]}
        empty={loading ? 'Calculando…' : 'Ningún proveedor con stock con esos filtros.'}
      >
        {filas.flatMap((g) => {
          const clave = g.id ?? 0;
          const fila = (
            <tr key={clave} className={s.clickable} onClick={() => abrir(clave)} title="Ver sus artículos">
              <td>
                {abierto === clave ? '▾ ' : '▸ '}<strong>{g.nombre}</strong>
                {g.esLocal && <> <Pill pill="est-recibida" label="local" /></>}
                {g.pareto && orden === 'valor' && <> <Pill label="80 %" /></>}
                {g.sinCosto > 0 && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>{g.sinCosto} artículo(s) sin costo cargado</div>}
              </td>
              <td className={s.num}>
                <strong>{money(g.valor)}</strong>
                <div style={{ height: 4, marginTop: 4, borderRadius: 2, background: 'var(--crm-color-border)' }}>
                  <div style={{ height: 4, width: `${Math.min(100, g.pct)}%`, borderRadius: 2, background: 'var(--crm-color-primary)' }} />
                </div>
              </td>
              <td className={s.num}>
                {pct(g.pct)}
                <div className={s.hint} style={{ margin: 0 }}>acum. {pct(g.pctAcumulado)}</div>
              </td>
              <td className={s.num}>{num(g.articulos, 0)}</td>
              <td className={s.num}>
                {g.enteros.articulos ? <>{num(g.enteros.unidades, 0)} u.<div className={s.hint} style={{ margin: 0 }}>{g.enteros.articulos} art. · {money(g.enteros.valor)}</div></> : '—'}
              </td>
              <td className={s.num}>
                {g.granel.articulos ? <>{num(g.granel.kg, 1)} kg<div className={s.hint} style={{ margin: 0 }}>{g.granel.articulos} art. · {money(g.granel.valor)}</div></> : '—'}
              </td>
              <td className={s.num}>{diasTxt(g.dias)}</td>
              <td className={s.num}>
                {g.parado > 0 ? <>{money(g.parado)}<div className={s.hint} style={{ margin: 0 }}>{pct((g.parado / g.valor) * 100)}</div></> : '—'}
              </td>
            </tr>
          );
          if (abierto !== clave) return [fila];
          return [fila, (
            <tr key={`${clave}-items`}>
              <td colSpan={8} style={{ background: 'var(--crm-color-surface-2)' }}>
                <table className={s.table} style={{ width: '100%' }}>
                  <thead>
                    <tr><th>Artículo</th><th className={s.num}>Stock</th><th className={s.num}>Plata</th><th className={s.num}>% del proveedor</th><th className={s.num}>Días de stock</th></tr>
                  </thead>
                  <tbody>
                    {(verTodos ? g.items : g.items.slice(0, MUESTRA)).map((x) => (
                      <tr key={x.id}>
                        <td>{x.nombre}{x.parado && <> <Pill pill="est-pendiente" label="sin ventas" /></>}{x.sinCosto && <> <Pill pill="est-cancelada" label="sin costo" /></>}</td>
                        <td className={s.num}>{num(x.stock, x.tipo === 'granel' ? 1 : 0)} {x.tipo === 'granel' ? 'kg' : 'u.'}</td>
                        <td className={s.num}>{money(x.valor)}</td>
                        <td className={s.num}>{g.valor > 0 ? pct((x.valor / g.valor) * 100) : '—'}</td>
                        <td className={s.num}>{diasTxt(x.costoDia > 0 ? x.valor / x.costoDia : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!verTodos && g.items.length > MUESTRA && (
                  <Btn small onClick={() => setVerTodos(true)}>Ver los {g.items.length - MUESTRA} restantes (con menos plata)</Btn>
                )}
              </td>
            </tr>
          )];
        })}
      </Table>
      <div className={s.hint}>
        <strong>Cómo leerlo:</strong> «80 %» marca los proveedores que juntan el 80 % de la plata (donde conviene mirar primero).
        <strong> Días de stock</strong>: cuántos días de venta cubre esa plata, al ritmo del período elegido.
        <strong> Parado</strong>: la plata en artículos que no se vendieron en ese período.
        Lo de uso exclusivo de Coffit no se cuenta: su costo ya se le cargó a ella.
      </div>
    </div>
  );
}
