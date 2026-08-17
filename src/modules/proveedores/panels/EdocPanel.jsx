import { useMemo, useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { provApi } from '../services/proveedores.api.js';
import {
  Btn, EstadoCuentaPill, PanelHead, Saldo, Stat, Table, fmtFecha, money, s,
} from '../components/ui.jsx';

/**
 * ESTADOS DE CUENTA — la foto global: cuánto se le debe a cada proveedor,
 * qué parte ya está prometida (compromisos) y el saldo proyectado. La fila
 * abre el mayor completo con FIFO, ajustes y conciliación.
 */
export function EdocPanel() {
  const { openModal } = useProveedores();
  const [buscar, setBuscar] = useState('');
  const [soloDeuda, setSoloDeuda] = useState(true);
  const { data, reload } = useResource('edoc-global', provApi.edoc);

  const filas = useMemo(() => {
    let out = data ?? [];
    if (soloDeuda) out = out.filter((f) => Math.abs(f.saldo) > 0.009);
    const t = buscar.trim().toLowerCase();
    if (t) out = out.filter((f) => f.nombre.toLowerCase().includes(t));
    return out;
  }, [data, buscar, soloDeuda]);

  const totales = useMemo(() => ({
    saldo: filas.reduce((a, f) => a + f.saldo, 0),
    comprometido: filas.reduce((a, f) => a + f.compromisosPendientes, 0),
    vencidos: filas.filter((f) => f.estado === 'vencido').length,
  }), [filas]);

  return (
    <div>
      <PanelHead
        title="Estados de cuenta"
        desc="El saldo real con cada proveedor: lo facturado (mercadería y gastos) más ajustes, menos lo pagado. La fila abre el mayor completo."
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Deuda total" value={money(totales.saldo)} />
        <Stat label="Comprometido" value={money(totales.comprometido)} />
        <Stat label="Proveedores vencidos" value={totales.vencidos} accent={totales.vencidos ? 'accent-red' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input
          type="search" placeholder="Buscar proveedor…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloDeuda} onChange={(e) => setSoloDeuda(e.target.checked)} />
          Solo con saldo
        </label>
      </div>

      <Table cols={[
        { h: 'Proveedor' }, { h: 'Saldo', num: true }, { h: 'Comprometido', num: true },
        { h: 'Proyectado', num: true }, { h: 'Estado' }, { h: 'Conciliado' }, { h: '' },
      ]}>
        {filas.map((f) => (
          <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => openModal('edocDetalle', { proveedorId: f.id })}>
            <td>
              {f.nombre}
              <div className={s.hint} style={{ margin: 0 }}>
                {f.modoCuenta === 'libre' ? 'cuenta libre' : 'por facturas'}
                {f.diasPago ? ` · ${f.diasPago} días` : ''}
              </div>
            </td>
            <td className={s.num}><Saldo valor={f.saldo}>{money(f.saldo)}</Saldo></td>
            <td className={s.num}>{f.compromisosPendientes > 0 ? money(f.compromisosPendientes) : '—'}</td>
            <td className={s.num}>{money(f.saldoProyectado)}</td>
            <td><EstadoCuentaPill estado={f.estado} /></td>
            <td>{f.conciliadoHasta ? fmtFecha(f.conciliadoHasta) : <span className={s.muted}>—</span>}</td>
            <td><Btn small onClick={(e) => { e.stopPropagation(); openModal('edocDetalle', { proveedorId: f.id }); }}>Ver</Btn></td>
          </tr>
        ))}
      </Table>
      {!filas.length && <div className={s['empty-state']}>Sin proveedores con movimiento.</div>}
      <div className={s.hint} style={{ marginTop: 8 }}>
        <Btn small onClick={reload}>Recalcular</Btn>
      </div>
    </div>
  );
}
