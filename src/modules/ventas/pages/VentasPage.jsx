import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { VentasProvider } from '../context/VentasContext.jsx';
import { VentasShell } from './VentasShell.jsx';
import { VENTAS_PANELS } from '../config/ventas.config.js';

/**
 * Página del módulo Ventas. El menú interno se arma SOLO con las secciones
 * que el rol tiene asignadas — lo que no está permitido no se muestra.
 *
 * `?panel=<id>` abre el módulo parado en esa sección (si el rol la tiene):
 * lo usa la alerta de pedidos web para aterrizar directo en Órdenes.
 */
export function VentasPage() {
  const { can, canAny } = usePermissions();
  const [searchParams] = useSearchParams();
  // `permiso` puede ser una lista: alcanza con tener cualquiera de las llaves.
  const panels = useMemo(
    () => VENTAS_PANELS.filter((p) => (Array.isArray(p.permiso) ? canAny(p.permiso) : can(p.permiso))),
    [can, canAny],
  );

  // «Formato de venta» dejó de ser sección propia: un link viejo aterriza en
  // Configuración, donde vive como pestaña.
  const pedidoCrudo = searchParams.get('panel');
  const pedido = pedidoCrudo === 'listas' ? 'configuracion' : pedidoCrudo;
  const defaultPanel = panels.some((p) => p.id === pedido) ? pedido : panels[0]?.id;

  return (
    <VentasProvider panels={panels} defaultPanel={defaultPanel}>
      <VentasShell
        title="Ventas"
        subtitle="Punto de venta, clientes, cobranzas y caja"
      />
    </VentasProvider>
  );
}
