/**
 * PEDIDO A LA DISTRIBUIDORA — la pantalla del rol Cafetería.
 * ============================================================================
 * Es la ÚNICA sección que ese rol ve del CRM: armar el pedido contra el
 * catálogo completo (con disponibilidad a la vista, que es lo que coffit no
 * puede mostrar) y seguirle el estado. El pedido no mueve stock ni habla de
 * plata: es demanda. El envío que lo cumple llega después a coffit por su
 * sincronización de siempre.
 *
 * El admin también puede abrir esta pantalla (tiene la sección), pero su lugar
 * de trabajo es la bandeja de Pedidos en Almacén › Cafetería.
 */
import { useCallback, useEffect, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { fmtFecha } from '../domain/format.js';
import { ESTADOS_PEDIDO_CAFE } from '../domain/constants.js';
import { Table, PanelHead, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

export function CafeteriaPedidosPanel() {
  const { store, openModal, toast } = useProductos();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setPedidos(await store.pedidosCafeteria({ limit: 100 })); }
    catch { toast('No se pudieron cargar los pedidos.', 'err'); }
    finally { setCargando(false); }
  }, [store, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const version = store.getVersion?.() ?? 0;
  useEffect(() => { cargar(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const pag = usePaginado(pedidos, 'cafeteria-pedidos', 'todos');

  const filas = pag.visibles.map((p) => {
    const est = ESTADOS_PEDIDO_CAFE[p.estado] || {};
    return (
      <tr key={p.id} className={s.clickable} onClick={() => openModal('pedidoCafeteriaDetalle', { id: p.id })}>
        <td className={s.mono}>{p.codigo}</td>
        <td>{fmtFecha(p.fecha)}</td>
        <td><Pill pill={est.pill} label={est.label || p.estado} /></td>
        <td className={s.num}>{p.renglones}</td>
        <td>{p.envioCodigo ? <span className={s.mono}>{p.envioCodigo}</span> : <span className={s.muted}>—</span>}</td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Pedido a la distribuidora"
        desc="Armá el pedido de mercadería del café y seguile el estado. El detalle final es el del envío que lo cumple."
        actions={(
          <Btn variant="btn-primary" onClick={() => openModal('pedidoCafeteria', {})}>
            + Nuevo pedido
          </Btn>
        )}
      />

      <Table
        cols={[
          { h: 'Código' }, { h: 'Fecha' }, { h: 'Estado' },
          { h: 'Renglones', num: true }, { h: 'Envío' },
        ]}
        empty={cargando ? 'Cargando…' : 'Sin pedidos todavía. "+ Nuevo pedido" arma el primero.'}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        <strong>Pendiente</strong> = la distribuidora todavía no lo tomó (se puede anular).{' '}
        <strong>Armando</strong> = lo están preparando. <strong>Enviado</strong> = salió: el detalle
        real viaja en el envío y coffit lo recibe por la sincronización de siempre.
      </div>
    </div>
  );
}
