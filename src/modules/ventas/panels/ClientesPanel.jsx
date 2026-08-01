import { useMemo, useState } from 'react';
import { useVentas } from '../context/VentasContext.jsx';
import { CONDICIONES_IVA, docLegible, norm } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, CondIvaBadge, money, s } from '../components/ui.jsx';

export function ClientesPanel() {
  const { clientes, openModal } = useVentas();
  const [q, setQ] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);

  /**
   * El filtrado se memoriza por (búsqueda, listado): con miles de clientes el
   * `normalize()` por fila es lo único caro de esta pantalla.
   */
  const filtrados = useMemo(() => {
    const ql = norm(q);
    return clientes.filter((c) => {
      if (!verInactivos && !c.activo) return false;
      if (!ql) return true;
      return (
        norm(c.nombre).includes(ql) ||
        norm(c.nombreFantasia).includes(ql) ||
        (c.numeroDoc || '').includes(ql.replace(/\D/g, '')) ||
        norm(c.localidad).includes(ql)
      );
    });
  }, [clientes, q, verInactivos]);

  const stats = useMemo(() => {
    const activos = clientes.filter((c) => c.activo);
    return {
      total: activos.length,
      ctaCte: activos.filter((c) => c.ctaCteHabilitada).length,
      inactivos: clientes.length - activos.length,
    };
  }, [clientes]);

  const stop = (e) => e.stopPropagation();

  const filas = filtrados.map((c) => (
    <tr
      key={c.id}
      className={s.clickable}
      onClick={() => openModal('detalleCliente', { clienteId: c.id })}
      style={c.activo ? undefined : { opacity: 0.55 }}
    >
      <td>
        <strong>{c.nombre}</strong>
        {c.nombreFantasia && <div className={s.hint}>{c.nombreFantasia}</div>}
        {!c.activo && <span className={s.muted}> · inactivo</span>}
      </td>
      <td className={s.mono}>{docLegible(c)}</td>
      <td><CondIvaBadge condicion={c.condicionIva} /></td>
      <td>{c.listaPrecio || <span className={s.muted}>—</span>}</td>
      <td className={s.num}>
        {c.ctaCteHabilitada
          ? (c.limiteCredito > 0 ? money(c.limiteCredito) : 'Sin tope')
          : <span className={s.muted}>—</span>}
      </td>
      <td>{c.telefono || <span className={s.muted}>—</span>}</td>
      <td>{c.localidad || <span className={s.muted}>—</span>}</td>
      <td className={s['actions-col']}>
        <div className={s['row-actions']} onClick={stop}>
          {c.activo ? (
            <>
              <Btn variant="btn-edit" small onClick={() => openModal('clienteForm', { clienteId: c.id })}>Editar</Btn>
              {!c.esConsumidorFinal && (
                <Btn variant="btn-delete" small onClick={() => openModal('eliminarCliente', { clienteId: c.id })}>Baja</Btn>
              )}
            </>
          ) : (
            <Btn variant="btn-ingreso" small onClick={() => openModal('reactivarCliente', { clienteId: c.id })}>Reactivar</Btn>
          )}
        </div>
      </td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Clientes"
        desc="Clic en una fila para ver el detalle: cuenta corriente, comprobantes y datos comerciales."
        actions={<Btn variant="btn-primary" onClick={() => openModal('clienteForm', {})}>+ Nuevo cliente</Btn>}
      />

      <div className={s.stats}>
        <Stat label="Clientes activos" value={stats.total} />
        <Stat label="Con cuenta corriente" value={stats.ctaCte} accent="accent-amber" />
        <Stat label="Dados de baja" value={stats.inactivos} />
      </div>

      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar por nombre, documento o localidad..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver dados de baja
        </label>
      </div>

      <Table
        cols={[
          { h: 'Cliente' }, { h: 'Documento' }, { h: 'IVA' }, { h: 'Lista' },
          { h: 'Límite cta. cte.', num: true }, { h: 'Teléfono' }, { h: 'Localidad' },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={q ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes.'}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        La condición frente al IVA ({Object.values(CONDICIONES_IVA).map((c) => c.corto).join(' · ')}) define
        la letra del comprobante que se emite en la caja.
      </div>
    </div>
  );
}
