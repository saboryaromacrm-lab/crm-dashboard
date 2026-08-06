import { useMemo, useState } from 'react';
import { useGastos } from '../context/GastosContext.jsx';
import { Table, PanelHead, Stat, Btn, Pill, s } from '../components/ui.jsx';

/**
 * El padrón, visto desde Gastos.
 *
 * Es EL MISMO padrón de Compras — una entidad, un CUIT, una cuenta corriente.
 * Lo que cambia es el filtro por defecto: acá se muestran los que facturan
 * gastos. Esta pantalla existe para que quien carga gastos pueda dar de alta al
 * plomero sin tener que entrar a Compras, y para poder marcar que un proveedor
 * de mercadería también factura servicios (el que trae la mercadería y además
 * te cobra el flete).
 */
export function ProveedoresPanel() {
  const { proveedores, openModal } = useGastos();
  const [q, setQ] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  const visibles = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return proveedores
      .filter((p) => verTodos || p.proveeGastos)
      .filter((p) => !ql || p.nombre.toLowerCase().includes(ql) || (p.cuit || '').toLowerCase().includes(ql));
  }, [proveedores, q, verTodos]);

  const stats = useMemo(() => ({
    gastos: proveedores.filter((p) => p.proveeGastos).length,
    ambos: proveedores.filter((p) => p.proveeGastos && p.proveeMercaderia).length,
    total: proveedores.length,
  }), [proveedores]);

  const stop = (e) => e.stopPropagation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Proveedores"
        desc="El mismo padrón que Compras: un proveedor, un CUIT, una cuenta. Acá se ven los que facturan gastos."
        actions={
          <Btn variant="btn-primary" onClick={() => openModal('proveedorForm', {})}>
            + Nuevo proveedor
          </Btn>
        }
      />

      <div className={s.stats}>
        <Stat label="Facturan gastos" value={stats.gastos} />
        <Stat label="Mercadería y gastos" value={stats.ambos} />
        <Stat label="Padrón completo" value={stats.total} />
      </div>

      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre o CUIT…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
          Ver todo el padrón
        </label>
      </div>

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'CUIT' }, { h: 'Condición IVA' }, { h: 'Teléfono' },
          { h: 'Provee' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={verTodos ? 'No hay proveedores.' : 'Ningún proveedor está marcado como de gastos todavía.'}
      >
        {visibles.map((p) => (
          <tr key={p.id} className={s.clickable} onClick={() => openModal('cuentaProveedor', { proveedorId: p.id })}>
            <td><strong>{p.nombre}</strong></td>
            <td className={s.mono}>{p.cuit || <span className={s.muted}>—</span>}</td>
            <td>{(p.condicionIva || '').replace(/_/g, ' ') || '—'}</td>
            <td>{p.telefono || <span className={s.muted}>—</span>}</td>
            <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.proveeMercaderia && <Pill pill="est-recibida" label="Mercadería" />}
              {p.proveeGastos && <Pill pill="est-pendiente" label="Gastos" />}
              {!p.proveeMercaderia && !p.proveeGastos && <span className={s.muted}>Sin clasificar</span>}
            </td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']} onClick={stop}>
                <Btn variant="btn-edit" small onClick={() => openModal('proveedorForm', { proveedorId: p.id })}>
                  Editar
                </Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        Clic en una fila para ver la <strong>cuenta corriente completa</strong>: lo que se le
        compró en mercadería, lo que facturó en gastos y lo que se le pagó.
      </div>
    </div>
  );
}
