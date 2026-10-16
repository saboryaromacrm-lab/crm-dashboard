/**
 * FRACCIONAMIENTO › PEDIDOS DE CAJA (0170) — el registro de lo que la caja de
 * la Distribuidora le pidió a fraccionado: quién, qué, quién lo armó, cuánto
 * tardó y, si no se pudo, por qué. Sirve para ver los tiempos de respuesta y
 * qué paquetes faltan seguido en la góndola.
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { num, fmtFechaHora, fmtTam } from '../domain/format.js';
import { RANGOS, chip, rango } from '../domain/rangosFecha.js';
import { ESTADO_PEDIDO_CAJA, haceCuanto, minutos, textoRenglon } from '../domain/pedidosCaja.js';
import { pedidosCajaApi } from '../services/pedidosCaja.js';
import { Table, Stat, Pill, usePaginado, s } from '../components/ui.jsx';

/** Cuántos paquetes se muestran en «Lo que más se pide». */
const TOP = 5;

export function TabPedidosCaja() {
  const [fechas, setFechas] = useState(() => { const [desde, hasta] = rango('hoy'); return { desde, hasta }; });
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    pedidosCajaApi.historial(fechas.desde, fechas.hasta)
      .then((r) => { if (vivo) { setDatos(r); setError(''); } })
      .catch((e) => { if (vivo) setError(errorMsg(e)); });
    return () => { vivo = false; };
  }, [fechas]);

  const pedidos = useMemo(() => datos?.pedidos ?? [], [datos]);
  const resumen = useMemo(() => {
    const listos = pedidos.filter((p) => p.estado === 'hecho');
    const demora = listos.length ? listos.reduce((a, p) => a + minutos(p.creadoEn, p.hechoEn), 0) / listos.length : null;
    const porPaquete = new Map();
    for (const p of pedidos) {
      for (const it of p.items) {
        const k = `${it.nombre} ${fmtTam(it.tamKg)}`;
        porPaquete.set(k, (porPaquete.get(k) ?? 0) + it.paquetes);
      }
    }
    return {
      listos: listos.length,
      no: pedidos.filter((p) => p.estado === 'rechazado').length,
      cancelados: pedidos.filter((p) => p.estado === 'cancelado').length,
      abiertos: pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'armando').length,
      demora,
      top: [...porPaquete].sort((a, b) => b[1] - a[1]).slice(0, TOP),
    };
  }, [pedidos]);
  const pag = usePaginado(pedidos, 'pedidosCaja', `${fechas.desde}|${fechas.hasta}`);
  const rangoActivo = RANGOS.find((r) => { const [d, h] = rango(r.id); return d === fechas.desde && h === fechas.hasta; })?.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s.hint} style={{ margin: 0 }}>
        Lo que la caja de la Distribuidora pide con <kbd>F7</kbd> («Pedir a fraccionado») llega al aviso de quien fracciona.
        «Listo» registra el fraccionado solo; acá queda todo.
      </div>
      <div className={s.toolbar} style={{ flexWrap: 'wrap', gap: 8 }}>
        {RANGOS.map((r) => (
          <button
            key={r.id} type="button" className={cx(s.badge)} style={chip(rangoActivo === r.id)}
            onClick={() => { const [desde, hasta] = rango(r.id); setFechas({ desde, hasta }); }}
          >
            {r.label}
          </button>
        ))}
        <input type="date" value={fechas.desde} max={fechas.hasta || undefined} aria-label="Desde"
          onChange={(e) => setFechas((x) => ({ ...x, desde: e.target.value }))} style={{ width: 'auto' }} />
        <input type="date" value={fechas.hasta} min={fechas.desde || undefined} aria-label="Hasta"
          onChange={(e) => setFechas((x) => ({ ...x, hasta: e.target.value }))} style={{ width: 'auto' }} />
      </div>

      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}

      <div className={s.stats}>
        <Stat label="Pedidos" value={datos ? num(pedidos.length, 0) : '—'} />
        <Stat label="Listos" value={datos ? num(resumen.listos, 0) : '—'} />
        <Stat label="Demora promedio" value={resumen.demora == null ? '—' : `${num(resumen.demora, 0)} min`} nota="del pedido a «Listo»" />
        {resumen.no > 0 && <Stat label="No se pudo" value={num(resumen.no, 0)} accent="accent-amber" />}
        {resumen.cancelados > 0 && <Stat label="Cancelados por la caja" value={num(resumen.cancelados, 0)} />}
        {resumen.abiertos > 0 && <Stat label="Abiertos ahora" value={num(resumen.abiertos, 0)} />}
      </div>
      {resumen.top.length > 0 && (
        <div className={s.hint} style={{ margin: 0 }}>
          <strong>Lo que más se pide:</strong> {resumen.top.map(([k, n]) => `${k} (${num(n, 0)})`).join(' · ')}
        </div>
      )}
      {datos?.tope && (
        <div className={cx(s.callout, s.warn)}>Se muestran los 500 más nuevos: achicá las fechas para ver el resto.</div>
      )}

      <Table
        cols={[{ h: 'Pedido' }, { h: 'Pidió' }, { h: 'Qué' }, { h: 'Estado' }, { h: 'Lo armó' }, { h: 'Tardó', num: true }, { h: 'Nota / motivo' }]}
        empty={datos ? 'Sin pedidos de la caja en esas fechas.' : 'Cargando…'}
        pag={pag}
      >
        {pag.visibles.map((p) => {
          const est = ESTADO_PEDIDO_CAJA[p.estado] ?? {};
          return (
            <tr key={p.id}>
              <td><strong>{p.codigo}</strong><div className={s.hint} style={{ margin: 0 }}>{fmtFechaHora(p.creadoEn)}</div></td>
              <td>{p.usuario || '—'}</td>
              <td>
                {p.items.map((it) => (
                  <div key={it.id} style={it.sinStockEn ? { color: 'var(--crm-color-danger)' } : undefined}>
                    {textoRenglon(it)}{it.sinStockEn ? ' · no había stock' : ''}
                  </div>
                ))}
                {p.cancelados.map((it) => (
                  <div key={it.id} className={s.muted}>
                    <s>{textoRenglon(it)}</s> · cancelado{it.fraccionados > 0 ? ` · se armó igual (${num(it.fraccionados, 0)}): entró al stock` : ''}
                  </div>
                ))}
              </td>
              <td><Pill pill={est.pill} label={est.label ?? p.estado} /></td>
              <td>{p.operador || p.tomadoPor || '—'}</td>
              <td className={s.num}>
                {p.estado === 'hecho' ? `${num(minutos(p.creadoEn, p.hechoEn), 0)} min`
                  : p.estado === 'rechazado' || p.estado === 'cancelado' ? '—' : haceCuanto(p.creadoEn)}
              </td>
              <td>
                {p.motivo && <div style={{ color: 'var(--crm-color-danger)' }}>{p.motivo}</div>}
                {p.observaciones && <div className={s.muted}>«{p.observaciones}»</div>}
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
