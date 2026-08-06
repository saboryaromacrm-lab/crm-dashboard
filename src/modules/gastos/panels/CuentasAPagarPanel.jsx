import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { nombreProveedor } from '../domain/constants.js';
import {
  Table, PanelHead, Stat, Btn, VencimientoPill, Saldo, usePaginado, money, fmtFecha, s,
} from '../components/ui.jsx';

/**
 * Qué hay que pagar y cuándo. Ordenado por urgencia — lo vencido arriba — que
 * es como se mira esta pantalla: no se busca un gasto, se busca qué pagar hoy.
 *
 * `dias` lo calcula la API (negativo = vencido). Se hace del lado del servidor
 * a propósito: si lo calculara el navegador, la respuesta dependería de la hora
 * de la máquina del usuario.
 */
export function CuentasAPagarPanel() {
  const { proveedores, sucursales, openModal, nombreSucursal } = useGastos();
  const [sucursalId, setSucursalId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [soloVencidos, setSoloVencidos] = useState(false);

  const key = `cuentas:${sucursalId}:${proveedorId}`;
  const { data, loading, error, reload } = useResource(key, () => gastosApi.cuentasAPagar({
    sucursalId: sucursalId || undefined,
    proveedorId: proveedorId || undefined,
  }));

  const todos = data ?? [];
  const filtrados = useMemo(
    () => (soloVencidos ? todos.filter((g) => g.dias !== null && g.dias <= 0) : todos),
    [todos, soloVencidos],
  );

  const stats = useMemo(() => {
    const vencidos = todos.filter((g) => g.dias !== null && g.dias <= 0);
    const semana = todos.filter((g) => g.dias !== null && g.dias > 0 && g.dias <= 7);
    return {
      total: todos.reduce((a, g) => a + g.saldo, 0),
      vencidos: vencidos.reduce((a, g) => a + g.saldo, 0),
      cantVencidos: vencidos.length,
      semana: semana.reduce((a, g) => a + g.saldo, 0),
    };
  }, [todos]);

  const pag = usePaginado(filtrados, 'cuentas-a-pagar', `${key}|${soloVencidos}`);
  const stop = (e) => e.stopPropagation();

  const filas = pag.visibles.map((g) => (
    <tr
      key={g.id}
      className={s.clickable}
      onClick={() => openModal('detalleGasto', { gastoId: g.id, onChange: reload })}
    >
      <td><VencimientoPill dias={g.dias} /></td>
      <td>{g.vencimiento ? fmtFecha(g.vencimiento) : <span className={s.muted}>—</span>}</td>
      <td>{nombreProveedor(g, proveedores)}</td>
      <td>
        <div>{g.descripcion || `Gasto #${g.id}`}</div>
        {g.numero && <div className={cx(s.hint, s.mono)} style={{ margin: 0 }}>{g.numero}</div>}
      </td>
      <td>{g.sucursalId ? nombreSucursal(g.sucursalId) : <span className={s.muted}>Todas</span>}</td>
      <td className={s.num}>{money(g.total)}</td>
      <td className={s.num}><Saldo valor={g.saldo}>{money(g.saldo)}</Saldo></td>
      <td className={s['actions-col']}>
        <div className={s['row-actions']} onClick={stop}>
          <Btn variant="btn-primary" small onClick={() => openModal('pagarGasto', { gastoId: g.id, onChange: reload })}>
            Pagar
          </Btn>
        </div>
      </td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Cuentas a pagar"
        desc="Todo lo que falta pagar, ordenado por urgencia. Lo vencido va primero."
      />

      <div className={s.stats}>
        <Stat label="Deuda total" value={money(stats.total)} accent={stats.total > 0.009 ? 'accent-amber' : undefined} />
        <Stat
          label={`Vencido (${stats.cantVencidos})`}
          value={money(stats.vencidos)}
          accent={stats.vencidos > 0.009 ? 'accent-red' : undefined}
        />
        <Stat label="Vence esta semana" value={money(stats.semana)} />
      </div>

      <div className={s.toolbar}>
        <select className={s['select-inline']} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloVencidos} onChange={(e) => setSoloVencidos(e.target.checked)} />
          Solo vencidos
        </label>
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar: <strong>{error}</strong></div>}

      <Table
        cols={[
          { h: 'Urgencia' }, { h: 'Vence' }, { h: 'Proveedor' }, { h: 'Concepto' }, { h: 'Sucursal' },
          { h: 'Total', num: true }, { h: 'Saldo', num: true }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : 'No queda nada por pagar. '}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        Un gasto sin fecha de vencimiento no se atrasa nunca: si te importa que aparezca acá
        arriba, cargale el vencimiento al darlo de alta.
      </div>
    </div>
  );
}
