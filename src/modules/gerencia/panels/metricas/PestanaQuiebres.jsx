/**
 * MÉTRICAS › QUIEBRES DE STOCK (4/11/2026, pedido del dueño)
 * ============================================================================
 * «¿En alguna parte del ERP puedo ver quiebres de stock?» Lo de hoy (qué está
 * en 0 y desde cuándo) ya estaba en Existencias (Alt+F3). Esto es el período:
 * cuánto tiempo tuvo cada local la góndola completa, qué artículos se quedaron
 * sin stock, cuántas veces y cuántos días, y cuánto se dejó de vender.
 *
 * La cuenta la hace la API (`metricas/quiebres.ts`): acá se filtra y se agrupa.
 */
import { useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, Pill, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { fechaLarga, pctTxt } from './formato.js';
import { Aviso, Bloque, Cargando, Tile, Tiles } from './piezas.jsx';

const VISTAS = [['quiebre', 'Con quiebre'], ['final', 'Sin stock al final'], ['contar', 'Hay que contarlos']];
const fecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });
const dias = (v) => `${num(v, 1)} día${v === 1 ? '' : 's'}`;
const articulo = (x) => `${x.nombre}${x.presentacion ? ` · ${x.presentacion}` : ''}`;
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Por proveedor: los artículos con quiebre de cada uno, sus días y lo que se dejó de vender. */
function porProveedor(items) {
  const m = new Map();
  for (const x of items) {
    if (!x.diasSinStock) continue;
    const k = x.proveedorId ?? 0;
    const a = m.get(k) ?? { proveedorId: x.proveedorId, nombre: x.proveedor || 'Sin proveedor', articulos: 0, dias: 0, ventaPerdida: 0 };
    a.articulos += 1; a.dias += x.diasSinStock; a.ventaPerdida += x.ventaPerdida ?? 0;
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.ventaPerdida - a.ventaPerdida || b.dias - a.dias);
}

