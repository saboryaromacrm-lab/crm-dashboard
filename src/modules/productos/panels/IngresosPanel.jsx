/**
 * ALMACÉN › INGRESOS (24/11/2026, pedido del dueño: «esa parte de ingresos la quiero
 * dentro de Almacén, con su propia sección, bien por fila, colapsado»)
 * ============================================================================
 * El historial de los pedidos a proveedores ya recibidos (la pizarra de Proveedores ›
 * Pedidos los manda acá con «✓ Recibido»): cuándo se pidió, cuándo llegó y cuánto
 * tardó. Cada fila arranca PLEGADA, con el total de la orden; ▸ abre la nota entera.
 *
 * La cuenta la hace la API (`/pedidos-proveedor/recibidos`, llave `almacen.ingresos`),
 * paginada en el servidor: el historial crece para siempre.
 */
import { Fragment, useState } from 'react';
import { BuscadorOpcion } from '@shared/components/BuscadorOpcion.jsx';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { fmtFecha } from '../domain/format.js';
import { resumenNota } from '../domain/ingresos.js';
import { Table, Btn, PanelHead, Stat, usePaginadoServidor, s } from '../components/ui.jsx';
import { useProductos } from '../context/ProductosContext.jsx';

const PERIODOS = [['mes', 'Este mes'], ['semana', 'Última semana'], ['mes_ant', 'Mes anterior'], ['todos', 'Todos']];

export function IngresosPanel() {
  const { store } = useProductos();
  const [filtro, setFiltro] = useState('mes');
  const [proveedorId, setProveedorId] = useState('');
  const [buscar, setBuscar] = useState('');
  const [abiertas, setAbiertas] = useState(() => new Set());
  const alternar = (id) => setAbiertas((xs) => {
    const n = new Set(xs);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const firma = `${filtro}|${proveedorId}|${buscar.trim()}`;
  const [total, setTotal] = useState(0);
  const pag = usePaginadoServidor(total, 'almacenIngresos', firma);
  const params = new URLSearchParams({ filtro, page: String(pag.actual), limit: String(pag.limit) });
  if (proveedorId) params.set('proveedorId', proveedorId);
  if (buscar.trim()) params.set('buscar', buscar.trim());
  const { data, loading, error } = useResource(
    `almacen-ingresos:${params}`,
    () => httpClient.get(`/pedidos-proveedor/recibidos?${params}`).then((r) => { setTotal(r.total ?? 0); return r; }),
  );
  const filas = data?.filas ?? [];
  const proveedores = store.state.proveedores.filter((p) => p.proveeMercaderia !== false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>
      <PanelHead
        title="Ingresos"
        desc="Los pedidos a proveedores que ya llegaron: cuándo se pidió, cuándo se recibió y cuánto tardó. Tocá ▸ para ver la nota completa del pedido."
      />

      <div className={s.stats}>
        <Stat label="Recibidos este mes" value={data?.totalMes ?? 0} />
        <Stat label="Demora promedio" value={`${data?.promedioDias ?? 0} d`} nota="del pedido a la recepción" />
      </div>

      <div className={s.toolbar} style={{ margin: 0 }}>
        <select className={s['select-inline']} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Período">
          {PERIODOS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <BuscadorOpcion
          ariaLabel="Proveedor" opciones={proveedores} value={proveedorId} onChange={setProveedorId}
          todos="Todos los proveedores" placeholder="Escribí el proveedor…"
        />
        <input type="search" placeholder="Buscar en notas o proveedor…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Btn small disabled={!filas.length} onClick={() => setAbiertas(new Set(filas.map((f) => f.id)))}>Desplegar todas</Btn>
          <Btn small disabled={!abiertas.size} onClick={() => setAbiertas(new Set())}>Plegar todas</Btn>
        </div>
      </div>
      {error && <div className={s.callout}>{error}</div>}

      <Table
        cols={[{ h: '', cls: 'actions-col' }, { h: 'Proveedor' }, { h: 'Pedido' }, { h: 'Recibido' }, { h: 'Días', num: true }, { h: 'Qué trajo' }]}
        empty={loading ? 'Cargando…' : 'Sin ingresos en este filtro.'}
        pag={pag}
        movil="tabla"
      >
        {filas.map((f) => {
          const abierta = abiertas.has(f.id);
          return (
            <Fragment key={f.id}>
              <tr className={s.clickable} onClick={() => alternar(f.id)} aria-expanded={abierta}>
                <td className={s['actions-col']} style={{ width: 32, color: 'var(--crm-color-text-secondary)' }}>
                  <button
                    type="button" aria-label={abierta ? 'Plegar la nota' : 'Ver la nota completa'}
                    onClick={(e) => { e.stopPropagation(); alternar(f.id); }}
                    style={{ border: 0, background: 'none', cursor: 'pointer', font: 'inherit', fontSize: 15, color: 'inherit', padding: 4 }}
                  >
                    {abierta ? '▾' : '▸'}
                  </button>
                </td>
                <td><strong>{f.proveedorNombre}</strong></td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(f.fechaPedido)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(f.fechaRecepcion)}</td>
                <td className={s.num}>{f.dias ?? '—'}</td>
                <td className={s.hint} style={{ margin: 0 }}>{resumenNota(f.notas) || <span className={s.muted}>Sin nota</span>}</td>
              </tr>
              {abierta && (
                <tr>
                  <td />
                  <td colSpan={5} style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--crm-color-text-secondary)' }}>
                    {f.notas || 'Sin nota.'}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>
    </div>
  );
}
