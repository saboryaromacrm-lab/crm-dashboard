/**
 * DEL RESULTADO DE LA CONSULTA A LA FICHA DEL PRODUCTO
 * ============================================================================
 * En la consulta rápida (Alt+F3) se busca un artículo y se ve su stock y sus
 * precios. La pregunta que sigue siempre es la misma —"¿y a cuánto lo compro?",
 * "¿qué formatos tiene cargados?"— y hasta ahora había que salir, ir a Compras,
 * buscarlo de nuevo y abrirlo. Ahora se hace clic en la fila y listo.
 *
 * LO QUE SE ABRE ES LA FICHA DE VERDAD, no una copia: el mismo
 * `DetalleProductoModal` de Compras, con sus pestañas de Formato de Compra,
 * Formato de Venta, Evolución de precios y Presentaciones. Duplicar esa
 * pantalla habría significado mantener dos versiones que se van separando sola
 * una de la otra.
 *
 * POR QUÉ HACE FALTA ESTE ARCHIVO. La ficha vive dentro del módulo de
 * productos y necesita su contexto (el motor de inventario, los permisos, el
 * manejo de modales). La consulta rápida, en cambio, se monta en el layout
 * porque se abre desde cualquier pantalla del sistema. Este componente es el
 * puente entre los dos: arma el contexto del módulo alrededor de la ficha,
 * solo en el momento en que alguien hace clic.
 *
 * SE MONTA RECIÉN AL HACER CLIC, y esa es la decisión de diseño central: el
 * motor de inventario baja el catálogo entero, y tenerlo cargado en todas las
 * pantallas del sistema —para una consulta que la mayoría de las veces se abre
 * solo para mirar un stock— sería pagar esa carga siempre para usarla casi
 * nunca. Si el usuario ya venía de Compras o Almacén, el motor ya está en
 * memoria y no se vuelve a pedir nada.
 */
import { useEffect, useRef } from 'react';
import { ProductosProvider, useProductos } from '@modules/productos/context/ProductosContext.jsx';
import { ModalHost } from '@modules/productos/components/ModalHost.jsx';
import { ModalShell } from '@modules/productos/components/Modal.jsx';

/**
 * EL PERMISO QUE HABILITA LA FICHA.
 *
 * Es el mismo que abre Compras › Productos, y tiene que ser el mismo: la ficha
 * muestra costos, márgenes y cuánto se le compra a cada proveedor. Un cajero no
 * tiene esa clave, así que para él la consulta sigue siendo lo que era —stock y
 * precios de venta— y las filas ni siquiera se ofrecen como clicables.
 *
 * Se exporta para que la vista de la consulta pregunte ANTES de pintar la fila
 * como algo en lo que se puede hacer clic: ofrecer algo que después se niega es
 * peor que no ofrecerlo.
 */
export const PERMISO_FICHA = 'compras.productos';

/**
 * Abre la ficha y avisa cuando se cerró.
 *
 * El contexto del módulo maneja los modales con un solo estado: `openModal`
 * pone uno, `closeModal` lo saca, y `ModalHost` dibuja el que esté puesto. Acá
 * se aprovecha esa maquinaria tal cual —la ficha ya sabe cerrarse sola con su
 * propio botón— y lo único que se agrega es enterarse de que se cerró, para
 * que la consulta que quedó abajo se entere también.
 */
function Puente({ prodId, onCerrar }) {
  const { store, openModal, modal } = useProductos();
  const seAbrio = useRef(false);

  useEffect(() => {
    // Mientras el motor no terminó de cargar no hay producto que mostrar: la
    // ficha se abre recién cuando el dato existe.
    if (store.loaded) openModal('detalleProducto', { prodId });
  }, [prodId, store.loaded, openModal]);

  useEffect(() => {
    if (modal) seAbrio.current = true;
    else if (seAbrio.current) onCerrar();
  }, [modal, onCerrar]);

  /*
   * La espera y el error son de ESTE componente y no de la ficha, porque la
   * ficha necesita el producto ya cargado para existir. Sin esto, el clic no
   * haría nada visible durante los segundos que tarda la primera carga y
   * parecería que el sistema lo ignoró.
   */
  if (store.loadError) {
    return (
      <ModalShell title="No se pudo abrir la ficha" onClose={onCerrar} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: onCerrar }]}>
        <p>{store.loadError}</p>
        <p>Puede ser un corte momentáneo de conexión. Cerrá y probá de nuevo.</p>
      </ModalShell>
    );
  }
  if (!store.loaded) {
    return (
      <ModalShell title="Abriendo la ficha…" onClose={onCerrar} footer={[{ texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar }]}>
        <p>Buscando el detalle del producto.</p>
      </ModalShell>
    );
  }
  return null;
}

/**
 * La ficha de un producto, abierta desde fuera del módulo de productos.
 * `prodId` null = no hay nada abierto y no se monta nada.
 */
export function DetalleDesdeConsulta({ prodId, onCerrar }) {
  if (prodId == null) return null;
  return (
    <ProductosProvider>
      <Puente prodId={prodId} onCerrar={onCerrar} />
      <ModalHost />
    </ProductosProvider>
  );
}
