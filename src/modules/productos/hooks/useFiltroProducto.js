/**
 * BUSCAR PRODUCTO Y MARCA en las listas del stock (8/10/2026, pedido del dueño):
 * Almacén › Existencias y su pestaña Movimientos. El desplegable de productos
 * solo, con miles de artículos, no servía para encontrar uno; ahora se escribe
 * (nombre, marca o código, sin importar acentos ni mayúsculas) y se acota por
 * marca. El desplegable sigue —es la elección exacta y la que llega desde el
 * botón «Movs.»— pero ofrece solo lo que coincide con la búsqueda y la marca.
 */
import { useMemo, useState } from 'react';
import { norm } from '../components/CatalogoPicker.jsx';

export function useFiltroProducto(store) {
  const [q, setQ] = useState('');
  const [marca, setMarca] = useState('');
  const productos = store.state.productos;

  const marcas = useMemo(
    () => [...new Set(productos.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [productos],
  );

  /** `coincide(productoId, nombre)`: el nombre es el del renglón, por si el producto ya no está en el catálogo. */
  const coincide = useMemo(() => {
    const ql = norm(q);
    const qCod = q.trim();
    if (!ql && !marca) return () => true;
    const porId = new Map(productos.map((p) => [p.id, p]));
    const memo = new Map();
    return (productoId, nombre) => {
      if (memo.has(productoId)) return memo.get(productoId);
      const p = porId.get(productoId);
      const ok = (!marca || p?.marca === marca) && (!ql || (p
        ? norm(p.nombre).includes(ql) || norm(p.marca).includes(ql)
          || (p.codigoPropio || '').includes(qCod) || (p.codigoBarras || '').includes(qCod)
          // El código de un fraccionado: cada tamaño lleva su etiqueta.
          || (p.presentaciones || []).some((pr) => pr.codigoBarras && pr.codigoBarras.includes(qCod))
        : norm(nombre).includes(ql)));
      memo.set(productoId, ok);
      return ok;
    };
  }, [q, marca, productos]);

  return { q, setQ, marca, setMarca, marcas, coincide, clave: `${q}|${marca}` };
}
