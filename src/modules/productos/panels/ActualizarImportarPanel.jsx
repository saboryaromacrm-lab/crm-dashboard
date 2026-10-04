import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { PanelHead, Btn, s } from '../components/ui.jsx';

/*
 * ACTUALIZAR E IMPORTAR (4/10/2026, pedido del dueño: «se llena de
 * opciones»). Los cinco botones de carga masiva salieron de la cabecera del
 * Catálogo y viven acá, cada uno con su explicación. En el Catálogo quedan
 * solo «Exportar CSV» y «+ Nuevo producto».
 *
 * «Actualizar márgenes» trabajaba sobre lo FILTRADO en el Catálogo: para no
 * perder eso, su tarjeta trae su propio filtro (categoría, marca, proveedor)
 * y dice a cuántos productos alcanza antes de abrir.
 */
function Tarjeta({ titulo, children, boton, onClick, disabled }) {
  return (
    <div className={cx(s.card, s.cardPad)} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className={s['card-title']} style={{ margin: 0 }}>{titulo}</div>
      <div className={s.desc} style={{ margin: 0, flex: 1 }}>{children}</div>
      <div><Btn variant="btn-primary" onClick={onClick} disabled={disabled}>{boton}</Btn></div>
    </div>
  );
}

export function ActualizarImportarPanel() {
  const { store, openModal } = useProductos();
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [proveedorId, setProveedorId] = useState('');

  /* Lo que está en juego (sin archivados), igual que el Catálogo por defecto. */
  const vigentes = useMemo(
    () => store.state.productos.filter((p) => (p.estado || 'activo') !== 'archivado'),
    [store.state.productos],
  );
  const opciones = useMemo(() => {
    const marcas = new Set();
    const categorias = new Set();
    for (const p of vigentes) {
      if (p.marca) marcas.add(p.marca);
      if (p.categoria) categorias.add(p.categoria);
    }
    return { marcas: [...marcas].sort(), categorias: [...categorias].sort() };
  }, [vigentes]);
  const paraMargenes = useMemo(() => {
    const provId = proveedorId ? Number(proveedorId) : null;
    return vigentes.filter((p) => (!categoria || p.categoria === categoria)
      && (!marca || p.marca === marca)
      && (!provId || (p.formatosCompra || []).some((e) => e.proveedorId === provId)));
  }, [vigentes, categoria, marca, proveedorId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Actualizar e importar"
        desc="Las cargas masivas del catálogo, cada una con lo que hace. Todas muestran una vista previa antes de guardar."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--crm-space-4)' }}>
        <Tarjeta titulo="Importar catálogo" boton="Importar catálogo" onClick={() => openModal('importarCatalogo', {})}>
          Alta en cantidad de los productos de un proveedor desde un archivo. Para dar de alta productos nuevos;
          el costo de los que ya existen se actualiza con la factura o con «Actualizar costos».
        </Tarjeta>
        <Tarjeta titulo="Actualizar costos" boton="Actualizar costos" onClick={() => openModal('importarCostos', {})}>
          Los costos desde la lista de precios de un proveedor, o de todos juntos en un solo archivo.
          Muestra qué cambia antes de guardar.
        </Tarjeta>
        <Tarjeta titulo="Actualizar formatos de venta" boton="Actualizar formatos de venta" onClick={() => openModal('importarFormatosVenta', {})}>
          Las listas de precios de cada producto (markup, unidades, mínimos) desde el archivo de formatos:
          de un proveedor o de todos. La guía de qué proveedor falta está en la pestaña «Formatos de venta por proveedores».
        </Tarjeta>
        <Tarjeta titulo="Actualizar categoría y etiquetas" boton="Actualizar categoría y etiquetas" onClick={() => openModal('actualizarClasificacion', {})}>
          Exportá el CSV desde el Catálogo, corregí Categoría, Subcategoría y Etiquetas en la planilla
          y subí ese mismo archivo acá.
        </Tarjeta>
        <div className={cx(s.card, s.cardPad)} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className={s['card-title']} style={{ margin: 0 }}>Actualizar márgenes</div>
          <div className={s.desc} style={{ margin: 0 }}>
            Cambia el markup del formato de venta (del producto y de sus paquetes) de un grupo de productos de una vez.
            Elegí a cuáles:
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <select className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {opciones.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={s['select-inline']} value={marca} onChange={(e) => setMarca(e.target.value)} aria-label="Marca">
              <option value="">Todas las marcas</option>
              {opciones.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className={s['select-inline']} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} aria-label="Proveedor">
              <option value="">Todos los proveedores</option>
              {store.state.proveedores
                .filter((p) => p.proveeMercaderia !== false)
                .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className={s.hint} style={{ margin: 0 }}>
            Alcanza a <strong>{paraMargenes.length}</strong> producto{paraMargenes.length === 1 ? '' : 's'} (sin los archivados).
          </div>
          <div>
            <Btn variant="btn-primary" disabled={!paraMargenes.length} onClick={() => openModal('margenesMasivos', { productos: paraMargenes })}>
              Actualizar márgenes
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
