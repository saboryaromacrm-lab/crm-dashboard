/**
 * UN MODAL DE COMPRAS ABIERTO DESDE OTRA PANTALLA
 * ============================================================================
 * La ficha del producto (desde la consulta rápida) o el detalle de una factura
 * (desde el estado de cuenta del proveedor) viven dentro del módulo de
 * productos y necesitan su contexto: el motor de inventario, los permisos y el
 * manejo de modales. Este componente arma ese contexto alrededor del modal
 * pedido, y lo que se abre es el modal DE VERDAD, no una copia que se vaya
 * separando del original.
 *
 * SE MONTA RECIÉN AL HACER CLIC: el motor baja el catálogo entero, y tenerlo
 * cargado en todas las pantallas para algo que se abre de vez en cuando sería
 * pagar esa carga siempre. Si el usuario ya venía de Compras o Almacén, el
 * motor ya está en memoria y no se vuelve a pedir nada.
 *
 * `preparar(store)` (opcional) trae lo que el modal necesita antes de abrirse,
 * p. ej. una factura que no está entre las últimas cargadas.
 */
import { useEffect, useRef, useState } from 'react';
import { ProductosProvider, useProductos } from '../context/ProductosContext.jsx';
import { ModalHost } from './ModalHost.jsx';
import { ModalShell } from './Modal.jsx';

function Puente({ tipo, props, preparar, onCerrar }) {
  const { store, openModal, modal } = useProductos();
  const [error, setError] = useState('');
  const [seAbrio, setSeAbrio] = useState(false);
  const pedido = useRef(false);

  // Se abre una sola vez, cuando el motor terminó de cargar y lo previo llegó.
  useEffect(() => {
    if (!store.loaded || pedido.current) return;
    pedido.current = true;
    Promise.resolve(preparar?.(store))
      .then(() => openModal(tipo, props))
      .catch((e) => setError(e?.message || 'No se pudo traer el detalle.'));
  }, [store, store.loaded, preparar, openModal, tipo, props]);

  // El modal sabe cerrarse solo; acá solo hay que enterarse para avisar afuera.
  useEffect(() => {
    if (modal) setSeAbrio(true);
    else if (seAbrio) onCerrar();
  }, [modal, seAbrio, onCerrar]);

  /*
   * La espera y el error son de ESTE componente y no del modal, que necesita el
   * dato ya cargado para existir. Sin esto, el clic no haría nada visible
   * durante la primera carga y parecería que el sistema lo ignoró.
   */
  const falla = store.loadError || error;
  if (falla) {
    return (
      <ModalShell title="No se pudo abrir" onClose={onCerrar} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: onCerrar }]}>
        <p>{falla}</p>
        <p>Puede ser un corte momentáneo de conexión. Cerrá y probá de nuevo.</p>
      </ModalShell>
    );
  }
  if (!modal && !seAbrio) {
    return (
      <ModalShell title="Abriendo…" onClose={onCerrar} footer={[{ texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar }]}>
        <p>Buscando el detalle.</p>
      </ModalShell>
    );
  }
  return null;
}

/** `tipo`/`props`: el modal del módulo a abrir (los de `ModalHost`). `onCerrar`: al cerrarse. */
export function ModalDesdeAfuera({ tipo, props, preparar, onCerrar }) {
  return (
    <ProductosProvider>
      <Puente tipo={tipo} props={props} preparar={preparar} onCerrar={onCerrar} />
      <ModalHost />
    </ProductosProvider>
  );
}
