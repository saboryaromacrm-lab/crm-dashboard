import { cx } from '@shared/utils/classNames.js';
import { VentasProvider, useVentas } from '../context/VentasContext.jsx';
import { AvisoVentas } from './AvisoVentas.jsx';
import { s } from './ui.jsx';

function Contenido({ children }) {
  const { loaded, loadError } = useVentas();
  if (!loaded) return <div className={s['empty-state']}>Cargando…</div>;
  if (loadError) return <div className={cx(s.callout, s.warn)}>No se pudo cargar la información desde la API: <strong>{loadError}</strong></div>;
  return (
    <>
      {children}
      <AvisoVentas />
    </>
  );
}

/**
 * UNA SECCIÓN DE VENTAS EN OTRO MÓDULO (25/10/2026): los pedidos y los
 * presupuestos de la tienda viven en Tienda online, pero son de Ventas —
 * clientes, usuarios, configuración y avisos salen de su contexto—. Esto les
 * da ese contexto y su aviso, sin el menú de Ventas.
 */
export function SeccionVentas({ children }) {
  return (
    <VentasProvider>
      <Contenido>{children}</Contenido>
    </VentasProvider>
  );
}
