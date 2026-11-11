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
 * El contexto del módulo lo arma `ModalDesdeAfuera`, recién al hacer clic.
 */
import { ModalDesdeAfuera } from '@modules/productos/components/ModalDesdeAfuera.jsx';

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
 * La ficha de un producto, abierta desde fuera del módulo de productos.
 * `prodId` null = no hay nada abierto y no se monta nada.
 */
export function DetalleDesdeConsulta({ prodId, onCerrar }) {
  if (prodId == null) return null;
  return (
    <ModalDesdeAfuera tipo="detalleProducto" props={{ prodId }} onCerrar={onCerrar} />
  );
}
