/**
 * REGLAS DEL PEDIDO ENTRE SUCURSALES
 * ============================================================================
 * Viven acá, sueltas de cualquier pantalla, porque las usan VARIAS: la tabla
 * del pedido, el explorador del catálogo, la preparación en dos listas y el
 * panel de transferencias. Una regla de negocio escrita en dos componentes
 * termina con una de las dos vieja, y en este proyecto eso ya costó caro.
 */

/** Las dos listas en que se parte el trabajo. Mismas claves que usa la API. */
export const LISTAS_PREP = {
  enteros: { titulo: 'Enteros', encargado: 'preparador' },
  granel: { titulo: 'Fraccionados', encargado: 'fraccionador' },
};

/**
 * A qué lista de preparación pertenece un producto (misma regla que la API).
 * Es también el criterio de las dos pestañas con las que se arma el pedido:
 * la vista de la cajera y el trabajo del origen hablan de los mismos grupos.
 */
export const listaDeProducto = (prod) => (prod?.tipo === 'granel' ? 'granel' : 'enteros');

/** Las dos pestañas, en el orden en que las recorren las cajeras. */
export const GRUPOS_PEDIDO = [
  { id: 'enteros', label: 'Prod. Enteros' },
  { id: 'granel', label: 'Prod. a granel' },
];

/**
 * LO QUE EL ORIGEN PUEDE MANDAR, que no es lo mismo que lo que tiene.
 *
 * Regla del dueño: **todo lo que se pide para una sucursal se fracciona del
 * producto madre**. Los paquetes que ya están armados en la Distribuidora son
 * su góndola —se venden ahí— y no viajan. Así que para un granel lo que
 * respalda el pedido es el **granel suelto en kg**, no los paquetes.
 *
 * Mostrar los paquetes era peor que no mostrar nada: "10 paq." al lado de un
 * pedido de 8 daba tranquilidad sobre mercadería que no se iba a mandar.
 */
export const puedeMandar = (store, p, sucId) => {
  if (!sucId || !p) return 0;
  if (p.tipo !== 'granel') return store.suma({ productoId: p.id, sucursalId: sucId, estado: 'disponible' });
  return store.cant(p.id, sucId, null, 'disponible');
};

/**
 * Total disponible en una sucursal. Para granel se convierte a KG equivalentes
 * (suelto + paquetes × tamaño): sumar "45 kg + 2 paquetes" como 47 dice algo;
 * sumarlo crudo no.
 *
 * Es la medida del DESTINO: lo que la sucursal tiene para vender, en cualquier
 * forma. Para el ORIGEN se usa `puedeMandar`, que mide otra cosa a propósito.
 */
export const disponibleTotal = (store, p, sucId) => {
  if (!sucId || !p) return 0;
  if (p.tipo !== 'granel') return store.suma({ productoId: p.id, sucursalId: sucId, estado: 'disponible' });
  return store.state.stock.reduce((a, st) => {
    if (st.productoId !== p.id || st.sucursalId !== sucId || st.estado !== 'disponible') return a;
    const pres = st.presentacionId ? (p.presentaciones || []).find((x) => x.id === st.presentacionId) : null;
    return a + st.cantidad * (pres ? pres.tamKg : 1);
  }, 0);
};
