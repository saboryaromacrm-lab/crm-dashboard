/** El buscador y la marca de `useFiltroProducto`, para la barra de filtros. */
import { s } from './ui.jsx';

export function FiltroProductoControles({ f, id }) {
  return (
    <>
      <input
        id={`${id}-buscar`} type="search" value={f.q} onChange={(e) => f.setQ(e.target.value)}
        placeholder="Buscar producto, marca o código…" aria-label="Buscar producto"
      />
      <select id={`${id}-marca`} className={s['select-inline']} value={f.marca} onChange={(e) => f.setMarca(e.target.value)} aria-label="Marca">
        <option value="">Todas las marcas</option>
        {f.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </>
  );
}
