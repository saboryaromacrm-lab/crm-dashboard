import { useEffect, useMemo, useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { provApi } from '../services/proveedores.api.js';
import {
  Btn, EstadoCuentaPill, PanelHead, Saldo, Stat, Table, fmtFecha, money, s,
} from '../components/ui.jsx';
import { EdocProveedorPage } from './EdocProveedorPage.jsx';

/**
 * ESTADOS DE CUENTA — la foto global: cuánto se le debe a cada proveedor de
 * MERCADERÍA, qué parte ya está prometida (compromisos) y el saldo proyectado.
 * La fila abre la PANTALLA COMPLETA de ese proveedor (su mayor, lo impago, y
 * el botón para pagarle); antes era un modal y no alcanzaba.
 *
 * Los proveedores que solo facturan gastos no aparecen acá: su cuenta se mira
 * en Gastos. El filtro lo aplica la API — ver `edocGlobal`.
 */
export function EdocPanel() {
  const { panelParams } = useProveedores();
  const [buscar, setBuscar] = useState('');
  const [soloDeuda, setSoloDeuda] = useState(true);
  const [verId, setVerId] = useState(panelParams?.proveedorId ?? null);
  const { data, reload } = useResource('edoc-global', provApi.edoc);

  /* Otra sección puede mandar acá con un proveedor puesto (`goPanel('edoc',
   * { proveedorId })`): si el panel ya estaba montado, el estado inicial no se
   * vuelve a evaluar y sin esto la navegación no haría nada. */
  useEffect(() => {
    if (panelParams?.proveedorId) setVerId(panelParams.proveedorId);
  }, [panelParams?.proveedorId]);

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

  if (verId) {
    return (
      <EdocProveedorPage
        proveedorId={verId}
        onVolver={() => setVerId(null)}
        onCambio={reload}
      />
    );
  }

  return (
    <div>
      <PanelHead
        title="Estados de cuenta"
        desc="El saldo real con cada proveedor de mercadería: lo facturado más ajustes, menos lo pagado. La fila abre su cuenta completa, con el mayor y el botón para pagarle."
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

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Saldo', num: true }, { h: 'Comprometido', num: true },
          { h: 'Proyectado', num: true }, { h: 'Estado' }, { h: 'Último pago' }, { h: 'Conciliado' }, { h: '' },
        ]}
        empty={soloDeuda
          ? 'Ningún proveedor de mercadería con saldo. Destildá "Solo con saldo" para ver también los que están al día.'
          : 'Todavía no hay proveedores con movimiento.'}
      >
        {filas.map((f) => (
          <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => setVerId(f.id)}>
            <td>
              {f.nombre}
              <div className={s.hint} style={{ margin: 0 }}>
                {f.modoCuenta === 'libre' ? 'cuenta libre' : 'por facturas'}
                {f.diasPago ? ` · ${f.diasPago} días` : ''}
                {f.gastos > 0.009 ? ' · también factura gastos' : ''}
              </div>
            </td>
            <td className={s.num}><Saldo valor={f.saldo}>{money(f.saldo)}</Saldo></td>
            <td className={s.num}>{f.compromisosPendientes > 0 ? money(f.compromisosPendientes) : '—'}</td>
            <td className={s.num}>{money(f.saldoProyectado)}</td>
            <td><EstadoCuentaPill estado={f.estado} /></td>
            <td>{f.ultimoPago ? fmtFecha(f.ultimoPago) : <span className={s.muted}>—</span>}</td>
            <td>{f.conciliadoHasta ? fmtFecha(f.conciliadoHasta) : <span className={s.muted}>—</span>}</td>
            <td><Btn small onClick={(e) => { e.stopPropagation(); setVerId(f.id); }}>Ver cuenta</Btn></td>
          </tr>
        ))}
      </Table>
      <div className={s.hint} style={{ marginTop: 8 }}>
        <Btn small onClick={reload}>Recalcular</Btn>
      </div>
    </div>
  );
}
