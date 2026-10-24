import { useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { ModalShell } from '../Modal.jsx';
import { s } from '../ui.jsx';

/**
 * EXPORTAR PRODUCTOS PARA EL ERP MAXI (24/10/2026, pedido del dueño): los
 * productos del filtro —o solo los tildados—, completos, en un archivo para
 * importar en otra instalación del sistema. Lo arma la API (`POST
 * /productos/exportar`, ver exportar.ts); acá se elige si van las fotos y se
 * descarga. Solo el superadmin: el archivo lleva costos y proveedores.
 */
export function ExportarProductosModal({ ids, tildados }) {
  const { closeModal, toast } = useProductos();
  const [fotos, setFotos] = useState(true);
  const [bajando, setBajando] = useState(false);
  const enVuelo = useRef(false);
  const n = ids.length;

  const descargar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setBajando(true);
    try {
      const nombre = await httpClient.descargar('/productos/exportar', 'productos.json', { ids, fotos });
      toast(`Listo: ${n} producto(s) en «${nombre}».`);
      closeModal();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo armar el archivo.', 'err');
    } finally {
      enVuelo.current = false;
      setBajando(false);
    }
  };

  return (
    <ModalShell
      title="Exportar para el ERP Maxi"
      subtitle={`${n} producto(s) ${tildados ? 'tildado(s)' : 'del filtro'}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: bajando ? 'Armando el archivo…' : 'Descargar archivo', clase: 'btn-primary', onClick: descargar, disabled: !n || bajando },
      ]}
    >
      <div className={s.desc}>
        Un archivo con cada producto completo, para importarlo en el ERP Maxi:
      </div>
      <ul className={s.desc} style={{ margin: '0 0 0 18px', display: 'grid', gap: 4 }}>
        <li>La ficha: códigos, marca, categoría, subcategoría, etiquetas, tipo, IVA y el texto del cartel.</li>
        <li>Sus paquetes fraccionados.</li>
        <li>Los formatos de compra (proveedor, bulto, costo, descuentos, flete y comisión) y los datos de esos proveedores.</li>
        <li>Los precios de venta de cada lista, del producto y de sus paquetes.</li>
      </ul>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
        <input id="exportar-fotos" type="checkbox" checked={fotos} onChange={(e) => setFotos(e.target.checked)} />
        Incluir las fotos
      </label>
      <div className={s.hint} style={{ margin: 0 }}>
        Con fotos el archivo pesa bastante más y tarda un poco en armarse. El stock no viaja: el otro negocio arranca con el suyo.
      </div>
      {!tildados && (
        <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
          Van todos los productos que muestra la lista con los filtros puestos. Para llevar solo algunos, tildalos en la lista y volvé a exportar.
        </div>
      )}
    </ModalShell>
  );
}
