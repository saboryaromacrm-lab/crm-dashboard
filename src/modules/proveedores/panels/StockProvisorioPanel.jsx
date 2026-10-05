/**
 * PROVEEDORES › STOCK PROVISORIO DE GRANEL (0138, 5/10/2026) — TEMPORAL
 * ============================================================================
 * Pedido del dueño: una planilla APARTE con las bolsas cerradas de cada
 * producto a granel madre, contadas a ojo en el depósito, mientras el stock
 * real no está confiable. No toca el stock del sistema: es una isla que se
 * borra entera cuando el stock real esté bien (ver crm-api/src/stock-provisorio).
 *
 * Pensada para cargar rápido lo que dicta el operario: se escribe el número y
 * Enter salta al producto siguiente; se guarda todo junto con un clic. Cada
 * conteo queda en el historial del producto (fecha, quién, cuántas).
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { descargarCsv } from '@shared/utils/csv.js';
import { imprimirDocumento, esc } from '@core/services/imprimir.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg } from '../services/proveedores.api.js';
import { Table, PanelHead, Stat, Btn, ModalShell, fmtFechaHora, s } from '../components/ui.jsx';

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const num = (n) => Number(n).toLocaleString('es-AR');

function Historial({ producto, onCerrar }) {
  const { data, loading, error } = useResource(`stock-prov-hist:${producto.id}`, () => httpClient.get(`/stock-provisorio/${producto.id}/historial`));
  return (
    <ModalShell title={`Conteos de ${producto.nombre}`} subtitle={producto.categoria} onClose={onCerrar} footer={[{ texto: 'Cerrar', onClick: onCerrar }]}>
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      <Table cols={[{ h: 'Fecha' }, { h: 'Bolsas', num: true }, { h: 'Cambio', num: true }, { h: 'Quién' }]} empty={loading ? 'Cargando…' : 'Todavía no se contó.'}>
        {(data ?? []).map((c, i, arr) => {
          const ant = arr[i + 1];
          const dif = ant ? c.bolsas - ant.bolsas : null;
          return (
            <tr key={c.id}>
              <td>{fmtFechaHora(c.fecha)}{c.observacion && <div className={s.hint} style={{ margin: 0 }}>{c.observacion}</div>}</td>
              <td className={s.num}><strong>{num(c.bolsas)}</strong></td>
              <td className={s.num}>{dif == null ? <span className={s.muted}>—</span> : dif === 0 ? <span className={s.muted}>igual</span> : <span style={{ color: dif < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-primary)' }}>{dif > 0 ? '+' : ''}{num(dif)}</span>}</td>
              <td>{c.usuario || '—'}</td>
            </tr>
          );
        })}
      </Table>
    </ModalShell>
  );
}

export function StockProvisorioPanel() {
  const { toast } = useProveedores();
  const { data, loading, error, reload } = useResource('stock-provisorio', () => httpClient.get('/stock-provisorio'));
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState('');
  /** productoId → lo tipeado (texto) — solo lo que cambió respecto del último conteo. */
  const [nuevos, setNuevos] = useState({});
  const [observacion, setObservacion] = useState('');
  const [historial, setHistorial] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const inputs = useRef(new Map());

  const productos = useMemo(() => data ?? [], [data]);
  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))], [productos]);
  const filtrados = useMemo(() => {
    const t = sinTildes(buscar.trim());
    return productos.filter((p) => (!categoria || p.categoria === categoria)
      && (!estado || (estado === 'sin' ? p.bolsas == null : p.bolsas != null))
      && (!t || sinTildes(`${p.nombre} ${p.marca} ${p.codigo}`).includes(t)));
  }, [productos, buscar, categoria, estado]);
  /* Agrupados por categoría, en el orden que llegan (el servidor ya ordena). */
  const grupos = useMemo(() => {
    const m = new Map();
    for (const p of filtrados) { if (!m.has(p.categoria)) m.set(p.categoria, []); m.get(p.categoria).push(p); }
    return [...m.entries()];
  }, [filtrados]);
  const orden = useMemo(() => grupos.flatMap(([, ps]) => ps.map((p) => p.id)), [grupos]);

  const pendientes = Object.entries(nuevos).filter(([, v]) => v !== '');
  const invalidos = pendientes.filter(([, v]) => !/^\d+$/.test(v) || Number(v) > 100000);
  const stats = useMemo(() => {
    const contados = productos.filter((p) => p.bolsas != null);
    const ultimo = contados.reduce((a, p) => (!a || p.fecha > a ? p.fecha : a), null);
    return { total: productos.length, contados: contados.length, bolsas: contados.reduce((a, p) => a + p.bolsas, 0), ultimo };
  }, [productos]);

  const tipear = (id, v) => setNuevos((n) => ({ ...n, [id]: v.replace(/[^\d]/g, '') }));
  const siguiente = (id) => {
    const i = orden.indexOf(id);
    const prox = orden[i + 1];
    if (prox != null) inputs.current.get(prox)?.focus();
  };

  const guardar = async () => {
    if (enVuelo.current || !pendientes.length) return;
    if (invalidos.length) { toast('Las bolsas van en números enteros (sin coma).', 'err'); return; }
    enVuelo.current = true;
    setGuardando(true);
    try {
      const items = pendientes.map(([id, v]) => ({ productoId: Number(id), bolsas: Number(v) }));
      const r = await httpClient.post('/stock-provisorio/conteos', { items, observacion: observacion.trim() || undefined });
      toast(`Conteo guardado: ${r.guardados} producto${r.guardados === 1 ? '' : 's'}.`, 'ok');
      setNuevos({});
      setObservacion('');
      reload();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  };

  const exportar = () => descargarCsv(`stock-provisorio-granel-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Categoría', 'Producto', 'Marca', 'Código', 'Bolsas (último conteo)', 'Fecha del conteo', 'Quién'],
    filtrados.map((p) => [p.categoria, p.nombre, p.marca, p.codigo, p.bolsas ?? '', p.fecha ? fmtFechaHora(p.fecha) : '', p.usuario ?? '']));

  /** La hoja para el operario: por categoría, con el último conteo y una columna en blanco para anotar. */
  const imprimirPlanilla = () => {
    const filas = grupos.map(([cat, ps]) => `
      <tr><td colspan="4" style="padding:8px 4px 3px;font-weight:700;border-bottom:2px solid #333">${esc(cat)}</td></tr>
      ${ps.map((p) => `<tr>
        <td style="padding:5px 4px;border-bottom:1px solid #ccc">${esc(p.nombre)}</td>
        <td style="padding:5px 4px;border-bottom:1px solid #ccc;color:#555">${esc(p.marca)}</td>
        <td style="padding:5px 4px;border-bottom:1px solid #ccc;text-align:right;color:#555">${p.bolsas ?? '—'}</td>
        <td style="padding:5px 4px;border-bottom:1px solid #999;width:90px"></td>
      </tr>`).join('')}`).join('');
    imprimirDocumento('stockProvisorio', {
      titulo: 'Stock provisorio de granel',
      cuerpo: `<h2 style="margin:0 0 2px">Conteo de bolsas cerradas · granel</h2>
        <div style="font-size:12px;color:#555;margin-bottom:8px">Fecha: ____/____/______ · Contó: ______________________ · Solo bolsas CERRADAS.</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr><th style="text-align:left">Producto</th><th style="text-align:left">Marca</th><th style="text-align:right">Último</th><th style="text-align:center">Bolsas hoy</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>`,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Stock provisorio de granel"
        desc="Planilla aparte con las bolsas CERRADAS de cada producto a granel madre, contadas a ojo en el depósito. No toca el stock del sistema: es temporal y se borra cuando el stock real esté bien."
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn small onClick={imprimirPlanilla} disabled={!filtrados.length}>Imprimir planilla</Btn>
            <Btn small onClick={exportar} disabled={!filtrados.length}>Exportar CSV</Btn>
          </div>
        )}
      />
      <div className={s.stats}>
        <Stat label="Productos a granel" value={num(stats.total)} />
        <Stat label="Contados" value={num(stats.contados)} accent={stats.contados ? 'accent-green' : undefined} />
        <Stat label="Sin contar" value={num(stats.total - stats.contados)} accent={stats.total - stats.contados ? 'accent-amber' : undefined} />
        <Stat label="Bolsas en total" value={num(stats.bolsas)} />
        <Stat label="Último conteo" value={stats.ultimo ? fmtFechaHora(stats.ultimo) : '—'} />
      </div>

      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar producto, marca o código…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar" style={{ flex: "1 1 220px", minWidth: 0 }} />
        <select className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Contados y sin contar</option>
          <option value="sin">Sin contar</option>
          <option value="con">Contados</option>
        </select>
        <span className={s.hint} style={{ margin: '0 0 0 auto' }}>{num(filtrados.length)} producto{filtrados.length === 1 ? '' : 's'}</span>
      </div>

      {pendientes.length > 0 && (
        <div className={cx(s.callout, invalidos.length ? s.warn : s.info)} style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: 0 }}>
          <strong>{pendientes.length} conteo{pendientes.length === 1 ? '' : 's'} sin guardar</strong>
          <input value={observacion} maxLength={300} placeholder="Nota (opcional): quién contó, sector…" onChange={(e) => setObservacion(e.target.value)} style={{ flex: '1 1 220px' }} />
          <Btn small onClick={() => setNuevos({})} disabled={guardando}>Descartar</Btn>
          <Btn small variant="btn-primary" onClick={guardar} disabled={guardando || invalidos.length > 0}>{guardando ? 'Guardando…' : 'Guardar conteo'}</Btn>
        </div>
      )}

      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar la planilla: <strong>{error}</strong></div>}
      {loading && !data ? <div className={s.hint}>Cargando…</div> : (
        <Table
          cols={[{ h: 'Producto' }, { h: 'Marca' }, { h: 'Último conteo', num: true }, { h: 'Cuándo · quién' }, { h: 'Bolsas hoy', num: true }, { h: '', cls: 'actions-col' }]}
          empty="No hay productos a granel con esos filtros."
        >
          {grupos.map(([cat, ps]) => [
            <tr key={`g-${cat}`}><td colSpan={6} style={{ fontWeight: 700, background: 'var(--crm-color-surface-2)' }}>{cat} <span className={s.muted} style={{ fontWeight: 400 }}>· {ps.length}</span></td></tr>,
            ...ps.map((p) => {
              const v = nuevos[p.id] ?? '';
              const cambia = v !== '' && p.bolsas != null && Number(v) !== p.bolsas;
              return (
                <tr key={p.id}>
                  <td>{p.nombre}{p.estado === 'discontinuado' && <span className={s.muted}> · discontinuado</span>}{p.codigo && <div className={s.hint} style={{ margin: 0 }}>{p.codigo}</div>}</td>
                  <td>{p.marca || <span className={s.muted}>—</span>}</td>
                  <td className={s.num}>{p.bolsas == null ? <span className={s.muted}>sin contar</span> : <strong>{num(p.bolsas)}</strong>}</td>
                  <td>{p.fecha ? <>{fmtFechaHora(p.fecha)}<div className={s.hint} style={{ margin: 0 }}>{p.usuario || '—'}</div></> : <span className={s.muted}>—</span>}</td>
                  <td className={s.num}>
                    <input
                      ref={(el) => { if (el) inputs.current.set(p.id, el); else inputs.current.delete(p.id); }}
                      value={v}
                      inputMode="numeric"
                      placeholder={p.bolsas == null ? '—' : String(p.bolsas)}
                      onChange={(e) => tipear(p.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); siguiente(p.id); } }}
                      aria-label={`Bolsas de ${p.nombre}`}
                      style={{ width: 80, textAlign: 'right', fontWeight: v !== '' ? 700 : 400, borderColor: cambia ? 'var(--crm-color-warning)' : undefined }}
                    />
                    {cambia && <div className={s.hint} style={{ margin: 0 }}>{Number(v) - p.bolsas > 0 ? '+' : ''}{num(Number(v) - p.bolsas)}</div>}
                  </td>
                  <td className={s['actions-col']}>{p.conteos > 0 && <Btn small onClick={() => setHistorial(p)}>Historial</Btn>}</td>
                </tr>
              );
            }),
          ])}
        </Table>
      )}
      <div className={s.hint}>Escribí las bolsas y apretá <strong>Enter</strong> para pasar al siguiente producto; al terminar, <strong>Guardar conteo</strong> guarda todo junto. Cada conteo queda en el historial del producto.</div>
      {historial && <Historial producto={historial} onCerrar={() => setHistorial(null)} />}
    </div>
  );
}
