import { cx } from '@shared/utils/classNames.js';
import { VentasProvider, useVentas } from '../context/VentasContext.jsx';
import { AvisoVentas } from './AvisoVentas.jsx';
import { ModalHost } from './ModalHost.jsx';
import { s } from './ui.jsx';

function Contenido({ children }) {
  const { loaded, loadError } = useVentas();
  if (!loaded) return <div className={s['empty-state']}>Cargando…</div>;
  if (loadError) return <div className={cx(s.callout, s.warn)}>No se pudo cargar la información desde la API: <strong>{loadError}</strong></div>;
  return (
    <>
      {children}
      <ModalHost />
      <AvisoVentas />
    </>
  );
}

/**
 * UNA SECCIÓN DE VENTAS EN OTRO MÓDULO (25/10/2026): los pedidos y los
 * presupuestos de la tienda viven en Tienda online, pero son de Ventas —
 * clientes, usuarios, configuración y avisos salen de su contexto—. Esto les
 * da ese contexto, sus ventanas y su aviso, sin el menú de Ventas.
 * 7/11/2026: con sus ventanas — sin el ModalHost, tocar una venta de la tienda
 * no abría el detalle («que acá pueda abrir la venta así veo qué compraron»).
 */
export function SeccionVentas({ children }) {
  return (
    <VentasProvider>
      <Contenido>{children}</Contenido>
    </VentasProvider>
  );
}
