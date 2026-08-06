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
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const panels = useMemo(() => VENTAS_PANELS.filter((p) => can(p.permiso)), [can]);

  const pedido = searchParams.get('panel');
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