export function PestanaQuiebres({ qs, version }) {
  const { data: d, loading, error } = useResource(`metricas:quiebres:${qs}:${version}`, () => httpClient.get(`/metricas/quiebres?${qs}`));
  const [vista, setVista] = useState('quiebre');
  const [local, setLocal] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [buscar, setBuscar] = useState('');
  const [todosProv, setTodosProv] = useState(false);

  const items = useMemo(() => d?.items ?? [], [d]);
  const nombreLocal = useMemo(() => new Map((d?.sucursales ?? []).map((x) => [x.sucursalId, x.nombre])), [d]);
  const proveedores = useMemo(() => porProveedor(items), [items]);
  const visibles = useMemo(() => {
    const q = sinTildes(buscar.trim());
    return items.filter((x) => (vista === 'quiebre' ? x.diasSinStock > 0 : vista === 'final' ? x.sinStockDesde : x.diasDudosos > 0)
      && (!local || x.sucursalId === Number(local))
      && (proveedor === '' || String(x.proveedorId ?? 0) === proveedor)
      && (!q || sinTildes(`${articulo(x)} ${x.marca} ${x.proveedor} ${x.categoria}`).includes(q)));
  }, [items, vista, local, proveedor, buscar]);
  const pag = usePaginado(visibles, 'metricas-quiebres', `${qs}|${vista}|${local}|${proveedor}|${buscar}`);

  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  const t = d.totales;
  if (!t) return <Aviso>No hay movimientos de stock en el período elegido.</Aviso>;
  const recortado = d.desdeEfectivo && d.desdeEfectivo.slice(0, 10) > d.desde;
  const alFinal = d.llegaAHoy ? 'Hoy sin stock' : 'Sin stock al final';

  const exportar = () => descargarCsv(`quiebres-${d.desde}-a-${d.hasta}.csv`,
    ['Producto', 'Presentación', 'Marca', 'Categoría', 'Proveedor', 'Local', 'Veces', 'Venía sin stock', 'Días sin stock',
      'Días en 0 vendiendo (contar)', alFinal, 'Vende por día', 'Unidad', 'Unidades perdidas', 'Venta perdida (neta)'],
    visibles.map((x) => [
      x.nombre, x.presentacion ?? '', x.marca, x.categoria, x.proveedor, nombreLocal.get(x.sucursalId) ?? '', x.veces, x.venia ? 'sí' : '',
      csvNum(x.diasSinStock, 1), csvNum(x.diasDudosos, 1), x.sinStockDesde ? fecha(x.sinStockDesde) : '',
      x.ventaPorDia == null ? '' : csvNum(x.ventaPorDia, 3), x.unidad,
      x.unidadesPerdidas == null ? '' : csvNum(x.unidadesPerdidas, 3), x.ventaPerdida == null ? '' : csvNum(x.ventaPerdida),
    ]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <div className={s.hint} style={{ margin: 0 }}>
        Un artículo (el suelto o cada paquete) está <strong>sin stock</strong> cuando su disponible en el local llega a 0, el mismo
        número de Existencias; menos de una hora no cuenta. Solo los artículos que cada local trabaja: tuvieron stock o se
        vendieron en el período o en los 30 días anteriores (lo que un local nunca tuvo lo dice Existencias, Alt+F3).
        <strong> Venta perdida</strong>: lo que vendía por día cuando tenía, por los días que no tuvo, al precio promedio al que se
        vendió (neto, sin IVA); es una estimación.
      </div>
      {recortado && (
        <Aviso>Hay registro de movimientos desde el {fechaLarga(d.desdeEfectivo.slice(0, 10))}: el período se mide desde ahí.</Aviso>
      )}

      <Tiles>
        <Tile label="Disponibilidad" valor={pctTxt(t.disponibilidad)} detalle={`Del tiempo, con stock en la góndola · ${num(t.trabajados, 0)} artículos que se trabajan`} />
        <Tile label="Artículos con quiebre" valor={num(t.conQuiebre, 0)} detalle={`${pctTxt(t.trabajados ? (t.conQuiebre / t.trabajados) * 100 : null)} de los que se trabajan`} />
        <Tile label="Venta perdida (estimada)" valor={money(t.ventaPerdida)} alerta={t.ventaPerdida > 0} detalle="Neta, sin IVA" />
        <Tile label={alFinal} valor={num(t.alFinalSinStock, 0)} detalle="Artículos en 0 al terminar el período" />
        <Tile label="Hay que contarlos" valor={num(t.dudosos, 0)} alerta={t.dudosos > 0} detalle="Estuvieron en 0 pero se vendieron: el número no era real" />
      </Tiles>

      <Bloque titulo="Por local" sub="Tocá un local para ver solo sus artículos.">
        <Table cols={[{ h: 'Local' }, { h: 'Disponibilidad', num: true }, { h: 'Con quiebre', num: true }, { h: 'Días sin stock', num: true }, { h: 'Venta perdida', num: true }, { h: alFinal, num: true }]}>
          {d.sucursales.map((x) => (
            <tr
              key={x.sucursalId} className={s.clickable} style={{ cursor: 'pointer', ...(local === String(x.sucursalId) ? { background: 'var(--crm-color-surface-2)' } : {}) }}
              onClick={() => setLocal((v) => (v === String(x.sucursalId) ? '' : String(x.sucursalId)))}
            >
              <td><strong>{x.nombre}</strong></td>
              <td className={s.num}>{pctTxt(x.disponibilidad)}</td>
              <td className={s.num}>{num(x.conQuiebre, 0)} <span className={s.hint}>de {num(x.trabajados, 0)}</span></td>
              <td className={s.num}>{num(x.diasSinStock, 1)}</td>
              <td className={s.num}>{money(x.ventaPerdida)}</td>
              <td className={s.num}>{num(x.alFinalSinStock, 0)}</td>
            </tr>
          ))}
        </Table>
      </Bloque>

      <Bloque
        titulo="Por proveedor"
        sub="Los proveedores cuyos artículos más se quedaron sin stock (el que fija el precio del producto). Tocá uno para ver sus artículos."
        acciones={proveedores.length > 8 && <Btn small onClick={() => setTodosProv((v) => !v)}>{todosProv ? 'Ver menos' : `Ver los ${proveedores.length}`}</Btn>}
      >
        <Table cols={[{ h: 'Proveedor' }, { h: 'Artículos con quiebre', num: true }, { h: 'Días sin stock', num: true }, { h: 'Venta perdida', num: true }]} empty="Ningún artículo se quedó sin stock.">
          {(todosProv ? proveedores : proveedores.slice(0, 8)).map((x) => {
            const k = String(x.proveedorId ?? 0);
            return (
              <tr
                key={k} className={s.clickable} style={{ cursor: 'pointer', ...(proveedor === k ? { background: 'var(--crm-color-surface-2)' } : {}) }}
                onClick={() => setProveedor((v) => (v === k ? '' : k))}
              >
                <td><strong>{x.nombre}</strong></td>
                <td className={s.num}>{num(x.articulos, 0)}</td>
                <td className={s.num}>{num(x.dias, 1)}</td>
                <td className={s.num}>{money(x.ventaPerdida)}</td>
              </tr>
            );
          })}
        </Table>
      </Bloque>

      <Bloque
        titulo="Artículos"
        sub="Ordenados por lo que se dejó de vender. «Veces»: cuántas veces se quedó sin stock dentro del período."
        acciones={<Btn small onClick={exportar} disabled={!visibles.length}>Exportar CSV</Btn>}
      >
        <div className={s.toolbar} style={{ margin: 0 }}>
          <input type="search" placeholder="Buscar producto, marca, proveedor o categoría…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar" />
          <select className={s['select-inline']} value={vista} onChange={(e) => setVista(e.target.value)} aria-label="Qué artículos">
            {VISTAS.map(([k, l]) => <option key={k} value={k}>{k === 'final' ? alFinal : l}</option>)}
          </select>
          <select className={s['select-inline']} value={local} onChange={(e) => setLocal(e.target.value)} aria-label="Local">
            <option value="">Todos los locales</option>
            {d.sucursales.map((x) => <option key={x.sucursalId} value={x.sucursalId}>{x.nombre}</option>)}
          </select>
          <select className={s['select-inline']} value={proveedor} onChange={(e) => setProveedor(e.target.value)} aria-label="Proveedor">
            <option value="">Todos los proveedores</option>
            {proveedores.map((x) => <option key={x.proveedorId ?? 0} value={String(x.proveedorId ?? 0)}>{x.nombre}</option>)}
          </select>
          <span className={s.hint} style={{ margin: 0 }}>{num(visibles.length, 0)} artículo(s)</span>
        </div>
        <Table
          cols={[{ h: 'Artículo' }, { h: 'Local' }, { h: 'Veces', num: true }, { h: 'Días sin stock', num: true }, { h: alFinal }, { h: 'Vende por día', num: true }, { h: 'Venta perdida', num: true }]}
          empty="Ningún artículo con estos filtros."
          pag={pag}
        >
          {pag.visibles.map((x) => (
            <tr key={`${x.productoId}-${x.presentacionId ?? 0}-${x.sucursalId}`}>
              <td>
                <strong>{articulo(x)}</strong>
                <div className={s.hint} style={{ margin: 0 }}>{[x.marca, x.proveedor].filter(Boolean).join(' · ')}</div>
                {x.diasDudosos > 0 && (
                  <div style={{ marginTop: 2 }} title="Estuvo en 0 en el sistema pero se vendió: había mercadería y el número estaba mal. Esos días no cuentan como quiebre.">
                    <Pill pill="est-pendiente" label={`Contar · ${dias(x.diasDudosos)} en 0 vendiendo`} />
                  </div>
                )}
              </td>
              <td>{nombreLocal.get(x.sucursalId) ?? ''}</td>
              <td className={s.num}>{x.veces || '—'}{x.venia && <div className={s.hint} style={{ margin: 0 }}>venía sin stock</div>}</td>
              <td className={s.num}><strong>{num(x.diasSinStock, 1)}</strong></td>
              <td>{x.sinStockDesde ? <Pill pill="est-cancelada" label={`Desde el ${fecha(x.sinStockDesde)}`} /> : <span className={s.muted}>Con stock</span>}</td>
              <td className={s.num}>{x.ventaPorDia == null ? <span className={s.muted} title="Menos de 3 días con stock: no alcanza para saber cuánto vende">—</span> : `${num(x.ventaPorDia, x.unidad === 'kg' ? 2 : 1)} ${x.unidad}`}</td>
              <td className={s.num}>
                {x.ventaPerdida == null || !x.diasSinStock ? <span className={s.muted}>—</span> : <strong>{money(x.ventaPerdida)}</strong>}
                {x.unidadesPerdidas != null && x.diasSinStock > 0 && <div className={s.hint} style={{ margin: 0 }}>{num(x.unidadesPerdidas, x.unidad === 'kg' ? 2 : 0)} {x.unidad}</div>}
              </td>
            </tr>
          ))}
        </Table>
      </Bloque>
    </div>
  );
}
