import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { hoyISO } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, TipoGastoBadge, money, s } from '../components/ui.jsx';

/** Barra proporcional: hace legible de un vistazo quién se lleva la plata. */
function Barra({ valor, maximo, color = 'var(--crm-color-primary)' }) {
  const pct = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return (
    <div style={{ background: 'var(--crm-color-border)', borderRadius: 4, height: 8, width: '100%' }}>
      <div style={{ background: color, borderRadius: 4, height: 8, width: `${pct}%` }} />
    </div>
  );
}

/** 'AAAA-MM' → "ago 2026". */
function mesCorto(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  if (!a || !m) return mes;
  return new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
}

/** Primer día del año actual, para que el resumen abra con algo que decir. */
function inicioDeAnio() {
  const d = new Date();
  return hoyISO(new Date(d.getFullYear(), 0, 1));
}

/**
 * En qué se va la plata. Todo agregado en la base: el período puede tener miles
 * de comprobantes y no tiene sentido traerlos para sumarlos en el navegador.
 *
 * Los gastos ANULADOS no entran en ningún número de esta pantalla.
 */
export function ResumenPanel() {
  const { sucursales } = useGastos();
  const [desde, setDesde] = useState(inicioDeAnio());
  const [hasta, setHasta] = useState(hoyISO());
  const [sucursalId, setSucursalId] = useState('');

  const key = `resumen:${desde}:${hasta}:${sucursalId}`;
  const { data, loading, error, reload } = useResource(key, () => gastosApi.resumen({
    desde: desde || undefined,
    hasta: hasta || undefined,
    sucursalId: sucursalId || undefined,
  }));

  const r = data;
  const maxCat = Math.max(1, ...(r?.porCategoria ?? []).map((c) => c.total));
  const maxMes = Math.max(1, ...(r?.porMes ?? []).map((m) => m.total));
  const maxProv = Math.max(1, ...(r?.porProveedor ?? []).map((p) => p.total));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Resumen de gastos"
        desc="En qué se va la plata: por rubro, por mes y por proveedor. Los gastos anulados no cuentan."
      />

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0 }}>
          Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0 }}>
          Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      {error && <div className={cx(s.callout, s.warn)}>No se pudo calcular: <strong>{error}</strong></div>}
      {loading && !r && <div className={s['empty-state']}>Calculando…</div>}

      {r && (
        <>
          <div className={s.stats}>
            <Stat label="Total gastado" value={money(r.total)} accent="accent-amber" />
            <Stat label="Neto" value={money(r.neto)} />
            <Stat label="IVA (crédito fiscal)" value={money(r.iva)} />
            <Stat label="Falta pagar" value={money(r.saldo)} accent={r.saldo > 0.009 ? 'accent-red' : undefined} />
          </div>

          <div className={s.stats}>
            <Stat label="Comprobantes" value={r.cantidad} />
            <Stat label="Gastos fijos" value={money(r.porTipo.fijos)} />
            <Stat label="Gastos variables" value={money(r.porTipo.variables)} />
            <Stat
              label="Peso de los fijos"
              value={r.total > 0 ? `${Math.round((r.porTipo.fijos / r.total) * 100)}%` : '—'}
            />
          </div>

          <div className={s['section-title']}>Por rubro</div>
          <Table
            cols={[
              { h: 'Rubro' }, { h: 'Tipo' }, { h: 'Comprobantes', num: true },
              { h: 'Total', num: true }, { h: 'Peso' },
            ]}
            empty="No hay gastos en el período."
          >
            {r.porCategoria.map((c) => (
              <tr key={c.categoriaId}>
                <td>{c.nombre}</td>
                <td><TipoGastoBadge tipo={c.tipo} /></td>
                <td className={s.num}>{c.cantidad}</td>
                <td className={s.num}><strong>{money(c.total)}</strong></td>
                <td style={{ minWidth: 160 }}>
                  <Barra
                    valor={c.total}
                    maximo={maxCat}
                    color={c.tipo === 'fijo' ? 'var(--crm-color-primary)' : 'var(--crm-color-warning, #d98324)'}
                  />
                  <span className={s.hint} style={{ margin: 0 }}>
                    {r.total > 0 ? `${Math.round((c.total / r.total) * 100)}%` : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </Table>

          <div className={s['section-title']}>Por mes</div>
          <Table cols={[{ h: 'Mes' }, { h: 'Total', num: true }, { h: 'Evolución' }]} empty="Sin datos.">
            {r.porMes.map((m) => (
              <tr key={m.mes}>
                <td>{mesCorto(m.mes)}</td>
                <td className={s.num}><strong>{money(m.total)}</strong></td>
                <td style={{ minWidth: 200 }}><Barra valor={m.total} maximo={maxMes} /></td>
              </tr>
            ))}
          </Table>

          <div className={s['section-title']}>A quién se le paga más</div>
          <Table
            cols={[{ h: 'Proveedor' }, { h: 'Comprobantes', num: true }, { h: 'Total', num: true }, { h: 'Peso' }]}
            empty="Sin datos."
          >
            {r.porProveedor.map((p, i) => (
              <tr key={`${p.proveedorId ?? 'sin'}-${i}`}>
                <td>{p.nombre}</td>
                <td className={s.num}>{p.cantidad}</td>
                <td className={s.num}><strong>{money(p.total)}</strong></td>
                <td style={{ minWidth: 160 }}><Barra valor={p.total} maximo={maxProv} /></td>
              </tr>
            ))}
          </Table>

          <div className={s.hint}>
            El <strong>IVA</strong> de esta pantalla es crédito fiscal: se descuenta del IVA de
            las ventas. Los pagos a proveedor todavía sin aplicar no figuran acá — no son gasto
            hasta que tienen un comprobante detrás.
          </div>
        </>
      )}
    </div>
  );
}
