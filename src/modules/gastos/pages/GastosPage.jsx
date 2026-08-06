import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { GastosProvider } from '../context/GastosContext.jsx';
import { GastosShell } from './GastosShell.jsx';
import { GASTOS_PANELS } from '../config/gastos.config.js';

/**
 * Página del módulo Gastos. El menú interno se arma SOLO con las secciones que
 * el rol tiene asignadas — lo que no está permitido no se muestra.
 *
 * `?panel=<id>` abre el módulo parado en esa sección (si el rol la tiene): lo
 * usa el aviso de pagos sin aplicar para aterrizar directo en la bandeja.
 */
export function GastosPage() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const panels = useMemo(() => GASTOS_PANELS.filter((p) => can(p.permiso)), [can]);

  const pedido = searchParams.get('panel');
  const defaultPanel = panels.some((p) => p.id === pedido) ? pedido : panels[0]?.id;

  return (
    <GastosProvider panels={panels} defaultPanel={defaultPanel}>
      <GastosShell
        title="Gastos"
        subtitle="Lo que la empresa paga: comprobantes, vencimientos y pagos a proveedores"
      />
    </GastosProvider>
  );
}
