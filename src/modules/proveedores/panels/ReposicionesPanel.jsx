import { useEffect, useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import { Btn, PanelHead, Pill, Stat, Table, fmtFecha, money, s } from '../components/ui.jsx';

const FILTROS = [['pendientes', 'Pendientes'], ['completos', 'Completos'], ['todos', 'Todos']];
const dias = (fecha) => Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000));

/**
 * CAMBIOS DE MERCADERÍA (0202, 26/10/2026, pedido del dueño): lo que se le
 * manda al proveedor para que lo reponga y lo que va reponiendo. A costo: el
 * cambio se completa cuando lo repuesto alcanza lo mandado; lo que falta queda
 * pendiente hasta que reponga.
 */
export function ReposicionesPanel() {
  const { proveedores, openModal, toast, panelParams } = useProveedores();
  const [filtro, setFiltro] = useState('pendientes');
  const [proveedorId, setProveedorId] = useState(panelParams?.proveedorId ? String(panelParams.proveedorId) : '');
  /* Desde la tarjeta de Pedidos se llega con el proveedor puesto. */
  useEffect(() => { if (panelParams?.proveedorId) setProveedorId(String(panelParams.proveedorId)); }, [panelParams?.proveedorId]);
  const { data, reload } = useResource(
    `reposiciones:${filtro}:${proveedorId}`,
    () => provApi.reposiciones({ estado: filtro, proveedorId: proveedorId || undefined }),
  );
  const filas = data ?? [];
  const pendientes = filas.filter((f) => f.estado === 'pendiente');
  const debe = pendientes.reduce((a, f) => a + f.debe, 0);

  const anular = async (f) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Anular el cambio #${f.id} con ${f.proveedorNombre}? Lo mandado vuelve al stock.`)) return;
    try { await provApi.anularReposicion(f.id); toast('Cambio anulado: lo mandado volvió al stock.', 'ok'); reload(); } catch (e) { toast(errorMsg(e), 'err'); }
  };

  return (
    <div>
      <PanelHead
        title="Cambios de mercadería"
        desc="Lo que le mandás al proveedor para que te lo reponga (vencidos, fallados) y lo que va reponiendo. Se mide a costo: puede reponer con otro producto o sabor, en partes o en otro envío."
        actions={<Btn variant="btn-primary" onClick={() => openModal('mandarReposicion', { proveedorId: proveedorId || undefined, onChange: reload })}>+ Mandar al proveedor</Btn>}
      />

      {filtro !== 'completos' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Stat label="Cambios pendientes" value={String(pendientes.length)} />
          <Stat label="Te deben, a costo" value={money(debe)} accent={debe > 0 ? 'accent-amber' : undefined} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {FILTROS.map(([k, v]) => <Btn key={k} small variant={filtro === k ? 'btn-primary' : undefined} onClick={() => setFiltro(k)}>{v}</Btn>)}
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} aria-label="Proveedor">
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      <Table
        cols={[{ h: 'Mandado' }, { h: 'Proveedor' }, { h: 'Mandaste', num: true }, { h: 'Repuso', num: true }, { h: 'Te debe', num: true }, { h: 'Estado' }, { h: 'Acciones' }]}
        empty={filtro === 'pendientes' ? 'No hay cambios pendientes.' : 'No hay cambios.'}
      >
        {filas.map((f) => (
          <tr key={f.id}>
            <td style={{ whiteSpace: 'nowrap' }}>
              {fmtFecha(f.creadoEn)}
              {f.estado === 'pendiente' && <div className={s.hint} style={{ margin: 0 }}>hace {dias(f.creadoEn)} día(s)</div>}
            </td>
            <td>
              {f.proveedorNombre}
              {f.nota && <div className={s.hint} style={{ margin: 0 }}>{f.nota}</div>}
            </td>
            <td className={s.num}>{money(f.mandado)}</td>
            <td className={s.num}>{money(f.repuesto)}</td>
            <td className={s.num}><strong>{f.estado === 'pendiente' ? money(f.debe) : '—'}</strong></td>
            <td>
              <Pill pill={f.estado === 'completo' ? 'est-recibida' : 'est-pendiente'} label={f.estado === 'completo' ? 'Completo' : 'Pendiente'} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {f.estado === 'pendiente' && (
                  <Btn small variant="btn-primary" onClick={() => openModal('recibirReposicion', { reposicion: f, onChange: reload })}>Recibir</Btn>
                )}
                <Btn small onClick={() => openModal('reposicion', { id: f.id })}>Ver</Btn>
                {f.estado === 'pendiente' && f.repuesto === 0 && <Btn small onClick={() => anular(f)}>Anular</Btn>}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
