/**
 * LO DE USO EXCLUSIVO DE COFFIT NO EXISTE PARA SABOR Y AROMA (19/10/2026, pedido del dueño).
 * ============================================================================
 * Un artículo marcado «uso exclusivo de Coffit» en su ficha (`soloCafeteria`,
 * 0089) no aparece en ninguna operación de Sabor y Aroma: Existencias,
 * Movimientos, controles de stock, vencimientos, mermas, incidencias,
 * fraccionamiento, pedido entre sucursales, listas de precios, la caja.
 *
 * Quedan, por decisión del dueño: la compra (es como entra, imputada a Coffit),
 * Compras › Productos (donde se marca y se desmarca), Almacén › Coffit (envíos,
 * pedidos y su stock, que se ajusta desde su Depósito) y la reposición al
 * proveedor (orden de pedido y SU Bajos en stock, adentro de Coffit).
 *
 * Una sola regla para todas las pantallas. La API tiene el mismo candado
 * (crm-api/src/productos/exclusivoCoffit.ts).
 */
export const deSaborYAroma = (p) => !p?.soloCafeteria;
