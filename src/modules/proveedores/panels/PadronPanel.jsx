import { useMemo, useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { errorMsg, provApi, MEDIOS_HABITUALES, CONDICIONES_COMPRA } from '../services/proveedores.api.js';
import { Btn, PanelHead, Pill, Table, usePaginado, s } from '../components/ui.jsx';

/**
 * EL PADRÓN — la ficha única del sistema (0068). Los ABM chicos que vivían en
 * Compras y en Gastos se fueron: todo proveedor se administra acá, con su
 * ficha comercial completa.
 *
 * MIGRACIÓN (26/8; acá desde el 27/8, pedido del dueño): esta lista es además
 * el tablero del administrativo que está pasando el catálogo del sistema
 * viejo, proveedor por proveedor — el importador alimenta el PADRÓN, así que
 * el botón y el avance viven con él. La columna Migración muestra el avance
 * ("35 de 64": formatos de compra cargados contra los productos que el
 * proveedor tiene allá) y el tilde manual de "terminé con este" — manual a
 * propósito: el número viejo puede incluir discontinuados que nunca van a
 * migrar; el que sabe si está completo es el que carga.
 */
export function PadronPanel() {
  const { proveedores, openModal, recargar, toast } = useProveedores();
  const [buscar, setBuscar] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  const filas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return proveedores
      .filter((p) => !t || p.nombre.toLowerCase().includes(t) || (p.cuit ?? '').includes(t))
      .filter((p) => !soloPendientes || !p.migracionLista);
  }, [proveedores, buscar, soloPendientes]);

  const eliminar = async (p) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Eliminar a ${p.nombre}? Solo se puede si no tiene historia (facturas, pagos, compromisos).`)) return;
    try {
      await provApi.eliminarProveedor(p.id);
      toast('Proveedor eliminado.', 'ok');
      recargar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  const marcarMigracion = async (p, lista) => {
    try {
      await provApi.marcarMigracion(p.id, lista);
      recargar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  const pendientes = proveedores.filter((p) => !p.migracionLista).length;

  // Paginado de servidor no hace falta: el padrón entero ya viene en memoria.
  // Los filtros van en la clave para volver a la página 1 al cambiarlos.
  const pag = usePaginado(filas, 'padron', `${buscar}|${soloPendientes}`);

  return (
    <div>
      <PanelHead
        title="Proveedores"
        desc={`El padrón único: ${proveedores.length} proveedores con su ficha fiscal y comercial.`}
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => openModal('importarProveedores', {})}>Importar proveedores</Btn>
            <Btn variant="btn-primary" onClick={() => openModal('ficha', {})}>+ Proveedor</Btn>
          </div>
        )}
      />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          type="search" placeholder="Buscar por nombre o CUIT…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ minWidth: 280 }}
        />
        <label className={s.hint} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Solo migración pendiente ({pendientes})
        </label>
      </div>
      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Emite' }, { h: 'Cómo cobra' }, { h: 'Modo de cuenta' },
          { h: 'Clasificación' }, { h: 'Migración' }, { h: 'Acciones' },
        ]}
        empty="Sin resultados."
        pag={pag}
      >
        {pag.visibles.map((p) => {
          const cargados = Number(p.productosCargados) || 0;
          const esperados = Number(p.productosEsperados) || 0;
          const color = p.migracionLista
            ? 'var(--crm-color-success)'
            : cargados === 0 ? 'var(--crm-color-text-muted)' : 'var(--crm-color-warning, #b45309)';
          return (
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
                {/* El avance contra el sistema viejo + el tilde de "terminé". */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={!!p.migracionLista}
                    onChange={(e) => marcarMigracion(p, e.target.checked)}
                  />
                  <span style={{ fontWeight: 600, color }}>
                    {p.migracionLista
                      ? '✓ Completa'
                      : esperados > 0 ? `${cargados} de ${esperados}` : (cargados > 0 ? `${cargados} cargados` : 'Sin empezar')}
                  </span>
                </label>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn small onClick={() => openModal('ficha', { proveedorId: p.id })}>Ficha</Btn>
                  <Btn small onClick={() => eliminar(p)}>×</Btn>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <div className={s.hint}>
        <strong>Migración</strong>: cuántos productos de este proveedor ya tienen su formato de
        compra cargado (en Compras), contra los que tiene en el sistema viejo (columna “Productos
        asociados” de su export). El tilde es manual: lo marca quien carga cuando da el catálogo
        por terminado — el número viejo puede incluir discontinuados que no van a migrar.
      </div>
    </div>
  );
}
