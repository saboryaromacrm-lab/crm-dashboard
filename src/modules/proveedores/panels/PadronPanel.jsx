import { useMemo, useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { errorMsg, provApi, MEDIOS_HABITUALES, CONDICIONES_COMPRA } from '../services/proveedores.api.js';
import { Btn, PanelHead, Pill, Table, s } from '../components/ui.jsx';

/**
 * EL PADRÓN — la ficha única del sistema (0068). Los ABM chicos que vivían en
 * Compras y en Gastos se fueron: todo proveedor se administra acá, con su
 * ficha comercial completa.
 */
export function PadronPanel() {
  const { proveedores, openModal, recargar, toast } = useProveedores();
  const [buscar, setBuscar] = useState('');

  const filas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return t ? proveedores.filter((p) => p.nombre.toLowerCase().includes(t) || (p.cuit ?? '').includes(t)) : proveedores;
  }, [proveedores, buscar]);

  const eliminar = async (p) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Eliminar a ${p.nombre}? Solo se puede si no tiene historia (facturas, pagos, compromisos).`)) return;
    try {
      await provApi.eliminarProveedor(p.id);
      toast('Proveedor eliminado.', 'ok');
      recargar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  return (
    <div>
      <PanelHead
        title="Proveedores"
        desc={`El padrón único: ${proveedores.length} proveedores con su ficha fiscal y comercial.`}
        actions={<Btn variant="btn-primary" onClick={() => openModal('ficha', {})}>+ Proveedor</Btn>}
      />
      <div style={{ marginBottom: 10 }}>
        <input
          type="search" placeholder="Buscar por nombre o CUIT…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ minWidth: 280 }}
        />
      </div>
      <Table cols={[
        { h: 'Proveedor' }, { h: 'Emite' }, { h: 'Cómo cobra' }, { h: 'Modo de cuenta' },
        { h: 'Clasificación' }, { h: 'Acciones' },
      ]}>
        {filas.map((p) => (
          <tr key={p.id}>
            <td>
              {p.nombre}
              {p.cuit && <div className={s.hint} style={{ margin: 0 }}>{p.cuit}</div>}
            </td>
            <td>{CONDICIONES_COMPRA[p.condicionCompra] ?? '—'}</td>
            <td>
              {p.medioHabitual
                ? `${MEDIOS_HABITUALES[p.medioHabitual] ?? p.medioHabitual}${p.diasPago ? ` ${p.diasPago}` : ''}`
                : <span className={s.muted}>sin definir</span>}
            </td>
            <td>{p.modoCuenta === 'libre' ? <Pill pill="est-pendiente" label="libre" /> : 'por facturas'}</td>
            <td>
              <div style={{ display: 'flex', gap: 4 }}>
                {p.proveeMercaderia && <Pill label="mercadería" />}
                {p.proveeGastos && <Pill label="gastos" />}
              </div>
            </td>
            <td>
              <div style={{ display: 'flex', gap: 4 }}>
                <Btn small onClick={() => openModal('ficha', { proveedorId: p.id })}>Ficha</Btn>
                <Btn small onClick={() => eliminar(p)}>×</Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>
      {!filas.length && <div className={s['empty-state']}>Sin resultados.</div>}
    </div>
  );
}
